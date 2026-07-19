import { describe, expect, it } from 'vitest'
import { createBody, createConnector, createTrack } from '../domain/scenario.js'
import { getPreset } from '../domain/presets.js'
import { connectorState, resolveEndpoint } from './assembly.js'
import { createWorld, stepWorld } from './world.js'

function run(world, seconds) {
  let next = world
  const steps = Math.round(seconds / world.fixedStep)
  for (let index = 0; index < steps; index += 1) next = stepWorld(next)
  return next
}

function crossings(scenario, seconds, sample) {
  let world = createWorld(scenario)
  let previous = sample(world)
  const times = []
  for (let index = 0; index < seconds / world.fixedStep; index += 1) {
    world = stepWorld(world)
    const value = sample(world)
    if (previous < 0 && value >= 0) times.push(world.time)
    previous = value
  }
  return { world, times }
}

describe('Scenario v2 mechanics world', () => {
  it('applies master gravity with disabled and doubled per-body participation', () => {
    const scenario = getPreset('projectile-motion')
    scenario.constraints = []
    scenario.bodies = [
      createBody({ id: 'normal', position: { x: -2, y: 10 } }),
      createBody({ id: 'disabled', position: { x: 0, y: 10 }, gravityEnabled: false }),
      createBody({ id: 'double', position: { x: 2, y: 10 }, gravityMultiplier: 2 }),
    ]
    const world = run(createWorld(scenario), 1)
    expect(world.bodies[0].velocity.y).toBeCloseTo(-9.80665, 5)
    expect(world.bodies[1].velocity.y).toBe(0)
    expect(world.bodies[2].velocity.y).toBeCloseTo(-19.6133, 5)
  })

  it('keeps an undamped spring period and energy bounded', () => {
    const scenario = getPreset('spring-oscillator')
    const result = crossings(scenario, 12, (world) => world.bodies[0].position.x - scenario.connectors[0].restLength)
    const observedPeriod = result.times[1] - result.times[0]
    const expectedPeriod = 2 * Math.PI * Math.sqrt(scenario.bodies[0].mass / scenario.connectors[0].stiffness)
    expect(observedPeriod).toBeCloseTo(expectedPeriod, 2)
    expect(Math.abs(result.world.energyError.percent)).toBeLessThan(0.05)
  })

  it('allows a rope to go slack, then enforces its maximum length in tension', () => {
    const scenario = getPreset('rope-pendulum')
    scenario.gravity.enabled = false
    scenario.connectors[0] = createConnector('rope', { id: 'rope', length: 2, a: { type: 'world', position: { x: 0, y: 0 } }, b: { type: 'port', ownerId: 'pendulum-bob', portId: 'pendulum-bob:center' } })
    scenario.bodies[0].position = { x: 1, y: 0 }
    scenario.bodies[0].velocity = { x: 2, y: 0 }
    let world = run(createWorld(scenario), 0.2)
    expect(connectorState(world, world.connectors[0]).length).toBeLessThan(2)
    expect(world.connectors[0].tension).toBe(0)
    let maximumTension = 0
    for (let index = 0; index < 120; index += 1) {
      world = stepWorld(world)
      maximumTension = Math.max(maximumTension, world.connectors[0].tension)
    }
    expect(connectorState(world, world.connectors[0]).length).toBeLessThanOrEqual(2.000001)
    expect(maximumTension).toBeGreaterThan(0)
  })

  it('matches the small-angle massless-rope pendulum period', () => {
    const scenario = getPreset('rope-pendulum')
    const result = crossings(scenario, 12, (world) => world.bodies[0].position.x)
    const observedPeriod = result.times[1] - result.times[0]
    const expectedPeriod = 2 * Math.PI * Math.sqrt(scenario.connectors[0].length / scenario.gravity.g)
    expect(observedPeriod).toBeCloseTo(expectedPeriod, 1)
  })

  it('matches uniform-beam inertia and physical-pendulum period with bounded pin error', () => {
    const scenario = getPreset('physical-pendulum')
    const beam = scenario.bodies[0]
    expect(beam.inertia).toBeCloseTo(beam.mass * beam.length ** 2 / 12, 10)
    const result = crossings(scenario, 12, (world) => world.bodies[0].angle + Math.PI / 2)
    const observedPeriod = result.times[1] - result.times[0]
    const expectedPeriod = 2 * Math.PI * Math.sqrt(2 * beam.length / (3 * scenario.gravity.g))
    expect(observedPeriod).toBeCloseTo(expectedPeriod, 1)
    const joint = result.world.joints[0]
    const a = resolveEndpoint(result.world, joint.a).position
    const b = resolveEndpoint(result.world, joint.b).position
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-5)
  })

  it('includes attached mass through the parallel-axis theorem', () => {
    const world = createWorld(getPreset('compound-pendulum'))
    const [beam, sphere] = world.bodies
    const totalMass = beam.mass + sphere.mass
    const center = { x: (beam.position.x * beam.mass + sphere.position.x * sphere.mass) / totalMass, y: (beam.position.y * beam.mass + sphere.position.y * sphere.mass) / totalMass }
    const expected = [beam, sphere].reduce((sum, body) => sum + body.inertia + body.mass * ((body.position.x - center.x) ** 2 + (body.position.y - center.y) ** 2), 0)
    expect(beam.assemblyInertia).toBeCloseTo(expected, 10)
    expect(sphere.assemblyInertia).toBeCloseTo(expected, 10)
  })

  it('uses only the rendered track top for contact and never remotely snaps', () => {
    const scenario = getPreset('projectile-motion')
    scenario.constraints = []
    scenario.tracks = [createTrack({ id: 'track', center: { x: 0, y: 0 }, angle: 0, length: 4, thickness: 0.2, restitution: 0, friction: 0 })]
    scenario.bodies = [createBody({ id: 'drop', position: { x: 0, y: 5 } })]
    const airborne = run(createWorld(scenario), 0.2)
    expect(airborne.bodies[0].position.y).toBeCloseTo(5 - 0.5 * scenario.gravity.g * 0.2 ** 2, 4)
    const landed = run(createWorld(scenario), 1.2)
    expect(landed.bodies[0].position.y).toBeCloseTo(0.1 + landed.bodies[0].radius, 5)
  })

  it('honors track restitution and Coulomb-like friction impulses', () => {
    const scenario = getPreset('projectile-motion')
    scenario.constraints = []
    scenario.tracks = [createTrack({ id: 'track', center: { x: 0, y: 0 }, length: 8, thickness: 0.2, restitution: 0.5, friction: 0.4 })]
    scenario.bodies = [createBody({ id: 'impact', position: { x: 0, y: 0.46 }, velocity: { x: 2, y: -3 }, radius: 0.35 })]
    const world = stepWorld(createWorld(scenario))
    expect(world.bodies[0].velocity.y).toBeGreaterThan(0)
    expect(world.bodies[0].velocity.x).toBeLessThan(2)
  })

  it('transfers impulse and torque through dynamic-beam collisions', () => {
    const scenario = getPreset('physical-pendulum')
    scenario.gravity.enabled = false
    scenario.joints = []
    scenario.bodies[0] = createBody({ id: 'beam', name: 'Beam', shape: 'beam', mode: 'dynamic', mass: 2, length: 4, position: { x: 0, y: 0 }, restitution: 0.6, gravityEnabled: false })
    scenario.bodies.push(createBody({ id: 'ball', position: { x: 1.2, y: 1 }, velocity: { x: 0, y: -3 }, restitution: 0.6, gravityEnabled: false }))
    const world = run(createWorld(scenario), 0.3)
    const beam = world.bodies.find((body) => body.id === 'beam')
    const ball = world.bodies.find((body) => body.id === 'ball')
    expect(ball.velocity.y).toBeGreaterThan(-3)
    expect(Math.abs(beam.angularVelocity)).toBeGreaterThan(0.01)
  })

  it('applies spring torque at an off-center beam port', () => {
    const scenario = getPreset('physical-pendulum')
    scenario.gravity.enabled = false
    scenario.joints = []
    scenario.bodies[0] = createBody({ id: 'beam', shape: 'beam', mode: 'dynamic', mass: 2, length: 2, position: { x: 0, y: 0 }, gravityEnabled: false })
    scenario.connectors = [createConnector('spring', { id: 'spring', a: { type: 'world', position: { x: 1, y: 3 } }, b: { type: 'port', ownerId: 'beam', portId: 'beam:end' }, restLength: 1, stiffness: 5 })]
    const world = stepWorld(createWorld(scenario))
    expect(world.bodies[0].angularAcceleration).toBeGreaterThan(0)
    expect(world.bodies[0].angularVelocity).toBeGreaterThan(0)
  })

  it('runs a representative pinned assembly for 60 seconds without divergence', () => {
    const world = run(createWorld(getPreset('compound-pendulum')), 60)
    for (const body of world.bodies) expect([body.position.x, body.position.y, body.velocity.x, body.velocity.y, body.angle]).toEqual(expect.arrayContaining([expect.any(Number)]))
    expect(world.bodies.every((body) => Number.isFinite(body.position.x) && Number.isFinite(body.position.y) && Number.isFinite(body.angle))).toBe(true)
    expect(Math.abs(world.energyError.percent)).toBeLessThan(5)
  })
})
