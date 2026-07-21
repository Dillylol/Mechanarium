import { describe, expect, it } from 'vitest'
import { bodyEnergy, conservationError, summarizeSystem, withEnergyTotal } from './metrics.js'
import { vector } from './vector.js'

describe('system metrics', () => {
  it('summarizes translational, rotational, and momentum values', () => {
    const summary = withEnergyTotal(summarizeSystem([
      { mass: 2, velocity: vector(3, 4), inertia: 0.5, angularVelocity: 2 },
    ], 10))

    expect(summary.translationalKinetic).toBe(25)
    expect(summary.rotationalKinetic).toBe(1)
    expect(summary.total).toBe(36)
    expect(summary.linearMomentum).toEqual(vector(6, 8))
  })

  it('reports signed absolute and relative conservation error', () => {
    expect(conservationError(100, 99)).toEqual({ absolute: -1, relative: -0.01, percent: -1 })
  })

  it('reports object-specific mgh and uses assembly inertia', () => {
    const energy = bodyEnergy({
      mass: 2,
      position: { x: 0, y: 3 },
      velocity: { x: 4, y: 0 },
      inertia: 1,
      assemblyInertia: 2,
      angularVelocity: 3,
      gravityEnabled: true,
      gravityMultiplier: 1,
    }, { enabled: true, g: 10, direction: { x: 0, y: -1 } })
    expect(energy).toMatchObject({ translational: 16, rotational: 9, gravitational: 60, height: 3, mechanical: 85 })
  })
})
