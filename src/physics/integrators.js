import { INTEGRATORS } from './constants.js'
import { add, scale } from './vector.js'

function assertParticle(state) {
  if (!state || !Number.isFinite(state.time) || !state.position || !state.velocity) {
    throw new TypeError('Particle state requires time, position, and velocity.')
  }
}

export function integrateParticle(state, dt, accelerationAt, method = INTEGRATORS.VELOCITY_VERLET) {
  assertParticle(state)
  if (!(dt > 0) || typeof accelerationAt !== 'function') {
    throw new TypeError('A positive time step and acceleration function are required.')
  }

  const acceleration = accelerationAt(state.position, state.velocity, state.time)

  if (method === INTEGRATORS.EXPLICIT_EULER) {
    return {
      ...state,
      time: state.time + dt,
      position: add(state.position, scale(state.velocity, dt)),
      velocity: add(state.velocity, scale(acceleration, dt)),
      acceleration,
    }
  }

  if (method === INTEGRATORS.SYMPLECTIC_EULER) {
    const velocity = add(state.velocity, scale(acceleration, dt))
    return {
      ...state,
      time: state.time + dt,
      position: add(state.position, scale(velocity, dt)),
      velocity,
      acceleration,
    }
  }

  if (method === INTEGRATORS.VELOCITY_VERLET) {
    const position = add(
      add(state.position, scale(state.velocity, dt)),
      scale(acceleration, 0.5 * dt * dt),
    )
    const predictedVelocity = add(state.velocity, scale(acceleration, dt))
    const nextAcceleration = accelerationAt(position, predictedVelocity, state.time + dt)
    const velocity = add(state.velocity, scale(add(acceleration, nextAcceleration), 0.5 * dt))

    return {
      ...state,
      time: state.time + dt,
      position,
      velocity,
      acceleration: nextAcceleration,
    }
  }

  throw new RangeError(`Unknown integrator: ${method}`)
}

export function integrateRotation(state, dt, angularAcceleration, method = INTEGRATORS.SYMPLECTIC_EULER) {
  const acceleration = typeof angularAcceleration === 'function'
    ? angularAcceleration(state.angle, state.angularVelocity, state.time)
    : angularAcceleration

  if (method === INTEGRATORS.EXPLICIT_EULER) {
    return {
      angle: state.angle + state.angularVelocity * dt,
      angularVelocity: state.angularVelocity + acceleration * dt,
      angularAcceleration: acceleration,
    }
  }

  const angularVelocity = state.angularVelocity + acceleration * dt
  return {
    angle: state.angle + angularVelocity * dt,
    angularVelocity,
    angularAcceleration: acceleration,
  }
}
