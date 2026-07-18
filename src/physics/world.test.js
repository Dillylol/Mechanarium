import { describe, expect, it } from 'vitest'
import { getPreset } from '../domain/presets.js'
import { createBody } from '../domain/scenario.js'
import { createWorld, stepWorld } from './world.js'

function run(world, seconds) {
  let next = world
  const steps = Math.round(seconds / world.fixedStep)
  for (let index = 0; index < steps; index += 1) next = stepWorld(next)
  return next
}

describe('mechanics world', () => {
  it('advances projectile motion deterministically', () => {
    const scenario = getPreset('projectile-motion')
    scenario.constraints = []
    const world = run(createWorld(scenario), 1)
    expect(world.bodies[0].position.x).toBeCloseTo(-0.2, 5)
    expect(world.bodies[0].position.y).toBeCloseTo(4.296675, 5)
    expect(world.bodies[0].velocity.y).toBeCloseTo(-2.60665, 5)
  })

  it('applies Earth gravity equally to different masses', () => {
    const scenario = getPreset('projectile-motion')
    scenario.bodies = [
      createBody({ id: 'light', mass: 1, position: { x: -1, y: 10 }, velocity: { x: 0, y: 0 } }),
      createBody({ id: 'heavy', mass: 8, position: { x: 1, y: 10 }, velocity: { x: 0, y: 0 } }),
    ]
    scenario.constraints = []
    const world = run(createWorld(scenario), 1)

    for (const body of world.bodies) {
      expect(body.velocity.y).toBeCloseTo(-9.80665, 5)
      expect(body.position.y).toBeCloseTo(10 - 0.5 * 9.80665, 5)
    }
  })

  it('conserves linear momentum through circle collisions', () => {
    const initial = createWorld(getPreset('momentum-collision'))
    const world = run(initial, 1.5)
    expect(world.metrics.linearMomentum.x).toBeCloseTo(initial.metrics.linearMomentum.x, 8)
  })

  it('couples rolling distance and angle on the incline', () => {
    const world = run(createWorld(getPreset('rolling-incline')), 0.5)
    const body = world.bodies[0]
    const ramp = world.constraints[0]
    const runLength = Math.hypot(ramp.end.x - ramp.start.x, ramp.end.y - ramp.start.y)
    const unit = { x: (ramp.end.x - ramp.start.x) / runLength, y: (ramp.end.y - ramp.start.y) / runLength }
    const along = (body.position.x - ramp.start.x) * unit.x + (body.position.y - ramp.start.y) * unit.y
    const speedAlong = body.velocity.x * unit.x + body.velocity.y * unit.y
    const expectedAcceleration = 9.80665 * Math.abs(ramp.end.y - ramp.start.y) / runLength * (2 / 3)
    expect(body.angle).toBeCloseTo(along / body.radius, 8)
    expect(speedAlong).toBeCloseTo(expectedAcceleration * 0.5, 5)
  })

  it('keeps undamped spring energy tightly bounded', () => {
    const world = run(createWorld(getPreset('spring-oscillator')), 12)
    expect(Math.abs(world.energyError.percent)).toBeLessThan(0.05)
  })

  it('produces a bound central-force orbit over one period-sized interval', () => {
    const world = run(createWorld(getPreset('orbital-motion')), 11)
    const radius = Math.hypot(world.bodies[0].position.x, world.bodies[0].position.y)
    expect(radius).toBeGreaterThan(3.8)
    expect(radius).toBeLessThan(4.3)
  })
})
