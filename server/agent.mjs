import http from 'node:http'
import OpenAI from 'openai'
import { ACTION_TARGETS, ACTION_TYPES, validateAgentInput, validateWorldActions } from './agentPolicy.mjs'

const port = Number(process.env.PORT ?? process.env.AGENT_PORT ?? 8787)
const model = process.env.OPENAI_MODEL ?? 'gpt-5.6-luna'
const reasoningEffort = process.env.OPENAI_REASONING_EFFORT ?? 'medium'
const rateLimit = Number(process.env.AGENT_RATE_LIMIT ?? 20)
const timeoutMs = Number(process.env.AGENT_TIMEOUT_MS ?? 60_000)
const allowedOrigins = new Set((process.env.AGENT_ALLOWED_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173,https://dillylol.github.io').split(',').map((origin) => origin.trim()).filter(Boolean))
const requestsByClient = new Map()

const instructions = `You are Vector, the Mechanarium world-building agent and Socratic physics guide.
Turn the student's request into safe, small edits to the current mechanics scenario.
Supported action targets:
- load_preset: target must be 'momentum-collision' | 'projectile-motion' | 'rolling-incline' | 'spring-oscillator' | 'spring-ramp-launch' | 'orbital-motion' | 'inclined-spring-oscillator' | 'rope-pendulum' | 'physical-pendulum' | 'compound-pendulum' | 'ideal-atwood' | 'rotating-atwood' | 'loop-the-loop'.
- add_body: target must be 'sphere' (for disks, circles, balls) or 'box' (for blocks, cubes).
- update_body: ALWAYS set target to null. Use name to identify the body by name (e.g. name: 'Cart A') or entityId to identify it by id. Never put a body name or body id in the target field — the validator only accepts null, 'sphere', 'box', 'wheel', 'disk', 'cart-a', or 'cart-b' for target.
- add_track: target must be 'ramp'.
- add_spline_track: target must be 'spline'.
- add_instrument: target must be 'ruler', 'photogate', or 'photogateAssembly'.
- add_constraint / remove_constraint: target must be 'floor' or 'ramp'.
- add_connector / update_connector: target 'spring'. For push-only / unattached springs (e.g. FRQs where a block is placed next to but not attached to a spring), set unattached: true (or connectorMode: 'push'). The spring pushes the block while compressed but drops to 0 force at rest length, detaching the block. For attached SHM springs, set unattached: false (or connectorMode: 'pull-push').
Do not invent custom target names like 'horizontal_track', 'disk', 'initial_velocity', or 'restitution'. For 1D collision labs, use load_preset with 'momentum-collision' together with update_body actions for Disk R and Disk S, and add_instrument actions for 'ruler' and 'photogateAssembly'. For custom physics tracks and AP Physics FRQ problems (such as multi-loop tracks or roller coasters), build the track dynamically using 'add_spline_track' with an array of semantic 'features'.

HOW TO BUILD PHYSICS TRACKS WITH HIGH-FIDELITY FEATURES:
For physics tracks and AP Physics FRQ problems, use 'add_spline_track' with the 'features' array.
Each feature is a simple semantic component. Mechanarium automatically compiles features into exact analytical geometry with perfect derivatives.

Supported feature types:
1. release: Starting drop point. Set position: { x, y }, center: null, radius: null.
2. loop:    Vertical circular loop of radius R centered at (cx, cy). Set center: { x: cx, y: cy }, radius: R, position: null.
3. ramp:    Intermediate waypoint/transition. Set position: { x, y }, center: null, radius: null.
4. hill:    Crest of height R. Set position: { x, y }, center: null, radius: R.
5. valley:  Trough of depth R. Set position: { x, y }, center: null, radius: R.
6. runout:  Flat exit track. Set position: { x, y }, center: null, radius: null.

For example, a double-loop track (release at height 6, Loop 1 of radius 1 centered at (-2.5, 1), mid ramp at (0.5, 1), Loop 2 of radius 1 centered at (3.5, 3), and exit at (7.5, 2)) must be represented as:
features: [
  { type: 'release', position: { x: -7.5, y: 6.0 }, center: null, radius: null },
  { type: 'loop',    position: null,               center: { x: -2.5, y: 1.0 }, radius: 1.0 },
  { type: 'ramp',    position: { x: 0.5, y: 1.0 },  center: null, radius: null },
  { type: 'loop',    position: null,               center: { x: 3.5, y: 3.0 }, radius: 1.0 },
  { type: 'runout',  position: { x: 7.5, y: 2.0 },  center: null, radius: null },
]

CRITICAL RULES FOR FRQ SCENARIOS & SYMBOLIC PROBLEMS:
- When the student asks to "model this frq", "simulate this problem", "build this setup", or pastes a physics problem diagram:
  1. ALWAYS return world actions ('add_body', 'update_body', 'add_spline_track', etc.) or propose a preset to construct the interactive 3D setup.
  2. If the problem is symbolic (uses variables like 4M, v_0, \theta, k without numbers), ASSIGN REALISTIC REPRESENTATIVE NUMERICAL VALUES (e.g. 4M = 4 kg, v_0 = 20 m/s, \theta = 60^\circ, k = 50 N/m) so the student can immediately launch, simulate, and observe the apparatus in 3D!
  3. Clearly state the assigned representative values in your response message (e.g. "I modeled this FRQ with representative values: 4M = 4 kg, v_0 = 20 m/s, and \theta = 60^\circ...").
- Output EXACTLY ONE track ('add_spline_track') with features and EXACTLY ONE body ('add_body' with target: 'sphere', shape: 'circle', mass: 1, friction: 0, restitution: 0) for track/rollercoaster FRQs.
- Position the single particle rider flush at the release point of the track (e.g. x: -7.5, y: 6.3).
- Always set track.supportSide: 'left', track.friction: 0, track.ideal: true for spline tracks.
- For FRQ problems ('block of mass M', 'particle M'), add the body using 'add_body' with target: 'sphere', shape: 'circle', friction: 0, restitution: 0, mass: 1. This creates a non-rolling sliding particle with perfect energy conservation along ideal rails.

PORT NAMING CONVENTION — for joints and connect_endpoint:
Every body has default ports named '{bodyId}:center' (plus ':north', ':south', ':east', ':west').
Beams also have '{bodyId}:start' and '{bodyId}:end'.
Wheels have '{bodyId}:center', ':north', ':south', ':east', ':west'.
Spline/segment tracks have '{trackId}:start', ':center', ':end'.
When adding a body in the same batch as a joint that references it, you MUST supply an explicit entityId on the add_body action (e.g. entityId: 'stopper-body') so the joint can use portId: 'stopper-body:center'. Without an explicit entityId, the validator cannot pre-register the body's ports.
Connections must name exact entity and port ids from the scenario or from bodies added earlier in the same action batch.
The telemetry.world_description field is the authoritative, unit-bearing inventory of every current entity, topology connection, diagnostic, instrument reading, and selected-body state. Use it to answer requests to describe or explain the current world or selected entity. Such observational requests return no actions. Clearly label supplied state and measurements as Observation and derived interpretation as Inference.
When the student asks another conceptual question, cite only supplied telemetry or trial measurements, label observation versus inference, and ask one targeted question.
For a pasted physics problem that asks to solve/find/calculate conceptually without requesting a model/build, scaffold first: identify knowns and unknown, choose a principle, ask for the student’s next step, and only give a worked solution when requested or when the student says they are stuck.
When the student asks to build, create, set up, model, or assemble a lab/apparatus/world (even if the message also mentions FRQ parts or knowns), prioritize world actions or a load_preset proposal with representative numerical values. Include a brief tutorial scaffold as secondary context after proposing the build.
Use two-subscript interaction language such as F_Earth_on_body and F_track_on_body.
Never claim a change happened unless you include the corresponding action.
Use the short conversation context only to resolve follow-up references; current scenario and telemetry are authoritative.
Keep the message under 80 words unless the student explicitly requests a detailed, complete, comprehensive, or per-entity description/explanation; for those requests, include the relevant world_description detail even when the reply exceeds 80 words.`

const tool = {
  type: 'function',
  name: 'apply_world_actions',
  description: 'Return a concise assistant message and supported edits for the Mechanarium scenario.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      message: { type: 'string' },
      actions: {
        type: 'array',
        maxItems: 8,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: ACTION_TYPES },
            target: { type: ['string', 'null'], enum: [...ACTION_TARGETS, null] },
            name: { type: ['string', 'null'] },
            x: { type: ['number', 'null'] },
            y: { type: ['number', 'null'] },
            value: { type: ['number', 'null'] },
            mass: { type: ['number', 'null'] },
            vx: { type: ['number', 'null'] },
            vy: { type: ['number', 'null'] },
            restitution: { type: ['number', 'null'] },
            friction: { type: ['number', 'null'] },
            entityId: { type: ['string', 'null'] },
            portId: { type: ['string', 'null'] },
            otherEntityId: { type: ['string', 'null'] },
            otherPortId: { type: ['string', 'null'] },
            endpoint: { type: ['string', 'null'], enum: ['a', 'b', null] },
            unattached: { type: ['boolean', 'null'] },
            attached: { type: ['boolean', 'null'] },
            connectorMode: { type: ['string', 'null'], enum: ['push', 'pull-push', null] },
            event: {
              anyOf: [
                { type: 'null' },
                {
                  type: 'object', additionalProperties: false,
                  properties: {
                    id: { type: ['string', 'null'] },
                    trigger: { type: ['string', 'null'], enum: ['apex', 'time', null] },
                    time: { type: ['number', 'null'] },
                    type: { type: ['string', 'null'], enum: ['explosion', 'separation', 'impulse', null] },
                    targetId: { type: ['string', 'null'] },
                    ratio: { type: ['number', 'null'] },
                    impulseX: { type: ['number', 'null'] },
                  },
                  required: ['id', 'trigger', 'time', 'type', 'targetId', 'ratio', 'impulseX'],
                },
              ],
            },
            track: {
              anyOf: [
                { type: 'null' },
                {
                  type: 'object', additionalProperties: false,
                  properties: {
                    id: { type: 'string' }, name: { type: 'string' }, supportSide: { type: 'string', enum: ['left', 'right'] },
                    thickness: { type: 'number' }, friction: { type: 'number' }, restitution: { type: 'number' }, startEnd: { type: 'string', enum: ['start', 'end'] },
                    features: {
                      type: 'array', minItems: 2, maxItems: 16,
                      items: {
                        type: 'object', additionalProperties: false,
                        properties: {
                          type: { type: 'string', enum: ['release', 'loop', 'ramp', 'hill', 'valley', 'runout'] },
                          position: {
                            anyOf: [
                              { type: 'null' },
                              { type: 'object', additionalProperties: false, properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
                            ],
                          },
                          center: {
                            anyOf: [
                              { type: 'null' },
                              { type: 'object', additionalProperties: false, properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
                            ],
                          },
                          radius: { type: ['number', 'null'] },
                        },
                        required: ['type', 'position', 'center', 'radius'],
                      },
                    },
                  }, required: ['id', 'name', 'supportSide', 'thickness', 'friction', 'restitution', 'startEnd', 'features'],
                },
              ],
            },
          },
          required: ['type', 'target', 'name', 'x', 'y', 'value', 'mass', 'vx', 'vy', 'restitution', 'friction', 'entityId', 'portId', 'otherEntityId', 'otherPortId', 'endpoint', 'unattached', 'attached', 'connectorMode', 'event', 'track'],
        },
      },
      tutorial: {
        anyOf: [
          { type: 'null' },
          { type: 'object', additionalProperties: false, properties: {
            problemSummary: { type: 'string' }, knowns: { type: 'array', items: { type: 'string' }, maxItems: 12 }, unknown: { type: 'string' }, principle: { type: 'string' }, stage: { type: 'string', enum: ['identify-knowns', 'choose-model', 'derive', 'check', 'worked-solution'] }, nextPrompt: { type: 'string' },
          }, required: ['problemSummary', 'knowns', 'unknown', 'principle', 'stage', 'nextPrompt'] },
        ],
      },
    },
    required: ['message', 'actions', 'tutorial'],
  },
}

