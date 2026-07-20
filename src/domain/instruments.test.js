import { describe, expect, it } from 'vitest'
import { createInstrument, deriveGateResults, detectPhotogateCrossings, measuredValue, rulerReading } from './instruments.js'

const body = (x, y = 0, vx = 2) => ({ id: 'cart', name: 'Cart', radius: 0.2, position: { x, y }, velocity: { x: vx, y: 0 }, acceleration: { x: 0, y: 0 } })
const world = (time, x, y = 0, vx = 2) => ({ time, bodies: [body(x, y, vx)] })

describe('laboratory instruments', () => {
  it('measures ruler distance and components', () => {
    expect(rulerReading(createInstrument('ruler', { a: { x: 1, y: 2 }, b: { x: 4, y: 6 } }))).toEqual({ dx: 3, dy: 4, distance: 5 })
  })

  it('interpolates forward and reverse photogate crossings', () => {
    const gate = createInstrument('photogate', { id: 'gate', center: { x: 0, y: 0 }, angle: Math.PI / 2, length: 2, resolution: 0.000001 })
    const forward = detectPhotogateCrossings(world(0, -1, 0, 2), world(1, 1, 0, 2), [gate])
    expect(forward.events).toHaveLength(1)
    expect(forward.events[0]).toMatchObject({ gateId: 'gate', bodyId: 'cart', time: 0.5 })
    expect(forward.events[0].direction).toBe(-1)
    const reverse = detectPhotogateCrossings(world(1, 1, 0, -2), world(2, -1, 0, -2), [gate])
    expect(reverse.events[0].time).toBe(1.5)
    expect(reverse.events[0].direction).toBe(1)
  })

  it('ignores crossings beyond the finite aperture and debounces until clear', () => {
    const gate = createInstrument('photogate', { id: 'gate', center: { x: 0, y: 0 }, angle: Math.PI / 2, length: 1 })
    expect(detectPhotogateCrossings(world(0, -1, 2), world(1, 1, 2), [gate]).events).toHaveLength(0)
    const crossing = detectPhotogateCrossings(world(0, -1), world(1, 0.05), [gate])
    const held = detectPhotogateCrossings(world(1, 0.05), world(1.1, -0.05), [gate], crossing.state)
    expect(crossing.events).toHaveLength(1)
    expect(held.events).toHaveLength(0)
  })

  it('derives paired-gate interval, average speed, and acceleration', () => {
    const gates = [createInstrument('photogate', { id: 'a', center: { x: 0, y: 0 } }), createInstrument('photogate', { id: 'b', center: { x: 2, y: 0 } })]
    const results = deriveGateResults([{ gateId: 'a', bodyId: 'cart', bodyName: 'Cart', time: 1, speed: 2 }, { gateId: 'b', bodyId: 'cart', bodyName: 'Cart', time: 1.5, speed: 3 }], gates)
    expect(results[0]).toMatchObject({ interval: 0.5, spacing: 2, averageSpeed: 4, acceleration: 2 })
  })

  it('keeps optional uncertainty deterministic for a stored seed', () => {
    const gate = createInstrument('photogate', { resolution: 0.0001, noiseEnabled: true, noiseSigma: 0.01 })
    expect(measuredValue(1.25, gate, 42)).toBe(measuredValue(1.25, gate, 42))
    expect(measuredValue(1.25, gate, 42)).not.toBe(measuredValue(1.25, gate, 43))
  })
})
