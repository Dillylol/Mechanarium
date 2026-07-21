import { allPorts, cloneScenario, createBody, migrateScenario, SCENARIO_VERSION, validateScenario } from '../domain/scenario.js'
import { applyCompositeInertia, buildLoadLedger, calibrateRoutedConnectors, connectorLoads, connectorState, solveAssemblyConstraints, wheelCenterMount, wheelRouteGeometry } from './assembly.js'
import { applyWorldContacts, resolveBeamBodyCollisions, resolveCircleCollisions } from './constraints.js'
import { netWorldForce, worldPotentialEnergy } from './forces.js'
import { conservationError, summarizeSystem, withEnergyTotal } from './metrics.js'
import { add, scale } from './vector.js'
import { sampleSpline } from '../domain/spline.js'

export function assemblyDiagnostics(scenario) {
  const diagnostics = []
  const diagnosticWorld = scenario.portIndex ? scenario : (() => {
    const ports = allPorts(scenario)
    return { ...scenario, ports, portIndex: new Map(ports.map((port) => [port.id, port])) }
  })()
  for (const connector of scenario.connectors ?? []) {
    const length = connector.type === 'rope' ? connector.length : connector.restLength
    if (!(length > 0)) diagnostics.push(`${connector.name ?? connector.id} must have a positive length.`)
    if (connector.a?.type === 'port' && connector.b?.type === 'port' && connector.a.portId === connector.b.portId) diagnostics.push(`${connector.name ?? connector.id} cannot connect a port to itself.`)
    if (connector.route) {
      const wheel = scenario.bodies.find((body) => body.id === connector.route.wheelId)
      const geometry = wheelRouteGeometry(diagnosticWorld, connector)
      if (!geometry) diagnostics.push(`${connector.name ?? connector.id} cannot form a valid upper wrap around its wheel.`)
      else {
        const aIsLeft = geometry.a.position.x < geometry.center.x
        const bIsLeft = geometry.b.position.x < geometry.center.x
        if (aIsLeft === bIsLeft || (connector.route.aSide === 'left') !== aIsLeft) diagnostics.push(`${connector.name ?? connector.id} endpoints must remain on their assigned opposite sides of the wheel.`)
      }
      const mount = wheel && wheelCenterMount(diagnosticWorld, wheel)
      if (!mount?.fixed) diagnostics.push(`${wheel?.name ?? connector.route.wheelId} must have its axle pinned to world or an immovable part.`)
      if (wheel?.rotationMode === 'free' && mount?.joint.type === 'rigid') diagnostics.push(`${wheel.name} must use a pin mount to rotate.`)
    }
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
    events: (source.events ?? []).map((event) => ({ ...event, triggered: false })),
    tracks: source.tracks.map((track) => track.type === 'spline' ? { ...track, _samples: sampleSpline(track) } : track),
    instruments: source.instruments,
    ports,
    customPorts: source.ports,
    portIndex: new Map(ports.map((port) => [port.id, port])),
    joints,
    connectors: source.connectors,
    railJoins: source.railJoins,
    diagnostics: [],
  }
  world = applyCompositeInertia(world)
  world = calibrateRoutedConnectors(world)
  world.diagnostics = assemblyDiagnostics(world)
  world = buildLoadLedger(world)
  const metrics = measureWorld(world)
  return { ...world, initialMetrics: metrics, metrics, energyError: conservationError(metrics.total, metrics.total) }
}

export function processWorldEvents(world) {
  if (!world.events || !world.events.length) return world
  let modified = false
  let bodies = [...world.bodies]
  const events = world.events.map((event) => {
    if (event.triggered) return event
    const target = bodies.find((b) => b.id === event.targetId)
    let isTriggered = false
    if (event.trigger === 'time' && world.time >= (event.time ?? 0)) {
      isTriggered = true
    } else if (event.trigger === 'apex' && target) {
      if (target.velocity.y <= 0.05 && (target._previousVy ?? target.velocity.y) > 0) {
        isTriggered = true
      }
    }

    if (!isTriggered || !target) return event

    modified = true
    if (event.type === 'impulse') {
      const impulse = event.impulse ?? { x: 10, y: 0 }
      bodies = bodies.map((b) => b.id === target.id ? {
        ...b,
        velocity: {
          x: b.velocity.x + impulse.x / b.mass,
          y: b.velocity.y + impulse.y / b.mass,
        }
      } : b)
    } else if (event.type === 'explosion' || event.type === 'separation') {
      const totalMass = target.mass
      const ratio = event.ratio ?? 0.25
      const massQ = totalMass * ratio
      const massR = totalMass * (1 - ratio)
      const impulseX = event.impulseX ?? 5

      const pieceQ = {
        ...createBody({
          id: `${target.id}-Q`,
          name: `${target.name} Q`,
          mass: massQ,
          radius: Math.max(0.15, target.radius * Math.cbrt(ratio)),
          position: { ...target.position },
          color: '#e63946',
        }),
        velocity: {
          x: target.velocity.x - impulseX / massQ,
          y: target.velocity.y,
        },
      }

      const pieceR = {
        ...createBody({
          id: `${target.id}-R`,
          name: `${target.name} R`,
          mass: massR,
          radius: Math.max(0.15, target.radius * Math.cbrt(1 - ratio)),
          position: { ...target.position },
          color: '#457b9d',
        }),
        velocity: {
          x: target.velocity.x + impulseX / massR,
          y: target.velocity.y,
        },
      }

      bodies = bodies.filter((b) => b.id !== target.id).concat([pieceQ, pieceR])
    }
    return { ...event, triggered: true }
  })

  bodies = bodies.map((b) => ({ ...b, _previousVy: b.velocity.y }))
  return { ...world, bodies, events }
}

