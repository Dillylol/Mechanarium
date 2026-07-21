import { describe, expect, it } from 'vitest'
import { getPreset } from '../domain/presets.js'
import { createBody, createSplineTrack, createWheel } from '../domain/scenario.js'
import { createSplineKnot, splineLength, splinePointAtDistance } from '../domain/spline.js'
import { createWorld, stepWorld } from './world.js'

function run(world, seconds, observe = () => {}) {
  let next = world
  for (let index = 0; index < seconds * 120; index += 1) {
    next = stepWorld(next)
    observe(next)
  }
  return next
}

describe('spline track contact', () => {
  it('supports a body on a straight quintic with the same visible surface geometry', () => {
    const scenario = getPreset('projectile-motion')
    scenario.gravity.enabled = true
    scenario.constraints = []
    scenario.bodies = [createBody({ id: 'body', radius: 0.3, position: { x: 0, y: 2 }, restitution: 0 })]
    scenario.tracks = [createSplineTrack({ id: 'straight', friction: 0, restitution: 0, knots: [
      createSplineKnot({ id: 'a', position: { x: -3, y: 0 }, tangent: { x: 6, y: 0 } }),
      createSplineKnot({ id: 'b', position: { x: 3, y: 0 }, tangent: { x: 6, y: 0 } }),
    ] })]
    const world = run(createWorld(scenario), 1)
    expect(world.bodies[0].position.y).toBeCloseTo(0.3, 2)
    expect(world.bodies[0]._trackContact?.trackId).toBe('straight')
  })

  it('substeps fast motion so a body cannot tunnel through a thin spline', () => {
    const scenario = getPreset('projectile-motion')
    scenario.gravity.enabled = false
    scenario.constraints = []
    scenario.bodies = [createBody({ id: 'fast', radius: 0.2, position: { x: 0, y: 0.8 }, velocity: { x: 0, y: -35 }, restitution: 0 })]
    scenario.tracks = [createSplineTrack({ id: 'thin', thickness: 0.08, friction: 0, restitution: 0, knots: [
      createSplineKnot({ id: 'a', position: { x: -2, y: 0 }, tangent: { x: 4, y: 0 } }),
      createSplineKnot({ id: 'b', position: { x: 2, y: 0 }, tangent: { x: 4, y: 0 } }),
    ] })]
    const world = run(createWorld(scenario), 0.1)
    expect(world.bodies[0].position.y).toBeGreaterThanOrEqual(0.19)
  })

  it('completes the prepared loop above the disk threshold', () => {
    let reachedTop = false
    let returnedToBottom = false
    run(createWorld(getPreset('loop-the-loop')), 4.8, (world) => {
      const body = world.bodies[0]
      if (body._trackContact && body.position.y > 3.7) reachedTop = true
      if (reachedTop && body._trackContact && body.position.x > 2.5 && body.position.y < 1) returnedToBottom = true
    })
    expect(reachedTop).toBe(true)
    expect(returnedToBottom).toBe(true)
  })

  it('detaches from the loop when released below the required height', () => {
    const scenario = getPreset('loop-the-loop')
    scenario.tracks[0].knots[0].position.y = 4.3
    scenario.tracks[0].knots[0].tangent = { x: 5, y: -3 }
    const release = splinePointAtDistance(scenario.tracks[0], 0)
    scenario.bodies[0].position = { x: release.position.x + release.normal.x * scenario.bodies[0].radius, y: release.position.y + release.normal.y * scenario.bodies[0].radius }
    let hadContact = false
    let detached = false
    let maximumTrackCoordinate = 0
    run(createWorld(scenario), 4, (world) => {
      const contact = world.bodies[0]._trackContact
      if (contact && !detached) { hadContact = true; maximumTrackCoordinate = Math.max(maximumTrackCoordinate, contact.distance) }
      else if (hadContact) detached = true
    })
    expect(detached).toBe(true)
    expect(maximumTrackCoordinate).toBeLessThan(14)
  })

  it('runs a custom spline coaster across its hill without artificial energy loss', () => {
    const track = createSplineTrack({
      id: 'custom-coaster', name: 'Coaster track', friction: 0.9, restitution: 0, ideal: true,
      knots: [
        createSplineKnot({ id: 'k0', position: { x: -7, y: 5.4 }, tangent: { x: 3.5, y: -2.5 }, secondDerivative: { x: 0, y: 0 } }),
        createSplineKnot({ id: 'k1', position: { x: -3.5, y: -1.3 }, tangent: { x: 3, y: 0 }, secondDerivative: { x: 0, y: 5 } }),
        createSplineKnot({ id: 'k2', position: { x: 0, y: 2.8 }, tangent: { x: 3, y: 0 }, secondDerivative: { x: 0, y: -4 } }),
        createSplineKnot({ id: 'k3', position: { x: 3.3, y: -0.8 }, tangent: { x: 3, y: 0 }, secondDerivative: { x: 0, y: 4 } }),
        createSplineKnot({ id: 'k4', position: { x: 7, y: 1.1 }, tangent: { x: 3, y: 0 }, secondDerivative: { x: 0, y: 0 } }),
      ],
    })
    const release = splinePointAtDistance(track, 0)
    const scenario = {
      ...getPreset('projectile-motion'),
      bodies: [createWheel({ id: 'coaster-car', name: 'Coaster wheel', mass: 1.2, radius: 0.3, position: { x: release.position.x + release.normal.x * 0.3, y: release.position.y + release.normal.y * 0.3 }, inertiaModel: 'disk', friction: 0.9, restitution: 0, color: '#78e6d5' })],
      tracks: [track],
    }
    const trackLength = splineLength(track)
    let maximumTrackCoordinate = 0
    let maximumEnergyError = 0
    run(createWorld(scenario), 12, (world) => {
      maximumTrackCoordinate = Math.max(maximumTrackCoordinate, world.bodies[0]._trackContact?.distance ?? 0)
      maximumEnergyError = Math.max(maximumEnergyError, Math.abs(world.energyError.percent))
    })
    expect(maximumTrackCoordinate).toBeGreaterThan(trackLength * 0.85)
    expect(maximumEnergyError).toBeLessThan(2)
  })

  it('lets a zero-friction wheel slide through an ideal valley without hidden rolling torque', () => {
    const scenario = getPreset('projectile-motion')
    const track = createSplineTrack({ id: 'valley', template: 'valley', ideal: true, friction: 0.8, restitution: 0 })
    const release = splinePointAtDistance(track, 0)
    const wheel = createWheel({
      id: 'wheel',
      radius: 0.45,
      friction: 0,
      restitution: 0,
      position: { x: release.position.x + release.normal.x * 0.45, y: release.position.y + release.normal.y * 0.45 },
    })
    scenario.constraints = []
    scenario.tracks = [track]
    scenario.bodies = [wheel]
    let maximumTrackCoordinate = 0
    let maximumAngularSpeed = 0
    run(createWorld(scenario), 8, (world) => {
      maximumTrackCoordinate = Math.max(maximumTrackCoordinate, world.bodies[0]._trackContact?.distance ?? 0)
      maximumAngularSpeed = Math.max(maximumAngularSpeed, Math.abs(world.bodies[0].angularVelocity))
    })
    expect(maximumTrackCoordinate).toBeGreaterThan(splineLength(track) * 0.8)
    expect(maximumAngularSpeed).toBeLessThan(1e-8)
  })
})
