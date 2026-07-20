import { add, dot, magnitude, normalize, scale, subtract } from './vector.js'
import { forceOnBody, gravityForce } from './forces.js'

const rotate = (point, angle) => ({
  x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
  y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
})
const cross = (a, b) => a.x * b.y - a.y * b.x
const TAU = Math.PI * 2
const wrapAngle = (angle) => ((angle % TAU) + TAU) % TAU

export function ownerById(world, ownerId) {
  return world.bodies.find((body) => body.id === ownerId) ?? world.tracks.find((track) => track.id === ownerId)
}

export function portById(world, portId) {
  return world.portIndex?.get(portId) ?? world.ports.find((port) => port.id === portId)
}

export function resolvePort(world, portId) {
  const port = portById(world, portId)
  if (!port) return null
  const owner = ownerById(world, port.ownerId)
  if (!owner) return null
  const offset = rotate(port.localPosition, owner.angle ?? 0)
  const origin = owner.position ?? owner.center
  return { x: origin.x + offset.x, y: origin.y + offset.y, owner, port, offset }
}

export function resolveEndpoint(world, endpoint) {
  if (endpoint.type === 'world') return { position: endpoint.position, velocity: { x: 0, y: 0 }, owner: null, offset: { x: 0, y: 0 } }
  const resolved = resolvePort(world, endpoint.portId)
  if (!resolved) return null
  const omega = resolved.owner.angularVelocity ?? 0
  return {
    position: resolved,
    velocity: {
      x: (resolved.owner.velocity?.x ?? 0) - omega * resolved.offset.y,
      y: (resolved.owner.velocity?.y ?? 0) + omega * resolved.offset.x,
    },
    owner: resolved.owner,
    offset: resolved.offset,
  }
}

function tangentPoint(center, radius, point, side) {
  const relative = subtract(point, center)
  const distanceSquared = relative.x ** 2 + relative.y ** 2
  if (distanceSquared <= radius ** 2 + 1e-8) return null
  const base = add(center, scale(relative, radius ** 2 / distanceSquared))
  const factor = radius * Math.sqrt(distanceSquared - radius ** 2) / distanceSquared
  const perpendicular = { x: -relative.y * factor, y: relative.x * factor }
  const candidates = [add(base, perpendicular), subtract(base, perpendicular)]
  return candidates.sort((a, b) => side === 'left' ? a.x - b.x : b.x - a.x)[0]
}

function directedAngle(from, to, direction) {
  return direction > 0 ? wrapAngle(to - from) : wrapAngle(from - to)
}

export function wheelRouteGeometry(world, connector, arcSegments = 24) {
  if (connector?.type !== 'rope' || connector.route?.type !== 'wheel') return null
  const wheel = ownerById(world, connector.route.wheelId)
  const a = resolveEndpoint(world, connector.a)
  const b = resolveEndpoint(world, connector.b)
  if (!wheel || wheel.shape !== 'wheel' || !a || !b) return null
  const center = wheel.position
  const aSide = connector.route.aSide
  const bSide = aSide === 'left' ? 'right' : 'left'
  const tangentA = tangentPoint(center, wheel.radius, a.position, aSide)
  const tangentB = tangentPoint(center, wheel.radius, b.position, bSide)
  if (!tangentA || !tangentB) return null
  const angleA = Math.atan2(tangentA.y - center.y, tangentA.x - center.x)
  const angleB = Math.atan2(tangentB.y - center.y, tangentB.x - center.x)
  const direction = aSide === 'left' ? -1 : 1
  const crown = Math.PI / 2
  const arcA = directedAngle(angleA, crown, direction)
  const arcB = directedAngle(crown, angleB, direction)
  const arcAngle = arcA + arcB
  if (arcAngle > Math.PI * 1.75) return null
  const legA = magnitude(subtract(a.position, tangentA))
  const legB = magnitude(subtract(b.position, tangentB))
  const qA = legA + wheel.radius * arcA
  const qB = legB + wheel.radius * arcB
  const points = [a.position, tangentA]
  const samples = Math.max(4, arcSegments)
  for (let index = 1; index < samples; index += 1) {
    const angle = angleA + direction * arcAngle * index / samples
    points.push({ x: center.x + Math.cos(angle) * wheel.radius, y: center.y + Math.sin(angle) * wheel.radius })
  }
  points.push(tangentB, b.position)
  return {
    wheel, a, b, center, tangentA, tangentB, aSide, bSide, qA, qB,
    legA, legB, wrapLength: wheel.radius * arcAngle, length: qA + qB,
    gradientA: normalize(subtract(a.position, tangentA)),
    gradientB: normalize(subtract(b.position, tangentB)),
    points,
  }
}

