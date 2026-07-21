import { describe, expect, it } from 'vitest'
import { snapToGrid } from './gridSnap.js'

describe('gridSnap utility', () => {
  it('snaps coordinates to nearest step size', () => {
    expect(snapToGrid({ x: 1.24, y: 3.76 }, 0.5)).toEqual({ x: 1.0, y: 4.0 })
    expect(snapToGrid({ x: 1.12, y: 3.88 }, 0.25)).toEqual({ x: 1.0, y: 4.0 })
    expect(snapToGrid({ x: 1.18, y: 3.88 }, 0.25)).toEqual({ x: 1.25, y: 4.0 })
    expect(snapToGrid({ x: -2.31, y: -0.51 }, 1.0)).toEqual({ x: -2.0, y: -1.0 })
    expect(snapToGrid({ x: 0.12, y: 0.88 }, 0.1)).toEqual({ x: 0.1, y: 0.9 })
  })

  it('returns original position when step is invalid or non-positive', () => {
    expect(snapToGrid({ x: 1.24, y: 3.76 }, 0)).toEqual({ x: 1.24, y: 3.76 })
    expect(snapToGrid({ x: 1.24, y: 3.76 }, null)).toEqual({ x: 1.24, y: 3.76 })
    expect(snapToGrid(null, 0.5)).toBeNull()
  })
})
