# Milestone 7 — Curved tracks, Vector previews, and guided tutorials

Completed: 2026-07-20

## Objective

Restore the original prototype's loop investigations without restoring prescribed rail motion, add a general continuous track editor, and make Vector and the learning interface capable of using the new systems safely.

## Delivered

- Scenario v4 with automatic v1/v2/v3 migration and a validated `segment | spline` track union.
- Piecewise quintic Hermite curves sharing position, tangent, and second derivative for C² continuity.
- Deterministic adaptive sampling shared by rendering, selection, contact, ports, placement, alignment, arclength, and curvature telemetry.
- One-sided free-body spline contact, friction-limited wheel rolling, vertical-loop completion/detachment, and re-contact behavior.
- Loop, Hill, Valley, and Blank Spline builder templates with direct knot/tangent handles and exact Inspector controls.
- Loop-the-Loop and Spline Roller Coaster presets, increasing the prepared library to thirteen systems.
- Vector coaster proposals with Apply/Cancel, bounded spline-blueprint validation, offline coaster fallback, and scaffold-then-solve text tutoring.
- Persistent onboarding plus Projectile, Incline, Atwood, and Loop tutorials.
- Track coordinate, curvature, curvature radius, and normal-force telemetry/export.

## Evidence

Fixtures cover quintic boundary conditions, deterministic sampling, Scenario v3 migration/v4 round trips, spline policy validation, straight-spline support, loop completion above the ideal disk threshold, detachment below it, Vector proposal confirmation, tutoring progression, and tutorial persistence. The complete lint/test/build gate passes.

## Remaining boundary

Mechanics remain planar. Moving/compound pulleys, full 3D joints, breakable materials, image problem intake, symbolic regression, worker execution, and Rust/Wasm are deferred. Broad browser, mobile, and screen-reader release audits remain part of Milestone 8.
