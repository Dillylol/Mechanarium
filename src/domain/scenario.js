import { INTEGRATORS } from '../physics/constants.js'
import { isFiniteVector } from '../physics/vector.js'
import { createInstrument, validateInstrument, validatePhotogatePairs } from './instruments.js'
import { validateRailJoins } from './railWeld.js'
import { autoCompleteSplineKnots, compileFeatures, createSplineKnot, sampleSpline, splinePointAtDistance, splineTemplate, validateSplineTrack } from './spline.js'

export const SCENARIO_VERSION = 4
export const BODY_SHAPES = Object.freeze(['circle', 'box', 'beam', 'wheel'])
export const BEAM_MODES = Object.freeze(['dynamic', 'pinned', 'track'])
export const WHEEL_INERTIA_MODELS = Object.freeze(['disk', 'hoop'])
export const WHEEL_ROTATION_MODES = Object.freeze(['free', 'sliding', 'fixed'])
export const FORCE_TYPES = Object.freeze(['uniform', 'drag', 'central'])
export const CONSTRAINT_TYPES = Object.freeze(['ground'])
export const CONNECTOR_TYPES = Object.freeze(['spring', 'rope'])
export const JOINT_TYPES = Object.freeze(['rigid', 'pin'])

const finitePositive = (value) => Number.isFinite(value) && value > 0
const finiteNonNegative = (value) => Number.isFinite(value) && value >= 0
const copy = (value) => structuredClone(value)

export const beamInertia = (mass, length) => mass * length ** 2 / 12
export const wheelInertia = (mass, radius, model = 'disk') => (model === 'hoop' ? 1 : 0.5) * mass * radius ** 2

export function createBody(overrides = {}) {
  const id = overrides.id ?? `body-${crypto.randomUUID()}`
  const radius = overrides.radius ?? 0.35
  const mass = overrides.mass ?? 1
  const shape = overrides.shape ?? 'circle'
  const length = overrides.length ?? 3
  const inertiaModel = shape === 'wheel' ? (overrides.inertiaModel ?? 'disk') : undefined
  const inertia = shape === 'beam'
    ? beamInertia(mass, length)
    : shape === 'wheel'
      ? wheelInertia(mass, radius, inertiaModel)
    : shape === 'box'
      ? mass * ((overrides.width ?? radius * 2) ** 2 + (overrides.height ?? radius * 2) ** 2) / 12
      : 0.5 * mass * radius ** 2
  return {
    id,
    name: overrides.name ?? (shape === 'beam' ? 'Beam' : shape === 'wheel' ? 'Wheel' : 'Body'),
    shape,
    mass,
    radius,
    width: overrides.width ?? radius * 2,
    height: overrides.height ?? radius * 2,
    length,
    thickness: overrides.thickness ?? 0.18,
    depth: shape === 'wheel' ? (overrides.depth ?? Math.max(0.24, radius * 0.7)) : undefined,
    mode: shape === 'beam' ? (overrides.mode ?? 'dynamic') : undefined,
    inertiaModel,
    rotationMode: shape === 'wheel' ? (overrides.rotationMode ?? 'free') : undefined,
    autoLength: shape === 'beam' ? (overrides.autoLength ?? false) : undefined,
    ideal: shape === 'beam' ? (overrides.ideal ?? false) : undefined,
    pinPortId: shape === 'beam' ? (overrides.pinPortId ?? `${id}:center`) : undefined,
    position: overrides.position ?? { x: 0, y: 2 },
    velocity: overrides.velocity ?? { x: 0, y: 0 },
    acceleration: overrides.acceleration ?? { x: 0, y: 0 },
    angle: overrides.angle ?? 0,
    angularVelocity: overrides.angularVelocity ?? 0,
    angularAcceleration: overrides.angularAcceleration ?? 0,
    inertia: overrides.inertia ?? inertia,
    assemblyInertia: overrides.assemblyInertia ?? inertia,
    restitution: overrides.restitution ?? 0.35,
    friction: overrides.friction ?? 0.18,
    color: overrides.color ?? (shape === 'beam' ? '#171717' : shape === 'wheel' ? '#3b82f6' : '#ffb35c'),
    locked: overrides.locked ?? false,
    gravityEnabled: overrides.gravityEnabled ?? true,
    gravityMultiplier: overrides.gravityMultiplier ?? 1,
  }
}

