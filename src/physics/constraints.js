import { add, dot, magnitude, normalize, scale, subtract } from './vector.js'

export function constrainAcceleration(_body, acceleration) { return acceleration }

function supportRadius(body, normal) {
  if (body.shape === 'circle' || body.shape === 'wheel') return body.radius
  if (body.shape === 'beam') {
    const tangent = { x: Math.cos(body.angle), y: Math.sin(body.angle) }
    const beamNormal = { x: -tangent.y, y: tangent.x }
    return Math.abs(dot(normal, tangent)) * body.length / 2 + Math.abs(dot(normal, beamNormal)) * body.thickness / 2
  }
  return Math.abs(normal.x) * body.width / 2 + Math.abs(normal.y) * body.height / 2
}

function contactWithSurface(body, surface, dt) {
  const tangent = { x: Math.cos(surface.angle), y: Math.sin(surface.angle) }
  const normal = { x: -tangent.y, y: tangent.x }
  const topCenter = add(surface.center, scale(normal, surface.thickness / 2))
  const relative = subtract(body.position, topCenter)
  const along = dot(relative, tangent)
  const distance = dot(relative, normal)
  const radius = supportRadius(body, normal)
  const inSpan = Math.abs(along) <= surface.length / 2 + radius * 0.25
  const penetration = radius - distance
  const nearTop = distance > -surface.thickness - radius * 0.5
  if (!inSpan || !nearTop || penetration <= 0) return body

  const velocityNormal = dot(body.velocity, normal)
  const velocityTangent = dot(body.velocity, tangent)
  const restitution = surface.restitution ?? body.restitution ?? 0
  const friction = Math.min(1, Math.max(0, surface.friction ?? body.friction ?? 0))
  const normalVelocity = velocityNormal < 0 ? -velocityNormal * restitution : velocityNormal
  const normalImpulseSpeed = velocityNormal < 0 ? -(1 + restitution) * velocityNormal : 0
  const normalImpulse = body.mass * normalImpulseSpeed
  let frictionImpulse
  let tangentVelocity = velocityTangent
  let angularVelocity = body.angularVelocity
  if (body.shape === 'wheel') {
    const inverseInertia = body.rotationMode === 'fixed' ? 0 : 1 / Math.max(body.assemblyInertia ?? body.inertia, 1e-9)
    const contactSpeed = velocityTangent + body.angularVelocity * body.radius
    const effectiveInverseMass = 1 / body.mass + body.radius ** 2 * inverseInertia
    const requiredImpulse = -contactSpeed / effectiveInverseMass
    const maximumImpulse = friction * normalImpulse
    frictionImpulse = Math.max(-maximumImpulse, Math.min(maximumImpulse, requiredImpulse))
    tangentVelocity += frictionImpulse / body.mass
    angularVelocity = body.rotationMode === 'fixed' ? 0 : body.angularVelocity + frictionImpulse * body.radius * inverseInertia
  } else {
    const frictionDelta = Math.min(Math.abs(velocityTangent), friction * normalImpulseSpeed)
    tangentVelocity = velocityTangent - Math.sign(velocityTangent) * frictionDelta
    frictionImpulse = -Math.sign(velocityTangent) * frictionDelta * body.mass
    if (body.shape === 'circle' && friction > 0.05) angularVelocity = tangentVelocity / body.radius
  }
  const point = add(body.position, scale(normal, -radius))
  const contactLoads = [...(body._contactLoads ?? [])]
  if (normalImpulse > 0) contactLoads.push({ kind: 'normal', sourceId: surface.id ?? 'surface', point, force: scale(normal, normalImpulse / dt) })
  if (Math.abs(frictionImpulse) > 0) contactLoads.push({ kind: 'friction', sourceId: surface.id ?? 'surface', point, force: scale(tangent, frictionImpulse / dt) })
  return {
    ...body,
    position: add(body.position, scale(normal, penetration)),
    velocity: add(scale(tangent, tangentVelocity), scale(normal, normalVelocity)),
    angularVelocity,
    _contactLoads: contactLoads,
  }
}

function applyGround(body, ground, dt) {
  return contactWithSurface(body, { ...ground, center: { x: body.position.x, y: ground.y }, angle: 0, length: 1e6, thickness: 0 }, dt)
}

export function applyWorldContacts(body, world, dt = world.fixedStep) {
  let current = body
  for (const ground of world.constraints.filter((constraint) => constraint.type === 'ground')) current = applyGround(current, ground, dt)
  const surfaces = [
    ...world.tracks,
    ...world.bodies.filter((candidate) => candidate.shape === 'beam' && candidate.mode === 'track').map((beam) => ({ ...beam, center: beam.position })),
  ]
  for (const surface of surfaces) current = contactWithSurface(current, surface, dt)
  return current
}

