import { isFiniteVector } from '../physics/vector.js'

export const MAX_SPLINE_KNOTS = 64
export const DEFAULT_CURVE_TOLERANCE = 0.018

const vector = (x = 0, y = 0) => ({ x, y })
const add = (a, b) => vector(a.x + b.x, a.y + b.y)
const subtract = (a, b) => vector(a.x - b.x, a.y - b.y)
const scale = (value, amount) => vector(value.x * amount, value.y * amount)
const magnitude = (value) => Math.hypot(value.x, value.y)
const normalize = (value) => {
  const length = magnitude(value)
  return length > 1e-9 ? scale(value, 1 / length) : vector(1, 0)
}

function coefficients(start, end) {
  const p0 = start.position
  const p1 = end.position
  const d0 = start.tangent
  const d1 = end.tangent
  const q0 = start.secondDerivative
  const q1 = end.secondDerivative
  const delta = subtract(p1, p0)
  return [
    p0,
    d0,
    scale(q0, 0.5),
    add(add(add(scale(delta, 10), scale(d0, -6)), scale(d1, -4)), add(scale(q0, -1.5), scale(q1, 0.5))),
    add(add(add(scale(delta, -15), scale(d0, 8)), scale(d1, 7)), add(scale(q0, 1.5), scale(q1, -1))),
    add(add(add(scale(delta, 6), scale(d0, -3)), scale(d1, -3)), add(scale(q0, -0.5), scale(q1, 0.5))),
  ]
}

export function evaluateQuintic(start, end, t) {
  const c = coefficients(start, end)
  const t2 = t * t
  const t3 = t2 * t
  const t4 = t3 * t
  const t5 = t4 * t
  const position = add(add(add(c[0], scale(c[1], t)), scale(c[2], t2)), add(scale(c[3], t3), add(scale(c[4], t4), scale(c[5], t5))))
  const firstDerivative = add(add(c[1], scale(c[2], 2 * t)), add(scale(c[3], 3 * t2), add(scale(c[4], 4 * t3), scale(c[5], 5 * t4))))
  const secondDerivative = add(scale(c[2], 2), add(scale(c[3], 6 * t), add(scale(c[4], 12 * t2), scale(c[5], 20 * t3))))
  const speed = magnitude(firstDerivative)
  const signedCurvature = speed > 1e-9
    ? (firstDerivative.x * secondDerivative.y - firstDerivative.y * secondDerivative.x) / speed ** 3
    : 0
  return { position, firstDerivative, secondDerivative, signedCurvature }
}

function pointLineDistance(point, start, end) {
  const chord = subtract(end, start)
  const length = magnitude(chord)
  if (length < 1e-9) return magnitude(subtract(point, start))
  return Math.abs(chord.x * (start.y - point.y) - (start.x - point.x) * chord.y) / length
}

function sampleSpan(start, end, tolerance, maxDepth) {
  const first = evaluateQuintic(start, end, 0)
  const last = evaluateQuintic(start, end, 1)
  const samples = [{ ...first, t: 0 }]
  const visit = (t0, a, t1, b, depth) => {
    const tm = (t0 + t1) / 2
    const middle = evaluateQuintic(start, end, tm)
    const deviation = pointLineDistance(middle.position, a.position, b.position)
    const left = normalize(a.firstDerivative)
    const right = normalize(b.firstDerivative)
    const tangentChange = Math.acos(Math.max(-1, Math.min(1, left.x * right.x + left.y * right.y)))
    if (depth < maxDepth && (deviation > tolerance || tangentChange > 0.12)) {
      visit(t0, a, tm, middle, depth + 1)
      visit(tm, middle, t1, b, depth + 1)
    } else samples.push({ ...b, t: t1 })
  }
  visit(0, first, 1, last, 0)
  return samples
}

export function sampleSpline(track, options = {}) {
  const tolerance = options.tolerance ?? DEFAULT_CURVE_TOLERANCE
  const maxDepth = options.maxDepth ?? 9
  const samples = []
  for (let spanIndex = 0; spanIndex < track.knots.length - 1; spanIndex += 1) {
    const span = sampleSpan(track.knots[spanIndex], track.knots[spanIndex + 1], tolerance, maxDepth)
    for (let index = spanIndex === 0 ? 0 : 1; index < span.length; index += 1) {
      const sample = span[index]
      const tangent = normalize(sample.firstDerivative)
      const leftNormal = vector(-tangent.y, tangent.x)
      samples.push({
        position: sample.position,
        tangent,
        normal: track.supportSide === 'right' ? scale(leftNormal, -1) : leftNormal,
        curvature: track.supportSide === 'right' ? -sample.signedCurvature : sample.signedCurvature,
        spanIndex,
        t: sample.t,
      })
    }
  }
  let distance = 0
  return samples.map((sample, index) => {
    if (index > 0) distance += magnitude(subtract(sample.position, samples[index - 1].position))
    return { ...sample, distance, index }
  })
}

