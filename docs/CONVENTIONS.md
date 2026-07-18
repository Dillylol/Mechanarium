# Mechanarium conventions

- SI units are authoritative: metres, kilograms, seconds, radians, newtons, joules, and watts.
- The world uses a right-handed 2D coordinate plane with positive x right and positive y up.
- Angles are radians internally and degrees only at user-facing input boundaries.
- Simulation time advances in deterministic fixed increments independent of render frame rate.
- Forces use source-on-target labels such as `F Earth→body` in the interface.
- Numeric clamping and contact assumptions must be surfaced in telemetry or scenario notes.
- The physics engine is authoritative; interface and teaching layers only consume engine state.
