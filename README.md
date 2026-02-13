# MGCO Dashboard

Next.js + TypeScript + Supabase multi-tenant dashboard with TechOps and client portals.

## New Feature: AI Agent Playground (TechOps)

- TechOps route: `/techops/ai-agent-playground`
- Client visibility: clients do not see Playground routes; they only see read-only AI Receptionist analytics in `/client/dashboard`.

## Environment

Create `.env.local` from `.env.example` and fill values.

```bash
cp .env.example .env.local
```

Required vars:

- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_API_KEY_SID`
- `TWILIO_API_KEY_SECRET`
- `TWILIO_WEBHOOK_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `TECHOPS_EMAILS` comma-separated allowlist (if omitted, authenticated users are treated as TechOps in API fallback mode)
- `AGENT_CALL_RATE_LIMIT_PER_MINUTE`

## Database Migration (Supabase)

Run:

- `supabase/ai_agent_playground.sql`

This migration creates:

- `agents`
- `agent_templates` (seeded for Retail/Restaurant/Auto Shop/Clinic/Real Estate)
- `google_calendar_connections`
- `calls`
- `call_events`

It also:

- enables RLS on new tables
- adds TechOps/client policies
- adds `calls` and `call_events` to `supabase_realtime` publication

## TechOps API Routes

- `GET /api/techops/agents`
- `POST /api/techops/agents`
- `GET /api/techops/agents/:id`
- `PATCH /api/techops/agents/:id`
- `POST /api/techops/agents/:id/assign`
- `POST /api/techops/agents/:id/publish`
- `POST /api/techops/agents/:id/pause`
- `GET /api/techops/twilio/numbers`
- `GET|POST /api/techops/agent-templates`
- `GET /api/techops/google-calendar-connections?client_id=<uuid>`

## Google OAuth (Per Client)

Flow:

- Start: `GET /api/google/oauth/start?client_id=<uuid>`
- Callback: `GET /api/google/oauth/callback`

Tokens are stored per client in `google_calendar_connections`, not tied to TechOps personal calendar.

Google Console setup:

1. Add OAuth consent scopes for Calendar (`https://www.googleapis.com/auth/calendar`).
2. Add authorized redirect URI: `https://<public-host>/api/google/oauth/callback`.
3. Set `.env.local` `GOOGLE_OAUTH_REDIRECT_URL` to the same URI.

## Twilio Voice Setup

For each Twilio number used by an agent:

1. In Twilio Console, configure Voice webhook to `POST`:
   - `https://<public-host>/api/twilio/voice/inbound`
2. The inbound route resolves agent by called `To` number and returns TwiML with `<Connect><Stream .../></Connect>`.
3. Stream status callback endpoint:
   - `POST https://<public-host>/api/twilio/voice/stream/status`

Media stream URL configured by TwiML:

- `wss://<public-host>/api/twilio/voice/stream`

Note:

- The current `/api/twilio/voice/stream` route is a websocket bridge scaffold endpoint. For production realtime audio bridging (Twilio Media Streams <-> OpenAI Realtime), deploy this behind a Node websocket server/runtime that supports upgrade handling.

## OpenAI Realtime + Calendar Tools

Utility functions are implemented in:

- `lib/ai-agent/calendar-tools.ts`

Provided tool functions:

- `checkAvailability`
- `bookAppointment`
- `cancelAppointment`
- `rescheduleAppointment`

Each tool writes `call_events` and updates `calls.outcome` for booking/cancel/reschedule outcomes.

## Client Dashboard Realtime Analytics

`/client/dashboard` includes an **AI Receptionist** section with:

- published agents
- live call count
- outcome breakdown
- recent calls list
- transcript/summary panel
- realtime timeline via Supabase Realtime on `calls` + `call_events`

## Local Testing (ngrok)

1. Start app:

```bash
npm run dev
```

2. Expose app:

```bash
ngrok http 3000
```

3. Set in `.env.local`:

- `TWILIO_WEBHOOK_BASE_URL=https://<your-ngrok-host>`
- `GOOGLE_OAUTH_REDIRECT_URL=https://<your-ngrok-host>/api/google/oauth/callback`

4. Reconfigure Twilio number webhook URLs to ngrok host.

## Reliability Notes

- Basic per-agent rate limiting is enabled in-memory (`lib/ai-agent/rate-limit.ts`).
- Inbound route has fallback voice responses and graceful hangup paths.
- Call metadata/transcript/summary are stored; raw audio is not stored.
- Stream status callback finalizes call duration/end state when stream ends.

## Existing Modules

Retail ledger, healthcare CRM, and listings modules remain unchanged.