export function splineLength(track) {
  return sampleSpline(track).at(-1)?.distance ?? 0
}

export function splinePointAtDistance(track, requestedDistance) {
  const samples = sampleSpline(track)
  if (!samples.length) return null
  const distance = Math.max(0, Math.min(requestedDistance, samples.at(-1).distance))
  let low = 0
  let high = samples.length - 1
  while (low < high - 1) {
    const middle = (low + high) >> 1
    if (samples[middle].distance <= distance) low = middle
    else high = middle
  }
  const a = samples[low]
  const b = samples[Math.min(low + 1, samples.length - 1)]
  const span = b.distance - a.distance
  const t = span > 1e-9 ? (distance - a.distance) / span : 0
  const tangent = normalize(add(scale(a.tangent, 1 - t), scale(b.tangent, t)))
  const normal = normalize(add(scale(a.normal, 1 - t), scale(b.normal, t)))
  return {
    position: add(scale(a.position, 1 - t), scale(b.position, t)),
    tangent,
    normal,
    curvature: a.curvature * (1 - t) + b.curvature * t,
    distance,
    sampleIndex: low,
  }
}

export function createSplineKnot(overrides = {}) {
  return {
    id: overrides.id ?? `knot-${crypto.randomUUID()}`,
    position: overrides.position ?? { x: 0, y: 0 },
    tangent: overrides.tangent ?? { x: 2, y: 0 },
    secondDerivative: overrides.secondDerivative ?? { x: 0, y: 0 },
  }
}

export function autoCompleteSplineKnots(knots) {
  if (!Array.isArray(knots) || knots.length < 2) return (knots ?? []).map((k) => createSplineKnot(k))
  return knots.map((knot, i) => {
    const created = createSplineKnot(knot)
    const prev = knots[Math.max(0, i - 1)]
    const next = knots[Math.min(knots.length - 1, i + 1)]
    const prevPos = prev.position ?? { x: 0, y: 0 }
    const nextPos = next.position ?? { x: 0, y: 0 }
    const autoTangent = scale(subtract(nextPos, prevPos), 0.5)
    const hasExplicitTangent = isFiniteVector(knot.tangent) && (knot.tangent.x !== 2 || knot.tangent.y !== 0) && magnitude(knot.tangent) >= 0.01
    const tangent = hasExplicitTangent ? knot.tangent : magnitude(autoTangent) > 0.01 ? autoTangent : { x: 2, y: 0 }
    const autoSecondDeriv = subtract(add(nextPos, prevPos), scale(created.position, 2))
    const hasExplicitSecondDeriv = isFiniteVector(knot.secondDerivative) && (knot.secondDerivative.x !== 0 || knot.secondDerivative.y !== 0)
    const secondDerivative = hasExplicitSecondDeriv ? knot.secondDerivative : autoSecondDeriv
    return {
      ...created,
      tangent,
      secondDerivative,
    }
  })
}

export function validateSplineTrack(track) {
  const errors = []
  if (!(Number.isFinite(track.thickness) && track.thickness > 0)) errors.push('Spline thickness must be positive.')
  if (!(Number.isFinite(track.friction) && track.friction >= 0 && track.friction <= 1)) errors.push('Spline friction must be between 0 and 1.')
  if (!(Number.isFinite(track.restitution) && track.restitution >= 0 && track.restitution <= 1)) errors.push('Spline restitution must be between 0 and 1.')
  if (!Array.isArray(track.knots) || track.knots.length < 2 || track.knots.length > MAX_SPLINE_KNOTS) return ['Spline tracks require 2 to 64 knots.']
  const ids = new Set()
  for (const knot of track.knots) {
    if (!knot.id || ids.has(knot.id)) errors.push(`Spline knot id must be unique: ${knot.id ?? 'missing'}.`)
    ids.add(knot.id)
    if (!isFiniteVector(knot.position) || !isFiniteVector(knot.tangent) || !isFiniteVector(knot.secondDerivative)) errors.push(`Spline knot ${knot.id ?? 'unknown'} requires finite vectors.`)
    if (isFiniteVector(knot.tangent) && magnitude(knot.tangent) < 0.01) errors.push(`Spline knot ${knot.id ?? 'unknown'} requires a nonzero tangent.`)
    if ([knot.position, knot.tangent, knot.secondDerivative].some((value) => isFiniteVector(value) && Math.max(Math.abs(value.x), Math.abs(value.y)) > 100)) errors.push(`Spline knot ${knot.id ?? 'unknown'} exceeds the 100-unit geometry bound.`)
  }
  for (let index = 1; index < track.knots.length; index += 1) {
    if (magnitude(subtract(track.knots[index].position, track.knots[index - 1].position)) < 0.0001) errors.push(`Spline span ${index} has coincident endpoints.`)
  }
  if (!['left', 'right'].includes(track.supportSide)) errors.push('Spline supportSide must be left or right.')
  if (!errors.length && !(splineLength(track) > 0.05)) errors.push('Spline track must have positive length.')
  return errors
}

