import http from 'node:http'
import OpenAI from 'openai'
import { ACTION_TARGETS, ACTION_TYPES, validateAgentInput, validateWorldActions } from './agentPolicy.mjs'

const port = Number(process.env.PORT ?? process.env.AGENT_PORT ?? 8787)
const model = process.env.OPENAI_MODEL ?? 'gpt-5.6-luna'
const rateLimit = Number(process.env.AGENT_RATE_LIMIT ?? 20)
const timeoutMs = Number(process.env.AGENT_TIMEOUT_MS ?? 25_000)
const allowedOrigins = new Set((process.env.AGENT_ALLOWED_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173,https://dillylol.github.io').split(',').map((origin) => origin.trim()).filter(Boolean))
const requestsByClient = new Map()

const instructions = `You are Vector, the Mechanarium world-building agent and Socratic physics guide.
Turn the student's request into safe, small edits to the current mechanics scenario.
Use only the supported Scenario v4 action schema. Connections must name exact entity and port ids from the scenario; reject ambiguous graphs in the message instead of guessing.
Spline geometry uses add_spline_track with 2-64 finite quintic knots. Each knot requires id, position, tangent, and secondDerivative. Large geometry and preset loads are previews, so describe them as proposals rather than completed changes.
When the student asks a conceptual question, cite only supplied telemetry or trial measurements, label observation versus inference, and ask one targeted question.
For a pasted physics problem, scaffold first: identify knowns and unknown, choose a principle, ask for the student’s next step, and only give a worked solution when requested or when the student says they are stuck. Never invent missing numerical values.
Use two-subscript interaction language such as F_Earth_on_body and F_track_on_body.
Never claim a change happened unless you include the corresponding action.
Use the short conversation context only to resolve follow-up references; current scenario and telemetry are authoritative.
Keep the message under 80 words.`

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
            entityId: { type: ['string', 'null'] },
            portId: { type: ['string', 'null'] },
            otherEntityId: { type: ['string', 'null'] },
            otherPortId: { type: ['string', 'null'] },
            endpoint: { type: ['string', 'null'], enum: ['a', 'b', null] },
            track: {
              anyOf: [
                { type: 'null' },
                {
                  type: 'object', additionalProperties: false,
                  properties: {
                    id: { type: 'string' }, name: { type: 'string' }, supportSide: { type: 'string', enum: ['left', 'right'] },
                    thickness: { type: 'number' }, friction: { type: 'number' }, restitution: { type: 'number' }, startEnd: { type: 'string', enum: ['start', 'end'] },
                    knots: { type: 'array', minItems: 2, maxItems: 64, items: { type: 'object', additionalProperties: false, properties: {
                      id: { type: 'string' },
                      position: { type: 'object', additionalProperties: false, properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
                      tangent: { type: 'object', additionalProperties: false, properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
                      secondDerivative: { type: 'object', additionalProperties: false, properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
                    }, required: ['id', 'position', 'tangent', 'secondDerivative'] } },
                  }, required: ['id', 'name', 'supportSide', 'thickness', 'friction', 'restitution', 'startEnd', 'knots'],
                },
              ],
            },
          },
          required: ['type', 'target', 'name', 'x', 'y', 'value', 'entityId', 'portId', 'otherEntityId', 'otherPortId', 'endpoint', 'track'],
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
    if (body.length > 100_000) {
      json(request, response, 413, { error: 'Request is too large.' })
      return
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const input = validateAgentInput(JSON.parse(body))
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const result = await client.responses.create({
      model,
      instructions,
      input: JSON.stringify({
        student_request: input.message,
        conversation: input.history,
        scenario: input.scenario,
        telemetry: input.telemetry,
      }),
      tools: [tool],
      tool_choice: { type: 'function', name: 'apply_world_actions' },
    }, { signal: controller.signal })
    const call = result.output.find((item) => item.type === 'function_call' && item.name === 'apply_world_actions')
    if (!call) throw new Error('The model did not return a world action.')
    const output = JSON.parse(call.arguments)
    if (typeof output.message !== 'string' || !output.message.trim() || output.message.length > 1_000) throw new TypeError('Vector returned an invalid message.')
    validateWorldActions(output.actions, input.scenario)
    json(request, response, 200, { ...output, message: output.message.trim(), model })
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