function stepWorldOnce(world, dt) {
  const worldWithEvents = processWorldEvents(world)
  const initialLoads = connectorLoads(worldWithEvents)
  const predictedBodies = worldWithEvents.bodies.map((body) => {
    if (body.locked || body.mode === 'track') return body
    const load = initialLoads.get(body.id) ?? { force: { x: 0, y: 0 }, torque: 0 }
    const acceleration = scale(netWorldForce(world, body, load.force), 1 / body.mass)
    const canRotate = !(body.shape === 'wheel' && body.rotationMode === 'fixed')
    const angularAcceleration = canRotate ? load.torque / Math.max(body.assemblyInertia ?? body.inertia, 1e-9) : 0
    const halfVelocity = add(body.velocity, scale(acceleration, dt / 2))
    const halfAngularVelocity = body.angularVelocity + angularAcceleration * dt / 2
    return {
      ...body,
      velocity: halfVelocity,
      position: add(body.position, scale(halfVelocity, dt)),
      acceleration,
      angularVelocity: canRotate ? halfAngularVelocity : 0,
      angle: canRotate ? body.angle + halfAngularVelocity * dt : body.angle,
      angularAcceleration,
      _contactLoads: [],
    }
  })
  const predicted = { ...world, bodies: predictedBodies }
  const finalLoads = connectorLoads(predicted)
  const integrated = predictedBodies.map((body) => {
    if (body.locked || body.mode === 'track') return body
    const load = finalLoads.get(body.id) ?? { force: { x: 0, y: 0 }, torque: 0 }
    const nextAcceleration = scale(netWorldForce(predicted, body, load.force), 1 / body.mass)
    const canRotate = !(body.shape === 'wheel' && body.rotationMode === 'fixed')
    const nextAngularAcceleration = canRotate ? load.torque / Math.max(body.assemblyInertia ?? body.inertia, 1e-9) : 0
    return {
      ...body,
      velocity: add(body.velocity, scale(nextAcceleration, dt / 2)),
      acceleration: nextAcceleration,
      angularVelocity: canRotate ? body.angularVelocity + nextAngularAcceleration * dt / 2 : 0,
      angularAcceleration: nextAngularAcceleration,
    }
  })
  let next = { ...world, time: world.time + dt, bodies: resolveBeamBodyCollisions(resolveCircleCollisions(integrated)) }
  next.bodies = next.bodies.map((body) => body.mode === 'track' ? body : applyWorldContacts({ ...body, _contactLoads: [] }, next, dt))
  next = solveAssemblyConstraints(next, dt)
  next.bodies = next.bodies.map((body) => body.mode === 'track' ? body : applyWorldContacts(body, next, dt))
  next.bodies = next.bodies.map((body) => {
    const previous = world.bodies.find((candidate) => candidate.id === body.id)
    if (!previous || body.locked || body.mode === 'track') return body
    return {
      ...body,
      acceleration: scale(add(body.velocity, scale(previous.velocity, -1)), 1 / dt),
      angularAcceleration: (body.angularVelocity - previous.angularVelocity) / dt,
    }
  })
  next = buildLoadLedger(next)
  const metrics = measureWorld(next)
  return { ...next, metrics, energyError: conservationError(world.initialMetrics.total, metrics.total) }
}

export function stepWorld(world, dt = world.fixedStep) {
  const minimumFeature = Math.max(0.04, Math.min(...world.tracks.map((track) => track.thickness ?? 0.18), 0.18) / 2)
  const maximumSpeed = Math.max(0, ...world.bodies.map((body) => Math.hypot(body.velocity.x, body.velocity.y)))
  const substeps = Math.max(1, Math.min(8, Math.ceil(maximumSpeed * dt / minimumFeature)))
  let next = world
  for (let index = 0; index < substeps; index += 1) next = stepWorldOnce(next, dt / substeps)
  return next
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
      delete serializedBody._contactLoads
      delete serializedBody._trackContact
      delete serializedBody._previousPosition
      delete serializedBody._railEnergy
      delete serializedBody._railDirection
      return serializedBody
    }),
    forces: cloneScenario(world.forces),
    constraints: cloneScenario(world.constraints),
    tracks: cloneScenario(world.tracks).map((track) => {
      const serialized = { ...track }
      delete serialized._samples
      return serialized
    }),
    instruments: cloneScenario(world.instruments),
    ports: cloneScenario(world.customPorts),
    joints: cloneScenario(world.joints),
    railJoins: cloneScenario(world.railJoins),
    connectors: cloneScenario(world.connectors).map((connector) => {
      const serialized = { ...connector }
      delete serialized.tension
      delete serialized.tensionA
      delete serialized.tensionB
      delete serialized.routeReference
      return serialized
    }),
    events: cloneScenario(world.events ?? []).map((event) => {
      const serialized = { ...event }
      delete serialized.triggered
      return serialized
    }),
  }
}
