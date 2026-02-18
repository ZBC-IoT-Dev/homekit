# HomeKit Web App (Next.js + Convex)

This repository is the web dashboard for homes, gateways, devices, and automations.

It provides:

- Authentication (Better Auth + GitHub OAuth)
- Home creation/join via invite code
- Gateway approval and monitoring
- Device discovery + pairing
- Live device control via gateway WebSocket
- Automation engine with queued gateway commands

## 1. Stack

- Next.js 16 + React 19
- Convex (database, queries, mutations, HTTP API)
- Better Auth (via Convex component)
- Tailwind CSS + UI components

## 2. Prerequisites

- Node.js 20+ (or Bun)
- Convex CLI
- GitHub OAuth app (for login)

Install Convex CLI (if missing):

```bash
npm i -g convex
```

## 3. Install

```bash
cd homekit
npm install
```

## 4. Environment Setup

Copy `.env.example` to `.env.local` and fill values.

Required keys:

```bash
# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CONVEX_SITE_URL=

# Next.js
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_HUB_WS_URL=ws://<gateway-ip>:8765/ws
NEXT_PUBLIC_HUB_WS_HOST=<gateway-ip>
NEXT_PUBLIC_HUB_WS_PATH=/ws
NEXT_PUBLIC_HUB_WS_TOKEN=<same_token_as_gateway>

# Better Auth
BETTER_AUTH_SECRET=<long_random_secret>
SITE_URL=http://localhost:3000
GITHUB_CLIENT_ID=<oauth_client_id>
GITHUB_CLIENT_SECRET=<oauth_client_secret>

# Gateway request signing
GATEWAY_SHARED_SECRET=<same_secret_as_gateway>
```

Important contract values:

- `GATEWAY_SHARED_SECRET` must equal gateway `gateway_shared_secret`.
- `NEXT_PUBLIC_HUB_WS_TOKEN` must equal gateway `websocket_auth_token` (if enabled).

## 5. Run (Local)

Start Convex dev server in one terminal:

```bash
npx convex dev
```

Start Next.js app in another terminal:

```bash
npm run dev
```

Open `http://localhost:3000`.

## 6. How It Works

### User and home model

- Users authenticate with Better Auth.
- A user creates a home or joins with invite code.
- Home members have roles (`admin`/`member`).

### Gateway onboarding

1. Gateway calls `POST /api/gateways/register` with invite code + signed headers.
2. New gateway is created as `pending`.
3. Admin approves in settings (`gateways.updateStatus` -> `active`).

### Device discovery

1. Gateway forwards telemetry to `POST /api/devices`.
2. Backend upserts device records (`pending` by default).
3. UI shows pending devices in discovery dialog.
4. Admin pairs device (sets status to `paired` + friendly name).

### Device control

UI sends command over WebSocket directly to gateway (`lib/hub-websocket.ts`):

```json
{
  "deviceId": "uno-r4-...",
  "action": "light_fx_on",
  "command": { "state": "ON", "fx": "ON" }
}
```

Gateway publishes to MQTT topic `devices/<deviceId>/set`.

### Automations

- Automations are evaluated when new device data arrives.
- Matching rules enqueue command rows in `gatewayCommands`.
- Gateway polls `/api/gateways/commands` and publishes MQTT commands.
- Gateway acknowledges with `/api/gateways/commands/ack`.

## 7. API Endpoints (Convex HTTP)

Defined in `convex/http.ts`:

- `POST /api/gateways/register`
- `POST /api/gateways/heartbeat`
- `GET /api/gateways`
- `POST /api/gateways/status`
- `POST /api/devices`
- `GET /api/gateways/devices`
- `GET /api/gateways/commands`
- `POST /api/gateways/commands/ack`
- `GET /api/device-types`
- `POST /api/device-types`

Gateway-facing routes are HMAC signed using:

- Header `X-Gateway-Timestamp`
- Header `X-Gateway-Signature`

## 8. Data Model Summary

From `convex/schema.ts`:

- `homes`, `home_members`
- `gateways`
- `devices`
- `measurements` (history)
- `automations`
- `gatewayCommands`
- `deviceTypes`
- `categories`

## 9. Common Dev Tasks

```bash
# lint
npm run lint

# build
npm run build

# production start
npm run start
```

## 10. Troubleshooting

- Login issues:
  1. verify `SITE_URL` and GitHub OAuth callback URL
  2. verify `BETTER_AUTH_SECRET` is set
- Gateway requests returning 401:
  1. secret mismatch (`GATEWAY_SHARED_SECRET`)
  2. clock skew too high between gateway and server
- WS control not working:
  1. check `NEXT_PUBLIC_HUB_WS_URL`
  2. check browser can reach gateway LAN IP/port 8765
  3. check token mismatch (if token required)
