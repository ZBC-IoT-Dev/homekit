import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { authComponent, createAuth } from "./betterAuth/auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

// 1. Register Gateway (Raspberry Pi)
http.route({
  path: "/api/gateways/register",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { inviteCode, identifier, name, type } = await request.json();

    try {
      const result = await ctx.runMutation(api.gateways.register, {
        inviteCode,
        identifier,
        name,
        type,
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// 2. Heartbeat (Raspberry Pi)
http.route({
  path: "/api/gateways/heartbeat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { identifier } = await request.json();

    try {
      const result = await ctx.runMutation(api.gateways.heartbeat, {
        identifier,
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// 3. List Gateways (Swift App / Dashboard)
// Note: In a real app, you should pass a Bearer token.
// For updated "simple" usage, we'll accept homeId query param.
// The internal query checks for auth, so this will fail if no token is passed in header.
// Swift App must send `Authorization: Bearer <token>`
http.route({
  path: "/api/gateways",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const homeId = url.searchParams.get("homeId");
    const inviteCode = url.searchParams.get("inviteCode");

    if (!homeId && !inviteCode) {
      return new Response(
        JSON.stringify({ error: "Missing homeId or inviteCode" }),
        {
          status: 400,
        },
      );
    }

    try {
      // This will use the auth token from the request header automatically if present
      const result = await ctx.runQuery(api.gateways.get, {
        homeId: homeId ? (homeId as any) : undefined,
        inviteCode: inviteCode || undefined,
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 401, // Likely unauthenticated or unauthorized
        headers: { "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// 5. Log Device Data (From Gateway)
http.route({
  path: "/api/devices",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { identifier, type, data, gatewayIdentifier } = await request.json();

    // In a real app we would authenticate the gateway here.

    try {
      await ctx.runMutation(api.gateways.logDeviceData, {
        identifier, // Device ID
        type,
        data,
        gatewayIdentifier: gatewayIdentifier, // Gateway ID used for Home lookup
      });

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
      });
    }
  }),
});

export default http;
