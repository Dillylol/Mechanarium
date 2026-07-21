# **Mechanarium**

*An Interactive 3D Sandbox & Virtual Laboratory for Classical Mechanics*

> **Build it. Test it. Discover the physics.**

---

## **Inspiration**

While studying AP Physics C: Mechanics, I often struggled to connect abstract differential equations with the physical motion they described, particularly in highly conceptual units like rotational dynamics and multi-body constraints. Near the end of the school year, my physics teacher assigned our class a culminating group project. Recognizing my difficulty with purely abstract textbook problems, he suggested connecting physics to my strength: programming. He asked me to code a physics simulator for rotational mechanics to demonstrate theoretical equations in live action.

That project became the foundation of what is now **Mechanarium**. Expanding far beyond that initial prototype, Mechanarium addresses a fundamental question in STEM education: *What if students could visually construct complex physical apparatuses, observe their motion in real time, record precision laboratory measurements, and discover core physical principles directly from data?*

---

## **What It Does**

Mechanarium is an interactive mechanics sandbox and virtual laboratory engineered for AP Physics 1, AP Physics C: Mechanics, and introductory university physics courses. The workspace presents a rich three-dimensional environment powered by Three.js, while maintaining a deterministic 2D planar physics simulation loop.

### Workspace Capabilities & Laboratory Suite

- **Comprehensive Systems**: Construct and analyze projectiles, elastic/inelastic collisions, inclined ramps, spring-mass systems, taut/slack ropes, simple and physical pendulums, uniform rotating beams, compound assemblies, ideal and rotating Atwood machines, central-force orbits, and vertical loop-the-loops.
- **13 Prepared Experiments**: Built-in curriculum-aligned starting points ranging from basic kinematics to compound rotational harmonic oscillators.
- **Custom Construction**: Includes straight tracks, $C^2$ quintic Hermite spline tracks, customizable attachment ports, pin and rigid joints, and massless spring or rope connectors.
- **Measurement Instrumentation**: Nonphysical rulers and photogates measure position, velocity, and timing intervals without introducing mechanical drag.
- **Telemetry & Data Export**: Live force vector rendering (net force $\vec{F}_{\text{net}}$, gravity $\vec{F}_g$, normal force $\vec{N}$, tension $\vec{T}$, friction $\vec{f}_s/\vec{f}_k$, axle reaction $\vec{R}$, and torque $\vec{\tau}$), energy/kinematics/dynamics charts, $120\text{ Hz}$ trial recording, and multi-trial notebook management with CSV and JSON data export.
- **Socratic AI Agent (Vector)**: Natural-language world building, automated problem parsing from uploaded images, change previews for complex assemblies, and Socratic guidance that distinguishes empirical observations from theoretical inferences. Vector operates via remote LLM (`gpt-5.6-luna`) when configured, with seamless fallback to a deterministic local planner.

---

## **How We Built It**

Mechanarium was developed using JavaScript, React 18, Vite, and Three.js, built in active pair-programming collaboration across a specialized multi-model AI workflow:
- **Primary Driver (GPT-5.6 Sol & Codex)**: Served as the primary driver for UI layout, component styling, state management, MVP completion, and initial Vector agent integration.
- **Physics & Debugging Specialists (Gemini 3.5 Flash & Claude Opus 4.6)**: Leveraged for additional system components, deep physics engine bug hunting (including the breakthrough in beam contact friction and free-air rotational damping), edge-case analytical derivations, and comprehensive Vector failure troubleshooting.

React manages interface reactivity and laboratory state, while Three.js renders the 3D scene.

### Physics Architecture & Fixed Timestep Loop

The simulation engine executes a deterministic fixed timestep:

$$\Delta t = \frac{1}{120}\ \text{s} \approx 0.008333\ \text{s}$$

The engine advances at $120\text{ Hz}$ ($120$ physics steps per simulated second). React receives published world states at approximately $30\text{ Hz}$, while Three.js interpolates position $\vec{x}$ and orientation $\theta$ between physics states. This decoupling ensures numerical solver precision without saturating the main React render loop.

### Integrator Mathematics

The production engine implements a kick–drift–kick form of **velocity Verlet** (equivalent to leapfrog integration). 

For linear motion:

1. **Half-Step Velocity Update**:

$$\vec{v}_{n+\frac{1}{2}} = \vec{v}_n + \frac{1}{2}\vec{a}_n \Delta t$$

1. **Full-Step Position Update**:

$$\vec{x}_{n+1} = \vec{x}*n + \vec{v}*{n+\frac{1}{2}} \Delta t$$

1. **Re-evaluate Forces & Final Velocity Update**:

$$\vec{v}*{n+1} = \vec{v}*{n+\frac{1}{2}} + \frac{1}{2}\vec{a}_{n+1} \Delta t$$

When acceleration depends strictly on position, the position update expands to:

$$\vec{x}_{n+1} = \vec{x}_n + \vec{v}_n \Delta t + \frac{1}{2}\vec{a}_n (\Delta t)^2$$