export function createWheel(overrides = {}) {
  return createBody({ shape: 'wheel', name: 'Wheel', mass: 2, radius: 0.65, ...overrides })
}

export function createTrack(overrides = {}) {
  if (overrides.type === 'spline') return createSplineTrack(overrides)
  return {
    id: overrides.id ?? `track-${crypto.randomUUID()}`,
    name: overrides.name ?? 'Ramp',
    type: 'segment',
    center: overrides.center ?? { x: 0, y: 0 },
    angle: overrides.angle ?? 0,
    length: overrides.length ?? 6,
    thickness: overrides.thickness ?? 0.18,
    friction: overrides.friction ?? 0.12,
    restitution: overrides.restitution ?? 0.2,
    ideal: overrides.ideal ?? false,
    startEnd: overrides.startEnd ?? 'start',
  }
}

export function createSplineTrack(overrides = {}) {
  const rawKnots = Array.isArray(overrides.features) && overrides.features.length > 0
    ? compileFeatures(overrides.features)
    : (overrides.knots ?? splineTemplate(overrides.template ?? 'blank')).map((knot) => createSplineKnot(knot))
  const knots = autoCompleteSplineKnots(rawKnots)
  return {
    id: overrides.id ?? `track-${crypto.randomUUID()}`,
    name: overrides.name ?? 'Spline track',
    type: 'spline',
    knots,
    thickness: overrides.thickness ?? 0.18,
    friction: overrides.friction ?? 0.12,
    restitution: overrides.restitution ?? 0.05,
    ideal: overrides.ideal ?? false,
    startEnd: overrides.startEnd ?? 'start',
    supportSide: overrides.supportSide ?? 'left',
  }
}

export function createConnector(type = 'spring', overrides = {}) {
  const length = overrides.length ?? overrides.restLength ?? 2
  return {
    id: overrides.id ?? `${type}-${crypto.randomUUID()}`,
    name: overrides.name ?? (type === 'rope' ? 'Rope' : 'Spring'),
    type,
    a: overrides.a ?? { type: 'world', position: { x: -1, y: 2 } },
    b: overrides.b ?? { type: 'world', position: { x: 1, y: 2 } },
    length,
    restLength: overrides.restLength ?? length,
    stiffness: overrides.stiffness ?? 8,
    damping: overrides.damping ?? 0.08,
    unattached: overrides.unattached ?? (overrides.attached === false) ?? false,
    route: type === 'rope' ? overrides.route : undefined,
  }
}

