# Mechanarium Project Groundwork

Status: planning only  
Baseline repository: `C:\Users\dylen\Projects\physicsThing`  
Architectural reference: `ProjectOutline.md`

## 1. Project objective

Build **Mechanarium**, an approachable, accurate, and visually transparent mechanics sandbox for AP Physics 1, AP Physics C: Mechanics, and introductory university physics.

The product should let a student construct or load a physical scenario, run it, see the forces and conserved quantities that govern it, collect data, and receive guided questions that help them reason toward an explanation. It should behave as a laboratory first and a demonstration second.

### Definition of success

A successful first major release will:

- model a deliberately chosen set of mechanics scenarios with documented assumptions;
- produce repeatable results within defined numerical tolerances;
- make forces, energy, momentum, coordinates, units, and constraints visible;
- support direct manipulation without requiring code;
- remain responsive on an ordinary student laptop;
- support keyboard, pointer, touch, reduced-motion, and screen-reader workflows;
- keep educational guidance separate from the authoritative physics calculation;
- be buildable and testable from a clean checkout with documented commands.

## 2. Current baseline

The existing repository is a working rotational-physics prototype built with React 19, Vite, Three.js, and Tailwind CSS. It focuses on rolling bodies, inclines, loops, compound inertia, force/energy displays, and AP Physics C free-response concepts.

Important baseline facts:

- the simulation core is JavaScript in `src/physics/`;
- time stepping currently uses an Euler-style update;
- rendering and application logic run in the browser application;
- the baseline deployment is configured for GitHub Pages under `/physicsThing/`; Mechanarium will use its own deployment path;
- there is not yet a Rust/Wasm workspace, worker pipeline, formal test suite, or environment pin;
- the prototype is valuable reference behavior and should remain runnable during migration.

## 3. Scope boundaries

### Initial product scope

- Kinematics in one and two dimensions
- Newtonian forces and free-body diagrams
- Work, energy, and power
- Momentum and basic collisions
- Rotation and rolling motion
- Springs, pendulums, and simple harmonic motion
- Introductory gravitation and orbital examples
- Scenario presets, basic world construction, telemetry, plots, and data export
- Guided Socratic prompts based on simulation state

### Explicitly deferred

- Relativity, quantum mechanics, fluids, electromagnetism, and thermodynamics
- Production multiplayer or shared real-time laboratories
- Server-authoritative simulation
- General-purpose CAD or arbitrary 3D rigid-body authoring
- Using generated AI output as the source of physical truth
- Premature optimization before correctness and profiling data exist

## 4. Guiding principles

1. **Correctness before speed.** Establish reference equations, fixtures, tolerances, and conservation checks before changing the engine.
2. **Assumptions must be visible.** Surface idealizations such as point mass, rigid body, no drag, or pure rolling.
3. **One source of simulation truth.** UI, plots, and assistant features consume the same structured simulation state.
4. **Units are part of the type contract.** Use SI internally; label every displayed or exported value.
5. **Deterministic by default.** Fixed time steps and seeded randomness make tests and lessons repeatable.
6. **Progressive enhancement.** Keep a functional main-thread fallback until worker/Wasm support is proven.
7. **Accessible interaction parity.** Anything possible by dragging must also be possible through keyboard-accessible controls.
8. **Measure before optimizing.** Set performance budgets, profile representative scenes, and port only demonstrated bottlenecks.

## 5. Proposed system boundaries

### Application layer

Owns routing, lessons, scenario persistence, panels, settings, accessibility state, and orchestration. It must not contain physics formulas.

### Domain and scenario model

Defines bodies, materials, forces, constraints, tracks, initial conditions, units, and scenario serialization. The schema should be versioned from its first persisted release.

### Simulation core

Owns integration, collision/contact rules, force accumulation, constraints, and authoritative telemetry. Begin behind a language-neutral interface so the JavaScript implementation can later be replaced or supplemented by Rust/Wasm.

### Rendering and interaction

Draws world geometry, bodies, vectors, traces, selection state, and manipulation handles. Rendering consumes snapshots; it does not decide physical state.

### Analysis and pedagogy

Produces graphs, conservation budgets, experiment tables, regression candidates, hints, and questions. It may interpret engine state but cannot mutate or override equations silently.

### Persistence and export

Handles scenario files, CSV data, screenshots, and version migrations. No account or cloud dependency is required for the initial release.

## 6. Environment groundwork

No dependency or toolchain migration should begin until the following files and policies are agreed upon.

### Required local tools

- Git
- A project-pinned Node.js release and npm version
- A modern Chromium or Firefox browser for development
- Rust stable, the `wasm32-unknown-unknown` target, and the selected Wasm build tool only when the Wasm phase begins

### Environment files to add during setup

- Node version pin such as `.nvmrc`, `.node-version`, or a `package.json` engine/tool field
- committed npm lockfile
- `.editorconfig`
- normalized line-ending policy through `.gitattributes`
- `.env.example` containing names and safe placeholders only
- documented local configuration rules; no secrets in client code or Git

