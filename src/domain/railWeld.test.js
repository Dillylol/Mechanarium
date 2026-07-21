import { describe, expect, it } from 'vitest'
import { createBody, createSplineTrack } from './scenario.js'
import { createSplineKnot } from './spline.js'
import { alignBeamToSpline, validateRailJoins } from './railWeld.js'

describe('continuous rail welding', () => {
  it('aligns a track beam top surface and tangent to a spline endpoint', () => {
    const beam = createBody({ id: 'beam', shape: 'beam', mode: 'track', length: 4, thickness: 0.2 })
    const spline = createSplineTrack({ id: 'hill', knots: [
      createSplineKnot({ id: 'a', position: { x: 2, y: 1 }, tangent: { x: 2, y: 1 } }),
      createSplineKnot({ id: 'b', position: { x: 5, y: 2 }, tangent: { x: 2, y: 0 } }),
    ] })
    const alignment = alignBeamToSpline(beam, 'end', spline, 'start')
    const tangent = { x: Math.cos(alignment.angle), y: Math.sin(alignment.angle) }
    const normal = { x: -tangent.y, y: tangent.x }
    const topEnd = {
      x: alignment.position.x + tangent.x * beam.length / 2 + normal.x * beam.thickness / 2,
      y: alignment.position.y + tangent.y * beam.length / 2 + normal.y * beam.thickness / 2,
    }
    expect(topEnd.x).toBeCloseTo(2, 8)
    expect(topEnd.y).toBeCloseTo(1, 8)
    expect(validateRailJoins({ bodies: [beam], tracks: [spline], railJoins: [alignment.join] })).toEqual([])
  })
})
