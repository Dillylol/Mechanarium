# Milestone 1 — Correctness foundation

Status: complete  
Completed: 2026-07-18

## Delivered

- Framework-independent vector math and SI constants.
- Deterministic fixed-step simulation clock with frame capping, bounded catch-up, interpolation alpha, reset, and dropped-time reporting.
- Explicit Euler, Symplectic Euler, and Velocity Verlet particle integration.
- Symplectic rotational integration.
- Translational and rotational kinetic energy, gravitational and spring potential energy, linear and angular momentum, and signed conservation error metrics.
- Numerical-integration architecture decision record.

## Reference fixtures

- Constant acceleration verifies the analytic position and velocity solution under Velocity Verlet.
- Harmonic motion runs 2,000 fixed steps and verifies that symplectic methods bound energy error better than Explicit Euler.
- A multi-component energy fixture verifies translation, rotation, potential energy, and momentum totals.
- Clock fixtures verify deterministic step counts and long-frame dropped-time behavior.

## Verification

Quality gate on 2026-07-18:

- `npm run lint`: passed
- `npm test`: 8 tests passed across 4 files
- `npm run build`: passed

One initial clock fixture exposed floating-point remainder loss in overload handling. The implementation now counts complete overflow steps using an epsilon-adjusted floor, and the regression fixture passes.

## Exit criteria

The engine can advance position and rotation independently of React and render timing. Canonical constant-acceleration and oscillator fixtures pass, and conservation drift is measurable rather than hidden.

## Known limits

Milestone 1 integrates isolated particles. Bodies, force generators, collisions, scenario versioning, and serialization belong to Milestone 2.
