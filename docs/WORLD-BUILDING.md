# World-building controls

Mechanarium separates visual references from physical environment objects. A faint grid is only a coordinate reference; the status label says `ground on` when a collision ground is active and `reference grid only` when it is not.

## Bodies and the default environment

Adding a sphere or block to a world without an environmental force creates Earth gravity (`9.80665 m/s²`) and a ground at `y = -3.6 m`. This prevents a newly constructed body from silently floating or falling through a visual reference grid. Gravity and Floor are explicit on/off buttons in the left builder.

## Editing surfaces and forces

The right rail lists every active gravity field, ground, ramp, spring, and attractor under **World forces & surfaces**. Pause the simulation to edit values or remove an item. Ramp start/end coordinates change its length, slope, and position; a ramp can also be dragged directly in the 3D world while paused.

Generic ramps only affect bodies that contact their visible segment. A ramp linked to a prepared experiment can remain body-specific. Rolling ramps include rotational inertia through the effective mass `m + I/r²`.

## Building an orbit manually

1. Add or select a body and place it away from the desired center.
2. Add **Attractor** from the left builder.
3. Edit its center and strength in the right rail.
4. Choose **Prepare clean circular orbit**.
5. Run the world and inspect the Kinematics view.

Orbit preparation gives the linked body the correct perpendicular circular-orbit speed `sqrt(strength / radius)` and removes uniform gravity and the ground so they do not interfere. All resulting body, force, and environment values remain editable.

## Measurement views

**Energy** presents kinetic, potential, total energy, momentum, and conservation error. **Kinematics** presents the selected body’s position, velocity, acceleration, speed, displacement, time, and history. CSV export includes both kinematics and energy columns.
