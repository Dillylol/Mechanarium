import { describe, expect, it } from 'vitest'
import { getPreset } from '../domain/presets.js'
import { alignBeamToSpline } from '../domain/railWeld.js'
import { createBody, createSplineTrack } from '../domain/scenario.js'
import { createSplineKnot } from '../domain/spline.js'
import { createWorld, stepWorld } from './world.js'

describe('joined rail traversal', () => {
  it('crosses a welded beam-to-spline boundary without falling through a gap', () => {
    const scenario = getPreset('projectile-motion')
    const spline = createSplineTrack({ id: 'finish', ideal: true, friction: 0.9, restitution: 0, knots: [
      createSplineKnot({ id: 'start', position: { x: 0, y: 0 }, tangent: { x: 4, y: 0 } }),
      createSplineKnot({ id: 'end', position: { x: 4, y: 0 }, tangent: { x: 4, y: 0 } }),
    ] })
    const beam = createBody({ id: 'lead-in', shape: 'beam', mode: 'track', ideal: true, length: 4, thickness: 0.2 })
    const alignment = alignBeamToSpline(beam, 'end', spline, 'start')
    Object.assign(beam, { position: alignment.position, angle: alignment.angle })
    scenario.bodies = [
      createBody({ id: 'rider', radius: 0.3, position: { x: -1.5, y: 0.3 }, velocity: { x: 3, y: 0 }, restitution: 0, friction: 0.9 }),
      beam,
    ]
    scenario.tracks = [spline]
    scenario.constraints = []
    scenario.railJoins = [alignment.join]
    let world = createWorld(scenario)
    let reachedSpline = false
    for (let index = 0; index < 180; index += 1) {
      world = stepWorld(world)
      reachedSpline ||= world.bodies[0]._trackContact?.trackId === spline.id
    }
    expect(reachedSpline).toBe(true)
    expect(world.bodies[0].position.x).toBeGreaterThan(1)
  })
})