export function applyConstraints(body, constraints) {
  return constraints.reduce((current, constraint) => constraint.type === 'ground' ? applyGround(current, constraint, 1 / 120) : current, body)
}

export function resolveCircleCollisions(bodies) {
  const next = bodies.map((body) => ({ ...body, position: { ...body.position }, velocity: { ...body.velocity } }))
  for (let leftIndex = 0; leftIndex < next.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < next.length; rightIndex += 1) {
      const left = next[leftIndex]
      const right = next[rightIndex]
      if (!['circle', 'wheel'].includes(left.shape) || !['circle', 'wheel'].includes(right.shape) || left.mode === 'track' || right.mode === 'track') continue
      const delta = subtract(right.position, left.position)
      const distance = magnitude(delta)
      const minimumDistance = left.radius + right.radius
      if (distance === 0 || distance >= minimumDistance) continue
      const normal = normalize(delta)
      const relativeSpeed = dot(subtract(right.velocity, left.velocity), normal)
      const overlap = minimumDistance - distance
      const inverseLeft = left.locked ? 0 : 1 / left.mass
      const inverseRight = right.locked ? 0 : 1 / right.mass
      const totalInverseMass = inverseLeft + inverseRight
      if (totalInverseMass === 0) continue
      left.position = subtract(left.position, scale(normal, overlap * inverseLeft / totalInverseMass))
      right.position = add(right.position, scale(normal, overlap * inverseRight / totalInverseMass))
      if (relativeSpeed >= 0) continue
      const restitution = Math.min(left.restitution, right.restitution)
      const impulse = (-(1 + restitution) * relativeSpeed) / totalInverseMass
      left.velocity = subtract(left.velocity, scale(normal, impulse * inverseLeft))
      right.velocity = add(right.velocity, scale(normal, impulse * inverseRight))
    }
  }
  return next
}

export function resolveBeamBodyCollisions(bodies) {
  const next = bodies.map((body) => ({ ...body, position: { ...body.position }, velocity: { ...body.velocity } }))
  const beams = next.filter((body) => body.shape === 'beam' && body.mode !== 'track')
  const others = next.filter((body) => body.shape !== 'beam')
  for (const beam of beams) for (const body of others) {
    const tangent = { x: Math.cos(beam.angle), y: Math.sin(beam.angle) }
    const beamNormal = { x: -tangent.y, y: tangent.x }
    const relative = subtract(body.position, beam.position)
    const local = { x: dot(relative, tangent), y: dot(relative, beamNormal) }
    const closestLocal = {
      x: Math.max(-beam.length / 2, Math.min(beam.length / 2, local.x)),
      y: Math.max(-beam.thickness / 2, Math.min(beam.thickness / 2, local.y)),
    }
    const contactOffset = add(scale(tangent, closestLocal.x), scale(beamNormal, closestLocal.y))
    const delta = subtract(relative, contactOffset)
    let distance = magnitude(delta)
    const radius = ['circle', 'wheel'].includes(body.shape) ? body.radius : Math.hypot(body.width, body.height) / 2
    if (distance >= radius) continue
    let normal
    if (distance > 1e-9) normal = scale(delta, 1 / distance)
    else {
      const xClearance = beam.length / 2 - Math.abs(local.x)
      const yClearance = beam.thickness / 2 - Math.abs(local.y)
      normal = xClearance < yClearance ? scale(tangent, Math.sign(local.x) || 1) : scale(beamNormal, Math.sign(local.y) || 1)
      distance = 0
    }
    const inverseBody = body.locked ? 0 : 1 / body.mass
    const inverseBeam = beam.locked ? 0 : 1 / beam.mass
    const inverseInertia = beam.locked ? 0 : 1 / Math.max(beam.assemblyInertia ?? beam.inertia, 1e-9)
    const lever = contactOffset.x * normal.y - contactOffset.y * normal.x
    const effective = inverseBody + inverseBeam + lever ** 2 * inverseInertia
    if (effective === 0) continue
    const penetration = radius - distance
    body.position = add(body.position, scale(normal, penetration * inverseBody / (inverseBody + inverseBeam || inverseBody)))
    beam.position = subtract(beam.position, scale(normal, penetration * inverseBeam / (inverseBody + inverseBeam || inverseBeam)))
    const beamContactVelocity = { x: beam.velocity.x - beam.angularVelocity * contactOffset.y, y: beam.velocity.y + beam.angularVelocity * contactOffset.x }
    const approachSpeed = dot(subtract(body.velocity, beamContactVelocity), normal)
    if (approachSpeed >= 0) continue
    const impulse = -(1 + Math.min(body.restitution, beam.restitution)) * approachSpeed / effective
    body.velocity = add(body.velocity, scale(normal, impulse * inverseBody))
    beam.velocity = subtract(beam.velocity, scale(normal, impulse * inverseBeam))
    beam.angularVelocity -= lever * impulse * inverseInertia
  }
  return next
}
