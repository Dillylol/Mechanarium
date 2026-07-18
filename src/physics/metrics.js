import { magnitudeSquared, scale, vector } from './vector.js'

export const translationalKineticEnergy = (body) => 0.5 * body.mass * magnitudeSquared(body.velocity)
export const rotationalKineticEnergy = (body) => 0.5 * (body.inertia ?? 0) * (body.angularVelocity ?? 0) ** 2
export const gravitationalPotentialEnergy = (body, gravity = 9.80665, datum = 0) => body.mass * gravity * (body.position.y - datum)
export const springPotentialEnergy = (extension, stiffness) => 0.5 * stiffness * extension ** 2
export const linearMomentum = (body) => scale(body.velocity, body.mass)
export const angularMomentum = (body) => (body.inertia ?? 0) * (body.angularVelocity ?? 0)

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
