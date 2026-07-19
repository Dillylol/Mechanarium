# Planar assembly editor

Mechanarium renders a three-dimensional workspace while solving mechanics in the visible x/y plane. The coordinate grid is a reference; only an enabled ground, ramp, or track-mode beam is solid.

## Construction workflow

Construction and simulation share one workspace. Pause before changing topology. Every structural edit resets time and telemetry; Run locks fields, gizmos, connector handles, deletion, and port operations.

- Add spheres, blocks, ramps, springs, ropes, beams, or attachment points from **Build**.
- Drag bodies or track centers. Select a ramp or beam to reveal yellow angle and length handles and a green start marker.
- Hold Shift while dragging the angle handle for 15Â° snapping.
- Use arrow keys to translate, brackets to rotate, minus/equals to resize, D to disconnect a selected connector, and Delete to remove.
- Choose **Place selected body at start** on a track. This is placement assistance only and never becomes an invisible rail.

## Gravity

Master gravity provides magnitude and direction. Each dynamic object independently enables it and applies a multiplier. Acceleration is `g Ã— multiplier`; mass does not change gravitational acceleration. Orbital and force-free presets disable uniform gravity on their bodies.

## Ports, joints, and snapping

Bodies derive center and cardinal ports. Tracks and beams derive start, center, and end ports. Custom attachment points are serialized and may be renamed or repositioned. Connector and track endpoints use an 18-pixel snap radius that remains consistent while zooming.

Snapping is always explicit. Drag a connector endpoint or track endpoint near a compatible port to produce a green target halo and, for tracks, a green ghost preview. The editor leaves the entity where it was released until **Snap to place** is selected. **Keep free** cancels the candidate without creating a connection. A confirmation message names both endpoints after placement.

Compound structural joints use the same confirmation flow: choose the first structural port, select the second port, choose **Preview rigid snap** or **Preview pin snap**, inspect the proposed alignment, and then select **Snap to place**. Custom ports also appear as quick-select chips in **Assembly constraints** so closely overlapping parts do not make port selection finicky. The second owner is translated so the ports coincide only when the snap is confirmed.

Select a port and choose **Use as first structural port**, then select a port on another entity and choose **Rigid to first** or **Pin to first**. A port may also be pinned to its current world position. Rigid groups report composite inertia; pins preserve a common point while allowing rotation.

## Springs, ropes, and beams

Spring and rope endpoints may be world anchors or port references. Springs apply forces and off-center torque. Ropes enforce a maximum length, carry tension only, and go slack below that length.

Beam modes are:

- **Dynamic** â€” free rigid body with inertia, collisions, and optional gravity.
- **Pinned** â€” dynamic beam with an end pin created when the mode is selected.
- **Track** â€” immovable solid segment; dynamic gravity and inertia are inactive.

Auto-length spans a beam between two connected end ports during paused editing and preserves that length when Run begins.

Straight track segments are the current scope. Loops and spline tracks will reuse the same port schema in a later milestone.
