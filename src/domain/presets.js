import { INTEGRATORS } from '../physics/constants.js'
import { cloneScenario, createBody, createConnector, createSplineTrack, createTrack, createWheel, migrateScenario, SCENARIO_VERSION } from './scenario.js'
import { createInstrument } from './instruments.js'
import { createSplineKnot } from './spline.js'

const common = {
  version: 1,
  fixedStep: 1 / 120,
  integrator: INTEGRATORS.VELOCITY_VERLET,
  bounds: { minX: -8, maxX: 8, minY: -4.5, maxY: 7.5 },
  duration: 20,
  constraints: [{ id: 'floor', type: 'ground', y: -3.6, restitution: 0.35, friction: 0.08 }],
}

const rollingTrack = createTrack({
  id: 'rolling-ramp',
  name: 'Rolling incline',
  center: { x: 0, y: 1 },
  angle: Math.atan2(-6, 11),
  length: Math.hypot(11, 6),
  thickness: 0.16,
  friction: 0.9,
  restitution: 0,
  ideal: true,
})
const rollingTangent = { x: Math.cos(rollingTrack.angle), y: Math.sin(rollingTrack.angle) }
const rollingNormal = { x: -rollingTangent.y, y: rollingTangent.x }
const rollingStart = {
  x: rollingTrack.center.x - rollingTangent.x * rollingTrack.length / 2 + rollingNormal.x * (rollingTrack.thickness / 2 + 0.5),
  y: rollingTrack.center.y - rollingTangent.y * rollingTrack.length / 2 + rollingNormal.y * (rollingTrack.thickness / 2 + 0.5),
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
    version: SCENARIO_VERSION,
    id: 'rolling-incline',
    name: 'Rolling Incline',
    category: 'Rotation',
    description: 'Track translation and rotation for a cylinder rolling without slipping.',
    lesson: 'Static friction couples translational acceleration to angular acceleration.',
    gravity: { g: 9.80665, direction: { x: 0, y: -1 }, enabled: true },
    bodies: [createWheel({ id: 'roller', name: 'Solid cylinder', mass: 1, radius: 0.5, inertiaModel: 'disk', position: rollingStart, friction: 0.9, restitution: 0, color: '#ffcf5c' })],
    tracks: [rollingTrack],
    instruments: [
      createInstrument('ruler', { id: 'rolling-ruler', name: 'Incline distance', a: { x: -5.5, y: 4.7 }, b: { x: 5.5, y: -1.3 } }),
      createInstrument('photogate', { id: 'rolling-gate-a', name: 'Photogate assembly A', center: { x: -2.5, y: 2.75 }, angle: rollingTrack.angle + Math.PI / 2, targetBodyId: 'roller', pairId: 'rolling-gate-pair', pairRole: 'A', nominalSpacing: 3, trackId: 'rolling-ramp', trackDistance: 3 }),
      createInstrument('photogate', { id: 'rolling-gate-b', name: 'Photogate assembly B', center: { x: 0.13, y: 1.31 }, angle: rollingTrack.angle + Math.PI / 2, targetBodyId: 'roller', pairId: 'rolling-gate-pair', pairRole: 'B', nominalSpacing: 3, trackId: 'rolling-ramp', trackDistance: 6 }),
    ],
    ports: [], joints: [], connectors: [], forces: [],
    constraints: [{ id: 'floor', type: 'ground', y: -3.6, restitution: 0.35, friction: 0.08 }],
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
    id: 'spring-ramp-launch',
    name: 'Spring Launch Ramp',
    category: 'Work & Energy',
    description: 'A block of mass 2.0 kg is compressed against an unattached spring on a frictionless surface and launched up an inclined ramp.',
    lesson: 'Elastic potential energy converts into kinetic energy, then into gravitational potential energy as the block ascends to maximum height h.',
    gravity: { g: 9.80665, direction: { x: 0, y: -1 }, enabled: true },
    bodies: [
      createBody({
        id: 'block-m',
        name: 'Sphere (2.0 kg)',
        shape: 'circle',
        mass: 2.0,
        radius: 0.35,
        position: { x: -2.0, y: -3.25 },
        friction: 0,
        restitution: 0,
        color: '#f2cf00',
      }),
    ],
    connectors: [
      createConnector('spring', {
        id: 'launch-spring',
        name: 'Spring k',
        a: { type: 'world', position: { x: -4.5, y: -3.2 } },
        b: { type: 'port', ownerId: 'block-m', portId: 'block-m:west' },
        restLength: 2.5,
        stiffness: 800,
        damping: 0,
        unattached: true,
      }),
    ],
    tracks: [
      createSplineTrack({
        id: 'launch-ramp-track',
        name: 'Horizontal to Ramp Track',
        friction: 0,
        restitution: 0,
        ideal: false,
        knots: [
          createSplineKnot({ id: 'ramp-wall-start', position: { x: -4.5, y: -3.6 }, tangent: { x: 4.807922546202714, y: -0.48154177054530806 }, secondDerivative: { x: 4.5, y: 0 } }),
          createSplineKnot({ id: 'ramp-flat-mid', position: { x: -0.06244548501136782, y: -3.540980968373833 }, tangent: { x: 3, y: 0 }, secondDerivative: { x: -0.5, y: 4.6 } }),
          createSplineKnot({ id: 'ramp-curve-up', position: { x: 6.021340213988095, y: 1.1854759049809622 }, tangent: { x: 5.333594741863015, y: 0.0007765795986341179 }, secondDerivative: { x: -1, y: 1 } }),
        ],
      }),
    ],
    instruments: [
      createInstrument('ruler', {
        id: 'height-ruler',
        name: 'Ramp Height h',
        a: { x: 0.02605846775543008, y: -3.5547387545324325 },
        b: { x: 0.02605846775543008, y: 1.0452612454675674 },
      }),
      createInstrument('ruler', {
        id: 'compression-ruler',
        name: 'Compression Distance s',
        a: { x: -4.522179320871206, y: -2.705398894640246 },
        b: { x: -2.022179320871207, y: -2.705398894640246 },
      }),
    ],
    ports: [], joints: [], forces: [],
    constraints: [{ id: 'floor', type: 'ground', y: -3.6, restitution: 0.35, friction: 0.08 }],
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
  {
    ...common,
    version: SCENARIO_VERSION,
    duration: 5,
    id: 'ideal-atwood',
    name: 'Ideal Atwood Machine',
    category: 'Pulley Systems',
    description: 'Two masses share a taut rope over a fixed ideal pulley.',
    lesson: 'An ideal pulley contributes no rotational inertia, so both rope legs carry equal tension.',
    gravity: { g: 9.80665, direction: { x: 0, y: -1 }, enabled: true },
    bodies: [
      createBody({ id: 'ideal-mass-a', name: 'Mass A', shape: 'box', mass: 1, radius: 0.25, width: 0.5, height: 0.5, position: { x: -0.65, y: 1.5 }, color: '#f2cf00' }),
      createBody({ id: 'ideal-mass-b', name: 'Mass B', shape: 'box', mass: 2, radius: 0.25, width: 0.5, height: 0.5, position: { x: 0.65, y: 1.5 }, color: '#ff7fa6' }),
      createWheel({ id: 'ideal-wheel', name: 'Ideal fixed pulley', mass: 2, radius: 0.65, position: { x: 0, y: 4 }, rotationMode: 'fixed', gravityEnabled: false }),
    ],
    connectors: [createConnector('rope', { id: 'ideal-rope', name: 'Atwood rope', a: { type: 'port', ownerId: 'ideal-mass-a', portId: 'ideal-mass-a:center' }, b: { type: 'port', ownerId: 'ideal-mass-b', portId: 'ideal-mass-b:center' }, route: { type: 'wheel', wheelId: 'ideal-wheel', wrap: 'top', aSide: 'left' } })],
    joints: [{ id: 'ideal-axle', type: 'pin', a: { type: 'world', position: { x: 0, y: 4 } }, b: { type: 'port', ownerId: 'ideal-wheel', portId: 'ideal-wheel:center' } }],
    tracks: [], ports: [], forces: [], instruments: [],
    constraints: [{ id: 'floor', type: 'ground', y: -3.6, restitution: 0.35, friction: 0.08 }],
  },
  {
    ...common,
    version: SCENARIO_VERSION,
    duration: 5,
    id: 'rotating-atwood',
    name: 'Rotating-Pulley Atwood Machine',
    category: 'Pulley Systems',
    description: 'A massive disk pulley couples unequal rope tensions to angular acceleration.',
    lesson: 'Pulley inertia lowers the masses’ acceleration and requires a tension difference to create torque.',
    gravity: { g: 9.80665, direction: { x: 0, y: -1 }, enabled: true },
    bodies: [
      createBody({ id: 'rotating-mass-a', name: 'Mass A', shape: 'box', mass: 1, radius: 0.25, width: 0.5, height: 0.5, position: { x: -0.65, y: 1.5 }, color: '#f2cf00' }),
      createBody({ id: 'rotating-mass-b', name: 'Mass B', shape: 'box', mass: 2, radius: 0.25, width: 0.5, height: 0.5, position: { x: 0.65, y: 1.5 }, color: '#ff7fa6' }),
      createWheel({ id: 'rotating-wheel', name: 'Massive disk pulley', mass: 2, radius: 0.65, position: { x: 0, y: 4 }, rotationMode: 'free', inertiaModel: 'disk', gravityEnabled: false }),
    ],
    connectors: [createConnector('rope', { id: 'rotating-rope', name: 'Atwood rope', a: { type: 'port', ownerId: 'rotating-mass-a', portId: 'rotating-mass-a:center' }, b: { type: 'port', ownerId: 'rotating-mass-b', portId: 'rotating-mass-b:center' }, route: { type: 'wheel', wheelId: 'rotating-wheel', wrap: 'top', aSide: 'left' } })],
    joints: [{ id: 'rotating-axle', type: 'pin', a: { type: 'world', position: { x: 0, y: 4 } }, b: { type: 'port', ownerId: 'rotating-wheel', portId: 'rotating-wheel:center' } }],
    tracks: [], ports: [], forces: [], instruments: [],
    constraints: [{ id: 'floor', type: 'ground', y: -3.6, restitution: 0.35, friction: 0.08 }],
  },
  {
    ...common,
    version: SCENARIO_VERSION,
    duration: 12,
    id: 'loop-the-loop',
    name: 'Loop-the-Loop',
    category: 'Energy & Circular Motion',
    description: 'Test the minimum release height required to maintain contact through a vertical loop.',
    lesson: 'The object must retain enough speed at the top for the inward net force to supply centripetal acceleration.',
    gravity: { g: 9.80665, direction: { x: 0, y: -1 }, enabled: true },
    bodies: [createWheel({ id: 'loop-rider', name: 'Rolling disk', mass: 1, radius: 0.28, position: { x: -5.82, y: 6.55 }, inertiaModel: 'disk', friction: 0.75, restitution: 0, color: '#f2cf00' })],
    tracks: [createSplineTrack({ id: 'loop-track', name: 'Vertical loop', template: 'loop', friction: 0.8, restitution: 0, ideal: true })],
    ports: [], joints: [], connectors: [], forces: [], instruments: [],
    constraints: [{ id: 'floor', type: 'ground', y: -3.6, restitution: 0.35, friction: 0.08 }],
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
