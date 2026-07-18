import { describe, expect, it, vi } from 'vitest'
import { createFixedStepClock } from './clock.js'

describe('fixed-step clock', () => {
  it('converts render time into deterministic simulation steps', () => {
    const clock = createFixedStepClock({ fixedStep: 0.01, maxFrameDelta: 1, maxSteps: 100 })
    const step = vi.fn()
    const result = clock.advance(0.055, step)

    expect(step).toHaveBeenCalledTimes(5)
    expect(result.simulationTime).toBeCloseTo(0.05)
    expect(result.alpha).toBeCloseTo(0.5)
  })

  it('caps long frames and reports dropped time', () => {
    const clock = createFixedStepClock({ fixedStep: 0.01, maxFrameDelta: 0.05, maxSteps: 3 })
    const result = clock.advance(0.2, () => {})

    expect(result.steps).toBe(3)
    expect(result.droppedTime).toBeCloseTo(0.17)
  })
})
