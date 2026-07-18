# ADR 0002: Numerical integration

- Status: accepted
- Date: 2026-07-18

## Decision

Mechanarium advances simulation through a fixed-step clock at 120 Hz by default. Velocity Verlet is the default for position-dependent conservative forces; Symplectic Euler is the fallback for general force and constraint systems. Explicit Euler remains available only as an educational comparison and regression reference.

Long browser frames are capped, step counts are bounded, and discarded time is reported instead of causing an unbounded catch-up loop.

## Consequences

- Rendering frequency cannot change the number or size of physics steps.
- Conservation error is a first-class metric.
- Integrator selection remains explicit in scenario metadata and exports.
