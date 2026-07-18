export const vector = (x = 0, y = 0) => ({ x, y })

export const add = (a, b) => vector(a.x + b.x, a.y + b.y)
export const subtract = (a, b) => vector(a.x - b.x, a.y - b.y)
export const scale = (value, scalar) => vector(value.x * scalar, value.y * scalar)
export const magnitudeSquared = (value) => value.x * value.x + value.y * value.y
export const magnitude = (value) => Math.sqrt(magnitudeSquared(value))
export const normalize = (value) => {
  const length = magnitude(value)
  return length === 0 ? vector() : scale(value, 1 / length)
}
export const dot = (a, b) => a.x * b.x + a.y * b.y

export function isFiniteVector(value) {
  return Number.isFinite(value?.x) && Number.isFinite(value?.y)
}
