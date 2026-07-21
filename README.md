# **Mechanarium**

*An Interactive 3D Sandbox & Virtual Laboratory for Classical Mechanics*

> **Build it. Test it. Discover the physics.**

Try the live web app at [dillylol.github.io/Mechanarium](https://dillylol.github.io/Mechanarium/).

---

## **Overview**

Mechanarium is an interactive mechanics sandbox and virtual laboratory engineered for AP Physics 1, AP Physics C: Mechanics, and introductory university physics courses. The workspace presents a visually three-dimensional environment rendered in Three.js, while maintaining a deterministic 2D planar physics loop.

Students can construct and investigate projectiles, collisions, inclined ramps, spring-mass systems, ropes, pendulums, uniform rotating beams, compound assemblies, Atwood machines, central-force orbits, and vertical loop-the-loops. 13 prepared experiments provide instant starting points, while the builder supports custom bodies, straight tracks, $C^2$ quintic Hermite spline tracks, attachment ports, pin/rigid joints, and massless spring/rope connectors.

---



## **Quick Start & Setup Instructions**



### Prerequisites

- **Node.js**: Requires Node.js 18+, 20+, or 24.6.0+
- **npm**: Package manager (included with Node.js)



### Installation & Development Server

```bash
# Clone the repository
git clone https://github.com/Dillylol/Mechanarium.git
cd Mechanarium

# Install dependencies
npm install

# Start the local Vite development server
npm run dev
```

Open your browser to `http://127.0.0.1:5173/Mechanarium/` (or the local URL printed by Vite).

### Production Build & Static Deployment

```bash
# Build production bundle to dist/
npm run build

# Preview production build locally
npm run preview
```



### Remote Vector AI Configuration (`.env`)

To enable the remote OpenAI-backed Vector AI Socratic Agent:

1. Copy `.env.example` to `.env`:
  ```bash
   cp .env.example .env
  ```
2. Add your server-side API key in `.env`:
  ```env
   OPENAI_API_KEY=your_actual_openai_api_key_here
  ```
3. Restart the dev server (`npm run dev`).

> **Note**: The API key is managed securely server-side and never exposed to the client bundle. If no key is set, Vector seamlessly operates using its deterministic local planner.

---



## **Quality Gate & Testing**

Mechanarium maintains a 100% passing automated test suite across 21 test files and 115 unit/integration tests:

```bash
# Run the full test suite via Vitest
npm test

# Run tests in watch mode
npx vitest

# Generate coverage report
npm run test:coverage

# Run ESLint check
npm run lint

# Comprehensive release check (lint + test + build)
npm run check
```

The test gate verifies:

- Symplectic velocity Verlet integration accuracy and energy conservation.
- $C^2$ Hermite spline continuity, curvature, and normal-force detachment thresholds.
- Collision manifold generation and contact torque damping.
- Multi-body joint constraints and Atwood pulley dynamics.
- Scenario v4 migration from legacy schemas.
- Vector AI proposal validation and safety policies.
- 60-second numerical assembly soak test.

---



## **Sample Data & File Formats**

Mechanarium includes full sample datasets and standardized file formats for collaborative lab work:

### 1. Scenario v4 JSON (`.mechanarium.json`)

Pre-packaged scenario files define complete physical initial conditions (bodies, tracks, connectors, joints, forces, instruments, and boundaries). Sample scenarios include:

- `spring-ramp-launch.mechanarium2.json` — Block compressed against an unattached spring on a frictionless surface launching up a curved ramp.
- `projectile-motion`, `momentum-collision`, `rolling-incline`, `spring-oscillator`, `orbital-motion`, `ideal-atwood`, `rotating-atwood`, `loop-the-loop`, and `spline-roller-coaster`.



### 2. Telemetry SI CSV Data Export (`-telemetry.csv`)

Recorded telemetry exports complete SI physical measurements at 120 Hz:

- `time` ($\text{s}$), `position_x` ($\text{m}$), `position_y` ($\text{m}$), `velocity_x` ($\text{m/s}$), `velocity_y` ($\text{m/s}$), `acceleration_x` ($\text{m/s}^2$), `acceleration_y` ($\text{m/s}^2$), `angle` ($\text{rad}$), `angularVelocity` ($\text{rad/s}$), `kineticEnergy` ($\text{J}$), `potentialEnergy` ($\text{J}$), `totalEnergy` ($\text{J}$), `netForce` ($\text{N}$), `netTorque` ($\text{N}\cdot\text{m}$).



### 3. Trial Notebook JSON & CSV (`-notebook.json`, `-notebook.csv`)

Saved laboratory trial notebooks store experimental parameters across comparative runs (e.g., varying mass or spring stiffness) for guided hypothesis verification.

---



## **AI Collaboration & Tooling (Codex & GPT-5.6)**

Mechanarium was developed in active pair-programming collaboration with OpenAI models throughout its lifecycle:

### 1. Development Collaboration (Codex & GPT-5.6 Sol)

- **Codex & GPT-5.6 Sol** served as primary development collaborators during codebase construction.
- Assisted in deriving the 120 Hz velocity Verlet solver equations, implementing $C^2$ quintic Hermite spline curvature algorithms ($\kappa$), formulating contact torque friction equations, architecting React state management, and writing the 115-test Vitest suite.



### 2. Runtime Agent Engine (GPT-5.6 Luna)

- **GPT-5.6 Luna** powers the remote Vector AI Assistant runtime (`server/agent.mjs`).
- Vector handles natural-language scenario construction, parses physics problem diagrams from uploaded images, previews structural changes before application, and provides Socratic guidance to students.



### 3. Deterministic Local Planner Fallback

- When running offline or without server-side API keys, Vector utilizes a deterministic rule-based planner (`src/assistant/worldAgent.js`), providing consistent world editing and tutoring capabilities without external dependencies.

---



## **Documentation Sitemap**

- [docs/PROJECT-SUBMISSION.md](./docs/PROJECT-SUBMISSION.md) — Comprehensive hackathon submission document, physical solver breakdown, beam physics breakthrough, and reflection.
- [docs/vector_failure_analysis.md](./docs/vector_failure_analysis.md) — Technical investigation into generative LLM spline synthesis vs. procedural feature compilers.
- [docs/SCENARIO-FORMAT.md](./docs/SCENARIO-FORMAT.md) — Scenario v4 schema specification and migration pipeline.
- [docs/WORLD-BUILDING.md](./docs/WORLD-BUILDING.md) — Guide to constructing assemblies, joint constraints, splines, and photogates.
- [docs/TESTING.md](./docs/TESTING.md) — Verification suite report and numerical soak test specifications.
- [docs/AGENT-DEPLOYMENT.md](./docs/AGENT-DEPLOYMENT.md) — Configuration and deployment guide for the Vector AI server.
- [docs/AUDIT-LOG.md](./docs/AUDIT-LOG.md) — Dated release logs, solver boundaries, and feature history.
- [demo/DEMO-SCRIPT.md](./demo/DEMO-SCRIPT.md) — Hackathon video walkthrough script (Lab 14 spline roller coaster + Vector).
- [demo/DEMO-PLAN.md](./demo/DEMO-PLAN.md) — Demo flow planning notes and timing targets.



Certified Dylen Vasquez Design.