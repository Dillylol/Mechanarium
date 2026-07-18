import { describe, expect, it } from 'vitest'
import { planWorldLocally } from './worldAgent.js'

describe('local world planner', () => {
  it('turns a compound construction request into supported actions', () => {
    const plan = planWorldLocally('Add a ball, a ramp, gravity, and a floor')
    expect(plan.actions.map((action) => action.target)).toEqual(['sphere', 'ramp', 'floor', 'gravity'])
  })

  it('loads named experiments', () => {
    expect(planWorldLocally('Show me an orbit').actions).toEqual([{ type: 'load_preset', target: 'orbital-motion' }])
  })

  it('asks for a supported construction when intent is unclear', () => {
    expect(planWorldLocally('make it interesting').actions).toHaveLength(0)
  })
})