export function defaultPorts(owner) {
  if (owner.shape === 'beam') return [
    { id: `${owner.id}:start`, ownerId: owner.id, name: 'Start', kind: 'structural', localPosition: { x: -owner.length / 2, y: 0 } },
    { id: `${owner.id}:center`, ownerId: owner.id, name: 'Center', kind: 'structural', localPosition: { x: 0, y: 0 } },
    { id: `${owner.id}:end`, ownerId: owner.id, name: 'End', kind: 'structural', localPosition: { x: owner.length / 2, y: 0 } },
  ]
  if (owner.type === 'segment') return [
    { id: `${owner.id}:start`, ownerId: owner.id, name: 'Start', kind: 'track', localPosition: { x: -owner.length / 2, y: owner.thickness / 2 } },
    { id: `${owner.id}:center`, ownerId: owner.id, name: 'Center', kind: 'track', localPosition: { x: 0, y: owner.thickness / 2 } },
    { id: `${owner.id}:end`, ownerId: owner.id, name: 'End', kind: 'track', localPosition: { x: owner.length / 2, y: owner.thickness / 2 } },
  ]
  if (owner.type === 'spline') {
    const samples = sampleSpline(owner)
    const length = samples.at(-1)?.distance ?? 0
    const start = samples[0]?.position ?? { x: 0, y: 0 }
    const middle = splinePointAtDistance(owner, length / 2)?.position ?? start
    const end = samples.at(-1)?.position ?? start
    return [
      { id: `${owner.id}:start`, ownerId: owner.id, name: 'Start', kind: 'track', localPosition: start, worldPosition: true },
      { id: `${owner.id}:center`, ownerId: owner.id, name: 'Center', kind: 'track', localPosition: middle, worldPosition: true },
      { id: `${owner.id}:end`, ownerId: owner.id, name: 'End', kind: 'track', localPosition: end, worldPosition: true },
    ]
  }
  if (owner.shape === 'wheel') return [
    { id: `${owner.id}:center`, ownerId: owner.id, name: 'Axle', kind: 'structural', localPosition: { x: 0, y: 0 } },
    { id: `${owner.id}:north`, ownerId: owner.id, name: 'North rim', kind: 'connector', localPosition: { x: 0, y: owner.radius } },
    { id: `${owner.id}:east`, ownerId: owner.id, name: 'East rim', kind: 'connector', localPosition: { x: owner.radius, y: 0 } },
    { id: `${owner.id}:south`, ownerId: owner.id, name: 'South rim', kind: 'connector', localPosition: { x: 0, y: -owner.radius } },
    { id: `${owner.id}:west`, ownerId: owner.id, name: 'West rim', kind: 'connector', localPosition: { x: -owner.radius, y: 0 } },
  ]
  const halfWidth = (owner.shape === 'box' ? owner.width : owner.radius * 2) / 2
  const halfHeight = (owner.shape === 'box' ? owner.height : owner.radius * 2) / 2
  return [
    { id: `${owner.id}:center`, ownerId: owner.id, name: 'Center', kind: 'connector', localPosition: { x: 0, y: 0 } },
    { id: `${owner.id}:north`, ownerId: owner.id, name: 'North', kind: 'connector', localPosition: { x: 0, y: halfHeight } },
    { id: `${owner.id}:east`, ownerId: owner.id, name: 'East', kind: 'connector', localPosition: { x: halfWidth, y: 0 } },
    { id: `${owner.id}:south`, ownerId: owner.id, name: 'South', kind: 'connector', localPosition: { x: 0, y: -halfHeight } },
    { id: `${owner.id}:west`, ownerId: owner.id, name: 'West', kind: 'connector', localPosition: { x: -halfWidth, y: 0 } },
  ]
}

export function allPorts(scenario) {
  return [...(scenario.bodies ?? []), ...(scenario.tracks ?? [])].flatMap(defaultPorts).concat(scenario.ports ?? [])
}

export function endpointWorldPosition(scenario, endpoint) {
  if (endpoint?.type === 'world') return endpoint.position
  if (endpoint?.type !== 'port') return null
  const port = allPorts(scenario).find((candidate) => candidate.id === endpoint.portId && candidate.ownerId === endpoint.ownerId)
  const owner = [...scenario.bodies, ...scenario.tracks].find((candidate) => candidate.id === endpoint.ownerId)
  if (!port || !owner) return null
  if (port.worldPosition) return { ...port.localPosition }
  const angle = owner.angle ?? 0
  const origin = owner.position ?? owner.center
  return {
    x: origin.x + port.localPosition.x * Math.cos(angle) - port.localPosition.y * Math.sin(angle),
    y: origin.y + port.localPosition.x * Math.sin(angle) + port.localPosition.y * Math.cos(angle),
  }
}

export function fitAutoLengthBeams(scenario) {
  for (const beam of scenario.bodies.filter((body) => body.shape === 'beam' && body.autoLength)) {
    const connectedPoint = (portId) => {
      const joint = scenario.joints.find((candidate) => candidate.a.portId === portId || candidate.b.portId === portId)
      if (!joint) return null
      return endpointWorldPosition(scenario, joint.a.portId === portId ? joint.b : joint.a)
    }
    const start = connectedPoint(`${beam.id}:start`)
    const end = connectedPoint(`${beam.id}:end`)
    if (!start || !end) continue
    beam.position = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
    beam.length = Math.max(0.05, Math.hypot(end.x - start.x, end.y - start.y))
    beam.angle = Math.atan2(end.y - start.y, end.x - start.x)
    beam.inertia = beamInertia(beam.mass, beam.length)
  }
  return scenario
}

