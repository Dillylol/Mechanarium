import { add, dot, magnitude, normalize, scale, subtract } from './vector.js'
import { sampleSpline, splinePointAtDistance } from '../domain/spline.js'

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

const contactFriction = (body, surface) => Math.min(1, Math.max(0, Math.sqrt(Math.max(0, body.friction ?? 0) * Math.max(0, surface.friction ?? 0))))

function idealRailCorrection(original, corrected, surface, tangent, gravity) {
  if (!surface.ideal || !gravity?.enabled || !['circle', 'wheel'].includes(corrected.shape)) return corrected
  const directionLength = Math.hypot(gravity.direction.x, gravity.direction.y) || 1
  const gravityDirection = { x: gravity.direction.x / directionLength, y: gravity.direction.y / directionLength }
  const potential = (candidate) => -candidate.mass * gravity.g * candidate.gravityMultiplier * dot(candidate.position, gravityDirection)
  const inertia = corrected.assemblyInertia ?? corrected.inertia ?? 0
  const kinetic = (candidate) => 0.5 * candidate.mass * dot(candidate.velocity, candidate.velocity) + 0.5 * inertia * candidate.angularVelocity ** 2
  const railEnergy = Number.isFinite(original._railEnergy) ? original._railEnergy : potential(original) + kinetic(original)
  const rolling = corrected.shape === 'wheel' && corrected.rotationMode === 'free' && contactFriction(corrected, surface) > 1e-6
  const preservedRotational = rolling ? 0 : 0.5 * inertia * corrected.angularVelocity ** 2
  const availableKinetic = Math.max(0, railEnergy - potential(corrected) - preservedRotational)
  const effectiveMass = corrected.mass + (rolling ? inertia / corrected.radius ** 2 : 0)
  const speed = Math.sqrt(2 * availableKinetic / Math.max(effectiveMass, 1e-9))
  const tangentSpeed = dot(corrected.velocity, tangent)
  const gravityAlong = dot(gravityDirection, tangent)
  const travelDirection = Math.sign(tangentSpeed) || original._railDirection || Math.sign(gravityAlong) || 1
  return {
    ...corrected,
    velocity: scale(tangent, travelDirection * speed),
    angularVelocity: rolling ? -travelDirection * speed / corrected.radius : corrected.angularVelocity,
    _railEnergy: railEnergy,
    _railDirection: travelDirection,
  }
}

