export const INSTRUMENT_TYPES = Object.freeze(['ruler', 'photogate'])

const finiteVector = (value) => Number.isFinite(value?.x) && Number.isFinite(value?.y)
const finitePositive = (value) => Number.isFinite(value) && value > 0

export function createInstrument(type = 'ruler', overrides = {}) {
  const id = overrides.id ?? `${type}-${crypto.randomUUID()}`
  const common = {
    id,
    type,
    name: overrides.name ?? (type === 'photogate' ? 'Photogate' : 'Ruler'),
    resolution: overrides.resolution ?? (type === 'photogate' ? 0.0001 : 0.001),
    noiseEnabled: overrides.noiseEnabled ?? false,
    noiseSigma: overrides.noiseSigma ?? 0,
  }
  if (type === 'photogate') return {
    ...common,
    center: overrides.center ?? { x: 0, y: 1 },
    angle: overrides.angle ?? Math.PI / 2,
    length: overrides.length ?? 2,
    targetBodyId: overrides.targetBodyId ?? null,
    pairId: overrides.pairId ?? null,
    pairRole: overrides.pairRole ?? null,
    nominalSpacing: overrides.nominalSpacing ?? null,
    trackId: overrides.trackId ?? null,
    trackDistance: overrides.trackDistance ?? null,
  }
  return {
    ...common,
    a: overrides.a ?? { x: -1, y: 0 },
    b: overrides.b ?? { x: 1, y: 0 },
  }
}

export function validateInstrument(instrument, bodyIds = new Set()) {
  const errors = []
  if (!instrument?.id) errors.push('Instrument requires an id.')
  if (!INSTRUMENT_TYPES.includes(instrument?.type)) errors.push(`Unsupported instrument type: ${instrument?.type}.`)
  if (!finitePositive(instrument?.resolution)) errors.push(`Instrument ${instrument?.id ?? 'unknown'} requires positive resolution.`)
  if (!Number.isFinite(instrument?.noiseSigma) || instrument.noiseSigma < 0) errors.push(`Instrument ${instrument?.id ?? 'unknown'} requires non-negative uncertainty.`)
  if (instrument?.type === 'ruler' && (!finiteVector(instrument.a) || !finiteVector(instrument.b) || Math.hypot(instrument.b.x - instrument.a.x, instrument.b.y - instrument.a.y) < 1e-8)) errors.push(`Ruler ${instrument?.id ?? 'unknown'} requires two distinct finite endpoints.`)
  if (instrument?.type === 'photogate') {
    if (!finiteVector(instrument.center) || !Number.isFinite(instrument.angle) || !finitePositive(instrument.length)) errors.push(`Photogate ${instrument?.id ?? 'unknown'} has invalid geometry.`)
    if (instrument.targetBodyId && !bodyIds.has(instrument.targetBodyId)) errors.push(`Photogate ${instrument.id} references unknown body ${instrument.targetBodyId}.`)
    if (instrument.pairId && !['A', 'B'].includes(instrument.pairRole)) errors.push(`Photogate ${instrument.id} requires pair role A or B.`)
    if (instrument.pairId && !finitePositive(instrument.nominalSpacing)) errors.push(`Photogate ${instrument.id} requires positive assembly spacing.`)
    if (instrument.trackDistance !== null && !Number.isFinite(instrument.trackDistance)) errors.push(`Photogate ${instrument.id} has invalid track distance.`)
  }
  return errors
}

export function validatePhotogatePairs(instruments = []) {
  const errors = []
  const pairs = new Map()
  for (const gate of instruments.filter((instrument) => instrument.type === 'photogate' && instrument.pairId)) {
    if (!pairs.has(gate.pairId)) pairs.set(gate.pairId, [])
    pairs.get(gate.pairId).push(gate)
  }
  for (const [pairId, gates] of pairs) {
    const roles = new Set(gates.map((gate) => gate.pairRole))
    if (gates.length !== 2 || !roles.has('A') || !roles.has('B')) errors.push(`Photogate assembly ${pairId} requires exactly one A and one B plane.`)
    if (new Set(gates.map((gate) => gate.targetBodyId ?? '')).size > 1) errors.push(`Photogate assembly ${pairId} must target the same body.`)
  }
  return errors
}

export function rulerReading(instrument) {
  const dx = instrument.b.x - instrument.a.x
  const dy = instrument.b.y - instrument.a.y
  return { dx, dy, distance: Math.hypot(dx, dy) }
}

function seededNormal(seed) {
  let state = (seed >>> 0) || 1
  const next = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5
    return (state >>> 0) / 4294967296
  }
  const u = Math.max(next(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next())
}

export function measuredValue(value, instrument, seed = 1) {
  const noisy = instrument.noiseEnabled ? value + seededNormal(seed) * instrument.noiseSigma : value
  return Math.round(noisy / instrument.resolution) * instrument.resolution
}

const sideOfGate = (position, gate) => {
  const normal = { x: -Math.sin(gate.angle), y: Math.cos(gate.angle) }
  return (position.x - gate.center.x) * normal.x + (position.y - gate.center.y) * normal.y
}