$$\vec{v}_{n+1} = \vec{v}_n + \frac{\vec{a}*n + \vec{a}*{n+1}}{2} \Delta t$$

Rotational kinematics follow the identical half-step velocity Verlet structure:

$$\omega_{n+\frac{1}{2}} = \omega_n + \frac{1}{2}\alpha_n \Delta t$$

$$\theta_{n+1} = \theta_n + \omega_{n+\frac{1}{2}} \Delta t$$

$$\omega_{n+1} = \omega_{n+\frac{1}{2}} + \frac{1}{2}\alpha_{n+1} \Delta t$$

This symplectic structure preserves total energy $E_{\text{total}} = K + U$ and bounded phase space trajectories significantly better than explicit Euler methods. Reference implementations of explicit Euler, symplectic Euler, and velocity Verlet are maintained in `src/physics/integrators.js` for unit testing and comparative energy drift analysis.

### Solvers, Constraints, & Rotational Dynamics

Each $120\text{ Hz}$ step executes:

1. Primary collision detection and contact manifold generation.
2. Contact force and impulse application.
3. Multi-body joint constraint solving (pins, rigid welds, Atwood pulleys).
4. Secondary contact re-enforcement.
5. System metrics and energy accounting updates.

Uniform beams compute rotational moment of inertia using:

$$I_{\text{center}} = \frac{1}{12} m L^2$$

Connected multi-body assemblies apply the parallel-axis theorem:

$$I = I_{\text{center}} + m d^2$$

### Hermite Spline Rail Geometry

Curved tracks are modeled as piecewise quintic Hermite splines. Each knot specifies position $\vec{p}$, first derivative $\vec{p}'$ (tangent vector), and second derivative $\vec{p}''$ (curvature derivative). A curve span $0 \le u \le 1$ is defined by:

$$\vec{p}(u) = \sum_{i=0}^{5} \vec{a}_i u^i$$

Coefficients $\vec{a}_i$ are analytically computed to enforce continuous position, tangent vector, and second derivative at knot boundaries, guaranteeing $C^2$ continuity. Local curvature $\kappa$ is computed dynamically:

$$\kappa = \frac{x' y'' - y' x''}{(x'^2 + y'^2)^{3/2}}$$

Riders on spline tracks experience genuine physical detachment when normal force drops to zero:

$$N = m \left( \frac{v^2}{R} - g \cos\theta \right) \le 0$$

For ideal loop-the-loop release investigations, theoretical minimum height satisfies:

$$h_{\min} = \frac{R(5 + b)}{2}, \qquad \text{where } I = b m r^2$$

For a sliding block ($b = 0$), $h_{\min} = \frac{5}{2}R$.

---

## **Challenges We Ran Into**

### 1. The Breakthrough in Beam Physics: Resolving the "Infinite Spinning Beam" Bug

During testing, my friends discovered a severe physics artifact: an unpinned beam or box dropped onto a flat floor or surface would bounce and spin perpetually without coming to rest. Even after multiple floor contacts, the beam continued to rotate infinitely.

#### Root Cause Analysis:

1. **Missing Rotational Contact Friction**: While `contactWithSurface()` applied linear friction to decelerate translational velocity $\vec{v}$, it applied zero rotational contact friction or torque damping to angular velocity $\omega$. Touching the ground slowed the beam's forward sliding, but imparted zero angular impulse to counter its spin.
2. **Undamped Free-Air Rotation**: Unjointed bodies floating or falling in free air lacked rotational atmospheric drag, causing micro-torques from initial conditions or off-center impacts to persist forever.

#### The Physics Solution:

We implemented a two-part resolution across `src/physics/constraints.js` and `src/physics/world.js`:

- **Rotational Contact Friction (`src/physics/constraints.js`)**: Added rotational contact torque damping inside `contactWithSurface()`. When a beam or box contacts a surface, normal force $N$ and surface friction $\mu$ generate an angular impulse based on an effective lever arm:

$$\ell_{\text{effective}} = \frac{L}{3}$$

$$\Delta\omega_{\max} = \max\left( \mu \cdot v_{\text{normalImpulse}} \cdot \ell_{\text{effective}} \cdot I^{-1},  0.15 \cdot \Delta t \cdot 60 \right)$$

If $|\omega| \le \Delta\omega_{\max}$, $\omega$ snaps cleanly to $0$, coming to rest; otherwise, surface friction rapidly decelerates spinning:

$$\omega \leftarrow \omega - \operatorname{sign}(\omega) \cdot \Delta\omega_{\max}$$

- **Selective Free-Air Rotational Damping (`src/physics/world.js`)**: Applied light rotational damping ($\gamma = 0.999$) per step specifically to unjointed free-floating bodies, while strictly preserving $100$ ideal (undamped) rotational physics for pinned assemblies (pendulums, levers, Atwood systems).

