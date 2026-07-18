import { INTEGRATORS } from '../physics/constants.js'
import { cloneScenario, createBody, SCENARIO_VERSION } from './scenario.js'

const common = {
  version: SCENARIO_VERSION,
  fixedStep: 1 / 120,
  integrator: INTEGRATORS.VELOCITY_VERLET,
  bounds: { minX: -8, maxX: 8, minY: -4.5, maxY: 7.5 },
  duration: 20,
}

const presets = [
  {
    ...common,
    id: 'projectile-motion',
    name: 'Projectile Motion',
    category: 'Kinematics',
    description: 'Compare horizontal and vertical motion under uniform gravity.',
    lesson: 'Horizontal velocity remains constant while gravity changes vertical velocity.',
    bodies: [createBody({ id: 'projectile', name: 'Projectile', position: { x: -6, y: 2 }, velocity: { x: 5.8, y: 7.2 }, color: '#ffb35c' })],
    forces: [{ id: 'earth-gravity', type: 'gravity', g: 9.80665 }],
    constraints: [{ id: 'floor', type: 'ground', y: -3.6, restitution: 0.72, friction: 0.04 }],
  },
  {
    ...common,
    id: 'momentum-collision',
    name: 'Momentum Exchange',
    category: 'Momentum',
    description: 'Observe momentum transfer in a near-elastic collision.',
    lesson: 'The system momentum stays constant while each body exchanges momentum.',
    bodies: [
      createBody({ id: 'cart-a', name: 'Cart A', mass: 1.5, radius: 0.5, position: { x: -4.2, y: 0 }, velocity: { x: 3.2, y: 0 }, color: '#78e6d5' }),
      createBody({ id: 'cart-b', name: 'Cart B', mass: 2.5, radius: 0.65, position: { x: 1.2, y: 0 }, velocity: { x: -0.45, y: 0 }, color: '#b397ff' }),
    ],
    forces: [],
    constraints: [],
  },
  {
    ...common,
    id: 'rolling-incline',
    name: 'Rolling Incline',
    category: 'Rotation',
    description: 'Track translation and rotation for a cylinder rolling without slipping.',
    lesson: 'Static friction couples translational acceleration to angular acceleration.',
    bodies: [createBody({ id: 'roller', name: 'Solid cylinder', radius: 0.5, position: { x: -5, y: 3.85 }, color: '#ffcf5c' })],
    forces: [{ id: 'earth-gravity', type: 'gravity', g: 9.80665 }],
    constraints: [{ id: 'ramp', type: 'incline', bodyId: 'roller', start: { x: -5.5, y: 4 }, end: { x: 5.5, y: -2 }, rolling: true }],
  },
  {
    ...common,
    id: 'spring-oscillator',
    name: 'Spring Oscillator',
    category: 'Oscillations',
    description: 'Inspect the exchange between spring potential and kinetic energy.',
    lesson: 'Energy moves between elastic potential and kinetic forms while total energy stays bounded.',
    bodies: [createBody({ id: 'spring-mass', name: 'Spring mass', mass: 1.2, radius: 0.45, position: { x: 2.4, y: 0 }, color: '#ff7fa6' })],
    forces: [{ id: 'spring', type: 'spring', bodyId: 'spring-mass', anchor: { x: 0, y: 0 }, stiffness: 5, restLength: 1.4, damping: 0 }],
    constraints: [],
  },
  {
    ...common,
    id: 'orbital-motion',
    name: 'Orbital Motion',
    category: 'Gravitation',
    description: 'Follow a body through a bound orbit around a fixed attractor.',
    lesson: 'Gravity continuously turns velocity, creating a curved path rather than a straight fall.',
    bodies: [createBody({ id: 'satellite', name: 'Satellite', mass: 0.8, radius: 0.28, position: { x: 4, y: 0 }, velocity: { x: 0, y: 2.2 }, color: '#8fb8ff' })],
    forces: [{ id: 'central-gravity', type: 'central', bodyId: 'satellite', center: { x: 0, y: 0 }, strength: 19.36, softening: 0.05 }],
    constraints: [],
  },
]

export function listPresets() {
  return presets.map(({ id, name, category, description }) => ({ id, name, category, description }))
}

export function getPreset(id) {
  const preset = presets.find((candidate) => candidate.id === id)
  if (!preset) throw new RangeError(`Unknown preset: ${id}`)
  return cloneScenario(preset)
}
