import { describe, expect, it } from 'vitest'
import { loopTopNormalForce, loopTopSpeed, minimumLoopHeight } from './loopAnalysis.js'

describe('idealized loop analysis', () => {
  it('matches sliding, disk, and hoop minimum-height relationships', () => {
    expect(minimumLoopHeight(2, 0)).toBe(5)
    expect(minimumLoopHeight(2, 0.5)).toBe(5.5)
    expect(minimumLoopHeight(2, 1)).toBe(6)
  })

  it('produces zero top normal force at the limiting release height', () => {
    const radius = 2
    const speed = loopTopSpeed(minimumLoopHeight(radius, 0.5), radius, 0.5)
    expect(loopTopNormalForce(1, speed, radius)).toBeCloseTo(0, 8)
  })
})
