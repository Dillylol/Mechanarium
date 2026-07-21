import { magnitudeSquared, scale, vector } from './vector.js'

export const translationalKineticEnergy = (body) => 0.5 * body.mass * magnitudeSquared(body.velocity)
export const rotationalKineticEnergy = (body) => 0.5 * (body.assemblyInertia ?? body.inertia ?? 0) * (body.angularVelocity ?? 0) ** 2
export const gravitationalPotentialEnergy = (body, gravity = 9.80665, datum = 0) => body.mass * gravity * (body.position.y - datum)
export const springPotentialEnergy = (extension, stiffness) => 0.5 * stiffness * extension ** 2
export const linearMomentum = (body) => scale(body.velocity, body.mass)
export const angularMomentum = (body) => (body.assemblyInertia ?? body.inertia ?? 0) * (body.angularVelocity ?? 0)

export function bodyEnergy(body, gravity = { enabled: false, g: 9.80665, direction: { x: 0, y: -1 } }, datum = 0) {
  const translational = translationalKineticEnergy(body)
  const rotational = rotationalKineticEnergy(body)
  const direction = gravity.direction ?? { x: 0, y: -1 }
  const directionLength = Math.hypot(direction.x, direction.y) || 1
  const centerHeight = gravity.enabled
    ? -(body.position.x * direction.x + body.position.y * direction.y) / directionLength - datum
    : 0
  const height = Math.max(0, centerHeight - (body.radius ?? 0))
  const gravitational = gravity.enabled && body.gravityEnabled
    ? body.mass * gravity.g * body.gravityMultiplier * height
    : 0
  return {
    translational,
    rotational,
    kinetic: translational + rotational,
    gravitational,
    height,
    mechanical: translational + rotational + gravitational,
  }
}

export function summarizeSystem(bodies, potentialEnergy = 0) {
  return bodies.reduce((summary, body) => {
    const momentum = linearMomentum(body)
    summary.translationalKinetic += translationalKineticEnergy(body)
    summary.rotationalKinetic += rotationalKineticEnergy(body)
    summary.linearMomentum.x += momentum.x
    summary.linearMomentum.y += momentum.y
    summary.angularMomentum += angularMomentum(body)
    return summary
  }, {
    translationalKinetic: 0,
    rotationalKinetic: 0,
    potential: potentialEnergy,
    total: potentialEnergy,
    linearMomentum: vector(),
    angularMomentum: 0,
  })
}

export function withEnergyTotal(summary) {
  return {
    ...summary,
    total: summary.translationalKinetic + summary.rotationalKinetic + summary.potential,
  }
}

export function conservationError(reference, current) {
  const absolute = current - reference
  const scaleValue = Math.max(Math.abs(reference), Number.EPSILON)
  return { absolute, relative: absolute / scaleValue, percent: (absolute / scaleValue) * 100 }
}
