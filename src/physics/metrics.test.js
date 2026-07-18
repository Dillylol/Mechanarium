import { describe, expect, it } from 'vitest'
import { conservationError, summarizeSystem, withEnergyTotal } from './metrics.js'
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
})
