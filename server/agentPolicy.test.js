import { describe, expect, it } from 'vitest'
import { getPreset } from '../src/domain/presets.js'
import { validateAgentInput, validateWorldActions, normalizeAgentHistory } from './agentPolicy.mjs'

describe('Vector server policy', () => {
  it('accepts bounded requests and supported world actions', () => {
    const scenario = getPreset('physical-pendulum')
    expect(validateAgentInput({ message: 'Explain the motion', scenario, telemetry: {}, history: [] }).message).toBe('Explain the motion')
    expect(validateWorldActions([{ type: 'load_preset', target: 'orbital-motion', name: null, x: null, y: null, value: null, entityId: null, portId: null, otherEntityId: null, otherPortId: null, endpoint: null }], scenario)).toHaveLength(1)
    expect(validateWorldActions([{ type: 'load_preset', target: 'spring-ramp-launch' }], scenario)).toHaveLength(1)
    expect(validateWorldActions([{ type: 'add_instrument', target: 'photogateAssembly' }], scenario)).toHaveLength(1)
  })

  it('rejects oversized history and incompatible action targets', () => {
    const scenario = getPreset('projectile-motion')
    const history = Array.from({ length: 7 }, () => ({ role: 'user', content: 'hello' }))
    expect(() => validateAgentInput({ message: 'Hello', scenario, telemetry: {}, history })).toThrow(/six messages/i)
    expect(() => validateWorldActions([{ type: 'add_body', target: 'central' }], scenario)).toThrow(/invalid target/i)
  })

  it('truncates long conversation history instead of rejecting the request', () => {
    const scenario = getPreset('projectile-motion')
    const long = 'x'.repeat(2_000)
    const normalized = normalizeAgentHistory([{ role: 'user', content: long }])
    expect(normalized).toEqual([{ role: 'user', content: 'x'.repeat(1_000) }])
    expect(validateAgentInput({ message: 'Hello', scenario, telemetry: {}, history: [{ role: 'user', content: long }] }).history[0].content).toHaveLength(1_000)
  })

  it('requires exact entity and port references for joints', () => {
    const scenario = getPreset('compound-pendulum')
    expect(() => validateWorldActions([{ type: 'add_joint', target: 'pin', entityId: 'missing', portId: 'missing:center', otherEntityId: 'compound-mass', otherPortId: 'compound-mass:center' }], scenario)).toThrow(/exact ports/i)
  })

  it('accepts feature-based spline blueprints and compiles exact knots', () => {
    const scenario = getPreset('projectile-motion')
    const action = {
      type: 'add_spline_track', target: 'spline',
      track: {
        id: 'feature-curve', name: 'Feature Curve', supportSide: 'left', thickness: 0.18, friction: 0, restitution: 0, startEnd: 'start',
        features: [
          { type: 'release', position: { x: -7.5, y: 6 }, center: null, radius: null },
          { type: 'loop', position: null, center: { x: -2.5, y: 1 }, radius: 1 },
          { type: 'runout', position: { x: 7.5, y: 2 }, center: null, radius: null },
        ],
      },
    }
    const validated = validateWorldActions([action], scenario)
    expect(validated).toHaveLength(1)
    expect(validated[0].track.features).toBeDefined()
  })
})
