# Milestone 6 - Experimental measurement and guided inquiry

Status: complete on 2026-07-19.

## Objective

Turn Mechanarium into a virtual mechanics laboratory through one complete flagship workflow: place rulers and photogates, record repeated ramp-motion trials at fixed-step precision, compare evidence, export observations, and receive Socratic guidance grounded in measured values.

## Built

- Additive Scenario v2 `instruments` records with validated ruler and photogate geometry, stable IDs, body targeting, exact resolution, and optional seeded uncertainty.
- Swept center-line photogate detection at the 120 Hz physics boundary with interpolated crossing times, finite apertures, direction, instantaneous velocity, and clear-before-rearm debounce.
- Paired-gate interval, spacing, average-speed, and acceleration results.
- Paused world dragging, numeric editing, delete controls, track alignment, and accessible instrument descriptions. Instruments never create ports, joints, collisions, or forces.
- Explicit Record, Armed, Recording, Review, Save, and Discard states. Trial acquisition is separate from the 30 Hz render history and is bounded by scenario duration.
- A scenario-keyed local notebook that preserves saved trials across apparatus edits and reloads, plus normalized JSON and CSV exports.
- The guided **Measure acceleration with photogates** workflow, configurable comparison plots, live readings, and trial tables.
- Compact agent context containing the current guide step, instrument inventory, and recent trial summaries. Local and OpenAI-backed guidance cites supplied evidence, distinguishes missing readings, and asks one question at a time.
- The pending ramp-beam contact/gravity and movable non-mountable attractor fixes were stabilized before laboratory work began.

## Verification

- 59 automated tests across 11 files.
- Measurement fixtures cover forward/reverse crossings, finite-aperture misses, interpolation, debounce, targeting, paired calculations, seeded uncertainty, serialization, exports, recording lifecycle, and nonphysical graph isolation.
- Interface coverage exercises adding one ruler and two gates, arming, running, pausing, reviewing, and saving a trial.
- `npm run check` passes lint, all tests, and the production build.
- The existing 60-second numerical soak remains finite and bounded; the 120 Hz acquisition path does not publish every sample through React.

## Deferred boundary

SHM timing and force-balance investigations can reuse this notebook and instrument architecture. Curved tracks, continuous splines, Rust/Wasm, and worker migration remain deferred until measured workloads demonstrate a need.
