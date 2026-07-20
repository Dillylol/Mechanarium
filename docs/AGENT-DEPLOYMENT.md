# Deploying Vector

Vector has two execution paths:

- a deterministic local planner that works on static GitHub Pages without credentials;
- an OpenAI-backed agent served by `POST /api/agent` with the API key held only on the server.

Both modes consume Scenario v4. Small validated actions may apply immediately; preset replacement, custom spline geometry, and multi-part requests are returned as previews that require Apply or Cancel. The server validates every spline blueprint to the same 2–64-knot, finite-vector contract used by the client.

The browser endpoint is configured at build time with `VITE_AGENT_API_URL`. If it is empty, the client uses the same-origin `/api/agent` path and falls back to the local planner when that request is unavailable.

## Local development

1. Copy `.env.example` to `.env`.
2. Set `OPENAI_API_KEY` in `.env`.
3. Run `npm install` and `npm run dev`.
4. Open `http://127.0.0.1:5173/Mechanarium/`.
5. Send a request through Vector. The source badge should change to **Vector / OpenAI**.

Vite proxies `/api/agent` to the local Node service on port 8787. The API key must never use a `VITE_` prefix because Vite variables are included in the browser bundle.

## Production: GitHub Pages plus Render

The repository includes `render.yaml`, which defines a small Node web service for the agent.

1. Sign in to Render and create a new **Blueprint** from the `Dillylol/Mechanarium` repository.
2. When prompted for the `OPENAI_API_KEY` value, enter a project-scoped OpenAI API key. Do not commit it to Git or add it to the GitHub Pages build.
3. Deploy the `mechanarium-agent` service.
4. Open `https://YOUR-SERVICE.onrender.com/health`. A configured service returns JSON with `"ready": true`.
5. Copy the complete endpoint URL: `https://YOUR-SERVICE.onrender.com/api/agent`.
6. In GitHub, open **Mechanarium -> Settings -> Secrets and variables -> Actions -> Variables**.
7. Create the repository variable `VITE_AGENT_API_URL` with the complete endpoint URL from step 5.
8. Open **Actions -> Deploy to GitHub Pages -> Run workflow** to rebuild the frontend with that endpoint.
9. Open `https://dillylol.github.io/Mechanarium/`, ask Vector a question, and confirm the dock displays **Vector / OpenAI**.

If the service is unavailable, times out, exceeds its rate limit, or returns an invalid action, the browser automatically uses the local planner instead.

## Production controls

The server currently enforces:

- an origin allowlist through `AGENT_ALLOWED_ORIGINS`;
- a 100 KB request-body ceiling;
- a 2,000-character student-message limit;
- six bounded conversation messages;
- a configurable per-client request limit;
- a configurable OpenAI request timeout;
- strict function-call output;
- server-side action and entity/port validation;
- a maximum of eight actions per response.

For a larger public launch, add durable distributed rate limiting, request logging without student content, budget alerts, and a privacy notice describing what scenario and measurement data is sent to the agent.
