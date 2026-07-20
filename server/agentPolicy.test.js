import { describe, expect, it } from 'vitest'
import { getPreset } from '../src/domain/presets.js'
import { validateAgentInput, validateWorldActions } from './agentPolicy.mjs'

describe('Vector server policy', () => {
  it('accepts bounded requests and supported world actions', () => {
    const scenario = getPreset('physical-pendulum')
    expect(validateAgentInput({ message: 'Explain the motion', scenario, telemetry: {}, history: [] }).message).toBe('Explain the motion')
    expect(validateWorldActions([{ type: 'load_preset', target: 'orbital-motion', name: null, x: null, y: null, value: null, entityId: null, portId: null, otherEntityId: null, otherPortId: null, endpoint: null }], scenario)).toHaveLength(1)
  })

  it('rejects oversized history and incompatible action targets', () => {
    const scenario = getPreset('projectile-motion')
    const history = Array.from({ length: 7 }, () => ({ role: 'user', content: 'hello' }))
    expect(() => validateAgentInput({ message: 'Hello', scenario, telemetry: {}, history })).toThrow(/six messages/i)
    expect(() => validateWorldActions([{ type: 'add_body', target: 'central' }], scenario)).toThrow(/invalid target/i)
  })

  it('requires exact entity and port references for joints', () => {
    const scenario = getPreset('compound-pendulum')
    expect(() => validateWorldActions([{ type: 'add_joint', target: 'pin', entityId: 'missing', portId: 'missing:center', otherEntityId: 'compound-mass', otherPortId: 'compound-mass:center' }], scenario)).toThrow(/exact ports/i)
  })

  it('accepts finite spline blueprints and rejects degenerate ones', () => {
    const scenario = getPreset('projectile-motion')
    const action = { type: 'add_spline_track', target: 'spline', track: { id: 'curve', name: 'Curve', supportSide: 'left', thickness: 0.18, friction: 0.2, restitution: 0, startEnd: 'start', knots: [
      { id: 'a', position: { x: -2, y: 0 }, tangent: { x: 2, y: 0 }, secondDerivative: { x: 0, y: 0 } },
      { id: 'b', position: { x: 2, y: 0 }, tangent: { x: 2, y: 0 }, secondDerivative: { x: 0, y: 0 } },
    ] } }
    expect(validateWorldActions([action], scenario)).toHaveLength(1)
    action.track.knots[1].position = { x: -2, y: 0 }
    expect(() => validateWorldActions([action], scenario)).toThrow(/coincident/i)
  })
})
