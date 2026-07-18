# ADR 0004: Server-side world-agent boundary

- Status: accepted
- Date: 2026-07-18

## Decision

The Mechanarium world agent uses the OpenAI Responses API through a same-origin server endpoint. The browser sends a bounded scenario summary, current telemetry, and the student's request. GPT returns strict, declarative world actions that are validated and executed by the existing client scenario layer.

The server defaults to `gpt-5.6-terra` to balance capability, latency, and cost. The OpenAI key remains server-side. When the endpoint or key is unavailable, a deterministic local planner supports the same basic construction vocabulary.

## Consequences

- Model output cannot execute arbitrary browser code or bypass scenario validation.
- The UI remains demonstrable without credentials.
- Production static hosting requires an accompanying serverless `/api/agent` endpoint.
- Socratic responses are grounded in current energy, momentum, time, and selected-body telemetry.
