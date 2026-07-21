import { describe, expect, it } from 'vitest'
import { createBody, createConnector, createTrack, createWheel } from '../domain/scenario.js'
import { getPreset } from '../domain/presets.js'
import { bodyLoadState, connectorState, resolveEndpoint, resolvePort } from './assembly.js'
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

describe('planar mechanics world', () => {
  it('detaches unattached push-only springs at rest length', () => {
    const scenario = {
      id: 'push-spring-test',
      bodies: [createBody({ id: 'mass', mass: 2, position: { x: -1, y: 0 }, velocity: { x: 0, y: 0 } })],
      connectors: [createConnector('spring', { id: 'spring-push', a: { type: 'world', position: { x: -2, y: 0 } }, b: { type: 'port', ownerId: 'mass', portId: 'mass:center' }, restLength: 1.5, stiffness: 100, unattached: true })],
      gravity: { enabled: false },
    }
    let world = createWorld(scenario)
    // Initially compressed at restLength=1.5, position x=-1 => length=1.0, extension = -0.5
    world = run(world, 0.5)
    // Mass should be pushed right and separate when length >= 1.5
    expect(world.bodies[0].position.x).toBeGreaterThan(0)
    // State of spring at extension > 0 should yield 0 force
    const springState = connectorState(world, world.connectors[0])
    expect(springState.force).toBe(0)
  })

  it('executes mid-air explosion event conserving momentum', () => {
    const scenario = {
      id: 'explosion-test',
      bodies: [createBody({ id: 'projectile', mass: 4, position: { x: 0, y: 10 }, velocity: { x: 10, y: 0 } })],
      events: [{ id: 'evt-1', trigger: 'time', time: 0.1, type: 'explosion', targetId: 'projectile', ratio: 0.25, impulseX: 6 }],
      gravity: { enabled: false },
    }
    let world = createWorld(scenario)
    world = run(world, 0.2)
    // Projectile should split into Q (mass 1) and R (mass 3)
    expect(world.bodies.length).toBe(2)
    const pieceQ = world.bodies.find((b) => b.name.includes('Q'))
    const pieceR = world.bodies.find((b) => b.name.includes('R'))
    expect(pieceQ.mass).toBe(1)
    expect(pieceR.mass).toBe(3)
    // Momentum conservation: 1 * vQx + 3 * vRx = 4 * 10 = 40
    const totalPx = pieceQ.mass * pieceQ.velocity.x + pieceR.mass * pieceR.velocity.x
    expect(totalPx).toBeCloseTo(40, 5)
  })

  it('keeps custom attachment points mounted through owner translation and rotation', () => {
    const scenario = getPreset('projectile-motion')
    const owner = scenario.bodies[0]
    scenario.ports.push({ id: 'projectile:mount', ownerId: owner.id, name: 'Mount', kind: 'custom', custom: true, localPosition: { x: 1, y: 0 } })
    const world = createWorld(scenario)
    world.bodies[0].position = { x: 3, y: 4 }
    world.bodies[0].angle = Math.PI / 2
    const mounted = resolvePort(world, 'projectile:mount')
    expect(mounted.x).toBeCloseTo(3, 8)
    expect(mounted.y).toBeCloseTo(5, 8)
  })

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

  it('matches ideal Atwood acceleration, equal tensions, and a stationary pulley', () => {
    const scenario = getPreset('ideal-atwood')
    const world = run(createWorld(scenario), 0.5)
    const massB = world.bodies.find((body) => body.id === 'ideal-mass-b')
    const wheel = world.bodies.find((body) => body.id === 'ideal-wheel')
    const state = connectorState(world, world.connectors[0])
    const expected = scenario.gravity.g * (2 - 1) / (2 + 1)
    expect(-massB.velocity.y / 0.5).toBeCloseTo(expected, 3)
    expect(state.tensionA).toBeCloseTo(state.tensionB, 6)
    expect(wheel.angle).toBe(0)
    expect(bodyLoadState(world, wheel.id).components.some((component) => component.kind === 'axle-reaction')).toBe(true)
  })

  it('couples rotating Atwood tensions, torque, and wheel angular acceleration', () => {
    const scenario = getPreset('rotating-atwood')
    const world = run(createWorld(scenario), 0.5)
    const massB = world.bodies.find((body) => body.id === 'rotating-mass-b')
    const wheel = world.bodies.find((body) => body.id === 'rotating-wheel')
    const state = connectorState(world, world.connectors[0])
    const expected = scenario.gravity.g / (3 + wheel.inertia / wheel.radius ** 2)
    const loads = bodyLoadState(world, wheel.id)
    expect(-massB.velocity.y / 0.5).toBeCloseTo(expected, 3)
    expect(state.tensionB).toBeGreaterThan(state.tensionA)
    expect(Math.abs(massB.velocity.y)).toBeCloseTo(Math.abs(wheel.angularVelocity) * wheel.radius, 4)
    expect(loads.netTorque).toBeCloseTo((state.tensionA - state.tensionB) * wheel.radius, 4)
    expect(loads.netTorque).toBeCloseTo(wheel.inertia * wheel.angularAcceleration, 3)
  })

  it('uses disk and hoop inertia in friction-limited rolling contact', () => {
    const angle = -Math.PI / 9
    const tangent = { x: Math.cos(angle), y: Math.sin(angle) }
    const normal = { x: -tangent.y, y: tangent.x }
    const speeds = {}
    for (const model of ['disk', 'hoop']) {
      const scenario = getPreset('projectile-motion')
      scenario.constraints = []
      scenario.tracks = [createTrack({ id: 'wheel-track', center: { x: 0, y: 0 }, angle, length: 8, thickness: 0.2, friction: 1, restitution: 0 })]
      scenario.bodies = [createWheel({ id: `wheel-${model}`, mass: 2, radius: 0.5, inertiaModel: model, position: { x: -2 * tangent.x + 0.6 * normal.x, y: -2 * tangent.y + 0.6 * normal.y } })]
      const world = run(createWorld(scenario), 1)
      const wheel = world.bodies[0]
      speeds[model] = wheel.velocity.x * tangent.x + wheel.velocity.y * tangent.y
      const coefficient = model === 'disk' ? 0.5 : 1
      expect(speeds[model]).toBeCloseTo(scenario.gravity.g * Math.sin(-angle) / (1 + coefficient), 2)
      expect(bodyLoadState(world, wheel.id).slipError).toBeLessThan(1e-6)
    }
    expect(speeds.disk).toBeGreaterThan(speeds.hoop)
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

  it.each(['pin', 'rigid'])('runs gravity with a beam %s-jointed to a ramp track', (jointType) => {
    const scenario = getPreset('projectile-motion')
    const track = createTrack({ id: 'ramp', center: { x: 0, y: 0 }, angle: 0, length: 4, thickness: 0.18 })
    const beam = createBody({ id: 'beam', shape: 'beam', mode: 'dynamic', length: 2, position: { x: 3, y: 0.09 } })
    scenario.constraints = []
    scenario.tracks = [track]
    scenario.bodies = [createBody({ id: 'falling', position: { x: -3, y: 3 } }), beam]
    scenario.joints = [{
      id: 'ramp-beam-joint',
      type: jointType,
      a: { type: 'port', ownerId: track.id, portId: `${track.id}:end` },
      b: { type: 'port', ownerId: beam.id, portId: `${beam.id}:start` },
    }]

    const initial = createWorld(scenario)
    const world = stepWorld(initial)

    expect(world.time).toBeCloseTo(initial.fixedStep, 10)
    expect(world.tracks[0].center).toEqual(track.center)
    expect(world.bodies.find((body) => body.id === 'falling').velocity.y).toBeLessThan(0)
    expect(world.bodies.every((body) => Number.isFinite(body.position.x) && Number.isFinite(body.position.y))).toBe(true)
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
