# Scenario format v4

Scenario v4 is the portable planar-assembly contract. Deserialization automatically migrates v1, v2, and v3 documents before validation.

## Top-level records

- `gravity`: `{ enabled, g, direction }`, using a non-negative magnitude and finite direction.
- `bodies`: circles, boxes, beams, and wheels. Wheels select disk/hoop inertia and free/fixed rotation.
- `tracks`: a union of straight `segment` records and curved `spline` records.
- `ports`: serialized custom attachment points; deterministic body and track ports are derived from owner geometry.
- `connectors`: massless springs or inextensible ropes, optionally routed over one fixed-center wheel.
- `joints`: frictionless pins or rigid welds between exact endpoints.
- `forces`, `constraints`, and measurement-only `instruments`.

## Spline tracks

A spline track stores:

```json
{
  "type": "spline",
  "knots": [{
    "id": "knot-a",
    "position": { "x": 0, "y": 0 },
    "tangent": { "x": 2, "y": 0 },
    "secondDerivative": { "x": 0, "y": 1 }
  }],
  "supportSide": "left",
  "thickness": 0.18,
  "friction": 0.12,
  "restitution": 0,
  "startEnd": "start"
}
```

Each neighboring knot pair defines one quintic Hermite span. Because position, first derivative, and second derivative are shared at each interior knot, adjacent spans are C² continuous. The runtime adaptively samples that mathematical path once and uses the same samples for rendering, selection, contact, placement, arclength, curvature, and instrument alignment.

`supportSide` selects the material normal relative to the path direction. A counterclockwise vertical loop uses the left side, making the normal point inward around the loop. Loop paths may revisit the same world position at distinct, nonconsecutive knots; consecutive coincident knots remain invalid.

Validation limits a spline to 2–64 uniquely identified knots and rejects non-finite vectors, zero tangents, nonpositive dimensions, degenerate spans, and unsupported material-side values.

## Runtime-only curve data

Adaptive samples, active contact coordinates, normal/friction loads, reaction forces, and torque ledgers are derived runtime measurements. They are removed from exported scenarios. Telemetry and notebook CSV may include track coordinate, curvature, curvature radius, and normal force.

## Instruments and notebooks

Rulers and photogates may align to either straight or curved tracks but never enter the collision, force, connector, port, or joint graphs. Scenario JSON stores configuration; recorded observations live in a separate notebook keyed by scenario ID.

## Compatibility

- v1 gravity, incline, and spring records migrate through the existing compatibility path.
- v2 assembly and instrument records migrate without changing supported behavior.
- v3 wheels, routed pulleys, and Atwood records migrate unchanged into v4.
- Existing straight tracks remain `segment` records and retain their previous physical geometry.

All quantities follow the SI and coordinate conventions in `docs/CONVENTIONS.md`.
