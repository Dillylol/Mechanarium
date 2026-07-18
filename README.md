# Mechanarium

**Build worlds. Discover the laws that move them.**

Mechanarium is an interactive two-dimensional mechanics laboratory for learning physics through construction, experimentation, measurement, and guided observation.

## MVP capabilities

- Deterministic 120 Hz fixed-step simulation independent of rendering
- Explicit Euler, Symplectic Euler, and Velocity Verlet integration
- Versioned JSON scenarios with validation and round-trip import/export
- Gravity, uniform force, drag, springs, central attraction, ground, inclines, and circle collisions
- Projectile, momentum, rolling, oscillation, and orbital presets
- Direct canvas manipulation plus keyboard-equivalent controls
- Body inspector for mass, size, position, velocity, restitution, and rotation
- Live force vectors, trails, energy plots, momentum, and conservation error
- Local scenario saving, portable scenario JSON, and SI-labelled telemetry CSV
- Responsive interface and accessible tabular body data

## Development

Requires Node.js 24.6.0 or a compatible release meeting the package engine requirement.

```bash
npm install
npm run dev
```

The local application uses the `/Mechanarium/` base path.

## Quality gates

```bash
npm run lint
npm test
npm run test:coverage
npm run build
npm run check
```

The completed Milestones 0–3 have 24 automated tests. See [`docs/TESTING.md`](./docs/TESTING.md) for the tested behaviors and latest results.

## Documentation

- [`ProjectGroundwork.md`](./ProjectGroundwork.md) — objectives, boundaries, milestones, decisions, and risks
- [`ProjectOutline.md`](./ProjectOutline.md) — extended architecture and research roadmap
- [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md) — units and physics conventions
- [`docs/SCENARIO-FORMAT.md`](./docs/SCENARIO-FORMAT.md) — scenario v1 contract
- [`docs/milestones/`](./docs/milestones/) — build/test/report record for each completed milestone
- [`docs/decisions/`](./docs/decisions/) — architecture decision records

## Current boundary

Milestones 0–3 form the MVP. Worker execution, Rust/WebAssembly optimization, AI-assisted inquiry, and release hardening remain future milestones. The earlier `physicsThing` repository is reference material only; all Mechanarium work belongs here.
