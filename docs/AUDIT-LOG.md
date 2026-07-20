# Mechanarium release audit log

## 2026-07-20 — Scenario v4 demo sign-off

**Repository:** `Dillylol/Mechanarium`

**Release branch:** `main`

**Audit timezone:** America/Chicago

**Decision:** Approved for public technical demonstration, subject to the documented release boundaries below.

### Change set reviewed

| Commit | Time (CDT) | Purpose |
| --- | --- | --- |
| `10c4a37` | 2026-07-20 05:56 | Complete Scenario v3 wheel/Atwood systems, routed pulleys, Vector server policy, Luna runtime default, deployment configuration, and submission documentation. |
| `7126e9a` | 2026-07-20 06:22 | Introduce Scenario v4, continuous spline tracks, loop physics, spline editing, Vector proposals/tutoring, guided tutorials, updated exports, and synchronized documentation. |

The pre-release baseline was merge commit `82768cd`, which integrated the original GitHub Pages publication work.

### Implemented state

- Deterministic 120 Hz planar mechanics with approximately 30 Hz UI publication.
- Scenario v4 with automatic v1/v2/v3 migration and validated JSON import/export.
- Thirteen prepared experiments spanning kinematics, momentum, rotation, oscillations, orbits, Atwood systems, loops, and spline-coaster motion.
- Disk and hoop wheels, ideal and rotating pulleys, routed massless ropes, unequal tension, axle reaction, and torque telemetry.
- Piecewise quintic Hermite tracks sharing position, tangent, and second derivative for C² continuity.
- One adaptive curve representation shared by rendering, selection, placement, contact, arclength, curvature, and instrument alignment.
- Free-body vertical-loop behavior, including maintained contact, insufficient-speed detachment, projectile motion, and re-contact.
- Hybrid spline editor with Loop, Hill, Valley, and Blank Spline templates, direct knot/tangent manipulation, exact derivative fields, insertion/deletion, and support-side selection.
- Rulers, photogates, 120 Hz trial acquisition, persistent notebooks, plots, and JSON/CSV export including curved-track measurements.
- Vector local fallback and optional remote-model endpoint, validated Scenario v4 actions, Apply/Cancel proposals for substantial changes, offline coaster generation, and scaffold-then-solve text tutoring.
- Persistent onboarding plus Projectile, Incline, Atwood, and Loop investigations.

### Verification evidence

The release candidate was checked from a clean committed code state using:

```text
git diff --check
npm run check
```

Results recorded on 2026-07-20:

- ESLint: passed.
- Vitest: 87 tests passed across 17 files.
- Production Vite build: passed.
- Numerical coverage includes the 60-second assembly soak, spline boundary continuity, deterministic curve sampling, straight-spline contact, high-speed anti-tunneling substeps, loop completion above threshold, and detachment below threshold.
- Agent coverage includes bounded requests, action validation, spline-blueprint rejection, proposal confirmation, telemetry grounding, and tutoring escalation.
- Tutorial coverage includes registry completeness, current-step context, and local persistence.

The production build reports a non-blocking bundle-size advisory for the Three.js application bundle. No build or test failures remain.

### Documentation audit

- `README.md` describes Scenario v4, thirteen experiments, splines, loops, Vector previews, and tutorials.
- `docs/PROJECT-SUBMISSION.md` matches implemented systems and contains no anecdotal teacher, student, or club endorsement claims.
- `docs/SCENARIO-FORMAT.md` defines the v4 track union, spline contract, runtime-only state, validation, and migration behavior.
- `docs/WORLD-BUILDING.md` documents the hybrid editor, free-body loop behavior, measurement workflow, tutorials, and Vector confirmation boundary.
- `docs/STATUS.md` marks curved tracks and guided learning complete and release hardening in progress.
- `ProjectOutline.md` is explicitly labeled as an aspirational roadmap rather than a description of shipped architecture.

### Release boundaries and deferred work

- Mechanics are planar even though the workspace is visually three-dimensional.
- Springs and ropes are ideal and massless; pulley support is limited to one fixed-center wheel per routed rope.
- Rust/Wasm, Web Workers, OffscreenCanvas, SharedArrayBuffer, symbolic regression, full 3D joints, moving/compound pulleys, breakable materials, and image-based problem intake are deferred.
- Remote open-ended Vector tutoring requires a deployed agent endpoint, a valid server-side API key, and the Pages `VITE_AGENT_API_URL` variable. The deterministic local planner remains available without paid tokens.
- Broad mobile, cross-browser, keyboard-only, and screen-reader audits remain release-hardening work.
- Automated in-app visual inspection of the localhost build was blocked by browser security policy. The manual acceptance checklist is preserved in `docs/TESTING.md` and should be completed on the deployed URL.

### Readiness conclusion

Mechanarium is signed off as feature-complete for its technical demo. The core claim is demonstrable without relying on endorsements: a student can construct a mechanics system, run deterministic physics, observe forces and motion, collect evidence, alter continuous track geometry, and receive structured guidance.

Estimated readiness at sign-off:

- Local technical demonstration: **95%**
- Public hackathon demonstration after Pages deployment: **90–95%**
- Broad classroom production release: **70–75%**

### Publication verification

- The reviewed feature commits and audit were pushed to `origin/main`.
- GitHub Pages workflow [run 29739129782](https://github.com/Dillylol/Mechanarium/actions/runs/29739129782) completed its build and deploy jobs successfully.
- `https://dillylol.github.io/Mechanarium/` returned HTTP 200 with the Mechanarium page title.
- The deployed `index-BNaolyC_.js` production asset returned HTTP 200 and contained the `Spline Roller Coaster` release marker, matching the locally verified build.
- GitHub reported a non-blocking runner advisory for actions that still declare Node.js 20 internally; the workflow forced those actions onto Node.js 24 and completed successfully.

The 2026-07-20 technical-demo release is therefore accepted within the documented boundaries. The remaining manual accessibility, device, and browser matrix is classroom-release hardening rather than a blocker for the public demo.