export function calibrateRoutedConnectors(world) {
  world.connectors = world.connectors.map((connector) => {
    const geometry = wheelRouteGeometry(world, connector)
    if (!geometry) return connector
    return {
      ...connector,
      length: geometry.length,
      routeReference: { qA: geometry.qA, qB: geometry.qB, angle: geometry.wheel.angle },
    }
  })
  return world
}

export function wheelCenterMount(world, wheel) {
  const centerPortId = `${wheel.id}:center`
  const joint = world.joints.find((candidate) => candidate.a?.portId === centerPortId || candidate.b?.portId === centerPortId)
  if (!joint) return null
  const other = joint.a?.portId === centerPortId ? joint.b : joint.a
  if (other?.type === 'world') return { joint, fixed: true, other: null }
  const owner = other?.type === 'port' ? ownerById(world, other.ownerId) : null
  return { joint, fixed: Boolean(owner && (owner.locked || owner.mode === 'track' || owner.type === 'segment')), other: owner }
}

export function connectorState(world, connector) {
  const routeGeometry = wheelRouteGeometry(world, connector)
  if (routeGeometry) {
    const tensionA = connector.tensionA ?? 0
    const tensionB = connector.tensionB ?? tensionA
    return {
      ...routeGeometry,
      extension: routeGeometry.length - connector.length,
      tensionA,
      tensionB,
      tension: (tensionA + tensionB) / 2,
      force: 0,
      elasticEnergy: 0,
    }
  }
  const a = resolveEndpoint(world, connector.a)
  const b = resolveEndpoint(world, connector.b)
  if (!a || !b) return { length: 0, extension: 0, tension: 0, force: 0 }
  const delta = subtract(b.position, a.position)
  const length = magnitude(delta)
  const direction = normalize(delta)
  const relativeSpeed = dot(subtract(b.velocity, a.velocity), direction)
  if (connector.type === 'spring') {
    const extension = length - connector.restLength
    const force = connector.stiffness * extension + (connector.damping ?? 0) * relativeSpeed
    return { a, b, length, direction, relativeSpeed, extension, force, tension: Math.max(0, force), elasticEnergy: 0.5 * connector.stiffness * extension ** 2 }
  }
  const extension = Math.max(0, length - connector.length)
  return { a, b, length, direction, relativeSpeed, extension, force: 0, tension: connector.tension ?? 0, elasticEnergy: 0 }
}

export function connectorLoads(world) {
  const loads = new Map(world.bodies.map((body) => [body.id, { force: { x: 0, y: 0 }, torque: 0 }]))
  for (const connector of world.connectors) {
    if (connector.type !== 'spring') continue
    const state = connectorState(world, connector)
    if (!state.a || state.length === 0) continue
    const forceOnA = scale(state.direction, state.force)
    const apply = (endpoint, force) => {
      if (!endpoint.owner || !loads.has(endpoint.owner.id) || endpoint.owner.mode === 'track') return
      const load = loads.get(endpoint.owner.id)
      load.force = add(load.force, force)
      load.torque += endpoint.offset.x * force.y - endpoint.offset.y * force.x
    }
    apply(state.a, forceOnA)
    apply(state.b, scale(forceOnA, -1))
  }
  return loads
}

