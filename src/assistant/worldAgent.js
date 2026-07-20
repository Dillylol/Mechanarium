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
  ['ideal atwood', 'ideal-atwood'],
  ['static atwood', 'ideal-atwood'],
  ['rotating atwood', 'rotating-atwood'],
  ['atwood machine', 'rotating-atwood'],
  ['oscillator', 'spring-oscillator'],
  ['orbit', 'orbital-motion'],
]

export function planWorldLocally(message, context = {}) {
  const normalized = message.toLowerCase()
  const actions = []
  const latestTrial = context.telemetry?.lab?.trials?.at(-1)
  const guideStep = context.telemetry?.lab?.guide_step

  if (latestTrial && /(data|measure|evidence|result|trial|acceleration|speed|time)/.test(normalized)) {
    const result = latestTrial.gate_results?.at(-1)
    const observation = result
      ? `The latest gates measured Δt=${Number(result.interval).toFixed(4)} s, average speed=${Number(result.averageSpeed).toFixed(3)} m/s, and acceleration=${Number(result.acceleration).toFixed(3)} m/s².`
      : `The latest trial contains ${latestTrial.sample_count} samples and ${latestTrial.gate_event_count} gate events, but no paired-gate result yet.`
    const guide = guideStep ? ` Your current investigation step is: ${guideStep}.` : ''
    return { message: `${observation}${guide} Which measured quantity supports or challenges your prediction?`, actions: [], source: 'local' }
  }

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
  if (/wheel|pulley/.test(normalized)) actions.push({ type: 'add_wheel', target: 'wheel' })
  if (/attachment point|\bport\b/.test(normalized)) actions.push({ type: 'add_port', target: 'attachment' })
  if (/gravity/.test(normalized)) actions.push({ type: /(remove|delete|turn off|disable|zero.?g)/.test(normalized) ? 'remove_force' : 'add_force', target: 'gravity', value: 9.80665 })
  if (/attractor|central force/.test(normalized)) actions.push({ type: 'add_force', target: 'central' })
  if (/photogate|photo gate/.test(normalized)) actions.push({ type: 'add_instrument', target: 'photogate' })
  if (/ruler|meter stick|metre stick/.test(normalized)) actions.push({ type: 'add_instrument', target: 'ruler' })

  if (actions.length === 0) {
    return {
      message: `${guideStep ? `Your current investigation step is: ${guideStep}. ` : ''}I can build apparatus, place rulers and photogates, or examine recorded evidence. What do you predict the next measurement will show?`,
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

const agentEndpoint = import.meta.env.VITE_AGENT_API_URL?.trim() || '/api/agent'

export async function askWorldAgent({ message, scenario, telemetry, history = [], signal }) {
  try {
    const response = await fetch(agentEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, scenario, telemetry, history: history.slice(-6) }),
      signal,
    })
    if (!response.ok) throw new Error('Agent endpoint unavailable.')
    return { ...(await response.json()), source: 'openai' }
  } catch (error) {
    if (error.name === 'AbortError') throw error
    return planWorldLocally(message, { scenario, telemetry })
  }
}
