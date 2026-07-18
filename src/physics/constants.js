export const GRAVITATIONAL_ACCELERATION = 9.80665
export const DEFAULT_FIXED_STEP = 1 / 120
export const DEFAULT_MAX_FRAME_DELTA = 0.1
export const DEFAULT_MAX_STEPS = 24

export const INTEGRATORS = Object.freeze({
  EXPLICIT_EULER: 'explicit-euler',
  SYMPLECTIC_EULER: 'symplectic-euler',
  VELOCITY_VERLET: 'velocity-verlet',
})