### Standard commands to establish

| Command | Purpose |
| --- | --- |
| `npm ci` | Reproduce the locked JavaScript environment |
| `npm run dev` | Start the local development server |
| `npm run build` | Produce the deployable static build |
| `npm run preview` | Inspect the production build locally |
| `npm run lint` | Run static code checks |
| `npm test` | Run deterministic unit and component tests |
| `npm run test:e2e` | Run critical browser workflows |
| `npm run check` | Run the complete local quality gate |

The last three commands are planning targets and do not exist in the baseline yet.

### Configuration categories

- build-time public configuration, clearly prefixed and safe to expose;
- local-only developer overrides ignored by Git;
- feature flags for worker, Wasm, experimental renderer, and assistant features;
- physics constants and numerical tolerances in versioned source, not environment variables;
- separate development and production logging levels.

### Cross-origin and hosting constraint

`SharedArrayBuffer` requires cross-origin isolation headers. GitHub Pages may not provide every required header directly, so the worker/Wasm memory design must not assume shared memory until hosting has been tested. A copy-based worker transport is the safe initial path.

## 7. Repository organization target

The exact names can change, but ownership should be obvious:

```text
Mechanarium/
  docs/                 product, architecture, physics, and decision records
  src/
    app/                application shell and orchestration
    domain/             scenario schema, units, and shared contracts
    physics/            current/reference JavaScript engine
    rendering/          scene and overlay rendering
    interaction/        selection and direct manipulation
    analysis/           plots, budgets, and regression
    pedagogy/           hints and Socratic dialogue policy
    workers/            worker protocol and adapters
    components/         reusable interface components
  crates/               future Rust/Wasm workspace
  tests/
    fixtures/           canonical physics scenarios and expected results
    integration/        cross-module checks
    e2e/                browser workflows
```

Avoid a large reorganization before tests cover the current prototype.

## 8. Physics groundwork

### Conventions to decide once

- SI base units internally
- right-handed coordinate system and world-axis directions
- radians internally for all angular values
- force naming using source-on-target two-subscript notation
- sign conventions for torque, curvature, angular velocity, and work
- fixed simulation time step independent of render frame rate
- explicit policies for contact loss, friction transitions, collision restitution, damping, and numerical clamping

### Reference scenarios

Each engine capability needs an analytic or trusted numerical fixture. The first fixture set should include:

- constant-velocity motion;
- constant acceleration and projectile motion;
- block on an incline with and without friction;
- energy-conserving free fall;
- perfectly elastic and inelastic one-dimensional collisions;
- rolling solid cylinder or sphere down an incline;
- minimum-height loop scenario;
- ideal mass-spring oscillator;
- small-angle pendulum;
- circular orbit.

Each fixture records inputs, assumptions, expected outputs, tolerance, and the source equation. Conservation budgets should report error rather than hide it.

### Integrator progression

1. Characterize the current engine with fixtures.
2. Add a fixed-step simulation clock.
3. Implement and compare Symplectic Euler.
4. Add Velocity Verlet where the force model supports it.
5. Choose per-system integrators only if tests justify the complexity.
6. Port stable, profiled kernels to Rust/Wasm behind the same contract.

## 9. UX and accessibility groundwork

The main workspace should eventually contain a world canvas, object/track palette, inspector, telemetry/plots, timeline controls, and guidance panel. Before visual redesign, define these interaction contracts:

- select, move, duplicate, configure, and delete an object;
- create or edit a track and inspect its slope/curvature;
- play, pause, step, reset, and change playback rate;
- enable vectors, labels, traces, and conservation displays;
- inspect the exact value and unit behind any visual indicator;
- complete every core action without a precision pointer gesture;
- announce simulation state changes without overwhelming assistive technology;
- respect reduced motion, contrast, zoom, and text scaling.

Mobile can initially be view-and-adjust rather than full authoring, but that boundary must be explicit.

## 10. Assistant and data-analysis groundwork

The assistant is a teaching interface, not the physics engine.

- All numeric claims should come from structured engine telemetry or verified analysis functions.
- The assistant should ask one useful question at a time and reveal hints progressively.
- It should state applicable assumptions and distinguish observation from inference.
- Student inputs and scenario data should remain local unless a user explicitly invokes a network-backed feature.
- A non-AI path must provide equations, explanations, and experiment prompts.
- Symbolic regression should return candidate relationships with fit metrics and dimensional checks, never present correlation as a physical law.
- Provider choice, credentials, cost limits, privacy policy, and offline behavior remain open decisions.

## 11. Quality and delivery gates

### Required before feature expansion

- clean install and production build from a fresh checkout;
- current baseline behavior captured with smoke tests;
- physics fixture format and initial analytic cases;
- error reporting and debug telemetry strategy;
- supported browser and device matrix;
- accessibility checklist;
- deployment preview independent of production.

### Continuous checks target

