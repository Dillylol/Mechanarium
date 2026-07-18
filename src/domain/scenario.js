import { INTEGRATORS } from '../physics/constants.js'
import { isFiniteVector } from '../physics/vector.js'

export const SCENARIO_VERSION = 1
export const BODY_SHAPES = Object.freeze(['circle', 'box'])
export const FORCE_TYPES = Object.freeze(['gravity', 'uniform', 'drag', 'spring', 'central'])
export const CONSTRAINT_TYPES = Object.freeze(['ground', 'incline'])

const finitePositive = (value) => Number.isFinite(value) && value > 0

export function validateScenario(scenario) {
  const errors = []
  if (!scenario || typeof scenario !== 'object') return { valid: false, errors: ['Scenario must be an object.'] }
  if (scenario.version !== SCENARIO_VERSION) errors.push(`Scenario version must be ${SCENARIO_VERSION}.`)
  if (!scenario.id || !scenario.name) errors.push('Scenario requires an id and name.')
  if (!Object.values(INTEGRATORS).includes(scenario.integrator)) errors.push('Scenario has an unsupported integrator.')
  if (!finitePositive(scenario.fixedStep)) errors.push('Scenario fixedStep must be positive.')
  if (!Array.isArray(scenario.bodies) || scenario.bodies.length === 0) errors.push('Scenario requires at least one body.')

  const ids = new Set()
  for (const body of scenario.bodies ?? []) {
    if (!body.id || ids.has(body.id)) errors.push(`Body id must be unique: ${body.id ?? 'missing'}.`)
    ids.add(body.id)
    if (!BODY_SHAPES.includes(body.shape)) errors.push(`Body ${body.id} has an unsupported shape.`)
    if (!finitePositive(body.mass)) errors.push(`Body ${body.id} mass must be positive.`)
    if (!isFiniteVector(body.position) || !isFiniteVector(body.velocity)) errors.push(`Body ${body.id} requires finite position and velocity.`)
    if (!finitePositive(body.radius)) errors.push(`Body ${body.id} radius must be positive.`)
  }

  for (const force of scenario.forces ?? []) {
    if (!FORCE_TYPES.includes(force.type)) errors.push(`Unsupported force type: ${force.type}.`)
    if (force.bodyId && !ids.has(force.bodyId)) errors.push(`Force references unknown body: ${force.bodyId}.`)
  }

  for (const constraint of scenario.constraints ?? []) {
    if (!CONSTRAINT_TYPES.includes(constraint.type)) errors.push(`Unsupported constraint type: ${constraint.type}.`)
    if (constraint.bodyId && !ids.has(constraint.bodyId)) errors.push(`Constraint references unknown body: ${constraint.bodyId}.`)
  }

  return { valid: errors.length === 0, errors }
}

export function cloneScenario(scenario) {
  return structuredClone(scenario)
}

export function serializeScenario(scenario) {
  const result = validateScenario(scenario)
  if (!result.valid) throw new TypeError(result.errors.join(' '))
  return JSON.stringify(scenario, null, 2)
}

export function deserializeScenario(serialized) {
  let scenario
  try {
    scenario = JSON.parse(serialized)
  } catch {
    throw new SyntaxError('Scenario is not valid JSON.')
  }
  const result = validateScenario(scenario)
  if (!result.valid) throw new TypeError(result.errors.join(' '))
  return scenario
}

export function createBody(overrides = {}) {
  const radius = overrides.radius ?? 0.35
  const mass = overrides.mass ?? 1
  return {
    id: overrides.id ?? `body-${crypto.randomUUID()}`,
    name: overrides.name ?? 'Body',
    shape: overrides.shape ?? 'circle',
    mass,
    radius,
    width: overrides.width ?? radius * 2,
    height: overrides.height ?? radius * 2,
    position: overrides.position ?? { x: 0, y: 2 },
    velocity: overrides.velocity ?? { x: 0, y: 0 },
    acceleration: overrides.acceleration ?? { x: 0, y: 0 },
    angle: overrides.angle ?? 0,
    angularVelocity: overrides.angularVelocity ?? 0,
    angularAcceleration: overrides.angularAcceleration ?? 0,
    inertia: overrides.inertia ?? 0.5 * mass * radius ** 2,
    restitution: overrides.restitution ?? 0.8,
    color: overrides.color ?? '#ffb35c',
    locked: overrides.locked ?? false,
  }
}
