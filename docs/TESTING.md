# Testing strategy and current results

## Layers

### Physics fixtures

Analytic and conservation-based tests cover the fixed-step clock, constant acceleration, harmonic motion, energy/momentum summaries, projectile motion, collision momentum, rolling coupling, spring energy, and orbital bounds.

### Domain contract tests

Scenario tests cover version validation, invalid references, malformed JSON, round-trip serialization, isolated presets, curriculum coverage, and SI-labelled CSV export.

### Interface component tests

Testing Library exercises accessible product identity, preset selection, deterministic stepping, data collection/export, body creation, body-property editing, local save, and independent overlay controls.

### Running-browser validation

The local production-shaped application was exercised in the browser on 2026-07-18:

- application title and `/Mechanarium/` route loaded;
- all five experiment presets were exposed through semantic controls;
- one fixed step changed time from `0.000 s` to `0.008 s`;
- switching to Spring Oscillator reset the selected body correctly;
- adding a second body selected and exposed its inspector;
- editing body mass accepted `2.5 kg`;
- run transitioned to pause and advanced live time;
- canvas, overlay controls, inspector inputs, telemetry chart, and accessible body table were present;
- no browser console errors or warnings were recorded.

## Latest quality gate

Run on 2026-07-18:

- lint: passed
- automated tests: 24 passed across 8 files
- production build: passed
- coverage: 74.34% statements, 63.11% branches, 70.37% functions, 79.82% lines

Coverage is reported for guidance, not used to replace analytic fixture quality. Future milestones should preserve the physics suite and add regression fixtures for each new interaction or force model.
