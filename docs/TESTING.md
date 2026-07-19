# Testing strategy and current results

## Automated layers

Physics fixtures cover 120 Hz stepping, master/per-body gravity, spring period and energy, rope slack/tension and pendulum period, beam and compound inertia, physical-pendulum period, bounded pin error, exact track-top contact, friction/restitution, collisions, central force, and a 60-second compound-assembly soak.

Domain fixtures cover Scenario v1-to-v2 migration, v2 round trip, invalid beam/port/joint graphs, deterministic default ports, custom-port preservation, preset isolation, world-agent actions, and assembly-aware SI CSV export.

Testing Library fixtures cover the 3D studio, body gravity overrides, ramp center/angle/length editing, start placement, beam/rope/custom-port construction, all four SHM labs, paused edit locks, time reset after edits, stepping, accessible assembly diagnostics, local v2 saving, and natural-language assembly requests.

## Browser acceptance checklist

- Load and Run Inclined Spring Oscillator, Massless-Rope Pendulum, Uniform-Beam Pendulum, and Compound Beam Oscillator.
- Manually add a beam, attachment point, and rope; move a connector endpoint near a highlighted port, verify no connection exists before confirmation, then select **Snap to place**.
- Move one track endpoint near another and verify the target halo, ghost placement, **Keep free**, and confirmed-placement feedback.
- Rotate and resize a ramp/beam with gizmos and verify the body rests on the visible top face.
- Confirm Run hides/locks structural controls, Pause restores them, and the next edit resets time and telemetry.
- Leave the compound assembly running for at least 60 seconds and inspect console, interaction responsiveness, and memory behavior.

## Latest quality gate

Run on 2026-07-19:

- lint: passed;
- automated tests: 43 passed across 9 files;
- production build: passed;
- 60-second numerical soak: passed with finite state and bounded energy error.

The existing Three.js bundle-size advisory remains non-blocking. A later performance milestone will split the render bundle and move physics execution behind the established world boundary.
