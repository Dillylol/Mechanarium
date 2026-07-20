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

  it('can remove uniform gravity and add an orbital attractor', () => {
    expect(planWorldLocally('Turn off gravity').actions[0]).toMatchObject({ type: 'remove_force', target: 'gravity' })
    expect(planWorldLocally('Add a central force attractor').actions[0]).toMatchObject({ type: 'add_force', target: 'central' })
  })

  it('can explicitly remove the floor constraint', () => {
    expect(planWorldLocally('Turn off the floor').actions[0]).toMatchObject({ type: 'remove_constraint', target: 'floor' })
  })

  it('asks for a supported construction when intent is unclear', () => {
    expect(planWorldLocally('make it interesting').actions).toHaveLength(0)
  })

  it('grounds inquiry in compact measured evidence and the current guide step', () => {
    const plan = planWorldLocally('What does the trial evidence show?', {
      telemetry: { lab: { guide_step: 'Interpret the evidence', trials: [{
        sample_count: 121,
        gate_event_count: 2,
        gate_results: [{ interval: 0.5, averageSpeed: 2.4, acceleration: 1.2 }],
      }] } },
    })
    expect(plan.actions).toEqual([])
    expect(plan.message).toContain('0.5000 s')
    expect(plan.message).toContain('2.400 m/s')
    expect(plan.message).toContain('1.200 m/s')
    expect(plan.message).toContain('Interpret the evidence')
    expect(plan.message.endsWith('?')).toBe(true)
  })

  it('never invents a paired result when no gate pair exists', () => {
    const plan = planWorldLocally('Explain the measurement', {
      telemetry: { lab: { trials: [{ sample_count: 48, gate_event_count: 1, gate_results: [] }] } },
    })
    expect(plan.message).toContain('48 samples and 1 gate events')
    expect(plan.message).toContain('no paired-gate result yet')
  })

  it('previews an offline roller coaster instead of applying it immediately', () => {
    const plan = planWorldLocally('Create a rollercoaster')
    expect(plan.actions).toEqual([])
    expect(plan.proposal.actions).toEqual([{ type: 'load_preset', target: 'spline-roller-coaster' }])
  })

  it('scaffolds a pasted problem before offering a worked approach', () => {
    const first = planWorldLocally('A 2 kg block is launched at 5 m/s. Find its momentum?')
    expect(first.tutorial.stage).toBe('identify-knowns')
    expect(first.message).toMatch(/list the known/i)
    const worked = planWorldLocally('I am stuck, show the worked solution', { telemetry: { tutor: first.tutorial } })
    expect(worked.tutorial.stage).toBe('worked-solution')
    expect(worked.message).toMatch(/worked approach/i)
  })
})
