import { describe, expect, it } from 'vitest'
import { INTEGRATORS } from './constants.js'
import { integrateParticle } from './integrators.js'
import { vector } from './vector.js'

const particle = () => ({ time: 0, position: vector(0, 10), velocity: vector(3, 0), acceleration: vector() })

describe('particle integrators', () => {
  it('Velocity Verlet matches constant-acceleration kinematics', () => {
    const next = integrateParticle(particle(), 2, () => vector(0, -9.8), INTEGRATORS.VELOCITY_VERLET)
    expect(next.position.x).toBeCloseTo(6)
    expect(next.position.y).toBeCloseTo(-9.6)
    expect(next.velocity.y).toBeCloseTo(-19.6)
  })

  it('rejects unknown methods', () => {
    expect(() => integrateParticle(particle(), 0.1, () => vector(), 'mystery')).toThrow('Unknown integrator')
  })

  it('bounds harmonic-oscillator energy better than explicit Euler', () => {
    const simulate = (method) => {
      let state = { time: 0, position: vector(1, 0), velocity: vector(0, 0), acceleration: vector(-1, 0) }
      const acceleration = (position) => vector(-position.x, 0)
      for (let index = 0; index < 2000; index += 1) {
        state = integrateParticle(state, 0.01, acceleration, method)
      }
      return 0.5 * state.velocity.x ** 2 + 0.5 * state.position.x ** 2
    }

    const explicitError = Math.abs(simulate(INTEGRATORS.EXPLICIT_EULER) - 0.5)
    const symplecticError = Math.abs(simulate(INTEGRATORS.SYMPLECTIC_EULER) - 0.5)
    const verletError = Math.abs(simulate(INTEGRATORS.VELOCITY_VERLET) - 0.5)

    expect(symplecticError).toBeLessThan(explicitError)
    expect(verletError).toBeLessThan(0.0001)
  })
})
