import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authComponent, createAuth } from "./betterAuth/auth";

const http = httpRouter();

const GATEWAY_REQUEST_MAX_SKEW_SECONDS = 300;
const rateLimitState = new Map<string, { count: number; resetAt: number }>();

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getClientIp(request: Request) {
  const xff = request.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0]?.trim();
  return first || "unknown";
}

function consumeRateLimit(key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const row = rateLimitState.get(key);
  if (!row || row.resetAt <= now) {
    rateLimitState.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  row.count += 1;
  rateLimitState.set(key, row);
  return row.count > maxRequests;
}

function getGatewaySharedSecret() {
  const secret = process.env.GATEWAY_SHARED_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

function timingSafeHexEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, content: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(content),
  );
  return bytesToHex(new Uint8Array(signature));
}

async function verifyGatewayRequest(request: Request, rawBody: string) {
  const secret = getGatewaySharedSecret();
  if (!secret) {
    return { ok: false, status: 503, error: "Gateway auth secret not configured" };
  }

  const signature = (request.headers.get("x-gateway-signature") || "").trim().toLowerCase();
  const timestampRaw = (request.headers.get("x-gateway-timestamp") || "").trim();
  if (!signature || !timestampRaw) {
    return { ok: false, status: 401, error: "Missing gateway auth headers" };
  }
  if (!/^[0-9a-f]{64}$/.test(signature)) {
    return { ok: false, status: 401, error: "Invalid gateway signature format" };
  }

  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, status: 401, error: "Invalid gateway timestamp" };
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > GATEWAY_REQUEST_MAX_SKEW_SECONDS) {
    return { ok: false, status: 401, error: "Gateway timestamp outside allowed window" };
  }

  const url = new URL(request.url);
  const canonical = `${request.method.toUpperCase()}\n${url.pathname}${url.search}\n${timestamp}\n${rawBody}`;
  const expectedSignature = await hmacSha256Hex(secret, canonical);
  if (!timingSafeHexEqual(signature, expectedSignature)) {
    return { ok: false, status: 401, error: "Invalid gateway signature" };
  }
  return { ok: true as const };
}

async function parseJsonBody<T>(request: Request): Promise<{ raw: string; parsed: T }> {
  const raw = await request.text();
  let parsed: T;
  try {
    parsed = JSON.parse(raw) as T;
  } catch {
    throw new Error("Invalid JSON payload");
  }
  return { raw, parsed };
}

authComponent.registerRoutes(http, createAuth);

// 1. Register Gateway (Raspberry Pi)
http.route({
  path: "/api/gateways/register",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const ip = getClientIp(request);
    const rateLimitKey = `register:${ip}`;
    if (consumeRateLimit(rateLimitKey, 40, 10 * 60 * 1000)) {
      return jsonResponse({ error: "Too many register attempts" }, 429);
    }

    try {
      const { raw, parsed } = await parseJsonBody<{
        inviteCode: string;
        identifier: string;
        name: string;
        type?: string;
      }>(request);
      const authResult = await verifyGatewayRequest(request, raw);
      if (!authResult.ok) {
        return jsonResponse({ error: authResult.error }, authResult.status);
      }

      const result = await ctx.runMutation(api.gateways.register, {
        inviteCode: parsed.inviteCode,
        identifier: parsed.identifier,
        name: parsed.name,
        type: parsed.type,
      });
      return jsonResponse(result, 200);
    } catch (e: unknown) {
      return jsonResponse({ error: getErrorMessage(e) }, 400);
    }
  }),
});

// 2. Heartbeat (Raspberry Pi)
http.route({
  path: "/api/gateways/heartbeat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { raw, parsed } = await parseJsonBody<{ identifier: string }>(request);
      const authResult = await verifyGatewayRequest(request, raw);
      if (!authResult.ok) {
        return jsonResponse({ error: authResult.error }, authResult.status);
      }

      const result = await ctx.runMutation(api.gateways.heartbeat, {
        identifier: parsed.identifier,
      });
      return jsonResponse(result, 200);
    } catch (e: unknown) {
      return jsonResponse({ error: getErrorMessage(e) }, 400);
    }
  }),
});

// 3. List Gateways (Swift App / Dashboard)
http.route({
  path: "/api/gateways",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const homeId = url.searchParams.get("homeId");
    const inviteCode = url.searchParams.get("inviteCode");

    if (!homeId && !inviteCode) {
      return jsonResponse({ error: "Missing homeId or inviteCode" }, 400);
    }

    if (inviteCode) {
      const ip = getClientIp(request);
      const rateLimitKey = `list_gateways_invite:${ip}`;
      if (consumeRateLimit(rateLimitKey, 60, 10 * 60 * 1000)) {
        return jsonResponse({ error: "Too many invite code attempts" }, 429);
      }
    }

    try {
      const result = await ctx.runQuery(api.gateways.get, {
        homeId: homeId ? (homeId as Id<"homes">) : undefined,
        inviteCode: inviteCode || undefined,
      });
      return jsonResponse(result, 200);
    } catch (e: unknown) {
      return jsonResponse({ error: getErrorMessage(e) }, 401);
    }
  }),
});

