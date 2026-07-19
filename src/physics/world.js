import { allPorts, cloneScenario, migrateScenario, SCENARIO_VERSION, validateScenario } from '../domain/scenario.js'
import { applyCompositeInertia, connectorLoads, connectorState, solveAssemblyConstraints } from './assembly.js'
import { applyWorldContacts, resolveBeamBodyCollisions, resolveCircleCollisions } from './constraints.js'
import { netWorldForce, worldPotentialEnergy } from './forces.js'
import { conservationError, summarizeSystem, withEnergyTotal } from './metrics.js'
import { add, scale } from './vector.js'

export function assemblyDiagnostics(scenario) {
  const diagnostics = []
  for (const connector of scenario.connectors ?? []) {
    const length = connector.type === 'rope' ? connector.length : connector.restLength
    if (!(length > 0)) diagnostics.push(`${connector.name ?? connector.id} must have a positive length.`)
    if (connector.a?.type === 'port' && connector.b?.type === 'port' && connector.a.portId === connector.b.portId) diagnostics.push(`${connector.name ?? connector.id} cannot connect a port to itself.`)
  }
  for (const joint of scenario.joints ?? []) {
    if (joint.a?.type === 'world' && joint.b?.type === 'world') diagnostics.push(`${joint.id} cannot join two fixed world anchors.`)
  }
  return diagnostics
}

export function measureWorld(world) {
  const connectorPotential = world.connectors.reduce((sum, connector) => sum + connectorState(world, connector).elasticEnergy, 0)
  return withEnergyTotal(summarizeSystem(world.bodies, worldPotentialEnergy(world) + connectorPotential))
}

export function createWorld(input) {
  const migrated = migrateScenario(input)
  const result = validateScenario(migrated)
  if (!result.valid) throw new TypeError(result.errors.join(' '))
  const source = cloneScenario(result.scenario)
  const ports = allPorts(source)
  const bodies = source.bodies.map((body) => ({ ...body }))
  const ownerIndex = new Map([...bodies, ...source.tracks].map((owner) => [owner.id, owner]))
  const joints = source.joints.map((joint) => {
    if (joint.type !== 'rigid' || joint.restAngle !== undefined || joint.a.type !== 'port' || joint.b.type !== 'port') return joint
    const a = ownerIndex.get(joint.a.ownerId)
    const b = ownerIndex.get(joint.b.ownerId)
    return { ...joint, restAngle: a && b ? b.angle - a.angle : 0 }
  })
  let world = {
    scenarioId: source.id,
    name: source.name,
    lesson: source.lesson,
    description: source.description,
    time: 0,
    fixedStep: source.fixedStep,
    integrator: source.integrator,
    bounds: source.bounds,
    duration: source.duration,
    gravity: source.gravity,
    bodies,
    forces: source.forces,
    constraints: source.constraints,
    tracks: source.tracks,
    instruments: source.instruments,
    ports,
    customPorts: source.ports,
    portIndex: new Map(ports.map((port) => [port.id, port])),
    joints,
    connectors: source.connectors,
    diagnostics: assemblyDiagnostics(source),
  }
  world = applyCompositeInertia(world)
  const metrics = measureWorld(world)
  return { ...world, initialMetrics: metrics, metrics, energyError: conservationError(metrics.total, metrics.total) }
}

export function stepWorld(world, dt = world.fixedStep) {
  const initialLoads = connectorLoads(world)
  const predictedBodies = world.bodies.map((body) => {
    if (body.locked || body.mode === 'track') return body
    const load = initialLoads.get(body.id) ?? { force: { x: 0, y: 0 }, torque: 0 }
    const acceleration = scale(netWorldForce(world, body, load.force), 1 / body.mass)
    const angularAcceleration = load.torque / Math.max(body.assemblyInertia ?? body.inertia, 1e-9)
    const halfVelocity = add(body.velocity, scale(acceleration, dt / 2))
    const halfAngularVelocity = body.angularVelocity + angularAcceleration * dt / 2
    return {
      ...body,
      velocity: halfVelocity,
      position: add(body.position, scale(halfVelocity, dt)),
      acceleration,
      angularVelocity: halfAngularVelocity,
      angle: body.angle + halfAngularVelocity * dt,
      angularAcceleration,
    }
  })
  const predicted = { ...world, bodies: predictedBodies }
  const finalLoads = connectorLoads(predicted)
  const integrated = predictedBodies.map((body) => {
    if (body.locked || body.mode === 'track') return body
    const load = finalLoads.get(body.id) ?? { force: { x: 0, y: 0 }, torque: 0 }
    const nextAcceleration = scale(netWorldForce(predicted, body, load.force), 1 / body.mass)
    const nextAngularAcceleration = load.torque / Math.max(body.assemblyInertia ?? body.inertia, 1e-9)
    return {
      ...body,
      velocity: add(body.velocity, scale(nextAcceleration, dt / 2)),
      acceleration: nextAcceleration,
      angularVelocity: body.angularVelocity + nextAngularAcceleration * dt / 2,
      angularAcceleration: nextAngularAcceleration,
    }
  })
  let next = { ...world, time: world.time + dt, bodies: resolveBeamBodyCollisions(resolveCircleCollisions(integrated)) }
  next.bodies = next.bodies.map((body) => body.mode === 'track' ? body : applyWorldContacts(body, next))
  next = solveAssemblyConstraints(next, dt)
  next.bodies = next.bodies.map((body) => body.mode === 'track' ? body : applyWorldContacts(body, next))
  const metrics = measureWorld(next)
  return { ...next, metrics, energyError: conservationError(world.initialMetrics.total, metrics.total) }
}

export function updateBody(world, bodyId, changes) {
  return { ...world, bodies: world.bodies.map((body) => body.id === bodyId ? { ...body, ...changes } : body) }
}

export function worldToScenario(world) {
  return {
    version: SCENARIO_VERSION,
    id: world.scenarioId,
    name: world.name,
    description: world.description,
    lesson: world.lesson,
    integrator: world.integrator,
    fixedStep: world.fixedStep,
    duration: world.duration,
    bounds: world.bounds,
    gravity: cloneScenario(world.gravity),
    bodies: world.bodies.map((body) => {
      const serializedBody = { ...body }
      delete serializedBody.time
      return serializedBody
    }),
    forces: cloneScenario(world.forces),
    constraints: cloneScenario(world.constraints),
    tracks: cloneScenario(world.tracks),
    instruments: cloneScenario(world.instruments),
    ports: cloneScenario(world.customPorts),
    joints: cloneScenario(world.joints),
    connectors: cloneScenario(world.connectors).map((connector) => {
      const serialized = { ...connector }
      delete serialized.tension
      return serialized
    }),
  }
}
