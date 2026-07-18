import { describe, expect, it } from 'vitest'
import { deserializeScenario, serializeScenario, validateScenario } from './scenario.js'
import { getPreset } from './presets.js'

describe('scenario contract', () => {
  it('round-trips a valid versioned scenario', () => {
    const source = getPreset('projectile-motion')
    expect(deserializeScenario(serializeScenario(source))).toEqual(source)
  })

  it('rejects unsupported versions and broken body references', () => {
    const source = getPreset('spring-oscillator')
    source.version = 99
    source.forces[0].bodyId = 'missing'
    const result = validateScenario(source)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'Scenario version must be 1.',
      'Force references unknown body: missing.',
    ]))
  })

  it('reports invalid JSON distinctly', () => {
    expect(() => deserializeScenario('{oops')).toThrow('not valid JSON')
  })
})