// 4. Update Status (Swift App / Dashboard - Approve/Reject)
http.route({
  path: "/api/gateways/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { gatewayId, status } = await request.json();

    try {
      await ctx.runMutation(api.gateways.updateStatus, {
        gatewayId,
        status,
      });
      return jsonResponse({ success: true }, 200);
    } catch (e: unknown) {
      return jsonResponse({ error: getErrorMessage(e) }, 400);
    }
  }),
});

// 5. Log Device Data (From Gateway)
http.route({
  path: "/api/devices",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { raw, parsed } = await parseJsonBody<{
        identifier: string;
        type: string;
        data?: unknown;
        gatewayIdentifier: string;
      }>(request);
      const authResult = await verifyGatewayRequest(request, raw);
      if (!authResult.ok) {
        return jsonResponse({ error: authResult.error }, authResult.status);
      }

      await ctx.runMutation(api.gateways.logDeviceData, {
        identifier: parsed.identifier,
        type: parsed.type,
        data: parsed.data,
        gatewayIdentifier: parsed.gatewayIdentifier,
      });

      return jsonResponse({ success: true }, 200);
    } catch (e: unknown) {
      return jsonResponse({ error: getErrorMessage(e) }, 500);
    }
  }),
});

// 6. Gateway device sync (for durable remembered pairing on hub)
http.route({
  path: "/api/gateways/devices",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const authResult = await verifyGatewayRequest(request, "");
    if (!authResult.ok) {
      return jsonResponse({ error: authResult.error }, authResult.status);
    }

    const url = new URL(request.url);
    const gatewayIdentifier = url.searchParams.get("gatewayIdentifier");

    if (!gatewayIdentifier) {
      return jsonResponse({ error: "Missing gatewayIdentifier query parameter" }, 400);
    }

    try {
      const result = await ctx.runQuery(api.gateways.getGatewayPairedDevices, {
        gatewayIdentifier,
      });
      return jsonResponse(result, 200);
    } catch (e: unknown) {
      return jsonResponse({ error: getErrorMessage(e) }, 500);
    }
  }),
});

// 7. Gateway command polling
http.route({
  path: "/api/gateways/commands",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const authResult = await verifyGatewayRequest(request, "");
    if (!authResult.ok) {
      return jsonResponse({ error: authResult.error }, authResult.status);
    }

    const url = new URL(request.url);
    const gatewayIdentifier = url.searchParams.get("gatewayIdentifier");

    if (!gatewayIdentifier) {
      return jsonResponse({ error: "Missing gatewayIdentifier query parameter" }, 400);
    }

    try {
      const rows = await ctx.runQuery(api.automations.pollGatewayCommands, {
        gatewayIdentifier,
      });
      return jsonResponse(rows, 200);
    } catch (e: unknown) {
      return jsonResponse({ error: getErrorMessage(e) }, 500);
    }
  }),
});

http.route({
  path: "/api/gateways/commands/ack",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { raw, parsed } = await parseJsonBody<{
        commandId: Id<"gatewayCommands">;
        gatewayIdentifier: string;
        status: "sent" | "failed";
        error?: string;
      }>(request);
      const authResult = await verifyGatewayRequest(request, raw);
      if (!authResult.ok) {
        return jsonResponse({ error: authResult.error }, authResult.status);
      }
      if (parsed.status !== "sent" && parsed.status !== "failed") {
        return jsonResponse({ error: "Invalid status" }, 400);
      }

      const result = await ctx.runMutation(api.automations.ackGatewayCommand, {
        commandId: parsed.commandId,
        gatewayIdentifier: parsed.gatewayIdentifier,
        status: parsed.status,
        error: parsed.error,
      });
      return jsonResponse(result, 200);
    } catch (e: unknown) {
      return jsonResponse({ error: getErrorMessage(e) }, 400);
    }
  }),
});

// 8. List enabled device types (for product catalog in UI)
http.route({
  path: "/api/device-types",
  method: "GET",
  handler: httpAction(async (ctx) => {
    try {
      const result = await ctx.runQuery(api.deviceTypes.listEnabled, {});
      return jsonResponse(result, 200);
    } catch (e: unknown) {
      return jsonResponse({ error: getErrorMessage(e) }, 500);
    }
  }),
});

// 9. Upsert a device type (admin tooling / dashboard)
http.route({
  path: "/api/device-types",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { key, name, brand, image, description, features, enabled } =
      await request.json();

    try {
      const result = await ctx.runMutation(api.deviceTypes.upsert, {
        key,
        name,
        brand,
        image,
        description,
        features,
        enabled,
      });
      return jsonResponse(result, 200);
    } catch (e: unknown) {
      return jsonResponse({ error: getErrorMessage(e) }, 400);
    }
  }),
});

export default http;
