import { allPorts } from '../src/domain/scenario.js'
import { createSplineTrack } from '../src/domain/scenario.js'
import { validateSplineTrack } from '../src/domain/spline.js'

export const ACTION_TYPES = Object.freeze([
  'add_body', 'add_track', 'add_spline_track', 'add_beam', 'add_wheel', 'add_connector', 'add_port', 'add_instrument',
  'add_joint', 'connect_endpoint', 'add_constraint', 'add_force', 'remove_force',
  'remove_constraint', 'disable_gravity', 'load_preset', 'none',
])

export const ACTION_TARGETS = Object.freeze([
  'sphere', 'box', 'wheel', 'ramp', 'spline', 'floor', 'spring', 'rope', 'beam', 'attachment',
  'ruler', 'photogate', 'rigid', 'pin', 'gravity', 'central',
  'projectile-motion', 'momentum-collision', 'rolling-incline', 'spring-oscillator',
  'orbital-motion', 'inclined-spring-oscillator', 'rope-pendulum',
  'physical-pendulum', 'compound-pendulum', 'ideal-atwood', 'rotating-atwood',
  'loop-the-loop', 'spline-roller-coaster',
])

const targetsByAction = new Map([
  ['add_body', new Set(['sphere', 'box'])],
  ['add_track', new Set(['ramp'])],
  ['add_spline_track', new Set(['spline'])],
  ['add_beam', new Set(['beam'])],
  ['add_wheel', new Set(['wheel'])],
  ['add_connector', new Set(['spring', 'rope'])],
  ['add_port', new Set(['attachment'])],
  ['add_instrument', new Set(['ruler', 'photogate'])],
  ['add_joint', new Set(['rigid', 'pin'])],
  ['connect_endpoint', new Set([null])],
  ['add_constraint', new Set(['ramp', 'floor'])],
  ['add_force', new Set(['spring', 'gravity', 'central'])],
  ['remove_force', new Set(['gravity'])],
  ['remove_constraint', new Set(['ramp', 'floor'])],
  ['disable_gravity', new Set(['gravity'])],
  ['load_preset', new Set(ACTION_TARGETS.filter((target) => target.endsWith('-motion') || target.endsWith('-collision') || target.endsWith('-incline') || target.endsWith('-oscillator') || target.endsWith('-pendulum') || target.endsWith('-atwood') || ['loop-the-loop', 'spline-roller-coaster'].includes(target)))],
  ['none', new Set([null])],
])

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export function validateAgentInput(input) {
  if (!isRecord(input)) throw new TypeError('Agent request must be a JSON object.')
  if (typeof input.message !== 'string' || !input.message.trim() || input.message.length > 2_000) throw new TypeError('Student request must contain 1 to 2,000 characters.')
  if (!isRecord(input.scenario) || !Array.isArray(input.scenario.bodies) || !Array.isArray(input.scenario.tracks)) throw new TypeError('A valid Scenario v4 summary is required.')
  if (!isRecord(input.telemetry)) throw new TypeError('Current telemetry is required.')
  const history = input.history ?? []
  if (!Array.isArray(history) || history.length > 6) throw new TypeError('Conversation context may contain at most six messages.')
  for (const message of history) {
    if (!isRecord(message) || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || message.content.length > 1_000) throw new TypeError('Conversation messages require a supported role and at most 1,000 characters.')
  }
  return { message: input.message.trim(), scenario: input.scenario, telemetry: input.telemetry, history }
}

function assertOptionalString(value, label) {
  if (value !== null && (typeof value !== 'string' || value.length > 160)) throw new TypeError(`${label} must be null or a short string.`)
}

function assertOptionalNumber(value, label) {
  if (value !== null && !Number.isFinite(value)) throw new TypeError(`${label} must be null or a finite number.`)
}

export function validateWorldActions(actions, scenario) {
  if (!Array.isArray(actions) || actions.length > 8) throw new TypeError('Vector returned too many world actions.')
  const owners = new Set([...(scenario.bodies ?? []), ...(scenario.tracks ?? [])].map((owner) => owner.id))
  const ports = new Map(allPorts(scenario).map((port) => [port.id, port]))
  const connectors = new Set((scenario.connectors ?? []).map((connector) => connector.id))

  for (const action of actions) {
    if (!isRecord(action) || !ACTION_TYPES.includes(action.type)) throw new TypeError('Vector returned an unsupported action type.')
    const target = action.target ?? null
    if (!targetsByAction.get(action.type)?.has(target)) throw new TypeError(`Vector returned an invalid target for ${action.type}.`)
    for (const field of ['name', 'entityId', 'portId', 'otherEntityId', 'otherPortId', 'endpoint']) assertOptionalString(action[field] ?? null, field)
    for (const field of ['x', 'y', 'value']) assertOptionalNumber(action[field] ?? null, field)

    if (action.type === 'add_spline_track') {
      if (!isRecord(action.track)) throw new TypeError('Spline actions require a track blueprint.')
      const track = createSplineTrack({ ...action.track, type: 'spline' })
      const errors = validateSplineTrack(track)
      if (errors.length) throw new TypeError(errors.join(' '))
      if (owners.has(track.id)) throw new TypeError('Spline actions require a new track id.')
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
  }
  return actions
}
