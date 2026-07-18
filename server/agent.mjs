import http from 'node:http'
import OpenAI from 'openai'

const port = Number(process.env.AGENT_PORT ?? 8787)
const model = process.env.OPENAI_MODEL ?? 'gpt-5.6-terra'

const instructions = `You are the Mechanarium world-building agent and Socratic physics guide.
Turn the student's request into safe, small edits to the current mechanics scenario.
Use only the supported action schema. Do not invent unsupported components.
When the student asks a conceptual question, prefer one concise observation and one targeted question.
Use two-subscript interaction language such as F_Earth_on_body and F_track_on_body.
Never claim a change happened unless you include the corresponding action.
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
            type: { type: 'string', enum: ['add_body', 'add_constraint', 'add_force', 'remove_force', 'remove_constraint', 'load_preset', 'none'] },
            target: { type: ['string', 'null'], enum: ['sphere', 'box', 'ramp', 'floor', 'spring', 'gravity', 'central', 'projectile-motion', 'momentum-collision', 'rolling-incline', 'spring-oscillator', 'orbital-motion', null] },
            name: { type: ['string', 'null'] },
            x: { type: ['number', 'null'] },
            y: { type: ['number', 'null'] },
            value: { type: ['number', 'null'] },
          },
          required: ['type', 'target', 'name', 'x', 'y', 'value'],
        },
      },
    },
    required: ['message', 'actions'],
  },
}

function json(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(payload))
}

async function handleAgent(request, response) {
  if (!process.env.OPENAI_API_KEY) {
    json(response, 503, { error: 'The server-side OpenAI API key is not configured.' })
    return
  }

  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 100_000) {
      json(response, 413, { error: 'Request is too large.' })
      return
    }
  }

  try {
    const input = JSON.parse(body)
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const result = await client.responses.create({
      model,
      instructions,
      input: JSON.stringify({
        student_request: input.message,
        scenario: input.scenario,
        telemetry: input.telemetry,
      }),
      tools: [tool],
      tool_choice: { type: 'function', name: 'apply_world_actions' },
    })
    const call = result.output.find((item) => item.type === 'function_call' && item.name === 'apply_world_actions')
    if (!call) throw new Error('The model did not return a world action.')
    json(response, 200, { ...JSON.parse(call.arguments), model })
  } catch (error) {
    json(response, 400, { error: error instanceof Error ? error.message : 'Agent request failed.' })
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'POST' && request.url === '/api/agent') {
    await handleAgent(request, response)
    return
  }
  if (request.method === 'GET' && request.url === '/health') {
    json(response, 200, { ready: Boolean(process.env.OPENAI_API_KEY), model })
    return
  }
  json(response, 404, { error: 'Not found.' })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Mechanarium agent listening on http://127.0.0.1:${port}`)
})
