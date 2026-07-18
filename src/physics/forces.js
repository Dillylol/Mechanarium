import { add, magnitude, normalize, scale, subtract, vector } from './vector.js'

const appliesTo = (force, body) => !force.bodyId || force.bodyId === body.id

export function forceOnBody(force, body, position = body.position, velocity = body.velocity) {
  if (!appliesTo(force, body) || body.locked) return vector()

  if (force.type === 'gravity') return vector(0, -body.mass * force.g)
  if (force.type === 'uniform') return force.vector
  if (force.type === 'drag') return scale(velocity, -force.coefficient * magnitude(velocity))

  if (force.type === 'spring') {
    const displacement = subtract(position, force.anchor)
    const length = magnitude(displacement)
    const springForce = scale(normalize(displacement), -force.stiffness * (length - force.restLength))
    const dampingForce = scale(velocity, -(force.damping ?? 0))
    return add(springForce, dampingForce)
  }

  if (force.type === 'central') {
    const towardCenter = subtract(force.center, position)
    const radiusSquared = towardCenter.x ** 2 + towardCenter.y ** 2 + (force.softening ?? 0.01) ** 2
    return scale(normalize(towardCenter), (body.mass * force.strength) / radiusSquared)
  }

  return vector()
}

export function netForceOnBody(forces, body, position = body.position, velocity = body.velocity) {
  return forces.reduce((net, force) => add(net, forceOnBody(force, body, position, velocity)), vector())
}

export function potentialEnergyForces(forces, bodies) {
  return forces.reduce((total, force) => {
    if (force.type === 'gravity') {
      return total + bodies.filter((body) => appliesTo(force, body)).reduce((sum, body) => sum + body.mass * force.g * body.position.y, 0)
    }
    if (force.type === 'spring') {
      const body = bodies.find((candidate) => candidate.id === force.bodyId)
      if (!body) return total
      const extension = magnitude(subtract(body.position, force.anchor)) - force.restLength
      return total + 0.5 * force.stiffness * extension ** 2
    }
    if (force.type === 'central') {
      const body = bodies.find((candidate) => candidate.id === force.bodyId)
      if (!body) return total
      const radius = Math.sqrt((body.position.x - force.center.x) ** 2 + (body.position.y - force.center.y) ** 2 + (force.softening ?? 0.01) ** 2)
      return total - (body.mass * force.strength) / radius
    }
    return total
  }, 0)
}