function fromLegacyIncline(constraint) {
  const dx = constraint.end.x - constraint.start.x
  const dy = constraint.end.y - constraint.start.y
  return createTrack({
    id: constraint.id,
    name: 'Ramp',
    center: { x: (constraint.start.x + constraint.end.x) / 2, y: (constraint.start.y + constraint.end.y) / 2 },
    angle: Math.atan2(dy, dx),
    length: Math.hypot(dx, dy),
    thickness: 0.16,
    friction: constraint.friction ?? (constraint.rolling ? 0.18 : 0.06),
    restitution: constraint.restitution ?? 0.1,
  })
}

function normalizeV4(input) {
  const scenario = copy(input)
  scenario.version = SCENARIO_VERSION
  scenario.id ??= `scenario-${crypto.randomUUID()}`
  scenario.name ??= 'Custom Lab'
  scenario.integrator ??= INTEGRATORS.SYMPLECTIC_EULER
  scenario.fixedStep ??= 1 / 120
  scenario.duration ??= 10
  scenario.bounds ??= { minX: -10, maxX: 10, minY: -2, maxY: 12 }
  scenario.gravity = {
    g: input.gravity?.g ?? 9.80665,
    direction: input.gravity?.direction ?? { x: 0, y: -1 },
    enabled: input.gravity?.enabled ?? false,
  }
  scenario.tracks ??= []
  scenario.ports ??= []
  scenario.joints ??= []
  scenario.connectors ??= []
  scenario.instruments ??= []
  scenario.railJoins ??= []
  scenario.forces ??= []
  scenario.constraints ??= [{ id: 'floor', type: 'ground', y: -3.6, restitution: 0.35, friction: 0.08 }]
  scenario.events ??= []
  scenario.bodies = (scenario.bodies ?? []).map((body) => createBody(body))
  scenario.tracks = scenario.tracks.map((track) => createTrack(track))
  scenario.connectors = scenario.connectors.map((connector) => createConnector(connector.type, connector))
  scenario.instruments = scenario.instruments.map((instrument) => createInstrument(instrument.type, instrument))
  return scenario
}

export function migrateScenario(input) {
  if (!input || typeof input !== 'object') return input
  if (!input.version || [SCENARIO_VERSION, 3, 2].includes(input.version)) return normalizeV4(input)
  if (input.version !== 1) return normalizeV4(input)

  const source = copy(input)
  const masterGravity = source.forces?.find((force) => force.type === 'gravity' && !force.bodyId)
  const bodyGravity = new Map((source.forces ?? []).filter((force) => force.type === 'gravity' && force.bodyId).map((force) => [force.bodyId, force]))
  const bodies = (source.bodies ?? []).map((body) => createBody({
    ...body,
    gravityEnabled: Boolean(masterGravity || bodyGravity.has(body.id)),
    gravityMultiplier: bodyGravity.has(body.id) && masterGravity ? bodyGravity.get(body.id).g / masterGravity.g : 1,
  }))
  const connectors = (source.forces ?? []).filter((force) => force.type === 'spring').map((force) => createConnector('spring', {
    id: force.id,
    a: { type: 'world', position: force.anchor },
    b: { type: 'port', ownerId: force.bodyId, portId: `${force.bodyId}:center` },
    restLength: force.restLength,
    length: force.restLength,
    stiffness: force.stiffness,
    damping: force.damping,
  }))
  return normalizeV4({
    ...source,
    version: 2,
    gravity: { g: masterGravity?.g ?? 9.80665, direction: { x: 0, y: -1 }, enabled: Boolean(masterGravity) },
    bodies,
    forces: (source.forces ?? []).filter((force) => !['gravity', 'spring'].includes(force.type)),
    constraints: (source.constraints ?? []).filter((constraint) => constraint.type === 'ground'),
    tracks: (source.constraints ?? []).filter((constraint) => constraint.type === 'incline').map(fromLegacyIncline),
    connectors,
    instruments: [],
    ports: [],
    joints: [],
  })
}