export function circleKnot(id, center, radius, theta, span = Math.PI / 2) {
  return createSplineKnot({
    id,
    position: { x: center.x + radius * Math.cos(theta), y: center.y + radius * Math.sin(theta) },
    tangent: { x: -radius * span * Math.sin(theta), y: radius * span * Math.cos(theta) },
    secondDerivative: { x: -radius * span ** 2 * Math.cos(theta), y: -radius * span ** 2 * Math.sin(theta) },
  })
}

export function compileFeatures(features) {
  if (!Array.isArray(features) || features.length === 0) return []
  const knots = []
  let knotIndex = 0

  features.forEach((feature, fIndex) => {
    if (feature.type === 'release') {
      const pos = feature.position ?? { x: -7.5, y: 6 }
      const nextFeature = features[fIndex + 1]
      let nextPos = null
      if (nextFeature) {
        if (nextFeature.type === 'loop' && nextFeature.center) {
          const r = nextFeature.radius ?? 1
          nextPos = { x: nextFeature.center.x - r, y: nextFeature.center.y - r }
        } else if (nextFeature.position) {
          nextPos = nextFeature.position
        }
      }
      const dx = nextPos ? nextPos.x - pos.x : 4
      const dy = nextPos ? nextPos.y - pos.y : -4
      const tangent = { x: dx > 0 ? dx * 0.6 : 4, y: dy }
      knots.push(createSplineKnot({
        id: `feat-release-${knotIndex++}`,
        position: pos,
        tangent,
        secondDerivative: { x: 0, y: 0 },
      }))
    } else if (feature.type === 'loop') {
      const r = feature.radius ?? 1
      const center = feature.center ?? { x: 0, y: r }
      const bottomIn = circleKnot(`feat-loop-in-${knotIndex++}`, center, r, -Math.PI / 2)
      const right = circleKnot(`feat-loop-right-${knotIndex++}`, center, r, 0)
      const top = circleKnot(`feat-loop-top-${knotIndex++}`, center, r, Math.PI / 2)
      const left = circleKnot(`feat-loop-left-${knotIndex++}`, center, r, Math.PI)
      const bottomOut = circleKnot(`feat-loop-out-${knotIndex++}`, center, r, 3 * Math.PI / 2)
      knots.push(bottomIn, right, top, left, bottomOut)
    } else if (feature.type === 'ramp') {
      const pos = feature.position ?? { x: 0, y: 0 }
      knots.push(createSplineKnot({
        id: `feat-ramp-${knotIndex++}`,
        position: pos,
      }))
    } else if (feature.type === 'hill') {
      const pos = feature.position ?? { x: 0, y: 3 }
      const r = feature.radius ?? 2
      knots.push(createSplineKnot({
        id: `feat-hill-${knotIndex++}`,
        position: pos,
        tangent: { x: 3, y: 0 },
        secondDerivative: { x: 0, y: -2 * r },
      }))
    } else if (feature.type === 'valley') {
      const pos = feature.position ?? { x: 0, y: 0 }
      const r = feature.radius ?? 2
      knots.push(createSplineKnot({
        id: `feat-valley-${knotIndex++}`,
        position: pos,
        tangent: { x: 3, y: 0 },
        secondDerivative: { x: 0, y: 2 * r },
      }))
    } else if (feature.type === 'runout') {
      const pos = feature.position ?? { x: 7.5, y: 0 }
      knots.push(createSplineKnot({
        id: `feat-runout-${knotIndex++}`,
        position: pos,
        tangent: { x: 4, y: 0 },
        secondDerivative: { x: 0, y: 0 },
      }))
    }
  })

  const completed = autoCompleteSplineKnots(knots)
  const uniqueKnots = []
  completed.forEach((knot) => {
    if (uniqueKnots.length === 0) {
      uniqueKnots.push(knot)
    } else {
      const prev = uniqueKnots[uniqueKnots.length - 1]
      const dist = Math.hypot(knot.position.x - prev.position.x, knot.position.y - prev.position.y)
      if (dist >= 0.01) {
        uniqueKnots.push(knot)
      } else if (knot.tangent && !prev.tangent) {
        uniqueKnots[uniqueKnots.length - 1] = knot
      }
    }
  })
  return uniqueKnots
}

