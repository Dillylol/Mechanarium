# ADR 0001: Web application foundation

- Status: accepted
- Date: 2026-07-18

## Decision

Mechanarium begins as a React 19 application built with Vite. Simulation code remains framework-independent JavaScript modules. The first MVP renders a two-dimensional laboratory and uses a fixed-step clock separate from browser rendering.

## Consequences

- The existing physicsThing React/Vite prototype remains a behavior reference rather than a code dependency.
- GitHub Pages remains a compatible static deployment option.
- Rust/Wasm and worker execution stay behind future adapter boundaries and are not prerequisites for the MVP.
