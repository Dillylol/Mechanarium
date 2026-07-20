# ADR 0004: Server-side world-agent boundary

- Status: accepted
- Date: 2026-07-18

## Decision

The Mechanarium world agent uses the OpenAI Responses API through a configurable server endpoint. The browser sends a bounded scenario summary, current telemetry, recent conversation context, and the student's request. GPT returns strict, declarative world actions that are validated by the server and executed through the existing client scenario layer.

The server defaults to `gpt-5.6-luna` for a cost-sensitive, high-volume student interaction path. The OpenAI key remains server-side. When the endpoint or key is unavailable, a deterministic local planner supports the same basic construction vocabulary.

## Consequences

- Model output cannot execute arbitrary browser code or bypass scenario validation.
- The UI remains demonstrable without credentials.
- Production static hosting requires an accompanying `/api/agent` backend; the frontend endpoint is supplied at build time through `VITE_AGENT_API_URL`.
- Socratic responses are grounded in current energy, momentum, time, and selected-body telemetry.
