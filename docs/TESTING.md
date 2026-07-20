# Testing strategy and current results

## Automated layers

- Physics fixtures cover the 120 Hz step, integrators, gravity, forces, springs, ropes, collisions, straight contact, friction, pins, rigid assemblies, pendulum/Atwood analytic comparisons, wheel inertia, and a 60-second numerical soak.
- Spline fixtures verify quintic endpoint position/first/second derivatives, deterministic adaptive sampling, arclength, normals, curvature, validation, straight-spline support, loop completion above threshold, and detachment below threshold.
- Domain fixtures cover v1/v2/v3-to-v4 migration, spline round trips and ports, invalid graphs, preset isolation, measurement sampling, and Scenario/notebook/telemetry export.
- Vector fixtures cover bounded requests/history, selected-body context, exact port policy, spline-blueprint rejection, offline coaster proposals, Apply confirmation, evidence grounding, tutoring scaffolds, and worked-solution escalation.
- Tutorial fixtures verify the onboarding plus four-investigation registry, required learning stages, current-step context, and local persistence.
- Testing Library fixtures cover the studio, construction, editing locks, trial recording, diagnostics, saving/import contracts, and agent interaction.

## Browser acceptance checklist

- Open all thirteen prepared experiments and Run the two Atwood, Loop-the-Loop, and Spline Roller Coaster systems.
- Confirm the above-threshold loop rider passes the top and exits; lower the release knot and confirm physical detachment.
- Add Loop, Hill, Valley, and Blank Spline tracks. Select each curve, drag a yellow knot and green tangent handle, edit exact derivative fields, insert/delete a knot, reverse support side, and verify Run locks editing.
- Confirm the visible curve and contact surface coincide at hills, valleys, and the loop. Watch track coordinate, curvature radius, normal force, and CSV output.
- Align a ruler and photogate to a curved track and verify alignment has no physical influence.
- Ask Vector to “create a rollercoaster”; confirm the current world remains unchanged until Apply, and Cancel leaves it unchanged.
- Paste a numeric mechanics problem; verify Vector asks for knowns/unknown before a solution and supplies a worked approach only when requested or told the student is stuck.
- Complete/restart/skip onboarding and the Projectile, Incline, Atwood, and Loop tutorials; reload and confirm progress persists.
- Repeat the critical workflow at desktop and mobile widths with keyboard-only navigation and a screen reader.

## Latest quality gate

Run on 2026-07-20:

- lint: passed;
- automated tests: 87 passed across 17 files;
- production build: passed;
- 60-second numerical soak: passed with finite state and bounded error.

The Three.js bundle-size advisory remains non-blocking. Broad browser/mobile/screen-reader and manual visual checks remain release-hardening work; the local in-app browser pass was unavailable because localhost navigation was blocked by the browser security policy.
