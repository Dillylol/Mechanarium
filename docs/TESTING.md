# Testing strategy and current results

## Layers

### Physics fixtures

Analytic and conservation-based tests cover the fixed-step clock, mass-independent Earth gravity, constant acceleration, harmonic motion, energy/momentum summaries, projectile motion, collision momentum, rolling inertia, spring energy, and orbital bounds.

### Domain contract tests

Scenario tests cover version validation, invalid references, malformed JSON, round-trip serialization, isolated presets, curriculum coverage, and SI-labelled CSV export.

### Interface component tests

Testing Library exercises the three-dimensional studio shell, builder tools, prepared labs, deterministic stepping, continuous Run playback across animation timestamp origins, body-property editing, local save, independent overlays, and natural-language world-building fallback.

### Running-browser validation

The local production-shaped application was exercised in the browser on 2026-07-18:

- application title and `/Mechanarium/` route loaded;
- all five experiment presets were exposed through semantic controls;
- one fixed step changed time from `0.000 s` to `0.008 s`;
- switching to Spring Oscillator reset the selected body correctly;
- adding a second body selected and exposed its inspector;
- editing body mass accepted `2.5 kg`;
- run transitioned to pause and advanced live time from `0.000 s` to `0.533 s`, moving the projectile from `(-6.0, 2.0)` to `(-2.9, 4.4)`;
- pause held simulation time and reset restored the initial state;
- Three.js world, overlay controls, builder rail, agent dock, inspector inputs, telemetry chart, and accessible body table were present;
- no new browser console errors or warnings were recorded after the playback repair.

### Continuous-render stability repair

An extended development run exposed excessive React and graphics-buffer churn culminating in a browser out-of-memory error. The repair limits React telemetry publication to 30 Hz while retaining 120 Hz fixed-step physics, interpolates body meshes on the render loop, reuses trail and spring buffers, avoids reallocating the telemetry canvas, and makes trails opt-in. The full automated gate and production build pass after these changes; a fresh browser reload is required for a tab that already exhausted its rendering context.

## Latest quality gate

Run on 2026-07-18:

- lint: passed
- automated tests: 29 passed across 9 files
- production build: passed
- coverage: 74.34% statements, 63.11% branches, 70.37% functions, 79.82% lines

Coverage is reported for guidance, not used to replace analytic fixture quality. Future milestones should preserve the physics suite and add regression fixtures for each new interaction or force model.
