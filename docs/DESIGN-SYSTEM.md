# Mechanarium studio design system

The active interface follows the hand-drawn studio layout and the direct-manipulation requirements in `ProjectOutline.md`.

## Layout authority

- Left rail: world-building elements and prepared experiments.
- Center: primary three-dimensional world with orbit camera, direct selection, drag placement, grid, tracks, vectors, and traces.
- Bottom center: persistent black world-agent dock.
- Right rail: authoritative measurements, energy history, selected-object properties, and accessible body data.

## Visual language

- White and warm-gray working surfaces with black structural borders.
- Black is used for controls, tracks, typography, and the agent dock.
- Physics accents are functional: green for force/kinetic direction, yellow for active bodies, and blue for field sources.
- Small monospaced labels communicate measurement and instrumentation; body copy remains sans-serif.
- Square geometry and one-pixel rules provide an official laboratory-instrument character rather than a consumer dashboard aesthetic.

## Interaction rules

- Drag empty 3D space to orbit; scroll to zoom.
- Select and drag bodies while paused.
- Arrow keys reposition the selected body; Space runs or pauses; Delete removes when allowed.
- Every canvas measurement is mirrored in labelled DOM controls or tables.
- Natural-language actions use the same validated scenario mutations as direct builder controls.
