import { describe, expect, it } from 'vitest'
import { INTEGRATORS } from '../physics/constants.js'
import { allPorts, beamInertia, createBody, createConnector, createSplineTrack, createWheel, deserializeScenario, fitAutoLengthBeams, migrateScenario, serializeScenario, validateScenario, wheelInertia } from './scenario.js'
import { getPreset } from './presets.js'
import { createInstrument } from './instruments.js'

describe('Scenario v4 contract', () => {
  it('defaults instruments additively and preserves them without creating ports', () => {
    const source = getPreset('projectile-motion')
    expect(source.instruments).toEqual([])
    source.instruments.push(createInstrument('photogate', { id: 'gate', targetBodyId: source.bodies[0].id }))
    const roundTrip = deserializeScenario(serializeScenario(source))
    expect(roundTrip.instruments[0]).toMatchObject({ id: 'gate', type: 'photogate' })
    expect(allPorts(roundTrip).some((port) => port.ownerId === 'gate')).toBe(false)
  })
  it('round-trips v2 scenarios without losing assembly data', () => {
    const source = getPreset('compound-pendulum')
    expect(deserializeScenario(serializeScenario(source))).toEqual(source)
  })

  it('automatically migrates v1 gravity, inclines, and springs', () => {
    const legacy = {
      version: 1, id: 'legacy', name: 'Legacy', integrator: INTEGRATORS.VELOCITY_VERLET,
      fixedStep: 1 / 120, duration: 10, bounds: {},
      bodies: [createBody({ id: 'mass' })],
      forces: [
        { id: 'g', type: 'gravity', g: 9.81 },
        { id: 's', type: 'spring', bodyId: 'mass', anchor: { x: 0, y: 0 }, restLength: 1, stiffness: 4 },
      ],
      constraints: [{ id: 'r', type: 'incline', start: { x: -2, y: 0 }, end: { x: 2, y: 2 } }],
    }
    const migrated = migrateScenario(legacy)
    expect(migrated.version).toBe(4)
    expect(migrated.gravity).toMatchObject({ enabled: true, g: 9.81 })
    expect(migrated.bodies[0]).toMatchObject({ gravityEnabled: true, gravityMultiplier: 1 })
    expect(migrated.tracks[0]).toMatchObject({ id: 'r', type: 'segment' })
    expect(migrated.connectors[0]).toMatchObject({ id: 's', type: 'spring' })
    expect(validateScenario(migrated).valid).toBe(true)
  })

  it('rejects invalid beam modes, ports, and duplicate joint graphs', () => {
    const source = getPreset('physical-pendulum')
    source.bodies[0].mode = 'hover'
    source.ports.push({ id: 'bad-port', ownerId: 'missing', name: 'Bad', localPosition: { x: 0, y: 0 } })
    source.joints.push(structuredClone(source.joints[0]))
    source.joints.at(-1).id = 'duplicate-pin'
    const result = validateScenario(source)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/invalid mode|invalid owner|duplicates/i)
  })

  it('derives deterministic default ports and preserves custom attachment points', () => {
    const source = getPreset('projectile-motion')
    source.ports.push({ id: 'projectile:sensor', ownerId: 'projectile', name: 'Sensor mount', kind: 'custom', custom: true, localPosition: { x: 0.1, y: 0.2 } })
    const ids = allPorts(deserializeScenario(serializeScenario(source))).map((port) => port.id)
    expect(ids).toEqual(expect.arrayContaining(['projectile:center', 'projectile:north', 'projectile:sensor']))
  })

  it('uses the uniform-beam inertia formula', () => {
    expect(beamInertia(3, 4)).toBe(4)
  })

  it('derives disk and hoop wheel inertia and axle/rim ports', () => {
    expect(wheelInertia(2, 0.5, 'disk')).toBeCloseTo(0.25, 10)
    expect(wheelInertia(2, 0.5, 'hoop')).toBeCloseTo(0.5, 10)
    const scenario = getPreset('projectile-motion')
    scenario.bodies.push(createWheel({ id: 'wheel', mass: 2, radius: 0.5, inertiaModel: 'hoop' }))
    expect(allPorts(scenario).filter((port) => port.ownerId === 'wheel').map((port) => port.id)).toEqual(['wheel:center', 'wheel:north', 'wheel:east', 'wheel:south', 'wheel:west'])
  })

  it('migrates v2 and rejects two routed ropes sharing one wheel', () => {
    const source = getPreset('rotating-atwood')
    source.version = 2
    expect(migrateScenario(source).version).toBe(4)
    source.version = 3
    source.connectors.push(createConnector('rope', { id: 'second-rope', a: source.connectors[0].a, b: source.connectors[0].b, route: { ...source.connectors[0].route } }))
    expect(validateScenario(source).errors.join(' ')).toMatch(/already used/i)
  })

  it('migrates v3 and round-trips spline tracks with world-space ports', () => {
    const legacy = getPreset('rolling-incline')
    legacy.version = 3
    expect(migrateScenario(legacy).version).toBe(4)
    const scenario = getPreset('projectile-motion')
    scenario.tracks = [createSplineTrack({ id: 'curve', template: 'hill' })]
    const restored = deserializeScenario(serializeScenario(scenario))
    expect(restored.tracks[0]).toMatchObject({ id: 'curve', type: 'spline', supportSide: 'left' })
    expect(allPorts(restored).filter((port) => port.ownerId === 'curve')).toHaveLength(3)
    expect(validateScenario(restored).valid).toBe(true)
  })

  it('auto-fits a beam between two connected end targets while editing', () => {
    const scenario = getPreset('physical-pendulum')
    const beam = scenario.bodies[0]
    beam.autoLength = true
    beam.mass = 3
    scenario.joints = [
      { id: 'start', type: 'pin', a: { type: 'world', position: { x: -2, y: 1 } }, b: { type: 'port', ownerId: beam.id, portId: `${beam.id}:start` } },
      { id: 'end', type: 'pin', a: { type: 'world', position: { x: 2, y: 4 } }, b: { type: 'port', ownerId: beam.id, portId: `${beam.id}:end` } },
    ]
    fitAutoLengthBeams(scenario)
    expect(beam.position).toEqual({ x: 0, y: 2.5 })
    expect(beam.length).toBeCloseTo(5, 10)
    expect(beam.angle).toBeCloseTo(Math.atan2(3, 4), 10)
    expect(beam.inertia).toBeCloseTo(6.25, 10)
  })

  it('reports invalid JSON distinctly', () => {
    expect(() => deserializeScenario('{oops')).toThrow('not valid JSON')
  })
})