- formatting and linting;
- unit tests for domain math and engine behavior;
- component tests for critical controls;
- browser tests for create/run/reset/export workflows;
- numerical regression tests with explicit tolerances;
- production build and bundle-size budget;
- accessibility scan plus manual keyboard review;
- performance benchmark scenes with recorded hardware/browser context.

### Initial performance budgets

Budgets should be confirmed through measurement rather than treated as promises. Candidate targets are a responsive 60 Hz UI, a fixed physics rate appropriate to scenario stiffness, no unbounded per-frame allocations in hot paths, and graceful reduction of visual detail before simulation accuracy is reduced.

## 12. Milestone outline

### Milestone 0 — Baseline and decisions

- reproduce the current app locally;
- capture screenshots and core workflows;
- record tool versions and create the environment pinning plan;
- establish scope, terminology, conventions, and architecture decision records;
- define the first physics fixtures and success metrics.

Exit: another developer can reproduce and describe the prototype and its known limitations.

### Milestone 1 — Correctness foundation

- separate engine contracts from UI code;
- introduce units/conventions and a fixed-step clock;
- add deterministic tests and conservation-error reporting;
- compare the baseline integrator with Symplectic Euler and Velocity Verlet.

Exit: chosen reference scenarios pass documented tolerances.

### Milestone 2 — General mechanics model

- versioned scenario schema;
- generalized bodies, forces, constraints, tracks, and telemetry;
- initial kinematics, forces, energy, momentum, rotation, and oscillation presets.

Exit: scenarios can be serialized, replayed, and analyzed consistently.

### Milestone 3 — Sandbox interaction

- direct manipulation, inspectors, timeline controls, overlays, plots, and export;
- keyboard/touch alternatives and accessibility validation.

Exit: a student can build and run a small experiment without code.

### Milestone 4 — Performance architecture

- benchmark representative scenes;
- introduce a worker protocol and copy-based state snapshots;
- port justified kernels to Rust/Wasm;
- evaluate OffscreenCanvas and shared memory as optional capabilities.

Exit: measured scene budgets are met without correctness regressions.

### Milestone 5 — Guided inquiry

- deterministic lesson prompts and explanations;
- optional Socratic assistant grounded in telemetry;
- experiment tables, regression candidates, and dimensional validation.

Exit: guidance is useful, inspectable, privacy-aware, and never authoritative over the engine.

### Milestone 6 — Release hardening

- browser/device validation, accessibility audit, performance profiling, documentation, deployment, and rollback plan.

Exit: release checklist is complete and a fresh clone can reproduce the published build.

## 13. Decision register

These choices should be made deliberately and recorded in short architecture decision records:

1. Primary audience and the exact curriculum slice for the first release
2. Two-dimensional versus three-dimensional world model
3. Supported object and constraint types for version 1
4. Numerical accuracy tolerances per scenario
5. TypeScript migration timing
6. Test frameworks and browser automation tooling
7. Renderer strategy: retain Three.js, adopt a lower-level renderer, or mix layers
8. Worker transport and hosting requirements
9. Criteria that justify a Rust/Wasm port
10. Scenario file format and migration policy
11. Assistant provider, privacy model, and offline fallback
12. Deployment platform if cross-origin isolation becomes mandatory

## 14. Immediate planning deliverables

Before implementation begins, produce:

- a one-page product brief and first-release scope;
- a baseline inventory with known issues and screenshots;
- an environment specification with pinned versions;
- a glossary of physics and UI terms;
- coordinate, unit, and force-notation conventions;
- the initial analytic fixture catalog;
- a scenario schema sketch;
- one architecture diagram showing module ownership and data flow;
- architecture decision records for the first irreversible choices;
- a prioritized backlog with milestone acceptance criteria.

## 15. Main risks

- **Scope expansion:** the full mechanics curriculum is too broad for one release. Mitigation: select a coherent first laboratory set.
- **Visual plausibility masking bad physics:** attractive output can conceal numerical errors. Mitigation: analytic fixtures and visible error budgets.
- **Early Wasm complexity:** language and memory boundaries can slow iteration. Mitigation: stable contracts and profiling thresholds first.
- **Track/contact instability:** discontinuous curvature creates force spikes. Mitigation: geometry continuity requirements and contact fixtures.
- **UI/engine coupling:** direct component access to formulas makes changes unsafe. Mitigation: explicit domain and engine APIs.
- **AI hallucination:** generated explanations may contradict the model. Mitigation: telemetry grounding, deterministic fallback, and clear uncertainty.
- **Hosting mismatch:** shared memory and worker assumptions may conflict with static hosting. Mitigation: capability detection and transport fallbacks.
- **Accessibility added too late:** canvas-only interaction creates expensive rework. Mitigation: accessible interaction contracts from the start.

---

This document is the practical planning layer. `ProjectOutline.md` remains the broad architectural and research reference; future decisions should narrow it into testable milestones rather than treating every proposed technology as an immediate requirement.
