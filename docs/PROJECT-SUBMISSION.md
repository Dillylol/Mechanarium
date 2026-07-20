# Mechanarium Project Submission

**Tagline:** Build it. Test it. Discover the physics.

## Inspiration

While studying AP Physics C: Mechanics, I often struggled to connect equations with the motion they described, especially in rotational mechanics. A class project gave me the opportunity to bridge that gap by creating an early rotational-physics simulator. Mechanarium grew from that prototype and from a larger question: what if students could construct a physical system, watch it move, measure it, and learn directly from the results?

## What it does

Mechanarium is an interactive mechanics sandbox and virtual laboratory designed primarily for AP Physics 1, AP Physics C: Mechanics, and introductory university physics courses. The workspace is rendered in three dimensions, while the current deterministic physics model remains planar.

Students can construct and investigate systems involving projectiles, collisions, ramps, springs, ropes, pendulums, rotating beams, connected assemblies, Atwood machines, central-force orbits, and vertical loops. Thirteen prepared experiments provide starting points, while the builder supports custom bodies, straight tracks, C² quintic spline tracks, attachment ports, pin and rigid joints, and massless spring and rope connectors.

The simulator is designed as a laboratory rather than only a demonstration. Students can inspect force vectors and kinematic or energy telemetry, place nonphysical rulers and photogates, record repeated trials, compare plots, and export scenario or laboratory data as JSON and CSV. The guided ramp-motion investigation asks students to state a prediction, collect evidence, review a trial, and decide whether the measurements support their reasoning.

Mechanarium also includes **Vector**, a world-building and Socratic learning agent. Vector translates natural-language requests into validated Scenario v4 actions, previews substantial changes such as roller coasters before applying them, and scaffolds pasted physics problems before offering a worked solution. When discussing results, it distinguishes observations from inferences and grounds its response in supplied telemetry or trial measurements. A remote model is available when a server-side API key is configured; otherwise, the same interface uses a deterministic local planner.

## How we built it

I developed Mechanarium with Codex and GPT-5.6 Sol as my primary development collaborators, building on the concept and early prototype I had created for an AP Physics C: Mechanics rotational-physics project.

The application is built with JavaScript, React, Vite, and Three.js. React manages the interface and laboratory state, while Three.js renders the visually three-dimensional workspace. The physics engine currently runs on the browser's main thread in JavaScript. Rust, WebAssembly, and a worker-based physics pipeline were explored in the technical roadmap but remain intentionally deferred because the measured workload did not yet justify their added complexity.

The simulation uses a deterministic fixed timestep of

\[
\Delta t = \frac{1}{120}\ \text{s},
\]

so the physics advances at 120 steps per simulated second. React receives published world state at approximately 30 Hz, while rendering interpolates motion between physics states. This separates simulation precision from interface update frequency and avoids sending every measurement sample through React.

The production world step uses a kick–drift–kick form of velocity Verlet, also describable as a leapfrog-style update. For linear motion, it first advances velocity by half a step:

\[
\vec{v}_{n+\frac{1}{2}}
=
\vec{v}_n + \frac{1}{2}\vec{a}_n\Delta t.
\]

It then advances position using that half-step velocity:

\[
\vec{x}_{n+1}
=
\vec{x}_n + \vec{v}_{n+\frac{1}{2}}\Delta t.
\]

After recalculating forces and acceleration at the predicted state, it completes the velocity update:

\[
\vec{v}_{n+1}
=
\vec{v}_{n+\frac{1}{2}}
+
\frac{1}{2}\vec{a}_{n+1}\Delta t.
\]

Equivalently, when acceleration is position-dependent, the position update can be written as

\[
\vec{x}_{n+1}
=
\vec{x}_n
+
\vec{v}_n\Delta t
+
\frac{1}{2}\vec{a}_n(\Delta t)^2,
\]

and the complete velocity update as

\[
\vec{v}_{n+1}
=
\vec{v}_n
+
\frac{\vec{a}_n+\vec{a}_{n+1}}{2}\Delta t.
\]

The engine applies the same half-step structure to angular motion:

\[
\omega_{n+\frac{1}{2}}
=
\omega_n + \frac{1}{2}\alpha_n\Delta t,
\]

\[
\theta_{n+1}
=
\theta_n + \omega_{n+\frac{1}{2}}\Delta t,
\]

\[
\omega_{n+1}
=
\omega_{n+\frac{1}{2}}
+
\frac{1}{2}\alpha_{n+1}\Delta t.
\]

This approach is more stable for the simulator's oscillating and rotating systems than basic explicit Euler integration. The repository also contains explicit Euler, symplectic Euler, and velocity-Verlet reference implementations and tests, including a harmonic-oscillator test that compares their energy error.

After unconstrained integration, the world step resolves circle and beam collisions, applies contacts, solves assembly constraints, reapplies contacts, and calculates system metrics. The engine supports uniform gravity, per-body gravity participation, central forces, springs, ropes, friction, restitution, pins, rigid joints, and compound rotational inertia. A uniform beam uses

\[
I_{\mathrm{center}} = \frac{1}{12}mL^2,
\]

and connected assemblies use the parallel-axis theorem when calculating compound inertia:

\[
I = I_{\mathrm{center}} + md^2.
\]

Curved tracks are piecewise quintic Hermite splines. Every knot stores position, first derivative, and second derivative. A span is

\[
\vec{p}(u)=\sum_{i=0}^{5}\vec{a}_i u^i,\qquad 0\le u\le1,
\]

