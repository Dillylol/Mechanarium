# Milestone 2 — General mechanics model

Status: complete  
Completed: 2026-07-18

## Delivered

- Validated and versioned scenario format with isolated cloning, JSON serialization, and JSON deserialization.
- Generalized circle/box body state including translation, rotation, inertia, restitution, and display metadata.
- Gravity, uniform, quadratic drag, spring, and central-attraction force generators.
- Ground and rolling-incline constraints.
- Pairwise circle collision impulses with overlap correction and restitution.
- World creation, stepping, body updates, scenario export, energy/momentum telemetry, and conservation error.
- Five curriculum presets: projectile motion, momentum exchange, rolling incline, spring oscillator, and orbital motion.

## Verification

Fixtures cover:

- scenario JSON round-trip and validation failures;
- isolated preset copies and curriculum coverage;
- analytic projectile position and velocity after one second;
- total linear momentum across a collision;
- rolling-without-slipping angle and distance coupling;
- bounded undamped spring energy;
- a bound central-force orbit.

Quality gate on 2026-07-18:

- `npm run lint`: passed
- `npm test`: 18 tests passed across 7 files
- `npm run build`: passed

An initial spring fixture crossed through a non-zero-rest-length anchor, creating a direction discontinuity that correctly revealed an unstable test scenario. The preset displacement was reduced so the fixture remains within the intended one-dimensional spring regime.

## Exit criteria

Every preset is a valid, replayable v1 scenario. The same engine contract advances kinematics, force, momentum, rotation, oscillation, and gravity examples, and exported scenarios can be reconstructed without UI state.

## Known limits

- Collisions are circle-to-circle only and do not yet include frictional impulse or continuous collision detection.
- The incline is a pedagogical rolling constraint, not a general rigid-body contact solver.
- Scenario migration is intentionally absent until a version 2 change exists.