export function splineTemplate(kind = 'blank', options = {}) {
  const origin = options.origin ?? { x: 0, y: 0 }
  const radius = options.radius ?? 2
  if (kind === 'double-loop') {
    const loopRadius = options.radius ?? 1
    const center1 = { x: origin.x - 2.5, y: origin.y + loopRadius }
    const center2 = { x: origin.x + 3.5, y: origin.y + 2 * loopRadius + loopRadius }
    const bottom1 = circleKnot('loop1-bottom-in', center1, loopRadius, -Math.PI / 2)
    const bottom2 = circleKnot('loop2-bottom-in', center2, loopRadius, -Math.PI / 2)
    return [
      createSplineKnot({ id: 'loop-release', position: { x: origin.x - 7.5, y: origin.y + 6 * loopRadius }, tangent: { x: 5, y: -4 }, secondDerivative: bottom1.secondDerivative }),
      bottom1,
      circleKnot('loop1-right', center1, loopRadius, 0),
      circleKnot('loop1-top', center1, loopRadius, Math.PI / 2),
      circleKnot('loop1-left', center1, loopRadius, Math.PI),
      circleKnot('loop1-bottom-out', center1, loopRadius, 3 * Math.PI / 2),
      createSplineKnot({ id: 'loop-mid-ramp', position: { x: origin.x + 0.5, y: origin.y + loopRadius }, tangent: { x: 4, y: 1 }, secondDerivative: { x: 0, y: 0 } }),
      bottom2,
      circleKnot('loop2-right', center2, loopRadius, 0),
      circleKnot('loop2-top', center2, loopRadius, Math.PI / 2),
      circleKnot('loop2-left', center2, loopRadius, Math.PI),
      circleKnot('loop2-bottom-out', center2, loopRadius, 3 * Math.PI / 2),
      createSplineKnot({ id: 'loop-exit', position: { x: origin.x + 7.5, y: origin.y + 2 * loopRadius }, tangent: { x: 4, y: 0 }, secondDerivative: { x: 0, y: 0 } }),
    ]
  }
  if (kind === 'loop') {
    const center = { x: origin.x + 1.5, y: origin.y + radius }
    const bottom = circleKnot('loop-bottom-in', center, radius, -Math.PI / 2)
    return [
      createSplineKnot({ id: 'loop-release', position: { x: origin.x - 6, y: origin.y + 6.3 }, tangent: { x: 5, y: -4 }, secondDerivative: bottom.secondDerivative }),
      bottom,
      circleKnot('loop-right', center, radius, 0),
      circleKnot('loop-top', center, radius, Math.PI / 2),
      circleKnot('loop-left', center, radius, Math.PI),
      circleKnot('loop-bottom-out', center, radius, 3 * Math.PI / 2),
      createSplineKnot({ id: 'loop-exit', position: { x: origin.x + 6, y: origin.y }, tangent: { x: 4, y: 0 }, secondDerivative: { x: 0, y: 0 } }),
    ]
  }
  if (kind === 'hill') return [
    createSplineKnot({ id: 'hill-start', position: { x: origin.x - 4, y: origin.y }, tangent: { x: 3, y: 0 } }),
    createSplineKnot({ id: 'hill-crest', position: { x: origin.x, y: origin.y + 3 }, tangent: { x: 3, y: 0 }, secondDerivative: { x: 0, y: -5 } }),
    createSplineKnot({ id: 'hill-end', position: { x: origin.x + 4, y: origin.y }, tangent: { x: 3, y: 0 } }),
  ]
  if (kind === 'valley') return [
    createSplineKnot({ id: 'valley-start', position: { x: origin.x - 4, y: origin.y + 3 }, tangent: { x: 3, y: -2 } }),
    createSplineKnot({ id: 'valley-bottom', position: { x: origin.x, y: origin.y }, tangent: { x: 3, y: 0 }, secondDerivative: { x: 0, y: 5 } }),
    createSplineKnot({ id: 'valley-end', position: { x: origin.x + 4, y: origin.y + 3 }, tangent: { x: 3, y: 2 } }),
  ]
  return [
    createSplineKnot({ id: 'spline-start', position: { x: origin.x - 3, y: origin.y + 1 }, tangent: { x: 3, y: 0 } }),
    createSplineKnot({ id: 'spline-end', position: { x: origin.x + 3, y: origin.y + 1 }, tangent: { x: 3, y: 0 } }),
  ]
}