function addLoad(ledger, body, kind, sourceId, point, force, couple = 0) {
  if (!body || !ledger.has(body.id) || !force || !Number.isFinite(force.x) || !Number.isFinite(force.y)) return
  ledger.get(body.id).components.push({ id: `${kind}:${sourceId ?? 'world'}:${ledger.get(body.id).components.length}`, kind, sourceId, point: { ...point }, force: { ...force }, couple })
}

export function buildLoadLedger(world) {
  const ledger = new Map(world.bodies.map((body) => [body.id, { bodyId: body.id, components: [], netForce: { x: 0, y: 0 }, netTorque: 0 }]))
  for (const body of world.bodies) {
    const gravity = gravityForce(world, body)
    if (magnitude(gravity) > 0) addLoad(ledger, body, 'gravity', 'gravity', body.position, gravity)
    for (const force of world.forces) {
      const applied = forceOnBody(force, body)
      if (magnitude(applied) > 0) addLoad(ledger, body, force.type, force.id, body.position, applied)
    }
    for (const contact of body._contactLoads ?? []) addLoad(ledger, body, contact.kind, contact.sourceId, contact.point, contact.force)
  }
  for (const connector of world.connectors) {
    const state = connectorState(world, connector)
    if (connector.route && state.wheel) {
      const forceA = scale(state.gradientA, -state.tensionA)
      const forceB = scale(state.gradientB, -state.tensionB)
      addLoad(ledger, state.a.owner, 'tension-a', connector.id, state.a.position, forceA)
      addLoad(ledger, state.b.owner, 'tension-b', connector.id, state.b.position, forceB)
      addLoad(ledger, state.wheel, 'tension-a', connector.id, state.tangentA, scale(forceA, -1))
      addLoad(ledger, state.wheel, 'tension-b', connector.id, state.tangentB, scale(forceB, -1))
      const wheelEntry = ledger.get(state.wheel.id)
      wheelEntry.tensionA = state.tensionA
      wheelEntry.tensionB = state.tensionB
      const sideSign = state.aSide === 'left' ? -1 : 1
      wheelEntry.slipError = Math.max(
        Math.abs(dot(state.a.velocity, state.gradientA) + sideSign * state.wheel.radius * state.wheel.angularVelocity),
        Math.abs(dot(state.b.velocity, state.gradientB) - sideSign * state.wheel.radius * state.wheel.angularVelocity),
      )
      continue
    }
    if (!state.a || !state.b || state.length <= 0) continue
    const magnitudeValue = connector.type === 'spring' ? state.force : state.tension
    const forceA = scale(state.direction, magnitudeValue)
    addLoad(ledger, state.a.owner, connector.type === 'spring' ? 'spring' : 'tension', connector.id, state.a.position, forceA)
    addLoad(ledger, state.b.owner, connector.type === 'spring' ? 'spring' : 'tension', connector.id, state.b.position, scale(forceA, -1))
  }
  for (const body of world.bodies) {
    const entry = ledger.get(body.id)
    for (const component of entry.components) {
      entry.netForce = add(entry.netForce, component.force)
      entry.netTorque += cross(subtract(component.point, body.position), component.force) + (component.couple ?? 0)
    }
    if (body.shape === 'wheel') {
      const contact = (body._contactLoads ?? []).find((component) => component.kind === 'normal')
      if (contact) {
        const surface = world.tracks.find((candidate) => candidate.id === contact.sourceId)
          ?? world.bodies.find((candidate) => candidate.id === contact.sourceId && candidate.mode === 'track')
        const tangent = { x: Math.cos(surface?.angle ?? 0), y: Math.sin(surface?.angle ?? 0) }
        entry.slipError = Math.abs(dot(body.velocity, tangent) + body.angularVelocity * body.radius)
      }
      const mount = wheelCenterMount(world, body)
      if (mount?.fixed) {
        const reactionForce = scale(entry.netForce, -1)
        const reactionCouple = mount.joint.type === 'rigid' || body.rotationMode === 'fixed' ? -entry.netTorque : 0
        addLoad(ledger, body, 'axle-reaction', mount.joint.id, body.position, reactionForce, reactionCouple)
        entry.netForce = { x: 0, y: 0 }
        entry.netTorque += reactionCouple
      }
    }
    entry.forceMagnitude = magnitude(entry.netForce)
    entry.angularAcceleration = entry.netTorque / Math.max(body.assemblyInertia ?? body.inertia, 1e-9)
  }
  world.loadLedger = ledger
  return world
}

