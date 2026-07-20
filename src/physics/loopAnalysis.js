export function minimumLoopHeight(radius, inertiaCoefficient = 0) {
  if (!(radius > 0) || !(inertiaCoefficient >= 0)) return NaN
  return radius * (5 + inertiaCoefficient) / 2
}

export function loopTopSpeed(releaseHeight, radius, inertiaCoefficient = 0, gravity = 9.80665) {
  const availableHeight = releaseHeight - 2 * radius
  return availableHeight > 0 ? Math.sqrt(2 * gravity * availableHeight / (1 + inertiaCoefficient)) : 0
}

export function loopTopNormalForce(mass, speed, radius, gravity = 9.80665) {
  if (!(mass > 0) || !(radius > 0)) return NaN
  return mass * (speed ** 2 / radius - gravity)
}
