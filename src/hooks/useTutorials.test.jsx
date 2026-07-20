import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { TUTORIALS } from '../domain/tutorials.js'
import { useTutorials } from './useTutorials.js'

beforeEach(() => localStorage.clear())

describe('guided tutorials', () => {
  it('ships onboarding plus four investigations with complete learning stages', () => {
    expect(TUTORIALS.map((tutorial) => tutorial.id)).toEqual(['onboarding', 'projectile-lab', 'incline-lab', 'atwood-lab', 'loop-lab'])
    for (const tutorial of TUTORIALS) {
      expect(tutorial.objective).toBeTruthy()
      expect(tutorial.steps.at(-1).id).toBe(tutorial.id === 'onboarding' ? 'vector' : 'explain')
    }
  })

  it('persists progress and exposes the current step to Vector', () => {
    const inputs = { world: { scenarioId: 'projectile-motion', time: 0, instruments: [] }, notebook: { trials: [] }, history: [] }
    const { result } = renderHook(() => useTutorials(inputs))
    act(() => result.current.start('projectile-lab'))
    expect(result.current.context).toMatchObject({ id: 'projectile-lab', step: 'Learning objective', index: 1 })
    act(() => result.current.advance())
    expect(result.current.context.step).toBe('Make a prediction')
    expect(JSON.parse(localStorage.getItem('mechanarium:tutorial-progress:v1')).progress['projectile-lab']).toBe(1)
  })
})
