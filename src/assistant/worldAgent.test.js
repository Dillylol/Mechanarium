import { describe, expect, it } from 'vitest'
import { getPreset } from '../domain/presets.js'
import { createWorld } from '../physics/world.js'
import { describeWorld } from './describeWorld.js'
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

  it('distinguishes a paired photogate assembly from a manual gate', () => {
    expect(planWorldLocally('Add a photogate assembly').actions[0]).toMatchObject({ type: 'add_instrument', target: 'photogateAssembly' })
    expect(planWorldLocally('Add a photogate').actions[0]).toMatchObject({ type: 'add_instrument', target: 'photogate' })
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
    expect(plan.proposal.actions).toEqual([{ type: 'load_preset', target: 'loop-the-loop' }])
  })

  it('scaffolds a pasted problem before offering a worked approach', () => {
    const first = planWorldLocally('A 2 kg block is launched at 5 m/s. Find its momentum?')
    expect(first.tutorial.stage).toBe('identify-knowns')
    expect(first.message).toMatch(/list the known/i)
    const worked = planWorldLocally('I am stuck, show the worked solution')
    expect(worked.tutorial.stage).toBe('worked-solution')
    expect(worked.message).toMatch(/worked approach/i)
  })

  it('prefers building a collision lab over problem scaffolding', () => {
    const plan = planWorldLocally('Build a 1D momentum-collision lab with disks R and S, a ruler, and a photogate. Do not solve yet.')
    expect(plan.tutorial).toBeUndefined()
    expect(plan.proposal.actions).toEqual(expect.arrayContaining([
      { type: 'load_preset', target: 'momentum-collision' },
      { type: 'add_instrument', target: 'ruler' },
      { type: 'add_instrument', target: 'photogateAssembly' },
    ]))
  })

  it('explains the current world in detail offline without proposing actions', () => {
    const scenario = getPreset('momentum-collision')
    const world = createWorld(scenario)
    const worldDescription = describeWorld({ scenario, world, selectedBody: world.bodies[1], notebook: { trials: [] } })
    const plan = planWorldLocally('Give me a detailed description of every entity in the current world', {
      telemetry: { world_description: worldDescription },
    })

    expect(plan.actions).toEqual([])
    expect(plan.message).toContain('Cart A')
    expect(plan.message).toContain('Cart B')
    expect(plan.message).toContain('Observation')
    expect(plan.message).toContain('Inference')
    expect(plan.message.length).toBeGreaterThan(400)
  })

  it('explains the selected body offline with forces, energy, and contact', () => {
    const scenario = getPreset('projectile-motion')
    const world = createWorld(scenario)
    const worldDescription = describeWorld({ scenario, world, selectedBody: world.bodies[0], notebook: { trials: [] } })
    const plan = planWorldLocally('Explain the selected body', { telemetry: { world_description: worldDescription } })

    expect(plan.actions).toEqual([])
    expect(plan.message).toMatch(/velocity/i)
    expect(plan.message).toMatch(/net force/i)
    expect(plan.message).toMatch(/kinetic energy/i)
  })
})
