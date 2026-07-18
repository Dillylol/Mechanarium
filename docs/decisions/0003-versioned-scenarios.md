# ADR 0003: Versioned local scenario documents

- Status: accepted
- Date: 2026-07-18

## Decision

Saved experiments use a versioned JSON scenario document. Version 1 contains only declarative bodies, forces, constraints, numerical policy, bounds, and educational metadata. Runtime time, trails, measured values, and UI state are not persisted as physics inputs.

## Consequences

- A scenario can be validated, cloned, replayed, exported, and imported without React.
- Presets and user-authored experiments share the same contract.
- Future structural changes require an explicit version migration rather than silent interpretation.
