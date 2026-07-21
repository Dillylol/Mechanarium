import { describeWorld, formatWorldDescription } from './describeWorld.js'

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
  const worldDescription = context.telemetry?.world_description
  const asksAboutWorld = /\b(describe|description|explain|inspect|summari[sz]e)\b.*\b(world|scene|apparatus|setup|simulation)\b|\b(what(?:'s| is) (?:in|happening in) (?:the|this) world)\b/.test(normalized)
  const asksAboutEntity = /\b(describe|description|explain|inspect)\b.*\b(selected|body|entity|object)\b|\b(selected (?:body|entity|object))\b/.test(normalized)

  if ((asksAboutWorld || asksAboutEntity) && worldDescription) {
    return {
      message: formatWorldDescription(worldDescription, {
        detailed: /\b(detailed|detail|comprehensive|complete|full|everything|every (?:entity|object|part))\b/.test(normalized),
        selectedOnly: asksAboutEntity && !asksAboutWorld,
      }),
      actions: [],
      source: 'local',
    }
  }

  if (/loop|roller\s*coaster|coaster/.test(normalized) && /(create|build|make|show|load)/.test(normalized)) {
    const isLoop = /loop/.test(normalized)
    const target = isLoop ? 'loop-the-loop' : 'spline-roller-coaster'
    const name = isLoop ? 'Loop-the-Loop' : 'Spline Roller Coaster'
    return {
      message: `I prepared the ${name} experiment. Review the proposed world before applying it.`,
      actions: [],
      proposal: { summary: `Replace the current world with the editable ${name} experiment.`, actions: [{ type: 'load_preset', target }] },
      source: 'local',
    }
  }

  if (/(model|simulate)\s*(this|the)?\s*(frq|problem|setup|apparatus)/.test(normalized) || (/frq/.test(normalized) && /(model|simulate|build|create|set up)/.test(normalized))) {
    const isSpring = /spring|ramp|compress|friction/.test(normalized)
    const target = isSpring ? 'spring-ramp-launch' : 'projectile-motion'
    const name = isSpring ? 'Spring Launch Ramp' : 'Apex Explosion (4M -> M + 3M)'
    const actions = [{ type: 'load_preset', target }]
    if (!isSpring) {
      actions.push({
        type: 'add_event',
        target: 'event',
        event: {
          trigger: 'apex',
          type: 'explosion',
          ratio: 0.25,
          impulseX: 5.0,
        },
      })
    }
    const message = isSpring
      ? `I set up the Spring Launch Ramp experiment (mass m = 2.0 kg, unattached push-only spring k, frictionless horizontal track sloping into a ramp). Compress the spring by distance s and release to measure maximum ascent height h!`
      : `I modeled this scenario in 3D using representative numerical values (4M = 4 kg, v_0 = 20 m/s, \\theta = 60^\\circ) with an apex breakup event (4M -> M + 3M). Review the proposal to load it into Mechanarium!`
    return {
      message,
      actions: [],
      proposal: {
        summary: `Load the interactive ${name} apparatus.`,
        actions,
      },
      source: 'local',
    }
  }

  const asksToBuild = /\b(build|create|make|construct|set up|setup|assemble|place|add)\b/.test(normalized) && /\b(world|lab|apparatus|scene|track|disk|sphere|block|ramp|photogate|ruler|beam|wheel)\b/.test(normalized)
  if (asksToBuild && /collision|momentum|disk/.test(normalized)) {
    const actions = [
      { type: 'load_preset', target: 'momentum-collision' },
      { type: 'add_instrument', target: 'ruler' },
      { type: 'add_instrument', target: 'photogateAssembly' },
    ]
    return {
      message: 'I prepared a 1D collision lab with two disks, a ruler, and a photogate assembly. Review the proposal, then we can list knowns for Part B.',
      actions: [],
      proposal: { summary: 'Load the momentum-collision lab and add measurement instruments.', actions },
      source: 'local',
    }
  }

  const asksForSolution = /(worked solution|show.*solution|give.*answer|i'?m stuck|solve it)/.test(normalized)
  const looksLikeProblem = /(physics problem|calculate|find|determine|how (fast|far|long|high))/.test(normalized) && /\?|find|calculate|determine/.test(normalized)
  // Build/setup requests win over tutoring. Sticky prior tutor state must not block world edits.
  if (!asksToBuild && (looksLikeProblem || asksForSolution)) {
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

  if (normalized.includes('reset') || normalized.includes('clear')) {
    actions.push({ type: 'load_preset', target: 'momentum-collision' })
    return { message: 'Resetting the simulation to the default collision lab state. What would you like to build next?', actions, source: 'local' }
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
  if (/(photogate|photo gate).*(assembly|pair|two)|(?:assembly|pair|two).*(photogate|photo gate)/.test(normalized)) actions.push({ type: 'add_instrument', target: 'photogateAssembly' })
  else if (/photogate|photo gate/.test(normalized)) actions.push({ type: 'add_instrument', target: 'photogate' })
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

export async function askWorldAgent({ message, scenario, world, selectedEntity, notebook, telemetry, history = [], image, signal }) {
  const enrichedTelemetry = {
    ...telemetry,
    world_description: telemetry?.world_description ?? describeWorld({
      scenario,
      world,
      selectedEntity: selectedEntity ?? telemetry?.selected_body,
      notebook,
    }),
  }
  try {
    const response = await fetch(agentEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, scenario, telemetry: enrichedTelemetry, history: history.slice(-6).map((item) => ({ role: item.role, content: item.content })), image }),
      signal,
    })
    if (!response.ok) {
      let detail = 'Agent endpoint unavailable.'
      try {
        const payload = await response.json()
        if (typeof payload.error === 'string' && payload.error.trim()) detail = payload.error.trim()
      } catch { /* keep default */ }
      throw new Error(detail)
    }
    const result = await response.json()
    return { ...previewLargeChange(result), source: 'openai' }
  } catch (error) {
    if (error.name === 'AbortError') throw error
    const fallback = previewLargeChange(planWorldLocally(message, { scenario, telemetry: enrichedTelemetry }))
    return {
      ...fallback,
      message: `${fallback.message} (OpenAI unavailable: ${error.message})`,
      source: 'local',
    }
  }
}
