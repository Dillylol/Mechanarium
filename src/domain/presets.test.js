import { describe, expect, it } from 'vitest'
import { getPreset, listPresets } from './presets.js'

describe('mechanics presets', () => {
  it('covers the MVP curriculum categories', () => {
    expect(listPresets().map((preset) => preset.category)).toEqual([
      'Kinematics', 'Momentum', 'Rotation', 'Oscillations', 'Gravitation',
    ])
  })

  it('returns isolated copies', () => {
    const first = getPreset('projectile-motion')
    first.bodies[0].mass = 999
    expect(getPreset('projectile-motion').bodies[0].mass).not.toBe(999)
  })
})
