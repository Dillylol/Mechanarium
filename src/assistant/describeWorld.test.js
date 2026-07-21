import { describe, expect, it } from 'vitest'
import { createInstrument } from '../domain/instruments.js'
import { getPreset } from '../domain/presets.js'
import { createWorld } from '../physics/world.js'
import { describeWorld, formatWorldDescription } from './describeWorld.js'

describe('Vector world description', () => {
  it('serializes every entity, topology, SI dimensions, diagnostics, and selected-body state', () => {
    const scenario = getPreset('inclined-spring-oscillator')
    const world = createWorld(scenario)
    const selected = world.bodies[0]
    const description = describeWorld({ scenario, world, selectedBody: selected, notebook: { trials: [] } })

    expect(description.entities.bodies).toHaveLength(world.bodies.length)
    expect(description.entities.tracks).toHaveLength(world.tracks.length)
    expect(description.entities.connectors).toHaveLength(world.connectors.length)
    expect(description.topology.ports).toHaveLength(world.ports.length)
    expect(description.entities.bodies[0].mass.unit).toBe('kg')
    expect(description.entities.tracks[0].dimensions.length.unit).toBe('m')
    expect(description.selected.kinematics.velocity.unit).toBe('m/s')
    expect(description.selected.forces.net.unit).toBe('N')
    expect(description.selected.energy.evidence_kind).toBe('inference')
    expect(description.diagnostics.evidence_kind).toBe('inference')
    expect(() => JSON.stringify(description)).not.toThrow()
  })

  it('includes ruler and photogate readings with units', () => {
    const scenario = getPreset('projectile-motion')
    scenario.instruments = [
      createInstrument('ruler', { id: 'ruler-1', a: { x: 0, y: 0 }, b: { x: 3, y: 4 } }),
      createInstrument('photogate', { id: 'gate-1' }),
    ]
    const world = createWorld(scenario)
    const notebook = { trials: [{ gateEvents: [{ gateId: 'gate-1', bodyId: 'projectile', time: 1.25, position: { x: 1, y: 2 }, speed: 3 }], gateResults: [] }] }
    const description = describeWorld({ scenario, world, selectedBody: world.bodies[0], notebook })

    expect(description.entities.instruments[0].readings.distance).toEqual({ value: 5, unit: 'm' })
    expect(description.entities.instruments[1].readings.latest_event.time).toEqual({ value: 1.25, unit: 's' })
  })

  it('formats detailed world and selected-entity explanations with evidence labels', () => {
    const scenario = getPreset('momentum-collision')
    const world = createWorld(scenario)
    const description = describeWorld({ scenario, world, selectedBody: world.bodies[1], notebook: { trials: [] } })

    const detailed = formatWorldDescription(description, { detailed: true })
    const selected = formatWorldDescription(description, { selectedOnly: true })
    expect(detailed).toContain('Observation')
    expect(detailed).toContain('Cart A')
    expect(detailed).toContain('Cart B')
    expect(detailed).toContain('Inference')
    expect(selected).toContain('selected body')
    expect(selected).toContain('net force')
    expect(selected).toContain('kinetic energy')
  })
})
