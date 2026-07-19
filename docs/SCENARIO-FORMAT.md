# Scenario format v2

Scenario v2 is the portable planar-assembly contract. Deserialization automatically migrates v1 documents before validation.

## Top-level records

- `gravity`: `{ enabled, g, direction }`. `g` is a non-negative magnitude and `direction` is normalized by the solver.
- `bodies`: circles, boxes, and beams. Every body has `gravityEnabled` and `gravityMultiplier`.
- `tracks`: straight solid segments defined by center, angle, length, thickness, friction, restitution, and `startEnd` release marker.
- `ports`: serialized custom attachment points. Deterministic center/cardinal or start/center/end ports are derived from owner geometry.
- `connectors`: massless springs or inextensible tension-only ropes. Each endpoint is either a world position or an exact owner/port reference.
- `joints`: frictionless pins or rigid welds between exact endpoints.
- `forces`: non-uniform generators retained for uniform, drag, and central-force experiments.
- `constraints`: ground planes. Inclines migrate to tracks.
- `instruments`: optional measurement-only rulers and photogates. Missing arrays default to `[]` without a version bump.

## Instruments and notebooks

A ruler stores two distinct world endpoints plus resolution and optional uncertainty settings. A photogate stores a center, angle, finite aperture length, optional target body, resolution, and uncertainty settings. Instruments may align to apparatus geometry, but they never own ports or enter force, collision, connector, or joint graphs.

Scenario JSON preserves placement and configuration only. Recorded observations live in a separate notebook keyed by scenario ID. Notebook JSON contains trial metadata, fixed-step samples, gate events, and derived results; notebook CSV normalizes samples and events into SI columns. Each trial stores its random seed so uncertainty is reproducible.

## Beam policy

Beams have `dynamic`, `pinned`, or `track` mode, plus mass, length, thickness, auto-length, and editable gravity participation. Intrinsic inertia is `mLÂ²/12`; changing length preserves mass and recomputes inertia. Rigid groups expose a calculated assembly inertia using the parallel-axis theorem.

## Validation

Validation rejects unknown modes/types, missing owners or ports, duplicate joints, invalid dimensions, non-finite vectors, and ambiguous endpoint records. Runtime assembly diagnostics additionally block Run for zero-length or self-connected components. Physical outcomes such as sliding or leaving a track do not invalidate a scenario.

All quantities use the SI and coordinate conventions in `docs/CONVENTIONS.md`.