export function bodyLoadState(world, bodyId) {
  return world.loadLedger?.get(bodyId) ?? { bodyId, components: [], netForce: { x: 0, y: 0 }, forceMagnitude: 0, netTorque: 0, angularAcceleration: 0 }
}

const isStaticOwner = (owner) => !owner || owner.locked || owner.mode === 'track' || owner.type === 'segment'
const inverseMass = (owner) => (isStaticOwner(owner) || !Number.isFinite(owner.mass) || owner.mass <= 0 ? 0 : 1 / owner.mass)
const inverseInertia = (owner) => {
  const inertia = owner?.assemblyInertia ?? owner?.inertia
  return isStaticOwner(owner) || owner?.shape === 'wheel' && owner.rotationMode === 'fixed' || !Number.isFinite(inertia) || inertia <= 0 ? 0 : 1 / inertia
}

function moveOwner(owner, delta) {
  if (!owner || inverseMass(owner) === 0) return
  owner.position = add(owner.position, delta)
}

function impulseOwner(owner, impulse) {
  if (!owner || inverseMass(owner) === 0) return
  owner.velocity = add(owner.velocity, scale(impulse, inverseMass(owner)))
}

function applyGeneralized(owner, gradient, impulseMagnitude, positionOnly = false, offset = null) {
  if (!owner) return
  const linear = inverseMass(owner)
  const angular = inverseInertia(owner)
  if (linear > 0) {
    if (positionOnly) owner.position = add(owner.position, scale(gradient, impulseMagnitude * linear))
    else owner.velocity = add(owner.velocity, scale(gradient, impulseMagnitude * linear))
  }
  if (offset && angular > 0) {
    const lever = cross(offset, gradient)
    if (positionOnly) owner.angle += lever * impulseMagnitude * angular
    else owner.angularVelocity += lever * impulseMagnitude * angular
  }
}

function solveDistance(world, aEndpoint, bEndpoint, targetLength, maxOnly, dt) {
  const a = resolveEndpoint(world, aEndpoint)
  const b = resolveEndpoint(world, bEndpoint)
  if (!a || !b) return 0
  const delta = subtract(b.position, a.position)
  const distance = magnitude(delta)
  if (distance < 1e-8 || (maxOnly && distance <= targetLength)) return 0
  const normal = scale(delta, 1 / distance)
  const error = distance - targetLength
  const inverseA = inverseMass(a.owner)
  const inverseB = inverseMass(b.owner)
  const inverseAngularA = inverseInertia(a.owner)
  const inverseAngularB = inverseInertia(b.owner)
  const leverA = cross(a.offset, normal)
  const leverB = cross(b.offset, normal)
  const inverseTotal = inverseA + inverseB + leverA ** 2 * inverseAngularA + leverB ** 2 * inverseAngularB
  if (!Number.isFinite(inverseTotal) || inverseTotal <= 0) return 0
  moveOwner(a.owner, scale(normal, error * inverseA / inverseTotal))
  moveOwner(b.owner, scale(normal, -error * inverseB / inverseTotal))
  if (inverseAngularA > 0) a.owner.angle += error * leverA * inverseAngularA / inverseTotal
  if (inverseAngularB > 0) b.owner.angle -= error * leverB * inverseAngularB / inverseTotal
  const relativeSpeed = dot(subtract(b.velocity, a.velocity), normal)
  const correctiveSpeed = 0
  const impulseMagnitude = (relativeSpeed + correctiveSpeed) / inverseTotal
  if (impulseMagnitude > 0 || !maxOnly) {
    impulseOwner(a.owner, scale(normal, impulseMagnitude))
    impulseOwner(b.owner, scale(normal, -impulseMagnitude))
    if (inverseAngularA > 0) a.owner.angularVelocity += leverA * impulseMagnitude * inverseAngularA
    if (inverseAngularB > 0) b.owner.angularVelocity -= leverB * impulseMagnitude * inverseAngularB
  }
  return Math.max(0, impulseMagnitude / dt)
}

