# Mechanarium

**Build worlds. Discover the laws that move them.**

Try the live app at [dillylol.github.io/Mechanarium](https://dillylol.github.io/Mechanarium/).

Mechanarium is an interactive three-dimensional mechanics laboratory for learning physics through construction, experimentation, measurement, and guided observation. Its workspace is visually 3D while its deterministic mechanics remain planar.

## Current capabilities

- Deterministic 120 Hz fixed-step simulation with 30 Hz React publication and interpolated Three.js rendering.
- Scenario v4 JSON with automatic v1/v2/v3 migration, validation, import/export, exact port references, routed pulleys, and topology diagnostics.
- Gravity, central forces, massless springs and ropes, contacts, friction, restitution, pins, rigid welds, beams, and connected assemblies.
- Disk and hoop wheels with friction-limited rolling, axle mounting, ideal or rotating Atwood behavior, and solver-backed force/torque overlays.
- Straight and C²-continuous quintic spline tracks whose rendering and collision contact share one adaptively sampled geometry.
- Free-body loop motion: an object can maintain contact, detach into projectile motion, and re-contact the visible rail.
- Hybrid curve editing with Loop, Hill, Valley, and Blank Spline templates, draggable knots and tangent handles, numeric second-derivative controls, and selectable support side.
- Thirteen prepared experiments, including ideal/massive-pulley Atwood machines, a loop-the-loop, and an editable spline roller coaster.
- Energy, kinematics, force, torque, track-coordinate, curvature, and normal-force telemetry with Scenario JSON and SI CSV export.
- Rulers and photogates with swept 120 Hz crossing detection, reproducible uncertainty, repeated trials, plots, and notebook JSON/CSV.
- A Learn area with onboarding plus guided Projectile, Incline, Atwood, and Loop investigations.
- Local deterministic and optional OpenAI-backed Vector guidance with validated world previews and scaffold-then-solve problem tutoring.

## Development

Requires Node.js 24.6.0 or another release meeting the package engine requirement.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/Mechanarium/`.

For the remote Vector agent, copy `.env.example` to `.env`, set the server-side `OPENAI_API_KEY`, and restart. The key is never exposed through Vite. Without it, Vector uses the deterministic local planner. See [`docs/AGENT-DEPLOYMENT.md`](./docs/AGENT-DEPLOYMENT.md).

## Quality gates

```bash
npm run lint
npm test
npm run test:coverage
npm run build
npm run check
```

The gate covers spline continuity/contact, loop completion and detachment, Scenario migration, Vector proposals, tutorial persistence, and a 60-second numerical assembly soak. See [`docs/TESTING.md`](./docs/TESTING.md) for the latest recorded count.

## Documentation

- [`ProjectGroundwork.md`](./ProjectGroundwork.md) — objectives, boundaries, milestones, decisions, and risks
- [`ProjectOutline.md`](./ProjectOutline.md) — aspirational architecture and research roadmap; deferred items are not current-product claims
- [`docs/SCENARIO-FORMAT.md`](./docs/SCENARIO-FORMAT.md) — Scenario v4 and migration contract
- [`docs/WORLD-BUILDING.md`](./docs/WORLD-BUILDING.md) — assembly, spline editing, ports, connectors, and keyboard workflow
- [`docs/milestones/MILESTONE-7.md`](./docs/milestones/MILESTONE-7.md) — curved-track, Vector-preview, and tutorial milestone report
- [`docs/AUDIT-LOG.md`](./docs/AUDIT-LOG.md) — dated release evidence, change history, limitations, and demo sign-off

## Current boundary

Physics is planar. Springs and ropes are ideal and massless. Straight tracks, quintic spline tracks, vertical loops, and single fixed-center pulleys ship now. Moving/compound pulleys, full 3D joints, breakable materials, image-based problem intake, symbolic regression, and a worker/Rust/Wasm engine remain deferred.