with coefficients chosen to match \(\vec{p}\), \(\vec{p}'\), and \(\vec{p}''\) at both endpoints. Sharing those three values at an interior knot provides CÂ² continuity. Curvature is calculated from

\[
\kappa=\frac{x'y''-y'x''}{(x'^2+y'^2)^{3/2}}.
\]

The engine adaptively samples the same mathematical curve for rendering, contact, measurement, and arclength telemetry. Objects are not constrained to a stored rail coordinate, so insufficient normal force causes genuine detachment. For the idealized loop investigation, the comparison relationships are

\[
h_{\min}=\frac{R(5+b)}{2},\qquad I=bmr^2,
\]

and at the loop top

\[
N=m\left(\frac{v^2}{R}-g\right).
\]

The sliding result is recovered with \(b=0\), giving \(h_{\min}=5R/2\). These formulas are used only when the simulated assumptions match the idealized model.

## Challenges we ran into

One of the greatest challenges was making the physics accurate, stable, and responsive while allowing many different systems to interact. Springs, slack and tensioned ropes, collisions, friction, rotating beams, contacts, and connected assemblies each introduce different numerical and geometric problems.

Small integration or constraint errors can accumulate quickly in pendulums, oscillators, and compound rotational systems. We addressed this with a fixed 120 Hz simulation boundary, a velocity-Verlet-style world step, deterministic updates, explicit collision and contact passes, constraint solving, and automated comparisons with analytical physics results. The test suite covers spring and pendulum periods, energy behavior, beam and compound inertia, bounded pin error, track contact, friction and restitution, collisions, central forces, and a 60-second numerical assembly soak.

Another challenge was balancing flexibility with accessibility. Mechanarium needed to support meaningful construction without requiring students to understand its internal data model. This led to prepared experiments, direct spline handles, explicit change previews, reusable Scenario v4 files, measurement instruments, guided tutorials, and Vector's natural-language interface.

Performance also required architectural restraint. Instead of assuming that a Rust/WebAssembly rewrite would automatically improve the experience, we separated the 120 Hz physics loop from 30 Hz React publication and measured the result. The current documentation records the worker and WebAssembly migration as deferred until profiling demonstrates a need.

## Accomplishments that we're proud of

I am most proud of how far Mechanarium has grown from a single rotational-physics prototype. It is now a flexible mechanics environment where students can build systems, test predictions, gather evidence, and investigate many topics found in first-year physics.

The current project includes thirteen prepared experiments, a versioned and validated scenario format, straight and spline construction tools, free-body loop contact, live physics telemetry, force and motion visualization, rulers and photogates, persistent trial notebooks, comparison plots, data export, five guided tutorials, and local or remote-model guidance. The automated quality gate includes a 60-second numerical soak and passes linting and the production build.

I am proud that the simulator now connects world construction, solver-authoritative force and torque measurements, repeatable experiments, curved-track physics, and guided reasoning in one portable web application. The result demonstrates the central concept directly: mechanics becomes easier to reason about when students can build a system, watch it move, measure it, and test their explanation.

## What we learned

I learned that building a reliable physics engine involves much more than making objects move across a screen. Integration, collision detection, contact geometry, constraints, energy accounting, measurement, rendering, performance, and interface design all affect one another.

I also learned that optimization should follow evidence. The original roadmap considered Rust, WebAssembly, Web Workers, and shared-memory techniques, but the implemented 120 Hz physics and 30 Hz publication architecture met the current milestone without requiring that migration. Keeping a clear world boundary leaves room for future optimization without prematurely increasing complexity.

Most importantly, I learned how useful AI can be when it lowers the barrier between a learner's idea and a complex technical system. Vector lets a student describe an apparatus or question in familiar language and helps connect that request to a buildable scenario, a measurable experiment, and a focused next question.

The goal is not for AI to replace the reasoning involved in physics. It is to reduce unnecessary friction so students can spend more time predicting, experimenting, analyzing evidence, and building understanding.

## What's next for Mechanarium

I learned about the Build Week challenge only four days before its deadline, so Mechanarium still needs broader user testing with teachers and students. The next steps are to refine Vector's teaching behavior, conduct accessibility and device testing, improve performance where profiling identifies real bottlenecks, and expand the library of guided investigations.

The physics roadmap leaves room for more advanced joints and materials, moving or compound pulleys, deeper orbital investigations, image-based problem intake, symbolic regression, and a worker or Rust/WebAssembly engine if future workloads justify one. These are future directions rather than claims about the current build.

The long-term goal is to create a **physics class in your pocket**: a place where anyone can build a world, observe its behavior, collect evidence, and develop an intuitive understanding of mechanics and calculus-based physics.

## Technical accuracy notes

- The current engine is JavaScript, not Rust or WebAssembly. Those technologies remain deferred because profiling has not justified the migration.
- Calling the production solver simply an "Euler physics engine" is inaccurate. The actual world step in `src/physics/world.js` uses half-step velocity and angular-velocity updates consistent with kick–drift–kick velocity Verlet/leapfrog integration.
- Because drag and spring damping can make acceleration velocity-dependent, "velocity-Verlet-style" is more precise than claiming that every supported force follows the textbook position-only velocity Verlet algorithm exactly.
- `src/physics/integrators.js` separately implements explicit Euler, symplectic Euler, and velocity Verlet for reference and testing.
- The mechanics are planar even though the laboratory is rendered with a three-dimensional camera and scene.
- Ideal and rotating-pulley Atwood machines are implemented with routed ropes, axle reactions, equal or unequal tensions, and pulley torque.
- The OpenAI-backed Vector agent currently defaults to `gpt-5.6-luna` in `server/agent.mjs`; GPT-5.6 Sol describes the development collaborator, not the simulator's default runtime model.