function solveIdealWheelRoute(world, connector, geometry, dt) {
  const error = geometry.length - connector.length
  const gradientA = geometry.gradientA
  const gradientB = geometry.gradientB
  const inverseA = inverseMass(geometry.a.owner)
  const inverseB = inverseMass(geometry.b.owner)
  const angularA = inverseInertia(geometry.a.owner)
  const angularB = inverseInertia(geometry.b.owner)
  const leverA = cross(geometry.a.offset, gradientA)
  const leverB = cross(geometry.b.offset, gradientB)
  const inverseTotal = inverseA + inverseB + leverA ** 2 * angularA + leverB ** 2 * angularB
  if (inverseTotal <= 0) return 0
  const correction = -error / inverseTotal
  applyGeneralized(geometry.a.owner, gradientA, correction, true, geometry.a.offset)
  applyGeneralized(geometry.b.owner, gradientB, correction, true, geometry.b.offset)
  const velocityError = dot(geometry.a.velocity, gradientA) + dot(geometry.b.velocity, gradientB)
  const impulse = -velocityError / inverseTotal
  applyGeneralized(geometry.a.owner, gradientA, impulse, false, geometry.a.offset)
  applyGeneralized(geometry.b.owner, gradientB, impulse, false, geometry.b.offset)
  return Math.max(0, -impulse / dt)
}

function solveRotatingWheelSide(geometry, endpoint, gradient, side, reference, dt) {
  const wheel = geometry.wheel
  const q = side === 'a' ? geometry.qA : geometry.qB
  const q0 = side === 'a' ? reference.qA : reference.qB
  const physicalSide = side === 'a' ? geometry.aSide : geometry.bSide
  const angularJacobian = physicalSide === 'left' ? -wheel.radius : wheel.radius
  const inverseLinear = inverseMass(endpoint.owner)
  const inverseAngular = inverseInertia(endpoint.owner)
  const inverseWheel = inverseInertia(wheel)
  const lever = cross(endpoint.offset, gradient)
  const inverseTotal = inverseLinear + lever ** 2 * inverseAngular + angularJacobian ** 2 * inverseWheel
  if (inverseTotal <= 0) return 0
  const error = q - q0 + angularJacobian * (wheel.angle - reference.angle)
  const correction = -error / inverseTotal
  applyGeneralized(endpoint.owner, gradient, correction, true, endpoint.offset)
  if (inverseWheel > 0) wheel.angle += angularJacobian * correction * inverseWheel
  const velocityError = dot(endpoint.velocity, gradient) + angularJacobian * wheel.angularVelocity
  const impulse = -velocityError / inverseTotal
  applyGeneralized(endpoint.owner, gradient, impulse, false, endpoint.offset)
  if (inverseWheel > 0) wheel.angularVelocity += angularJacobian * impulse * inverseWheel
  return Math.max(0, -impulse / dt)
}

