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
  ['loop', 'loop-the-loop'],
  ['roller coaster', 'spline-roller-coaster'],
  ['rollercoaster', 'spline-roller-coaster'],
  ['oscillator', 'spring-oscillator'],
  ['orbit', 'orbital-motion'],
]

export function planWorldLocally(message, context = {}) {
  const normalized = message.toLowerCase()
  const actions = []
  const latestTrial = context.telemetry?.lab?.trials?.at(-1)
  const guideStep = context.telemetry?.lab?.guide_step

  if (/roller\s*coaster|coaster/.test(normalized) && /(create|build|make|show|load)/.test(normalized)) {
    return {
      message: 'I prepared an editable spline coaster with hills and valleys. Review the proposed world before applying it.',
      actions: [],
      proposal: { summary: 'Replace the current world with the editable Spline Roller Coaster experiment.', actions: [{ type: 'load_preset', target: 'spline-roller-coaster' }] },
      source: 'local',
    }
  }

  const asksForSolution = /(worked solution|show.*solution|give.*answer|i'?m stuck|solve it)/.test(normalized)
  const looksLikeProblem = /(physics problem|given|calculate|find|determine|how (fast|far|long|high)|mass|velocity|acceleration|force|energy|momentum)/.test(normalized) && /\?|find|calculate|determine|given/.test(normalized)
  if (looksLikeProblem || asksForSolution || context.telemetry?.tutor) {
    const principle = /momentum|collision/.test(normalized) ? 'conservation of momentum' : /spring|oscillat/.test(normalized) ? 'Hooke’s law and energy conservation' : /loop|circular|radius/.test(normalized) ? 'energy conservation and radial Newton’s second law' : /projectile|launch|range/.test(normalized) ? 'independent horizontal and vertical kinematics' : /atwood|pulley|tension/.test(normalized) ? 'Newton’s second law for each mass and torque for the pulley' : 'a free-body diagram followed by Newton’s second law or energy conservation'
    const messageText = asksForSolution
      ? `Worked approach: define the system, draw the interactions, write ${principle}, substitute only the stated values, then check units and limiting behavior. I will not invent missing quantities. Which numerical values should I use?`
      : `Let’s model this with ${principle}. First, list the known quantities with units and name the single quantity you need to find.`
    return {
      message: messageText,
      actions: [],
      tutorial: { problemSummary: message.slice(0, 240), knowns: [], unknown: '', principle, stage: asksForSolution ? 'worked-solution' : 'identify-knowns', nextPrompt: asksForSolution ? 'Supply any missing numerical values.' : 'List each known with its unit.' },
      source: 'local',
    }
  }

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

function previewLargeChange(result) {
  if (result.proposal) return result
  const requiresPreview = result.actions?.some((action) => ['load_preset', 'add_spline_track'].includes(action.type)) || result.actions?.length > 2
  return requiresPreview ? { ...result, actions: [], proposal: { summary: result.proposalSummary ?? `Review ${result.actions.length} proposed world changes.`, actions: result.actions } } : result
}

export async function askWorldAgent({ message, scenario, telemetry, history = [], signal }) {
  try {
    const response = await fetch(agentEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, scenario, telemetry, history: history.slice(-6) }),
      signal,
    })
    if (!response.ok) throw new Error('Agent endpoint unavailable.')
    const result = await response.json()
    return { ...previewLargeChange(result), source: 'openai' }
  } catch (error) {
    if (error.name === 'AbortError') throw error
    return previewLargeChange(planWorldLocally(message, { scenario, telemetry }))
  }
}
