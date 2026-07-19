# Milestone 4 â€” Planar assembly editor and SHM mechanics

Status: complete on 2026-07-19.

## Objective

Replace special-case ramp and spring behavior with a KSP-inspired paused assembly editor and a generalized Scenario v2 mechanics model, while preserving the 120 Hz fixed step and the clean 3D laboratory presentation.

## Built

- Scenario v2 with v1 migration, deterministic/default ports, serialized custom ports, exact endpoint references, validation, and actionable Run diagnostics.
- Master/per-body gravity, spring endpoint forces and torque, slack/tension ropes, rigid/pin constraints, beam inertia, compound inertia, and straight solid track contact.
- Dynamic, pinned, and track beam modes; automatic end pin; edit-time auto-length.
- Ramp/beam center dragging, angle/length gizmos, numeric center/angle/length inspection, start markers, explicit track snap previews, and confirmed release placement.
- Draggable connector endpoints with world anchors and explicit port snap confirmation; previewed port-to-port Rigid/Pin workflow.
- SHM presets for an inclined spring, rope pendulum, uniform-beam physical pendulum, and compound beam oscillator.
- Connector, beam, joint, gravity, kinematics, export, force-vector, and accessible parallel-DOM measurements.
- Scenario v2 actions for the local and OpenAI-backed world agents. Ambiguous connection actions are rejected rather than guessed.

## Physics policy

The renderer and track solver consume the same center/angle/length/thickness geometry. Bodies free-fall until their support shape intersects the actual top face. Contact uses normal restitution and friction impulses; placement snapping never persists as a runtime rail.

Conservative motion uses a kick-drift-kick symplectic path at 120 Hz. Contacts, pins, welds, and rope limits receive iterative impulse and positional correction. Springs and ropes remain ideal and massless.

## Verification

- 45 automated tests across ten files.
- Fixtures cover v1 migration/v2 round trip, deterministic/custom ports, invalid graphs, gravity overrides, spring period/energy, rope slack/tension and period, beam period/inertia, parallel-axis inertia, pin error, track contact/friction/restitution, UI construction/locking, export, and a 60-second compound-assembly soak.
- `npm run check` passes lint, tests, and the production build.
- Browser acceptance covers all four SHM presets, manual construction controls, paused locking, and live simulation.

## Deferred boundary

Full 3D mechanics, breakable/material connectors, slider joints, loops, and spline tracks remain outside this milestone.
