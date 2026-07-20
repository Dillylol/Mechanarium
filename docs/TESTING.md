# Testing strategy and current results

## Automated layers

Physics fixtures cover 120 Hz stepping, master/per-body gravity, spring period and energy, rope slack/tension and pendulum period, beam and compound inertia, physical-pendulum period, bounded pin error, exact track-top contact, friction/restitution, collisions, central force, and a 60-second compound-assembly soak.

Domain fixtures cover Scenario v1-to-v2 migration, v2 round trip, invalid beam/port/joint graphs, deterministic default ports, custom-port preservation, preset isolation, world-agent actions, and assembly-aware SI CSV export.

Vector fixtures cover selected-body context, bounded follow-up history, request limits, action/target compatibility, and exact entity/port validation at the server boundary.

Measurement fixtures cover ruler components, exact and reverse-direction gate crossings, interpolated timestamps, finite-aperture misses, body targeting, debounce, paired-gate calculations, seeded uncertainty, additive Scenario v2 instrument round trips, 120 Hz trial acquisition, notebook persistence, and normalized notebook exports. They also prove instruments never enter port or joint graphs.

Wheel fixtures cover v2-to-v3 migration, disk/hoop inertia, ideal and rotating Atwood analytic acceleration, equal and unequal leg tensions, axle reactions, torque balance, no-slip kinematics, friction-limited rolling, overlay controls, Dynamics UI, and force/torque CSV columns.

Testing Library fixtures cover the 3D studio, body gravity overrides, ramp center/angle/length editing, start placement, beam/rope/custom-port construction, all four SHM labs, paused edit locks, time reset after edits, stepping, accessible assembly diagnostics, local v2 saving, and natural-language assembly requests.

The laboratory interface fixture adds a ruler and two gates, arms a trial, drives Run/Pause acquisition, reviews it, and saves it. Agent fixtures require measured values with units, current-step awareness, one evidence question, and an explicit statement when paired readings do not exist.

## Browser acceptance checklist

- Load and Run Inclined Spring Oscillator, Massless-Rope Pendulum, Uniform-Beam Pendulum, and Compound Beam Oscillator.
- Manually add a beam, attachment point, and rope; move a connector endpoint near a highlighted port, verify no connection exists before confirmation, then select **Snap to place**.
- Move one track endpoint near another and verify the target halo, ghost placement, **Keep free**, and confirmed-placement feedback.
- Pick up a sphere near a beam and verify that all foreign ports appear green, carried-part ports appear yellow, the closest pair magnetically aligns, and release produces a named rigid-mount proposal.
- Rotate and resize a ramp/beam with gizmos and verify the body rests on the visible top face.
- Confirm Run hides/locks structural controls, Pause restores them, and the next edit resets time and telemetry.
- Leave the compound assembly running for at least 60 seconds and inspect console, interaction responsiveness, and memory behavior.
- Build an incline experiment, add a ruler and two gates, align them, target a body, and record two trials at different angles.
- Compare plotted measurements, export notebook JSON/CSV, reload, and confirm saved trials persist while instruments have no physical influence.

## Latest quality gate

Run on 2026-07-19:

- lint: passed;
- automated tests: 71 passed across 13 files;
- production build: passed;
- 60-second numerical soak: passed with finite state and bounded energy error.

The existing Three.js bundle-size advisory remains non-blocking. A later performance milestone will split the render bundle and move physics execution behind the established world boundary.
