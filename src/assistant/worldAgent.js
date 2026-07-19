const PRESET_ALIASES = [
  ['projectile', 'projectile-motion'],
  ['collision', 'momentum-collision'],
  ['momentum', 'momentum-collision'],
  ['incline', 'rolling-incline'],
  ['rolling', 'rolling-incline'],
  ['inclined spring', 'inclined-spring-oscillator'],
  ['rope pendulum', 'rope-pendulum'],
  ['physical pendulum', 'physical-pendulum'],
  ['compound pendulum', 'compound-pendulum'],
  ['oscillator', 'spring-oscillator'],
  ['orbit', 'orbital-motion'],
]

export function planWorldLocally(message) {
  const normalized = message.toLowerCase()
  const actions = []

  for (const [phrase, target] of PRESET_ALIASES) {
    if ((normalized.includes('load') || normalized.includes('show') || normalized.includes('start')) && normalized.includes(phrase)) {
      actions.push({ type: 'load_preset', target })
      return { message: `Loaded the ${phrase} experiment. What quantity do you expect to remain constant?`, actions, source: 'local' }
    }
  }

  if (/sphere|ball/.test(normalized)) actions.push({ type: 'add_body', target: 'sphere', name: 'Sphere' })
  if (/box|block|cube/.test(normalized)) actions.push({ type: 'add_body', target: 'box', name: 'Block' })
  if (/ramp|incline/.test(normalized)) actions.push({ type: 'add_constraint', target: 'ramp' })
  if (/floor|ground/.test(normalized)) actions.push({ type: /(remove|delete|turn off|disable)/.test(normalized) ? 'remove_constraint' : 'add_constraint', target: 'floor' })
  if (/spring/.test(normalized)) actions.push({ type: 'add_force', target: 'spring' })
  if (/rope/.test(normalized)) actions.push({ type: 'add_connector', target: 'rope' })
  if (/beam/.test(normalized)) actions.push({ type: 'add_beam', target: 'beam' })
  if (/attachment point|\bport\b/.test(normalized)) actions.push({ type: 'add_port', target: 'attachment' })
  if (/gravity/.test(normalized)) actions.push({ type: /(remove|delete|turn off|disable|zero.?g)/.test(normalized) ? 'remove_force' : 'add_force', target: 'gravity', value: 9.80665 })
  if (/attractor|central force/.test(normalized)) actions.push({ type: 'add_force', target: 'central' })

  if (actions.length === 0) {
    return {
      message: 'I can build with bodies, ramps, beams, ports, springs, ropes, gravity, joints, attractors, or a prepared SHM experiment. What should I place first?',
      actions: [],
      source: 'local',
    }
  }

  return {
    message: `Applied ${actions.length} world ${actions.length === 1 ? 'change' : 'changes'}. Which measurement should we watch as the system evolves?`,
    actions,
    source: 'local',
  }
}

export async function askWorldAgent({ message, scenario, telemetry, signal }) {
  try {
    const response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, scenario, telemetry }),
      signal,
    })
    if (!response.ok) throw new Error('Agent endpoint unavailable.')
    return { ...(await response.json()), source: 'openai' }
  } catch (error) {
    if (error.name === 'AbortError') throw error
    return planWorldLocally(message)
  }
}