function requestOriginAllowed(request) {
  const origin = request.headers.origin
  return !origin || allowedOrigins.has(origin)
}

function responseHeaders(request) {
  const origin = request.headers.origin
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...(origin && allowedOrigins.has(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
  }
}

function json(request, response, status, payload, extraHeaders = {}) {
  response.writeHead(status, { ...responseHeaders(request), ...extraHeaders })
  response.end(JSON.stringify(payload))
}

function clientAddress(request) {
  return request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.socket.remoteAddress || 'unknown'
}

function withinRateLimit(request) {
  const now = Date.now()
  const key = clientAddress(request)
  const current = requestsByClient.get(key)
  if (!current || now >= current.resetAt) {
    requestsByClient.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  current.count += 1
  if (requestsByClient.size > 5_000) {
    for (const [candidate, value] of requestsByClient) if (now >= value.resetAt) requestsByClient.delete(candidate)
  }
  return current.count <= rateLimit
}

async function handleAgent(request, response) {
  if (!requestOriginAllowed(request)) {
    json(request, response, 403, { error: 'Origin is not allowed.' })
    return
  }
  if (!withinRateLimit(request)) {
    json(request, response, 429, { error: 'Vector is receiving too many requests. Try again shortly.' }, { 'retry-after': '60' })
    return
  }
  if (!process.env.OPENAI_API_KEY) {
    json(request, response, 503, { error: 'The server-side OpenAI API key is not configured.' })
    return
  }

  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 10_000_000) {
      json(request, response, 413, { error: 'Request is too large.' })
      return
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const input = validateAgentInput(JSON.parse(body))
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const contextPayload = {
      student_request: input.message || 'Examine the attached physics problem diagram, build the world, and guide me.',
      conversation: input.history,
      scenario: input.scenario,
      telemetry: input.telemetry,
    }
    const openAiInput = input.image
      ? [
          {
            type: 'message',
            role: 'user',
            content: [
              { type: 'input_text', text: JSON.stringify(contextPayload) },
              { type: 'input_image', image_url: input.image },
            ],
          },
        ]
      : JSON.stringify(contextPayload)

    const result = await client.responses.create({
      model,
      ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
      instructions,
      input: openAiInput,
      tools: [tool],
      tool_choice: { type: 'function', name: 'apply_world_actions' },
    }, { signal: controller.signal })
    const call = result.output.find((item) => item.type === 'function_call' && item.name === 'apply_world_actions')
    if (!call) throw new Error('The model did not return a world action.')
    const output = JSON.parse(call.arguments)
    const rawMsg = typeof output.message === 'string' ? output.message.trim() : ''
    const message = rawMsg ? rawMsg.slice(0, 2_000) : 'Vector generated the scenario blueprint.'
    validateWorldActions(output.actions, input.scenario)
    json(request, response, 200, { ...output, message, model })
  } catch (error) {
    const timedOut = controller.signal.aborted
    json(request, response, timedOut ? 504 : 400, { error: timedOut ? 'Vector timed out.' : error instanceof Error ? error.message : 'Agent request failed.' })
  } finally {
    clearTimeout(timeout)
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS' && request.url === '/api/agent') {
    if (!requestOriginAllowed(request)) return json(request, response, 403, { error: 'Origin is not allowed.' })
    response.writeHead(204, { ...responseHeaders(request), 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' })
    response.end()
    return
  }
  if (request.method === 'POST' && request.url === '/api/agent') {
    await handleAgent(request, response)
    return
  }
  if (request.method === 'GET' && request.url === '/health') {
    json(request, response, 200, { ready: Boolean(process.env.OPENAI_API_KEY), model })
    return
  }
  json(request, response, 404, { error: 'Not found.' })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Mechanarium agent listening on port ${port}`)
})