function contactWithSurface(body, surface, dt, gravity) {
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
  const friction = contactFriction(body, surface)
  const normalVelocity = velocityNormal < 0 ? -velocityNormal * restitution : velocityNormal
  const normalImpulseSpeed = velocityNormal < 0 ? -(1 + restitution) * velocityNormal : 0
  const normalImpulse = body.mass * normalImpulseSpeed
  let frictionImpulse
  let tangentVelocity = velocityTangent
  let angularVelocity = body.angularVelocity
  if (body.shape === 'wheel' && body.rotationMode !== 'sliding') {
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
  const corrected = {
    ...body,
    position: add(body.position, scale(normal, penetration)),
    velocity: add(scale(tangent, tangentVelocity), scale(normal, normalVelocity)),
    angularVelocity,
    _contactLoads: contactLoads,
  }
  return idealRailCorrection(body, corrected, surface, tangent, gravity)
}

function splineSurfaceCandidates(body, track) {
  const samples = track._samples ?? sampleSpline(track)
  const candidates = []
  const priorIndex = body._trackContact?.trackId === track.id ? body._trackContact.sampleIndex : null
  const startIndex = priorIndex === null ? 1 : Math.max(1, priorIndex - 8)
  const endIndex = priorIndex === null ? samples.length - 1 : Math.min(samples.length - 1, priorIndex + 8)
  for (let index = startIndex; index <= endIndex; index += 1) {
    const a = samples[index - 1]
    const b = samples[index]
    const delta = subtract(b.position, a.position)
    const length = magnitude(delta)
    if (length < 1e-9) continue
    const tangent = scale(delta, 1 / length)
    const normal = normalize(add(a.normal, b.normal))
    const centerline = scale(add(a.position, b.position), 0.5)
    const center = subtract(centerline, scale(normal, track.thickness / 2))
    const relative = subtract(body.position, centerline)
    const along = dot(relative, tangent)
    const radius = supportRadius(body, normal)
    const signedDistance = dot(relative, normal)
    if (Math.abs(along) > length / 2 + radius * 0.35 || signedDistance < -track.thickness - radius * 0.6 || signedDistance > radius * 1.75) continue
    const continuityPenalty = priorIndex === null ? 0 : Math.abs(index - priorIndex) * 0.04
    candidates.push({
      score: Math.abs(radius - signedDistance) + continuityPenalty,
      index,
      surface: { ...track, center, angle: Math.atan2(tangent.y, tangent.x), length, id: track.id },
      contact: {
        trackId: track.id,
        sampleIndex: index,
        distance: a.distance + length / 2,
        tangent,
        normal,
        curvature: (a.curvature + b.curvature) / 2,
        gap: signedDistance - radius,
      },
    })
  }
  return candidates.sort((left, right) => left.score - right.score)
}

function followIdealSpline(body, track, dt, gravity) {
  if (!track.ideal || body._trackContact?.trackId !== track.id) return null
  if (body._contactLoads?.some((load) => load.sourceId === track.id)) return body
  const prior = body._trackContact
  const tangentSpeed = dot(body.velocity, prior.tangent)
  const requestedDistance = prior.distance + tangentSpeed * dt
  const samples = track._samples ?? sampleSpline(track)
  const trackLength = samples.at(-1)?.distance ?? 0
  if (requestedDistance < 0 || requestedDistance > trackLength) return { ...body, _trackContact: null }
  const point = splinePointAtDistance(track, requestedDistance)
  if (!point) return { ...body, _trackContact: null }
  const radius = supportRadius(body, point.normal)
  const constrained = idealRailCorrection(body, {
    ...body,
    position: add(point.position, scale(point.normal, radius)),
    _trackContact: {
      trackId: track.id,
      sampleIndex: point.sampleIndex,
      distance: point.distance,
      tangent: point.tangent,
      normal: point.normal,
      curvature: point.curvature,
      gap: 0,
    },
  }, track, point.tangent, gravity)
  const speed = Math.abs(dot(constrained.velocity, point.tangent))
  const gravityDirectionLength = Math.hypot(gravity.direction.x, gravity.direction.y) || 1
  const gravityAcceleration = scale(gravity.direction, gravity.g * body.gravityMultiplier / gravityDirectionLength)
  const normalForce = body.mass * (speed ** 2 * point.curvature - dot(gravityAcceleration, point.normal))
  const isApexDetachment = point.normal.y < 0.2 && dot(body.velocity, point.normal) > 0
  if ((!track.ideal || isApexDetachment) && normalForce < -1e-6) return { ...body, _trackContact: null }
  const contactPoint = add(constrained.position, scale(point.normal, -radius))
  return {
    ...constrained,
    _contactLoads: [...(body._contactLoads ?? []), { kind: 'normal', sourceId: track.id, point: contactPoint, force: scale(point.normal, Math.max(0, normalForce)) }],
  }
}

function contactWithSpline(body, track, dt, gravity) {
  const followed = followIdealSpline(body, track, dt, gravity)
  if (followed) return followed
  const candidate = splineSurfaceCandidates(body, track)[0]
  if (!candidate) return body._trackContact?.trackId === track.id ? { ...body, _trackContact: null } : body
  const contacted = contactWithSurface(body, candidate.surface, dt, gravity)
  const changed = contacted !== body
  if (changed) return { ...contacted, _trackContact: candidate.contact }
  if (body._trackContact?.trackId === track.id && Math.abs(candidate.contact.gap) < 0.03) return { ...body, _trackContact: candidate.contact }
  return body._trackContact?.trackId === track.id ? { ...body, _trackContact: null } : body
}

function applyGround(body, ground, dt, gravity) {
  return contactWithSurface(body, { ...ground, center: { x: body.position.x, y: ground.y }, angle: 0, length: 1e6, thickness: 0 }, dt, gravity)
}

function seedJoinedSplineContact(body, world) {
  const supportingRailId = body._contactLoads?.find((load) => load.kind === 'normal')?.sourceId
  if (!supportingRailId || body._trackContact) return body
  for (const join of world.railJoins ?? []) {
    const source = join.a.ownerId === supportingRailId ? join.a : join.b.ownerId === supportingRailId ? join.b : null
    const target = source === join.a ? join.b : source === join.b ? join.a : null
    const spline = target && world.tracks.find((track) => track.id === target.ownerId && track.type === 'spline')
    if (!source || !spline) continue
    const samples = spline._samples ?? sampleSpline(spline)
    const distance = target.endpoint === 'start' ? 0 : samples.at(-1)?.distance ?? 0
    const point = splinePointAtDistance(spline, distance)
    if (!point) continue
    const radius = supportRadius(body, point.normal)
    const expectedCenter = add(point.position, scale(point.normal, radius))
    if (magnitude(subtract(body.position, expectedCenter)) > Math.max(0.45, radius * 1.8)) continue
    const inwardTangent = target.endpoint === 'start' ? point.tangent : scale(point.tangent, -1)
    if (dot(body.velocity, inwardTangent) <= 0) continue
    return {
      ...body,
      _trackContact: {
        trackId: spline.id,
        sampleIndex: point.sampleIndex,
        distance: point.distance,
        tangent: point.tangent,
        normal: point.normal,
        curvature: point.curvature,
        gap: 0,
      },
    }
  }
  return body
}

export function applyWorldContacts(body, world, dt = world.fixedStep) {
  let current = body
  for (const ground of world.constraints.filter((constraint) => constraint.type === 'ground')) current = applyGround(current, ground, dt, world.gravity)
  const surfaces = [
    ...world.tracks.filter((track) => track.type === 'segment'),
    ...world.bodies.filter((candidate) => candidate.shape === 'beam' && candidate.mode === 'track').map((beam) => ({ ...beam, center: beam.position })),
  ]
  for (const surface of surfaces) current = contactWithSurface(current, surface, dt, world.gravity)
  current = seedJoinedSplineContact(current, world)
  for (const track of world.tracks.filter((candidate) => candidate.type === 'spline')) current = contactWithSpline(current, track, dt, world.gravity)
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
