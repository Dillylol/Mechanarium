# Milestone 0 — Baseline and decisions

Status: complete  
Completed: 2026-07-18

## Delivered

- Reproducible React 19 and Vite application in the Mechanarium repository.
- Node version pin, npm lockfile, editor rules, line-ending policy, lint configuration, and deterministic test runner.
- Product identity, static-hosting base path, baseline accessible application shell, and local development server.
- GitHub Actions quality gate for every pull request and push to `main`.
- Architecture decision record for the web foundation.
- SI units, coordinate system, force notation, engine-authority, and fixed-step conventions.
- Existing `physicsThing` application documented as reference material rather than a runtime dependency.

## Verification

Environment used:

- Node.js 24.6.0
- npm 11.5.1
- Vite 8.1.5
- Vitest 4.1.10

Quality gate on 2026-07-18:

- `npm run lint`: passed
- `npm test`: 1 test passed
- `npm run build`: passed
- local production route `/Mechanarium/`: HTTP 200

## Exit criteria

A fresh checkout has a locked dependency graph and standard `dev`, `lint`, `test`, `build`, and aggregate `check` commands. The application communicates its identity and the project conventions are explicit.

## Known limits

This milestone intentionally contains no simulation. The baseline screen exists only to prove the product environment before physics behavior is introduced.

## Milestone 1 entry condition

The fixed-step clock, simulation contracts, integrators, canonical reference fixtures, and conservation reporting may now be implemented without coupling them to the interface.