function validateEndpoint(endpoint, ownerIds, portIds, label, errors) {
  if (!endpoint || !['world', 'port'].includes(endpoint.type)) {
    errors.push(`${label} requires a world or port endpoint.`)
    return
  }
  if (endpoint.type === 'world' && !isFiniteVector(endpoint.position)) errors.push(`${label} requires a finite world position.`)
  if (endpoint.type === 'port' && (!ownerIds.has(endpoint.ownerId) || !portIds.has(endpoint.portId))) errors.push(`${label} references an unknown port.`)
}

export function validateScenario(input) {
  const scenario = migrateScenario(input)
  const errors = []
  if (!scenario || typeof scenario !== 'object') return { valid: false, errors: ['Scenario must be an object.'], scenario }
  if (scenario.version !== SCENARIO_VERSION) errors.push(`Scenario version must be ${SCENARIO_VERSION}.`)
  if (!scenario.id || !scenario.name) errors.push('Scenario requires an id and name.')
  if (!Object.values(INTEGRATORS).includes(scenario.integrator)) errors.push('Scenario has an unsupported integrator.')
  if (!finitePositive(scenario.fixedStep)) errors.push('Scenario fixedStep must be positive.')
  if (!Array.isArray(scenario.bodies) || scenario.bodies.length === 0) errors.push('Scenario requires at least one body.')
  if (!scenario.gravity || !finiteNonNegative(scenario.gravity.g) || !isFiniteVector(scenario.gravity.direction)) errors.push('World gravity requires a non-negative magnitude and finite direction.')

  const ids = new Set()
  const bodyIds = new Set()
  for (const body of scenario.bodies ?? []) {
    if (!body.id || ids.has(body.id)) errors.push(`Body id must be unique: ${body.id ?? 'missing'}.`)
    ids.add(body.id)
    bodyIds.add(body.id)
    if (!BODY_SHAPES.includes(body.shape)) errors.push(`Body ${body.id} has an unsupported shape.`)
    if (!finitePositive(body.mass)) errors.push(`Body ${body.id} mass must be positive.`)
    if (!isFiniteVector(body.position) || !isFiniteVector(body.velocity)) errors.push(`Body ${body.id} requires finite position and velocity.`)
    if (!finitePositive(body.radius)) errors.push(`Body ${body.id} radius must be positive.`)
    if (!Number.isFinite(body.gravityMultiplier)) errors.push(`Body ${body.id} gravity multiplier must be finite.`)
    if (body.shape === 'beam' && (!BEAM_MODES.includes(body.mode) || !finitePositive(body.length) || !finitePositive(body.thickness))) errors.push(`Beam ${body.id} has invalid mode or dimensions.`)
    if (body.shape === 'wheel' && (!WHEEL_INERTIA_MODELS.includes(body.inertiaModel) || !WHEEL_ROTATION_MODES.includes(body.rotationMode) || !finitePositive(body.depth))) errors.push(`Wheel ${body.id} has invalid inertia, rotation mode, or dimensions.`)
  }
  for (const track of scenario.tracks ?? []) {
    if (!track.id || ids.has(track.id)) errors.push(`Track id must be unique: ${track.id ?? 'missing'}.`)
    ids.add(track.id)
    if (!['segment', 'spline'].includes(track.type) || !finitePositive(track.thickness)) errors.push(`Track ${track.id} has invalid geometry.`)
    else if (track.type === 'segment' && (!isFiniteVector(track.center) || !finitePositive(track.length) || !Number.isFinite(track.angle))) errors.push(`Track ${track.id} has invalid segment geometry.`)
    else if (track.type === 'spline') errors.push(...validateSplineTrack(track).map((message) => `Track ${track.id}: ${message}`))
  }
  const physicalOwnerIds = new Set(ids)
  for (const instrument of scenario.instruments ?? []) {
    if (!instrument.id || ids.has(instrument.id)) errors.push(`Instrument id must be unique: ${instrument.id ?? 'missing'}.`)
    ids.add(instrument.id)
    errors.push(...validateInstrument(instrument, bodyIds))
    if (instrument.trackId && !scenario.tracks.some((track) => track.id === instrument.trackId)) errors.push(`Instrument ${instrument.id} references unknown track ${instrument.trackId}.`)
  }
  errors.push(...validatePhotogatePairs(scenario.instruments))
  const ports = allPorts(scenario)
  const portIds = new Set()
  for (const port of ports) {
    if (!port.id || portIds.has(port.id)) errors.push(`Port id must be unique: ${port.id ?? 'missing'}.`)
    portIds.add(port.id)
    if (!physicalOwnerIds.has(port.ownerId) || !isFiniteVector(port.localPosition)) errors.push(`Port ${port.id} has an invalid owner or position.`)
  }
  for (const force of scenario.forces ?? []) {
    if (!FORCE_TYPES.includes(force.type)) errors.push(`Unsupported force type: ${force.type}.`)
    if (force.bodyId && !bodyIds.has(force.bodyId)) errors.push(`Force references unknown body: ${force.bodyId}.`)
  }
  for (const constraint of scenario.constraints ?? []) {
    if (!CONSTRAINT_TYPES.includes(constraint.type)) errors.push(`Unsupported constraint type: ${constraint.type}.`)
    if (constraint.bodyId && !bodyIds.has(constraint.bodyId)) errors.push(`Constraint references unknown body: ${constraint.bodyId}.`)
  }
  const routedWheelIds = new Set()
  for (const connector of scenario.connectors ?? []) {
    if (!CONNECTOR_TYPES.includes(connector.type)) errors.push(`Connector ${connector.id} has an unsupported type.`)
    if (!finitePositive(connector.type === 'rope' ? connector.length : connector.restLength)) errors.push(`Connector ${connector.id} requires a positive length.`)
    validateEndpoint(connector.a, physicalOwnerIds, portIds, `Connector ${connector.id}`, errors)
    validateEndpoint(connector.b, physicalOwnerIds, portIds, `Connector ${connector.id}`, errors)
    if (connector.route !== undefined) {
      const route = connector.route
      const wheel = scenario.bodies.find((body) => body.id === route?.wheelId && body.shape === 'wheel')
      if (connector.type !== 'rope' || route?.type !== 'wheel' || route.wrap !== 'top' || !['left', 'right'].includes(route.aSide) || !wheel) errors.push(`Connector ${connector.id} has an invalid wheel route.`)
      if (route?.wheelId && routedWheelIds.has(route.wheelId)) errors.push(`Wheel ${route.wheelId} is already used by another routed rope.`)
      if (route?.wheelId) routedWheelIds.add(route.wheelId)
    }
  }
  const jointPairs = new Set()
  const jointPortUsage = new Set()
  for (const joint of scenario.joints ?? []) {
    if (!JOINT_TYPES.includes(joint.type)) errors.push(`Joint ${joint.id} has an unsupported type.`)
    validateEndpoint(joint.a, physicalOwnerIds, portIds, `Joint ${joint.id}`, errors)
    validateEndpoint(joint.b, physicalOwnerIds, portIds, `Joint ${joint.id}`, errors)
    const key = [joint.a?.portId, joint.b?.portId].sort().join('|')
    if (jointPairs.has(key)) errors.push(`Joint ${joint.id} duplicates an existing connection.`)
    jointPairs.add(key)
    for (const endpoint of [joint.a, joint.b]) if (endpoint?.type === 'port') {
      if (jointPortUsage.has(endpoint.portId)) errors.push(`Port ${endpoint.portId} is over-constrained by multiple joints.`)
      jointPortUsage.add(endpoint.portId)
    }
  }
  errors.push(...validateRailJoins(scenario))
  return { valid: errors.length === 0, errors, scenario }
}

export function cloneScenario(scenario) { return copy(scenario) }

export function serializeScenario(input) {
  const result = validateScenario(input)
  if (!result.valid) throw new TypeError(result.errors.join(' '))
  return JSON.stringify(result.scenario, null, 2)
}

export function deserializeScenario(serialized) {
  let scenario
  try { scenario = JSON.parse(serialized) } catch { throw new SyntaxError('Scenario is not valid JSON.') }
  const result = validateScenario(scenario)
  if (!result.valid) throw new TypeError(result.errors.join(' '))
  return result.scenario
}
