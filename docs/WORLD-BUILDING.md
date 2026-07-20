# Planar assembly and track editor

Mechanarium renders a three-dimensional workspace while solving mechanics in the visible x/y plane. The coordinate grid is a reference; only enabled physical surfaces participate in contact.

## Construction workflow

Pause before editing. Every structural edit resets simulation time and live telemetry; Run locks fields, curve handles, connector handles, deletion, and port operations.

- Add bodies, ramps, spline templates, springs, ropes, beams, wheels, forces, or instruments from **Build**.
- Drag bodies and straight-track centers. Straight tracks and beams expose angle/length gizmos.
- Select a spline to reveal yellow knot handles and green tangent handles.
- Use arrow keys to translate a selected entity. Brackets and minus/equals rotate or resize straight tracks and beams. D disconnects a connector; Delete removes the selection.
- Choose **Place selected body at start** for exact visible-surface placement; this never creates an invisible rail constraint.

## Hybrid spline editor

The builder supplies Loop, Hill, Valley, and Blank Spline templates. Drag a yellow point to change a knot position or its green handle to change the tangent. The Inspector exposes exact position, tangent, and second-derivative values, knot insertion/deletion, thickness, friction, restitution, release end, and left/right support side.

Adjacent spans use shared quintic derivatives, so edits retain C² continuity. The rendered blocks, collision surfaces, ports, placement point, measurements, and exported geometry all come from the same adaptive sample cache.

Spline contact remains free-body contact. Mechanarium does not force an object to a path coordinate: insufficient loop speed causes real detachment, followed by projectile motion and possible re-contact.

## Ports, joints, and snapping

Bodies derive center/cardinal ports. Straight and spline tracks derive start, center, and end ports. Spline track ports use positions on the sampled path. Custom ports, rigid joints, pin joints, connectors, and explicit snap confirmation retain the established assembly behavior.

## Wheels, loops, and Atwood machines

Disk and hoop wheels use `I = ½mR²` and `I = mR²`. Friction-limited contact couples translation and rotation. Routed ropes wrap over one fixed-center pulley; fixed wheels are ideal equal-tension pulleys while free wheels use their rotational inertia and develop unequal leg tensions.

For an idealized loop of radius `R` with `I = bmr²`, the minimum rolling release height above the bottom is `h_min = R(5 + b)/2`. The sliding limit is `5R/2`, and the top normal force is `N = m(v²/R - g)`. These comparisons apply only to the matching idealized preset assumptions.

## Measurement and tutorials

Rulers and photogates align to straight or curved tracks without becoming physical. Trial acquisition runs at 120 Hz and exports raw observations, track coordinate, curvature, and derived gate results.

The **Learn** tab contains a skippable/restartable interface tour plus Projectile, Incline, Atwood, and Loop investigations. Each investigation moves through an objective, prediction, setup, measurement choice, run, evidence review, and explanation. Progress is stored locally and supplied to Vector as teaching context.

## Vector previews

Small validated edits remain immediate. Preset replacement, spline creation, and other substantial world changes appear in a proposal card with Apply and Cancel. Offline “create a rollercoaster” requests propose the deterministic spline-coaster preset; a configured remote model may return a custom bounded spline blueprint that must pass the same server and client validation.
