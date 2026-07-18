# Mechanarium

**Build worlds. Discover the laws that move them.**

Mechanarium is an interactive three-dimensional mechanics laboratory for learning physics through construction, experimentation, measurement, and guided observation.

## MVP capabilities

- Deterministic 120 Hz fixed-step simulation independent of rendering
- Explicit Euler, Symplectic Euler, and Velocity Verlet integration
- Versioned JSON scenarios with validation and round-trip import/export
- Gravity, uniform force, drag, springs, central attraction, ground, inclines, and circle collisions
- Projectile, momentum, rolling, oscillation, and orbital presets
- Three.js world with an orbit camera, direct body manipulation, force vectors, tracks, and a monochrome measurement grid
- Left-hand world builder with explicit gravity/ground toggles, editable ramps, springs, orbital attractors, and prepared experiments
- Persistent world-agent dock for natural-language construction and Socratic guidance
- Body inspector for mass, size, position, velocity, restitution, and rotation
- Switchable energy and kinematics measurements with force vectors, optional trails, history plots, momentum, and conservation error
- Local scenario saving, portable scenario JSON, and SI-labelled telemetry CSV
- Responsive interface and accessible tabular body data

## Development

Requires Node.js 24.6.0 or a compatible release meeting the package engine requirement.

```bash
npm install
npm run dev
```

The local application uses the `/Mechanarium/` base path.

### GPT world agent

Copy `.env.example` to `.env`, set the server-side `OPENAI_API_KEY`, and restart `npm run dev`. The key is read only by the local agent server and is never exposed through Vite browser variables. Without a key, the same chat interface uses a deterministic local world-building planner.

## Quality gates

```bash
npm run lint
npm test
npm run test:coverage
npm run build
npm run check
```

The completed foundation and studio redesign have 36 automated tests. See [`docs/TESTING.md`](./docs/TESTING.md) for the tested behaviors and latest results.

## Documentation

- [`ProjectGroundwork.md`](./ProjectGroundwork.md) — objectives, boundaries, milestones, decisions, and risks
- [`ProjectOutline.md`](./ProjectOutline.md) — extended architecture and research roadmap
- [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md) — units and physics conventions
- [`docs/SCENARIO-FORMAT.md`](./docs/SCENARIO-FORMAT.md) — scenario v1 contract
- [`docs/WORLD-BUILDING.md`](./docs/WORLD-BUILDING.md) — forces, surfaces, ramp editing, and manual orbit construction
- [`docs/milestones/`](./docs/milestones/) — build/test/report record for each completed milestone
- [`docs/decisions/`](./docs/decisions/) — architecture decision records

## Current boundary

Milestones 0–3 form the MVP. Worker execution, Rust/WebAssembly optimization, AI-assisted inquiry, and release hardening remain future milestones. The earlier `physicsThing` repository is reference material only; all Mechanarium work belongs here.
