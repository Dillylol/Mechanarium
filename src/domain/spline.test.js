import { describe, expect, it } from 'vitest'
import { compileFeatures, createSplineKnot, evaluateQuintic, sampleSpline, splineLength, splinePointAtDistance, splineTemplate, validateSplineTrack } from './spline.js'

describe('quintic spline tracks', () => {
  it('matches position, tangent, and second derivative at shared endpoints', () => {
    const a = createSplineKnot({ id: 'a', position: { x: 0, y: 0 }, tangent: { x: 2, y: 1 }, secondDerivative: { x: 0, y: 3 } })
    const b = createSplineKnot({ id: 'b', position: { x: 4, y: 2 }, tangent: { x: 3, y: -1 }, secondDerivative: { x: 1, y: -2 } })
    expect(evaluateQuintic(a, b, 0)).toMatchObject({ position: a.position, firstDerivative: a.tangent, secondDerivative: a.secondDerivative })
    const end = evaluateQuintic(a, b, 1)
    expect(end.position.x).toBeCloseTo(b.position.x, 10)
    expect(end.position.y).toBeCloseTo(b.position.y, 10)
    expect(end.firstDerivative.x).toBeCloseTo(b.tangent.x, 10)
    expect(end.firstDerivative.y).toBeCloseTo(b.tangent.y, 10)
    expect(end.secondDerivative.x).toBeCloseTo(b.secondDerivative.x, 10)
    expect(end.secondDerivative.y).toBeCloseTo(b.secondDerivative.y, 10)
  })

  it('samples deterministically with arclength, support normals, and curvature', () => {
    const track = { type: 'spline', supportSide: 'left', knots: splineTemplate('hill') }
    const first = sampleSpline(track)
    const second = sampleSpline(track)
    expect(first).toEqual(second)
    expect(first.length).toBeGreaterThan(5)
    expect(splineLength(track)).toBeGreaterThan(8)
    const middle = splinePointAtDistance(track, splineLength(track) / 2)
    expect(Math.hypot(middle.tangent.x, middle.tangent.y)).toBeCloseTo(1)
    expect(Math.hypot(middle.normal.x, middle.normal.y)).toBeCloseTo(1)
  })

  it('compiles high-fidelity features into analytical spline knots', () => {
    const features = [
      { type: 'release', position: { x: -7.5, y: 6 } },
      { type: 'loop', center: { x: -2.5, y: 1 }, radius: 1 },
      { type: 'ramp', position: { x: 0.5, y: 1 } },
      { type: 'loop', center: { x: 3.5, y: 3 }, radius: 1 },
      { type: 'runout', position: { x: 7.5, y: 2 } },
    ]
    const knots = compileFeatures(features)
    expect(knots.length).toBe(13) // 1 release + 5 loop1 + 1 ramp + 5 loop2 + 1 runout
    expect(validateSplineTrack({ type: 'spline', supportSide: 'left', thickness: 0.18, friction: 0, restitution: 0, knots })).toEqual([])
  })

  it('deduplicates coincident endpoints during feature compilation', () => {
    const features = [
      // release point lands exactly at the entry of the loop (-2.5, 0)
      { type: 'release', position: { x: -2.5, y: 0 } },
      { type: 'loop', center: { x: -2.5, y: 1 }, radius: 1 },
      { type: 'runout', position: { x: 2, y: 0 } },
    ]
    const knots = compileFeatures(features)
    // Coincident knots are merged, so it compiles cleanly without duplicate check errors
    expect(validateSplineTrack({ type: 'spline', supportSide: 'left', thickness: 0.18, friction: 0, restitution: 0, knots })).toEqual([])
  })
})
