# Mechanarium

**Build worlds. Discover the laws that move them.**

Try the live app at [dillylol.github.io/Mechanarium](https://dillylol.github.io/Mechanarium/).

Mechanarium is an interactive three-dimensional mechanics laboratory for learning physics through construction, experimentation, measurement, and guided observation. Its workspace is visually 3D while its deterministic mechanics remain planar.

## Current capabilities

- Deterministic 120 Hz fixed-step simulation with 30 Hz React publication and interpolated Three.js rendering.
- Scenario v2 JSON with automatic v1 migration, validation, import/export, exact port references, and topology diagnostics.
- Master and per-object gravity participation, central forces, massless springs, slack/tension ropes, contacts, friction, restitution, pins, and rigid welds.
- Dynamic, pinned, and track beams with `I = mLÂ²/12`, auto-length, and compound inertia through the parallel-axis theorem.
- Straight solid ramps/tracks whose rendered and collision geometry are identicalâ€”no hidden rails or body-specific platforms.
- Paused KSP-inspired assembly editing: direct translation, angle/length gizmos, start ports, explicit snap previews and confirmation, connector handles, custom attachment points, and keyboard controls.
- Nine prepared experiments, including inclined spring, rope pendulum, uniform-beam physical pendulum, and compound beam SHM systems.
- Energy and kinematics telemetry, connector/beam/joint diagnostics, force vectors, trails, accessible tables, Scenario JSON, and SI CSV.
- Nonphysical rulers and photogates with swept 120 Hz crossing detection, finite apertures, body targeting, reproducible uncertainty, and paired-gate calculations.
- A guided ramp-motion laboratory with explicit trial recording, comparison plots, local notebook persistence, and normalized notebook JSON/CSV export.
- Local deterministic and optional OpenAI-backed world agents with Scenario v2 assembly actions.

## Development

Requires Node.js 24.6.0 or a compatible release meeting the package engine requirement.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/Mechanarium/`.

For the GPT world agent, copy `.env.example` to `.env`, set the server-side `OPENAI_API_KEY`, and restart. The key is never exposed through Vite. Without it, the same dock uses the local planner.

## Quality gates

```bash
npm run lint
npm test
npm run test:coverage
npm run build
npm run check
```

The current gate has 59 tests across 11 files, including a 60-second numerical assembly soak. See [`docs/TESTING.md`](./docs/TESTING.md).

## Documentation

- [`ProjectGroundwork.md`](./ProjectGroundwork.md) â€” objectives, boundaries, milestones, decisions, and risks
- [`ProjectOutline.md`](./ProjectOutline.md) â€” extended architecture and research roadmap
- [`docs/SCENARIO-FORMAT.md`](./docs/SCENARIO-FORMAT.md) â€” Scenario v2 and migration contract
- [`docs/WORLD-BUILDING.md`](./docs/WORLD-BUILDING.md) â€” assembly editing, ports, connectors, tracks, and keyboard workflow
- [`docs/milestones/MILESTONE-4.md`](./docs/milestones/MILESTONE-4.md) â€” build/test/report record for this milestone

- [`docs/milestones/MILESTONE-6.md`](./docs/milestones/MILESTONE-6.md) - measurement and guided-inquiry milestone report

## Current boundary

Physics is planar. Springs and ropes are ideal and massless. Straight tracks ship now; full 3D joints, breakable materials, loops, and continuous spline tracks remain later work on the same Scenario v2 port schema.
