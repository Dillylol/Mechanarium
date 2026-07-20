import { add, dot, magnitude, normalize, scale, subtract } from './vector.js'

const rotate = (point, angle) => ({
  x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
  y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
})

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

export function connectorState(world, connector) {
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

const isStaticOwner = (owner) => !owner || owner.locked || owner.mode === 'track' || owner.type === 'segment'
const inverseMass = (owner) => (isStaticOwner(owner) || !Number.isFinite(owner.mass) || owner.mass <= 0 ? 0 : 1 / owner.mass)
const inverseInertia = (owner) => {
  const inertia = owner?.assemblyInertia ?? owner?.inertia
  return isStaticOwner(owner) || !Number.isFinite(inertia) || inertia <= 0 ? 0 : 1 / inertia
}
const cross = (a, b) => a.x * b.y - a.y * b.x

function moveOwner(owner, delta) {
  if (!owner || inverseMass(owner) === 0) return
  owner.position = add(owner.position, delta)
}

function impulseOwner(owner, impulse) {
  if (!owner || inverseMass(owner) === 0) return
  owner.velocity = add(owner.velocity, scale(impulse, inverseMass(owner)))
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

export function solveAssemblyConstraints(world, dt, iterations = 8) {
  const connectorTensions = new Map()
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (const connector of world.connectors) {
      if (connector.type !== 'rope') continue
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
  world.connectors = world.connectors.map((connector) => connector.type === 'rope' ? { ...connector, tension: connectorTensions.get(connector.id) ?? 0 } : connector)
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
