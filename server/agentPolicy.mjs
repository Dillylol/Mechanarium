import { allPorts } from '../src/domain/scenario.js'
import { createSplineTrack } from '../src/domain/scenario.js'
import { validateSplineTrack } from '../src/domain/spline.js'

export const ACTION_TYPES = Object.freeze([
  'add_body', 'update_body', 'add_track', 'add_spline_track', 'add_beam', 'add_wheel', 'add_connector', 'update_connector', 'add_port', 'add_instrument',
  'add_joint', 'connect_endpoint', 'add_constraint', 'add_force', 'remove_force',
  'remove_constraint', 'disable_gravity', 'load_preset', 'add_event', 'none',
])

export const ACTION_TARGETS = Object.freeze([
  'sphere', 'box', 'wheel', 'ramp', 'spline', 'floor', 'spring', 'rope', 'beam', 'attachment',
  'ruler', 'photogate', 'photogateAssembly', 'rigid', 'pin', 'gravity', 'central', 'event',
  'projectile-motion', 'momentum-collision', 'rolling-incline', 'spring-oscillator', 'spring-ramp-launch',
  'orbital-motion', 'inclined-spring-oscillator', 'rope-pendulum',
  'physical-pendulum', 'compound-pendulum', 'ideal-atwood', 'rotating-atwood',
  'loop-the-loop', 'spline-roller-coaster',
])

const targetsByAction = new Map([
  ['add_body', new Set(['sphere', 'box'])],
  ['update_body', new Set(['sphere', 'box', 'wheel', 'disk', 'cart-a', 'cart-b', null])],
  ['add_track', new Set(['ramp'])],
  ['add_spline_track', new Set(['spline'])],
  ['add_beam', new Set(['beam'])],
  ['add_wheel', new Set(['wheel'])],
  ['add_connector', new Set(['spring', 'rope'])],
  ['update_connector', new Set(['spring', 'rope', null])],
  ['add_port', new Set(['attachment'])],
  ['add_instrument', new Set(['ruler', 'photogate', 'photogateAssembly'])],
  ['add_joint', new Set(['rigid', 'pin'])],
  ['connect_endpoint', new Set([null])],
  ['add_constraint', new Set(['ramp', 'floor'])],
  ['add_force', new Set(['spring', 'gravity', 'central'])],
  ['remove_force', new Set(['gravity'])],
  ['remove_constraint', new Set(['ramp', 'floor'])],
  ['disable_gravity', new Set(['gravity'])],
  ['load_preset', new Set(ACTION_TARGETS.filter((target) => target.endsWith('-motion') || target.endsWith('-collision') || target.endsWith('-incline') || target.endsWith('-oscillator') || target.endsWith('-pendulum') || target.endsWith('-atwood') || target.endsWith('-launch') || ['loop-the-loop', 'spline-roller-coaster'].includes(target)))],
  ['add_event', new Set(['event', null])],
  ['none', new Set([null])],
])

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export function normalizeAgentHistory(history) {
  if (!Array.isArray(history)) return []
  return history.slice(-6).flatMap((message) => {
    if (!isRecord(message)) return []
    const role = message.role === 'assistant' ? 'assistant' : message.role === 'user' ? 'user' : null
    if (!role) return []
    const content = typeof message.content === 'string' ? message.content.trim().slice(0, 1_000) : ''
    return content ? [{ role, content }] : []
  })
}

export function validateAgentInput(input) {
  if (!isRecord(input)) throw new TypeError('Agent request must be a JSON object.')
  if (typeof input.message !== 'string' || (!input.message.trim() && !input.image) || input.message.length > 2_000) throw new TypeError('Student request must contain text or an attached diagram/image.')
  if (!isRecord(input.scenario) || !Array.isArray(input.scenario.bodies) || !Array.isArray(input.scenario.tracks)) throw new TypeError('A valid Scenario v4 summary is required.')
  if (!isRecord(input.telemetry)) throw new TypeError('Current telemetry is required.')
  const history = normalizeAgentHistory(input.history)
  if (Array.isArray(input.history) && input.history.length > 6) throw new TypeError('Conversation context may contain at most six messages.')
  const image = typeof input.image === 'string' && (input.image.startsWith('data:image/') || input.image.startsWith('http')) && input.image.length < 8_000_000 ? input.image : null
  return { message: (input.message || '').trim(), scenario: input.scenario, telemetry: input.telemetry, history, image }
}

function assertOptionalString(value, label) {
  if (value !== null && (typeof value !== 'string' || value.length > 160)) throw new TypeError(`${label} must be null or a short string.`)
}

function assertOptionalNumber(value, label) {
  if (value !== null && !Number.isFinite(value)) throw new TypeError(`${label} must be null or a finite number.`)
}

