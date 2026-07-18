# Milestone 3 — Sandbox interaction

Status: complete  
Completed: 2026-07-18

## Delivered

- Responsive three-region laboratory: experiment library, world workspace, and analysis/inspector rail.
- Five selectable curriculum presets sharing one engine and scenario format.
- Pointer selection and paused drag repositioning in the world canvas.
- Keyboard canvas controls: Space to run/pause, arrow keys to reposition, and Delete to remove.
- Run, pause, fixed-step, reset, add-body, and playback-rate controls.
- Body inspector for name, mass, radius, position, velocity, restitution, and angular speed.
- Grid, force-vector, and selected-body trail overlays.
- Live system energy, conservation error, momentum, energy-history chart, and accessible body table.
- Device-local save, validated JSON import/export, and SI-labelled CSV telemetry export.
- Scenario-specific observation prompts grounded in declared preset lessons.

## Accessibility

- Semantic headings, regions, navigation, status messages, tables, labels, and button names.
- Focus-visible treatment and complete non-pointer access to core simulation and positioning controls.
- Canvas and chart alternatives through descriptive labels, inspector values, metric cards, and the body table.
- Controls that mutate physics are disabled while running.
- Responsive layouts at desktop, compact desktop/tablet, and mobile widths.
- Reduced-motion preference is respected by removing smooth scrolling; simulation remains user-controlled.

## Verification

Automated component workflows cover initial render, preset changes, fixed stepping, telemetry export, body creation, property editing, local saving, and overlay toggling. Physics and scenario suites remain active in the same quality gate.

Running-browser validation covered preset selection, stepping, body creation, inspector editing, run/pause, semantic UI presence, and console health.

Quality gate on 2026-07-18:

- `npm run lint`: passed
- `npm test`: 24 tests passed across 8 files
- `npm run test:coverage`: passed; 74.34% statements and 79.82% lines
- `npm run build`: passed
- production output: 0.67 kB HTML, 9.56 kB CSS, 224.72 kB JavaScript before gzip

## Exit criteria

A student can select, modify, run, pause, step, reset, inspect, save, import, and export a mechanics experiment without writing code. The authoritative engine state drives the canvas, measurements, plot, and accessible table.

## Known limits

- Direct manipulation moves existing bodies; arbitrary force/constraint authoring is not yet exposed as a visual palette.
- Saved local state has a Save action but no dedicated saved-lab browser; JSON export/import is the portable workflow.
- The canvas renderer runs on the main thread; worker/Wasm architecture belongs to Milestone 4.
- Guided prompts are deterministic preset text; adaptive Socratic guidance belongs to Milestone 5.