### 2. Greater Vector Troubleshooting: The Fundamental Architectural Gap

A critical challenge during development was Vector's failure when asked to generate curved tracks (such as roller coasters or double loops) from prompt requests or uploaded FRQ physics diagrams.

#### The Root Cause:

Vector was expected to generate $78+$ precise floating-point numbers in a single JSON response representing position, tangent, and second derivative for $13$ spline knots. Large Language Models are semantic engines, not numerical calculators. Forcing an LLM to output raw floats leads to:

1. **Token-Level Arithmetic Hallucination**: LLMs predict likely token sequences rather than evaluating trigonometric functions ($\cos \theta$, $\sin \theta$). Tangents were output with incorrect magnitudes (e.g., $1.0$ instead of $R \cdot \frac{\pi}{2} \approx 1.5708 R$), turning circular loops into deformed ellipses.
2. **Missing Second Derivatives**: $C^2$ Hermite splines require second derivatives pointing inward toward the center with magnitude $R \cdot (\frac{\pi}{2})^2$. Without exact values, quintic splines warp, causing rider detachment and numerical jitter.
3. **The Auto-Complete Trap**: Relying on chordal linear finite-difference auto-completion (`autoCompleteSplineKnots`) introduces a $\sim 36$ magnitude error on circular arcs, destroying true circular geometry.

#### The Architectural Fix (Feature Compiler Pattern):

Instead of asking Vector to generate $78$ raw floating-point numbers, we designed an architecture where Vector outputs high-level semantic primitives (e.g., `{ type: "loop", center: {x:-2.5, y:1}, radius: 1.0 }`). The engine's procedural compiler calls exact analytical functions (like `circleKnot()`) to compute flawless knots automatically.

---

## **Accomplishments That We're Proud Of**

- **Comprehensive Laboratory Sandbox**: Evolved from a single AP Physics prototype into a multi-topic physics laboratory featuring 13 prepared experiments, live force/torque visualization, nonphysical measurement instruments, and CSV/JSON export.
- **Symplectic Solver Precision**: Built a stable $120\text{ Hz}$ velocity Verlet solver capable of running complex multi-body assemblies for 60 seconds without divergence or energy blowup.
- **Local Classroom Impact & Personal Achievement**: At our school, our physics classes are very tight-knit, and many classmates have seen immediate viability in what Mechanarium can be for their own learning. My physics teacher has also shown genuine interest in the tool and how it could transform the way he teaches mechanics to future students. To me, this is my greatest achievement: impacting a group of individuals who I would have never thought I’d ever be able to help.
- **Robust Quality Gate**: $100\%$ passing test suite across 21 test files and 115 unit/integration tests covering numerical integration, collision manifolds, rail welds, spline contacts, and AI agent policies.
- **Clean Architecture**: Successfully decoupled physics execution ($120\text{ Hz}$) from UI state publication ($30\text{ Hz}$), delivering high-fps 3D rendering without main-thread jank.

---

## **What We Learned**

1. **Integrator Choice Matters**: Symplectic velocity Verlet integration is essential for energy conservation in orbital and harmonic systems; explicit Euler rapidly diverges.
2. **Empirical Profiling vs. Premature Optimization**: Early plans assumed Rust/WebAssembly would be mandatory. Benchmarking demonstrated that JavaScript on a $120\text{ Hz}$ fixed timestep handles current workloads cleanly without unnecessary cross-language overhead.
3. **AI as a Socratic Partner**: AI excels at semantic interpretation, problem parsing, and pedagogical scaffolding, but numerical computation must remain strictly within deterministic code primitives.

---

## **What's Next for Mechanarium**

- **Classroom Beta Testing**: Conduct user testing with AP Physics educators and students to refine lab workflows.
- **Vector Feature Compiler**: Complete full integration of high-level geometric primitives for instant AI spline track compilation.
- **Expanded Physics Library**: Introduce deformable springs, non-uniform rotational mass distributions, variable pulleys, and 3D constraint dynamics.
- **Pocket Physics Lab**: Mobile PWA optimization to provide a complete physics laboratory on any device.

---

## **Technical Accuracy Notes**

- The simulation engine is written in pure JavaScript, utilizing a $120\text{ Hz}$ fixed timestep ($\Delta t = \frac{1}{120}\text{ s} \approx 0.008333\text{ s}$).
- The production solver uses a kick–drift–kick velocity Verlet (leapfrog) formulation for both linear and angular motion (`src/physics/world.js`).
- Reference integrators (Explicit Euler, Symplectic Euler, Velocity Verlet) are implemented in `src/physics/integrators.js` for validation.
- Physics calculations are planar 2D, rendered visually in 3D via Three.js.
- Rotating pulleys and Atwood machines account for moment of inertia $I$, differential rope tensions $T_1 \ne T_2$, and torque dynamics $\tau = I \alpha$.
- Vector agent operates via OpenAI `gpt-5.6-luna` when remote keys are present, falling back to a deterministic local planner.

