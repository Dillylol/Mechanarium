# Mechanarium — Full System Audit
**Date:** 2026-07-21  
**Test result:** ✅ 115 / 115 tests passing (21 files)

---

## 1. Project Overview

Mechanarium is an interactive 3D-rendered, 2D-planar mechanics simulator for AP Physics 1, AP Physics C: Mechanics, and introductory university physics. The tech stack is React 19 + Vite + Three.js frontend with an optional Node.js + OpenAI backend (Vector agent).

**Key architectural pillars:**

| Layer | File(s) | Role |
|---|---|---|
| Physics engine | `src/physics/world.js`, `assembly.js`, `constraints.js`, `forces.js` | Velocity-Verlet 120 Hz integrator, contact, constraints |
| Domain / scenario | `src/domain/scenario.js`, `spline.js`, `presets.js` | Schema v4, track geometry, preset library |
| Simulation hook | `src/hooks/useSimulation.js` | Full app state — run/pause/reverse, undo/redo, history |
| Rendering | `src/components/WorldScene3D.jsx` | Three.js scene, body/track meshes, overlays, selection |
| Data rail | `src/components/DataRail.jsx`, `Inspector.jsx` | Right-panel energy/kinematics/dynamics/lab data |
| Vector agent | `server/agent.mjs`, `agentPolicy.mjs`, `src/assistant/worldAgent.js` | AI world-building + tutoring |

---

## 2. Problems Encountered with Vector (AI Agent)

### 2.1 Springs — Push-Only vs. Attached (Fixed This Session)
**Problem:** Vector had no native way to distinguish a *push-only/unattached spring* (FRQ-style: spring launches block, they separate at rest length) from a *standard attached spring* (SHM). Vector couldn't set `unattached: true` on connectors.

**Fix applied:**
- `createConnector` in `scenario.js` now accepts and stores `unattached` / `attached` fields.
- `applyActions` in `useSimulation.js` reads `action.unattached`, `action.attached`, and `action.connectorMode` and writes `targetConnector.unattached` / `.mode`.
- `agentPolicy.mjs` and `agent.mjs` include the `unattached`, `attached`, `connectorMode` fields in the validated schema.
- Inspector shows an "Attachment" dropdown (Attached / Push-only) for springs.
- **Physics:** `src/physics/assembly.js` spring connector code respects `connector.unattached` — it applies no restoring force once compressed length ≥ rest length (push-only mode).

### 2.2 Momentum Problem Accuracy (Addressed This Session)
**Problem:** User verified the momentum-collision preset and asked whether it was accurate. Initial body positions caused the red ball to visually overshoot its start position during reverse playback.

**Fix applied:**
- Reverse playback speed was synchronized to match the forward play rate by dividing `UI_PUBLISH_INTERVAL_MS` by the `speed` multiplier.
- `worldSnapshotsRef` is now popped frame-by-frame at the correct pace, so reverse looks like slow-motion replay rather than a fast jump.

### 2.3 Object Starting Position Accuracy
**Problem:** After loading a spring-launch or momentum-collision preset, the red ball appeared to start slightly ahead of (or behind) the visually expected starting position.

**Root cause:** Body positions in presets use `createBody` which offsets by `body.radius` above the track surface. For the spring launch, the flat horizontal floor and the ramp start knot were misaligned.

**Fix applied:**
- `spring-ramp-launch` preset recalculated body start position using `splinePointAtDistance(track, 0)` plus `point.normal * radius` to guarantee flush contact with the track's first knot.

### 2.4 Deselect All When Clicking Blank Space (Fixed This Session)
**Problem:** Clicking on blank canvas/grid did not clear the selected object. The inspector kept showing the previously selected entity. If `selectedId` was set to a now-deleted entity's id after clicking blank space, `selectedBody` would be non-null but the body wouldn't exist, causing potential null-dereference.

**Fix applied:**
- `WorldScene3D.jsx` pointer-down handler now calls `onSelect(null)` when no body/track/connector/instrument is found at the click position.
- `useSimulation.js` `selectedBody` and `selectedEntity` memos guard against null `selectedId` — they return `null` rather than falling back to `world.bodies[0]`.
- `DataRail.jsx` uses `const activeBody = selectedBody ?? world.bodies[0]` — data panels still show the first body when nothing is selected, but the inspector correctly shows "No object selected".

### 2.5 Double-Loop Preset Removed; Spring Launch Ramp Added (This Session)
**Problem:** The user wanted to remove the "Push Spring Launch (FRQ Question 3)" preset and the "Double Loop the Loop" preset, replacing them with a cleaner "Spring Launch Ramp" that does not carry any FRQ label.

**Fix applied:**
- `presets.js`: `spring-launch-friction` (with FRQ label) and `double-loop-the-loop` entries removed. New `spring-ramp-launch` preset added with `name: 'Spring Launch Ramp'`, clean description, push-only spring (k=800 N/m), spline track (flat→ramp), two rulers for height and compression measurement, no `gravity` type force (uses world gravity object instead).
- `agentPolicy.mjs`: `ACTION_TARGETS` list and `targetsByAction` map updated to reference `spring-ramp-launch`.
- `agent.mjs` instructions: `load_preset` target list updated.
- `worldAgent.js`: Local FRQ routing changed to target `spring-ramp-launch`. `PRESET_ALIASES` and loop handler cleaned up.
- `agentPolicy.test.js`: Test updated to use new preset id.

