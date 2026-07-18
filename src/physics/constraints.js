import { dot, magnitude, normalize, scale, subtract } from './vector.js'

function inclineContact(body, incline) {
  if (incline.bodyId === body.id) return true
  if (incline.bodyId) return false
  const segment = subtract(incline.end, incline.start)
  const length = magnitude(segment)
  const tangent = normalize(segment)
  const normal = { x: -tangent.y, y: tangent.x }
  const relative = subtract(body.position, incline.start)
  const along = dot(relative, tangent)
  const normalDistance = dot(relative, normal)
  return along >= -body.radius && along <= length + body.radius
    && normalDistance >= -body.radius
    && normalDistance <= body.radius + 0.08
}

export function constrainAcceleration(body, acceleration, constraints) {
  const incline = constraints.find((constraint) => (
    constraint.type === 'incline' && inclineContact(body, constraint)
  ))
  if (!incline) return acceleration

  const tangent = normalize(subtract(incline.end, incline.start))
  const along = dot(acceleration, tangent)
  const rollingFactor = incline.rolling
    ? body.mass / (body.mass + body.inertia / body.radius ** 2)
    : 1
  return scale(tangent, along * rollingFactor)
}

export function applyConstraints(body, constraints) {
  return constraints.reduce((current, constraint) => {
    if (constraint.bodyId && constraint.bodyId !== current.id) return current
    if (constraint.type === 'ground') return applyGround(current, constraint)
    if (constraint.type === 'incline') return applyIncline(current, constraint)
    return current
  }, body)
}

function applyGround(body, ground) {
  const bottom = body.position.y - body.radius
  if (bottom >= ground.y || body.velocity.y >= 0) return body
  return {
    ...body,
    position: { ...body.position, y: ground.y + body.radius },
    velocity: {
      x: body.velocity.x * (1 - (ground.friction ?? 0)),
      y: -body.velocity.y * (ground.restitution ?? body.restitution),
    },
  }
}

function applyIncline(body, incline) {
  if (!inclineContact(body, incline)) return body
  const segment = subtract(incline.end, incline.start)
  const length = magnitude(segment)
  const tangent = normalize(segment)
  const normal = { x: -tangent.y, y: tangent.x }
  const relative = subtract(body.position, incline.start)
  const along = Math.min(length, Math.max(0, dot(relative, tangent)))
  const surface = { x: incline.start.x + tangent.x * along, y: incline.start.y + tangent.y * along }
  const velocityAlong = dot(body.velocity, tangent)
  const position = { x: surface.x + normal.x * body.radius, y: surface.y + normal.y * body.radius }
  const velocity = scale(tangent, velocityAlong)

  return {
    ...body,
    position,
    velocity,
    angularVelocity: incline.rolling ? velocityAlong / body.radius : body.angularVelocity,
    angle: incline.rolling ? along / body.radius : body.angle,
  }
}

export function resolveCircleCollisions(bodies) {
  const next = bodies.map((body) => ({ ...body, position: { ...body.position }, velocity: { ...body.velocity } }))
  for (let leftIndex = 0; leftIndex < next.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < next.length; rightIndex += 1) {
      const left = next[leftIndex]
      const right = next[rightIndex]
      if (left.shape !== 'circle' || right.shape !== 'circle') continue
      const delta = subtract(right.position, left.position)
      const distance = magnitude(delta)
      const minimumDistance = left.radius + right.radius
      if (distance === 0 || distance >= minimumDistance) continue
      const normal = scale(delta, 1 / distance)
      const relativeSpeed = dot(subtract(right.velocity, left.velocity), normal)
      const overlap = minimumDistance - distance
      const totalInverseMass = 1 / left.mass + 1 / right.mass
      left.position = subtract(left.position, scale(normal, overlap * (1 / left.mass) / totalInverseMass))
      right.position = { x: right.position.x + normal.x * overlap * (1 / right.mass) / totalInverseMass, y: right.position.y + normal.y * overlap * (1 / right.mass) / totalInverseMass }
      if (relativeSpeed >= 0) continue
      const restitution = Math.min(left.restitution, right.restitution)
      const impulse = (-(1 + restitution) * relativeSpeed) / totalInverseMass
      left.velocity = subtract(left.velocity, scale(normal, impulse / left.mass))
      right.velocity = { x: right.velocity.x + normal.x * impulse / right.mass, y: right.velocity.y + normal.y * impulse / right.mass }
    }
  }
  return next
}
