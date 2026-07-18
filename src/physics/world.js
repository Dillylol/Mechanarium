import { cloneScenario, validateScenario } from '../domain/scenario.js'
import { conservationError, summarizeSystem, withEnergyTotal } from './metrics.js'
import { applyConstraints, constrainAcceleration, resolveCircleCollisions } from './constraints.js'
import { netForceOnBody, potentialEnergyForces } from './forces.js'
import { integrateParticle, integrateRotation } from './integrators.js'
import { scale } from './vector.js'

export function measureWorld(world) {
  return withEnergyTotal(summarizeSystem(world.bodies, potentialEnergyForces(world.forces, world.bodies)))
}

export function createWorld(scenario) {
  const result = validateScenario(scenario)
  if (!result.valid) throw new TypeError(result.errors.join(' '))
  const source = cloneScenario(scenario)
  const world = {
    scenarioId: source.id,
    name: source.name,
    lesson: source.lesson,
    description: source.description,
    time: 0,
    fixedStep: source.fixedStep,
    integrator: source.integrator,
    bounds: source.bounds,
    duration: source.duration,
    bodies: source.bodies,
    forces: source.forces ?? [],
    constraints: source.constraints ?? [],
  }
  const metrics = measureWorld(world)
  return { ...world, initialMetrics: metrics, metrics, energyError: conservationError(metrics.total, metrics.total) }
}

export function stepWorld(world, dt = world.fixedStep) {
  const integrated = world.bodies.map((body) => {
    if (body.locked) return body
    const accelerationAt = (position, velocity) => constrainAcceleration(
      body,
      scale(netForceOnBody(world.forces, body, position, velocity), 1 / body.mass),
      world.constraints,
    )
    const particle = integrateParticle({ ...body, time: world.time }, dt, accelerationAt, world.integrator)
    const rotation = integrateRotation(body, dt, body.angularAcceleration ?? 0)
    return applyConstraints({ ...body, ...particle, ...rotation }, world.constraints)
  })
  const bodies = resolveCircleCollisions(integrated)
  const next = { ...world, time: world.time + dt, bodies }
  const metrics = measureWorld(next)
  return { ...next, metrics, energyError: conservationError(world.initialMetrics.total, metrics.total) }
}

export function updateBody(world, bodyId, changes) {
  return {
    ...world,
    bodies: world.bodies.map((body) => body.id === bodyId ? { ...body, ...changes } : body),
  }
}

export function worldToScenario(world) {
  return {
    version: 1,
    id: world.scenarioId,
    name: world.name,
    description: world.description,
    lesson: world.lesson,
    integrator: world.integrator,
    fixedStep: world.fixedStep,
    duration: world.duration,
    bounds: world.bounds,
    bodies: world.bodies.map((body) => {
      const serializedBody = { ...body }
      delete serializedBody.time
      return serializedBody
    }),
    forces: world.forces,
    constraints: world.constraints,
  }
}