### 2.6 Block Shape Changed to Circle (This Session)
**Problem:** The user wanted the spring-launch body to look like a circle/sphere rather than a box block.

**Fix applied:**
- `spring-ramp-launch` body uses `shape: 'circle'`, `name: 'Sphere (2.0 kg)'` — renders as a circle in Three.js.

---

## 3. Known Issues Found During Audit

### 3.1 `worldToScenario` Does Not Serialize `events` — **BUG**
**Location:** [`src/physics/world.js` line 234–275](file:///c:/Users/dylen/Projects/OpenaiProject/src/physics/world.js#L234-L275)

`worldToScenario` converts the running world back to a saveable scenario. It serializes bodies, tracks, connectors, forces, joints, railJoins, instruments, ports, and constraints — but it **does not include `events`**.

**Impact:** If a user loads the projectile-motion preset (which has an explosion event via Vector), saves the world locally or exports the scenario JSON, then re-imports it, the explosion event is silently dropped. The `events` array in the world is cleared on re-import.

**Fix required:**
```diff
// worldToScenario in world.js
+   events: cloneScenario(world.events ?? []).map((event) => {
+     const serialized = { ...event }
+     delete serialized.triggered   // reset to false on reload
+     return serialized
+   }),
```

### 3.2 `_initialVelocity` Never Set on Bodies — **BUG (Silent)**
**Location:** [`src/hooks/useSimulation.js` line 113](file:///c:/Users/dylen/Projects/OpenaiProject/src/hooks/useSimulation.js#L113) and [`DataRail.jsx` lines 16–17](file:///c:/Users/dylen/Projects/OpenaiProject/src/components/DataRail.jsx#L16-L17)

Both `useSimulation.sampleWorld` and `DataRail.DynamicsPanel` check `body._initialVelocity` to compute impulse `J = m·Δv`. However, `_initialVelocity` is never actually written onto bodies anywhere in the physics pipeline (`world.js`, `constraints.js`, `assembly.js`, `forces.js`) — there is no code that sets it.

**Impact:** Impulse display always shows `0.00 N·s`, even during and after a collision. The impulse column in telemetry CSV export is always zero. This is an incomplete feature.

**Fix required:** Set `body._initialVelocity = { ...body.velocity }` in `createWorld` (or in `applyScenarioStateInternal` after world creation) so the impulse meter tracks change from initial conditions. Or remove the field check if impulse tracking via initial velocity is not the intended design.

### 3.3 Dead Code — `doubleLoopTrack` / `doubleLoopPosition` — **MINOR**
**Location:** [`src/domain/presets.js` lines 48–53](file:///c:/Users/dylen/Projects/OpenaiProject/src/domain/presets.js#L48-L53)

```js
const doubleLoopTrack = createSplineTrack({ id: 'double-loop-track', … })
const doubleLoopRelease = splinePointAtDistance(doubleLoopTrack, 0)
const doubleLoopPosition = { … }
```

These three constants are evaluated at module-load time but no preset in the array uses them. The `double-loop-the-loop` preset was removed this session, but these constants were not cleaned up.

**Impact:** Minor memory cost at startup; `sampleSpline` is called unnecessarily for a track that never appears. ESLint may flag `doubleLoopRelease` and `doubleLoopPosition` as unused variables (no-unused-vars).

**Fix required:** Remove those three lines from `presets.js`.

### 3.4 README Preset Count Is Stale — **DOCUMENTATION BUG**
**Location:** [`README.md` line 18](file:///c:/Users/dylen/Projects/OpenaiProject/README.md#L18)

> "Thirteen prepared experiments, including ideal/massive-pulley Atwood machines, a loop-the-loop, and an editable spline roller coaster."

Current preset count: **14** (`projectile-motion`, `momentum-collision`, `rolling-incline`, `spring-oscillator`, `orbital-motion`, `inclined-spring-oscillator`, `spring-ramp-launch`, `rope-pendulum`, `physical-pendulum`, `compound-pendulum`, `ideal-atwood`, `rotating-atwood`, `loop-the-loop`, `spline-roller-coaster`).

**Fix required:** Update README.md line 18 to say "Fourteen prepared experiments".

### 3.5 `momentum-collision` Preset Uses `gravity.enabled: false` Implicitly — **PHYSICS CLARITY**
**Location:** [`src/domain/presets.js` lines 67–80](file:///c:/Users/dylen/Projects/OpenaiProject/src/domain/presets.js#L67-L80)

The `momentum-collision` preset has no `gravity` field and no `forces` array — it relies on `normalizeV4` defaulting `gravity.enabled` to `false`. Both carts float freely. This is physically correct for a 1D collision lab on a frictionless surface, but the lack of a ground constraint means bodies can drift vertically if any perturbation is introduced (e.g., after Vector applies a body position change via `update_body`).

**Recommendation:** Add an explicit `gravity: { g: 9.80665, direction: { x: 0, y: -1 }, enabled: false }` field and consider adding a frictionless floor constraint (`restitution: 0, friction: 0`) to prevent drift without affecting horizontal momentum.

### 3.6 `spring-oscillator` Uses Legacy `force.type: 'spring'` Not a Connector — **PHYSICS DISCREPANCY**
**Location:** [`src/domain/presets.js` line 107](file:///c:/Users/dylen/Projects/OpenaiProject/src/domain/presets.js#L107)

```js
forces: [{ id: 'spring', type: 'spring', bodyId: 'spring-mass', anchor: { x: 0, y: 0 }, stiffness: 5, restLength: 1.4, damping: 0 }],
```

This uses the legacy `force.type === 'spring'` path (handled in `forces.js:forceOnBody`). All other spring presets use the `connector type='spring'` approach with full endpoint resolution, tension telemetry, and elastic energy tracking.

**Impact:** The spring oscillator cannot show spring tension in the Inspector or elastic potential energy in the connector table. It also cannot be made push-only. The spring is visually rendered differently (no connector geometry).

**Recommendation:** Migrate `spring-oscillator` to use `createConnector('spring', …)` with one endpoint world-anchored at `{ x: 0, y: 0 }` and the other attached to the mass's center port, matching the `inclined-spring-oscillator` pattern.

### 3.7 Agent Tool Schema — `events` Object Has All Fields `required`, But `id` and `time` Are Often Null — **SCHEMA STRICTNESS**
**Location:** [`server/agent.mjs` line 116](file:///c:/Users/dylen/Projects/OpenaiProject/server/agent.mjs#L116)

```js
required: ['id', 'trigger', 'time', 'type', 'targetId', 'ratio', 'impulseX'],
```

The event object schema requires all seven fields, including `id` (which can be null) and `time` (only needed for `trigger: 'time'` events). Requiring `time` even for `trigger: 'apex'` events makes OpenAI's strict mode require the model to output `"time": null` even when irrelevant, which adds noise and risks a schema rejection if the model omits it.

**Recommendation:** Make `time` optional in the schema (move out of `required`) or make it a conditional requirement.

---

## 4. Verified Correct Systems

| System | Status | Notes |
|---|---|---|
| Velocity-Verlet integrator with substeps | ✅ Correct | Up to 8 substeps based on max speed / min feature size |
| Quintic Hermite spline (C² continuity) | ✅ Correct | `sampleSpline` adaptively samples; curvature, tangent, normal all derived |
| Free-body loop contact / detachment | ✅ Correct | Contact lost when normal force < 0; projectile-then-re-contact logic in `constraints.js` |
| Push-only (unattached) spring physics | ✅ Correct | `connector.unattached = true` → force clamps to zero once body separates |
| Routed pulley rope tension split | ✅ Correct | Wheel torque from T_B − T_A, correct for both ideal (fixed) and rotating pulleys |
| Ideal rail energy conservation | ✅ Correct | `idealRailCorrection` re-derives speed from conserved mechanical energy at each step |
| Undo/redo (scenario snapshot stack) | ✅ Correct | 50-step history, both snapshot on change and restore on undo |
| Reverse playback | ✅ Correct (Fixed) | Now matches forward play speed, popping one snapshot per publish interval |
| Blank-space deselect | ✅ Correct (Fixed) | `onSelect(null)` → `selectedBody = null` → Inspector shows placeholder |
| Scenario v4 migration (v1/v2/v3→v4) | ✅ Correct | `migrateScenario` in `scenario.js` |
| Test suite | ✅ 115/115 passing | 21 test files, including 60-second assembly soak |
| CORS + rate limiting in agent server | ✅ Correct | 20 req/min per IP, origin whitelist, 60s timeout |
| Spring push-only in Inspector dropdown | ✅ Correct | "Push-only / Unattached" option sets `connector.unattached` |

---

## 5. Summary of Required Fixes (Priority Order)

| # | Priority | File | Issue |
|---|---|---|---|
| 1 | 🔴 High | `src/physics/world.js` | `worldToScenario` drops `events` array — events lost on save/export/reset |
| 2 | 🟠 Medium | `src/hooks/useSimulation.js`, physics pipeline | `_initialVelocity` never set — impulse display always zero |
| 3 | 🟡 Low | `src/domain/presets.js` | Dead code: `doubleLoopTrack`, `doubleLoopRelease`, `doubleLoopPosition` — remove |
| 4 | 🟡 Low | `README.md` | Preset count says "thirteen" but there are fourteen |
| 5 | 🟢 Cosmetic | `src/domain/presets.js` | `momentum-collision` should have explicit gravity + floor to prevent drift |
| 6 | 🟢 Cosmetic | `src/domain/presets.js` | `spring-oscillator` uses legacy force type instead of connector — no tension telemetry |
| 7 | 🟢 Cosmetic | `server/agent.mjs` | Event schema: `time` should not be `required` for apex-trigger events |