function solveWheelRoute(world, connector, dt) {
  const geometry = wheelRouteGeometry(world, connector)
  if (!geometry) return { tensionA: 0, tensionB: 0 }
  if (geometry.wheel.rotationMode === 'fixed') {
    const tension = solveIdealWheelRoute(world, connector, geometry, dt)
    geometry.wheel.angularVelocity = 0
    return { tensionA: tension, tensionB: tension }
  }
  const reference = connector.routeReference ?? { qA: geometry.qA, qB: geometry.qB, angle: geometry.wheel.angle }
  return {
    tensionA: solveRotatingWheelSide(geometry, geometry.a, geometry.gradientA, 'a', reference, dt),
    tensionB: solveRotatingWheelSide(geometry, geometry.b, geometry.gradientB, 'b', reference, dt),
  }
}

export function solveAssemblyConstraints(world, dt, iterations = 8) {
  const connectorTensions = new Map()
  const routedTensions = new Map()
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (const connector of world.connectors) {
      if (connector.type !== 'rope') continue
      if (connector.route) {
        const tensions = solveWheelRoute(world, connector, dt)
        const current = routedTensions.get(connector.id) ?? { tensionA: 0, tensionB: 0 }
        routedTensions.set(connector.id, { tensionA: current.tensionA + tensions.tensionA, tensionB: current.tensionB + tensions.tensionB })
        continue
      }
      const tension = solveDistance(world, connector.a, connector.b, connector.length, true, dt)
      connectorTensions.set(connector.id, Math.max(connectorTensions.get(connector.id) ?? 0, tension))
    }
    for (const joint of world.joints) {
      solveDistance(world, joint.a, joint.b, 0, false, dt)
      if (joint.type === 'rigid' && joint.restAngle !== undefined) {
        const a = joint.a.type === 'port' ? ownerById(world, joint.a.ownerId) : null
        const b = joint.b.type === 'port' ? ownerById(world, joint.b.ownerId) : null
        if (a && b) {
          const error = ((b.angle - a.angle - joint.restAngle + Math.PI) % (Math.PI * 2)) - Math.PI
          const inverseA = inverseInertia(a)
          const inverseB = inverseInertia(b)
          const inverseTotal = inverseA + inverseB
          if (inverseTotal > 0) {
            if (inverseA > 0) a.angle += error * inverseA / inverseTotal
            if (inverseB > 0) b.angle -= error * inverseB / inverseTotal
            const relativeAngularVelocity = (b.angularVelocity ?? 0) - (a.angularVelocity ?? 0)
            const angularImpulse = relativeAngularVelocity / inverseTotal
            if (inverseA > 0) a.angularVelocity += angularImpulse * inverseA
            if (inverseB > 0) b.angularVelocity -= angularImpulse * inverseB
          }
        }
      }
    }
  }
  world.connectors = world.connectors.map((connector) => {
    if (connector.type !== 'rope') return connector
    if (connector.route) return { ...connector, ...(routedTensions.get(connector.id) ?? { tensionA: 0, tensionB: 0 }) }
    return { ...connector, tension: connectorTensions.get(connector.id) ?? 0 }
  })
  return world
}

export function applyCompositeInertia(world) {
  const parent = new Map(world.bodies.map((body) => [body.id, body.id]))
  const find = (id) => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)
    parent.set(id, root)
    return root
  }
  const union = (a, b) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent.set(rootB, rootA)
  }
  for (const joint of world.joints) {
    if (joint.type === 'rigid' && joint.a.type === 'port' && joint.b.type === 'port' && parent.has(joint.a.ownerId) && parent.has(joint.b.ownerId)) union(joint.a.ownerId, joint.b.ownerId)
  }
  const groups = new Map()
  for (const body of world.bodies) {
    const root = find(body.id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(body)
  }
  for (const members of groups.values()) {
    const totalMass = members.reduce((sum, body) => sum + body.mass, 0)
    const center = members.reduce((sum, body) => add(sum, scale(body.position, body.mass / totalMass)), { x: 0, y: 0 })
    const inertia = members.reduce((sum, body) => sum + body.inertia + body.mass * ((body.position.x - center.x) ** 2 + (body.position.y - center.y) ** 2), 0)
    for (const body of members) body.assemblyInertia = inertia
  }
  return world
}
