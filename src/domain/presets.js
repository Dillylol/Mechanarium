import { INTEGRATORS } from '../physics/constants.js'
import { cloneScenario, createBody, createConnector, createTrack, migrateScenario, SCENARIO_VERSION } from './scenario.js'

const common = {
  version: 1,
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
    bodies: [createBody({ id: 'projectile', name: 'Projectile', position: { x: -6, y: 2 }, velocity: { x: 5.8, y: 7.2 }, color: '#f2cf00' })],
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
  {
    ...common,
    version: SCENARIO_VERSION,
    id: 'inclined-spring-oscillator',
    name: 'Inclined Spring Oscillator',
    category: 'Simple Harmonic Motion',
    description: 'A spring-driven mass oscillates along a solid inclined surface.',
    lesson: 'Gravity shifts equilibrium while the spring sets the oscillation period.',
    gravity: { g: 9.80665, direction: { x: 0, y: -1 }, enabled: true },
    bodies: [createBody({ id: 'incline-mass', name: 'Oscillator mass', mass: 1, radius: 0.42, position: { x: 0.483, y: 0.718 }, color: '#f2cf00' })],
    tracks: [createTrack({ id: 'incline-track', name: 'Incline', center: { x: 0, y: 0 }, angle: Math.PI / 9, length: 8, friction: 0.01 })],
    connectors: [createConnector('spring', { id: 'incline-spring', a: { type: 'world', position: { x: -2.994, y: -0.547 } }, b: { type: 'port', ownerId: 'incline-mass', portId: 'incline-mass:center' }, restLength: 3.1, stiffness: 9, damping: 0.02 })],
    ports: [], joints: [], forces: [], constraints: [],
  },
  {
    ...common,
    version: SCENARIO_VERSION,
    id: 'rope-pendulum',
    name: 'Massless-Rope Pendulum',
    category: 'Simple Harmonic Motion',
    description: 'A tension-only inextensible rope supports a pendulum bob.',
    lesson: 'At small angles, the period depends on rope length and gravity rather than bob mass.',
    gravity: { g: 9.80665, direction: { x: 0, y: -1 }, enabled: true },
    bodies: [createBody({ id: 'pendulum-bob', name: 'Pendulum bob', radius: 0.38, position: { x: 2.85 * Math.sin(0.25), y: 4.2 - 2.85 * Math.cos(0.25) }, color: '#f2cf00' })],
    connectors: [createConnector('rope', { id: 'pendulum-rope', a: { type: 'world', position: { x: 0, y: 4.2 } }, b: { type: 'port', ownerId: 'pendulum-bob', portId: 'pendulum-bob:center' }, length: 2.85 })],
    tracks: [], ports: [], joints: [], forces: [], constraints: [],
  },
  {
    ...common,
    version: SCENARIO_VERSION,
    id: 'physical-pendulum',
    name: 'Uniform-Beam Pendulum',
    category: 'Simple Harmonic Motion',
    description: 'A uniform inertial beam rotates around a frictionless end pin.',
    lesson: 'The period follows the beam moment of inertia about its pivot.',
    gravity: { g: 9.80665, direction: { x: 0, y: -1 }, enabled: true },
    bodies: [createBody({ id: 'pendulum-beam', name: 'Uniform beam', shape: 'beam', mode: 'pinned', mass: 2, length: 4, angle: -Math.PI / 2 + 0.24, position: { x: 2 * Math.sin(0.24), y: 4 - 2 * Math.cos(0.24) }, color: '#171717' })],
    joints: [{ id: 'beam-pin', type: 'pin', a: { type: 'world', position: { x: 0, y: 4 } }, b: { type: 'port', ownerId: 'pendulum-beam', portId: 'pendulum-beam:start' } }],
    tracks: [], ports: [], connectors: [], forces: [], constraints: [],
  },
  {
    ...common,
    version: SCENARIO_VERSION,
    id: 'compound-pendulum',
    name: 'Compound Beam Oscillator',
    category: 'Simple Harmonic Motion',
    description: 'A beam and attached sphere act as one compound inertial assembly.',
    lesson: 'Attached mass changes the center of mass and adds inertia through the parallel-axis theorem.',
    gravity: { g: 9.80665, direction: { x: 0, y: -1 }, enabled: true },
    bodies: [
      createBody({ id: 'compound-beam', name: 'Inertial beam', shape: 'beam', mode: 'pinned', mass: 1.8, length: 4, angle: -Math.PI / 2 + 0.22, position: { x: 2 * Math.sin(0.22), y: 4 - 2 * Math.cos(0.22) }, color: '#171717' }),
      createBody({ id: 'compound-mass', name: 'Attached sphere', mass: 1.2, radius: 0.48, position: { x: 4 * Math.sin(0.22), y: 4 - 4 * Math.cos(0.22) }, color: '#f2cf00' }),
    ],
    joints: [
      { id: 'compound-pin', type: 'pin', a: { type: 'world', position: { x: 0, y: 4 } }, b: { type: 'port', ownerId: 'compound-beam', portId: 'compound-beam:start' } },
      { id: 'compound-weld', type: 'rigid', a: { type: 'port', ownerId: 'compound-beam', portId: 'compound-beam:end' }, b: { type: 'port', ownerId: 'compound-mass', portId: 'compound-mass:center' } },
    ],
    tracks: [], ports: [], connectors: [], forces: [], constraints: [],
  },
]

export function listPresets() {
  return presets.map(({ id, name, category, description }) => ({ id, name, category, description }))
}

export function getPreset(id) {
  const preset = presets.find((candidate) => candidate.id === id)
  if (!preset) throw new RangeError(`Unknown preset: ${id}`)
  return cloneScenario(migrateScenario(preset))
}