export function detectPhotogateCrossings(previousWorld, nextWorld, instruments, previousState = {}, seed = 1) {
  const state = { ...previousState }
  const events = []
  let eventIndex = 0
  for (const gate of instruments.filter((instrument) => instrument.type === 'photogate')) {
    const tangent = { x: Math.cos(gate.angle), y: Math.sin(gate.angle) }
    for (const nextBody of nextWorld.bodies) {
      if (gate.targetBodyId && gate.targetBodyId !== nextBody.id) continue
      const previousBody = previousWorld.bodies.find((body) => body.id === nextBody.id)
      if (!previousBody) continue
      const key = `${gate.id}:${nextBody.id}`
      const prior = state[key] ?? { armed: true, side: Math.sign(sideOfGate(previousBody.position, gate)) || 1 }
      const d0 = sideOfGate(previousBody.position, gate)
      const d1 = sideOfGate(nextBody.position, gate)
      const side0 = Math.sign(d0) || prior.side
      const side1 = Math.sign(d1) || side0
      if (!prior.armed) {
        state[key] = Math.abs(d1) > nextBody.radius ? { armed: true, side: side1 } : { ...prior, side: side1 }
        continue
      }
      if (side0 !== side1 && Math.abs(d0 - d1) > 1e-12) {
        const fraction = Math.min(1, Math.max(0, d0 / (d0 - d1)))
        const position = {
          x: previousBody.position.x + (nextBody.position.x - previousBody.position.x) * fraction,
          y: previousBody.position.y + (nextBody.position.y - previousBody.position.y) * fraction,
        }
        const along = (position.x - gate.center.x) * tangent.x + (position.y - gate.center.y) * tangent.y
        if (Math.abs(along) <= gate.length / 2) {
          const rawTime = previousWorld.time + (nextWorld.time - previousWorld.time) * fraction
          const velocity = {
            x: previousBody.velocity.x + (nextBody.velocity.x - previousBody.velocity.x) * fraction,
            y: previousBody.velocity.y + (nextBody.velocity.y - previousBody.velocity.y) * fraction,
          }
          events.push({
            id: `${gate.id}:${nextBody.id}:${rawTime.toFixed(9)}`,
            gateId: gate.id,
            gateName: gate.name,
            pairId: gate.pairId ?? null,
            pairRole: gate.pairRole ?? null,
            bodyId: nextBody.id,
            bodyName: nextBody.name,
            direction: Math.sign(d1 - d0),
            time: measuredValue(rawTime, gate, seed + eventIndex),
            position,
            velocity,
            speed: Math.hypot(velocity.x, velocity.y),
          })
          eventIndex += 1
          state[key] = { armed: false, side: side1 }
          continue
        }
      }
      state[key] = { armed: true, side: side1 }
    }
  }
  return { events, state }
}

export function deriveGateResults(events, instruments) {
  const gates = new Map(instruments.filter((instrument) => instrument.type === 'photogate').map((gate) => [gate.id, gate]))
  const results = []
  const byBody = new Map()
  const assemblyStarts = new Map()
  for (const event of [...events].sort((a, b) => a.time - b.time)) {
    const gate = gates.get(event.gateId)
    if (gate?.pairId) {
      const key = `${gate.pairId}:${event.bodyId}`
      const previous = assemblyStarts.get(key)
      const a = previous && gates.get(previous.gateId)
      if (previous && a && a.pairRole !== gate.pairRole) {
        const interval = event.time - previous.time
        if (interval > 0) {
          const trackSpacing = a.trackId && a.trackId === gate.trackId && Number.isFinite(a.trackDistance) && Number.isFinite(gate.trackDistance)
            ? Math.abs(gate.trackDistance - a.trackDistance)
            : null
          const spacing = trackSpacing ?? gate.nominalSpacing ?? a.nominalSpacing ?? Math.hypot(gate.center.x - a.center.x, gate.center.y - a.center.y)
          results.push({
            pairId: gate.pairId,
            bodyId: event.bodyId,
            bodyName: event.bodyName,
            fromGateId: previous.gateId,
            toGateId: event.gateId,
            startTime: previous.time,
            endTime: event.time,
            interval,
            spacing,
            averageSpeed: spacing / interval,
            acceleration: (event.speed - previous.speed) / interval,
          })
        }
        assemblyStarts.delete(key)
      } else {
        assemblyStarts.set(key, event)
      }
      continue
    }
    const previous = byBody.get(event.bodyId)
    const previousGate = previous && gates.get(previous.gateId)
    if (previous && !previousGate?.pairId && previous.gateId !== event.gateId) {
      const a = gates.get(previous.gateId)
      const b = gate
      const interval = event.time - previous.time
      if (a && b && interval > 0) {
        const spacing = Math.hypot(b.center.x - a.center.x, b.center.y - a.center.y)
        results.push({
          bodyId: event.bodyId,
          bodyName: event.bodyName,
          fromGateId: previous.gateId,
          toGateId: event.gateId,
          startTime: previous.time,
          endTime: event.time,
          interval,
          spacing,
          averageSpeed: spacing / interval,
          acceleration: (event.speed - previous.speed) / interval,
        })
      }
    }
    byBody.set(event.bodyId, event)
  }
  return results
}

export function sampleTrialWorld(world) {
  return world.bodies.map((body) => ({
    time: world.time,
    bodyId: body.id,
    bodyName: body.name,
    x: body.position.x,
    y: body.position.y,
    vx: body.velocity.x,
    vy: body.velocity.y,
    ax: body.acceleration.x,
    ay: body.acceleration.y,
    speed: Math.hypot(body.velocity.x, body.velocity.y),
    trackCoordinate: body._trackContact?.distance ?? '',
    trackCurvature: body._trackContact?.curvature ?? '',
    trackRadius: body._trackContact?.curvature ? Math.abs(1 / body._trackContact.curvature) : '',
  }))
}