export function normalizeActionTarget(type, target) {
  if (!target || typeof target !== 'string') return target ?? null
  const raw = target.trim().toLowerCase()
  if (type === 'add_body') {
    if (['disk', 'circle disk', 'circle', 'ball', 'sphere', 'cylinder', 'particle'].some((alias) => raw.includes(alias))) return 'sphere'
    if (['cube', 'block', 'box', 'square'].some((alias) => raw.includes(alias))) return 'box'
  }
  if (type === 'add_track') {
    if (['track', 'horizontal_track', 'horizontal track', 'flat_track', 'ramp', 'incline', 'slope'].some((alias) => raw.includes(alias))) return 'ramp'
  }
  if (type === 'add_constraint' || type === 'remove_constraint') {
    if (['floor', 'ground', 'horizontal', 'flat'].some((alias) => raw.includes(alias))) return 'floor'
    if (['ramp', 'incline'].some((alias) => raw.includes(alias))) return 'ramp'
  }
  if (type === 'add_instrument') {
    if (['photogateassembly', 'photogate assembly', 'photogate_assembly', 'photogate pair', 'gates', 'collision photogate'].some((alias) => raw.includes(alias))) return 'photogateAssembly'
    if (['photogate', 'photo gate', 'gate'].some((alias) => raw.includes(alias))) return 'photogate'
    if (['ruler', 'meter stick', 'metre stick', 'scale', 'track ruler'].some((alias) => raw.includes(alias))) return 'ruler'
  }
  if (type === 'load_preset') {
    if (['collision', 'momentum', '1d-collision', 'momentum-collision'].some((alias) => raw.includes(alias))) return 'momentum-collision'
    if (['roller-coaster', 'rollercoaster', 'coaster', 'spline-roller-coaster'].some((alias) => raw.includes(alias))) return 'spline-roller-coaster'
  }
  if (type === 'update_body') {
    // update_body uses entityId/name for body lookup; only a small fixed set are valid shape aliases
    const validBodyTargets = new Set(['sphere', 'box', 'wheel', 'disk', 'cart-a', 'cart-b'])
    if (!validBodyTargets.has(raw)) return null
  }
  if (type === 'update_connector') {
    // update_connector uses entityId for lookup; unrecognized target strings should be null
    if (!['spring', 'rope'].includes(raw)) return null
  }
  return target
}

export function validateWorldActions(actions, scenario) {
  if (!Array.isArray(actions) || actions.length > 8) throw new TypeError('Vector returned too many world actions.')
  // Build mutable sets so entities added earlier in the batch are visible to later actions
  const owners = new Set([...(scenario.bodies ?? []), ...(scenario.tracks ?? [])].map((owner) => owner.id))
  const ports = new Map(allPorts(scenario).map((port) => [port.id, port]))
  const connectors = new Set((scenario.connectors ?? []).map((connector) => connector.id))
  const validActions = []

  for (const action of actions) {
    if (!isRecord(action) || !ACTION_TYPES.includes(action.type)) throw new TypeError('Vector returned an unsupported action type.')
    action.target = normalizeActionTarget(action.type, action.target)
    const target = action.target ?? null
    if (!targetsByAction.get(action.type)?.has(target)) {
      if (action.type === 'add_constraint' || action.type === 'add_force') continue
      throw new TypeError(`Vector returned an invalid target for ${action.type}.`)
    }
    for (const field of ['name', 'entityId', 'portId', 'otherEntityId', 'otherPortId', 'endpoint']) assertOptionalString(action[field] ?? null, field)
    for (const field of ['x', 'y', 'value', 'mass', 'vx', 'vy', 'restitution', 'friction']) assertOptionalNumber(action[field] ?? null, field)

    if (action.type === 'add_spline_track') {
      if (!isRecord(action.track)) throw new TypeError('Spline actions require a track blueprint.')
      const track = createSplineTrack({ ...action.track, type: 'spline' })
      const errors = validateSplineTrack(track)
      if (errors.length) throw new TypeError(errors.join(' '))
      if (owners.has(track.id)) throw new TypeError('Spline actions require a new track id.')
      // Register the new track so subsequent actions in this batch can reference it
      owners.add(track.id)
      for (const port of allPorts({ bodies: [], tracks: [track] })) ports.set(port.id, port)
    }

    // Register newly added bodies/connectors so later actions in the batch can reference them
    if (action.type === 'add_body' && action.name) {
      // The actual id is generated client-side; we can't predict it, but we can register
      // an inferred id based on the convention used by useSimulation (next-id is not deterministic).
      // What we CAN do: if the action carries an explicit entityId, pre-register that id.
      if (typeof action.entityId === 'string' && action.entityId) {
        owners.add(action.entityId)
        for (const port of allPorts({ bodies: [{ id: action.entityId, shape: target ?? 'circle', radius: 0.35, length: 3, width: 0.7, height: 0.7, thickness: 0.18 }], tracks: [] })) ports.set(port.id, port)
      }
    }
    if (action.type === 'add_connector' && typeof action.entityId === 'string' && action.entityId) {
      connectors.add(action.entityId)
    }

    if (action.type === 'add_joint') {
      const first = ports.get(action.portId)
      const second = ports.get(action.otherPortId)
      if (!owners.has(action.entityId) || !owners.has(action.otherEntityId) || first?.ownerId !== action.entityId || second?.ownerId !== action.otherEntityId || action.entityId === action.otherEntityId) throw new TypeError('Joint actions require exact ports on two different entities.')
    }
    if (action.type === 'connect_endpoint') {
      const port = ports.get(action.otherPortId)
      if (!connectors.has(action.entityId) || !['a', 'b'].includes(action.endpoint) || !owners.has(action.otherEntityId) || port?.ownerId !== action.otherEntityId) throw new TypeError('Connector actions require an exact connector endpoint and destination port.')
    }
    validActions.push(action)
  }
  return validActions
}
