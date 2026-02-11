import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authComponent, createAuth } from "./betterAuth/auth";

const http = httpRouter();

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

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
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: getErrorMessage(e) }), {
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
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: getErrorMessage(e) }), {
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
        homeId: homeId ? (homeId as Id<"homes">) : undefined,
        inviteCode: inviteCode || undefined,
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: getErrorMessage(e) }), {
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
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: getErrorMessage(e) }), {
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
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: getErrorMessage(e) }), {
        status: 500,
      });
    }
  }),
});

// 6. Gateway device sync (for durable remembered pairing on hub)
http.route({
  path: "/api/gateways/devices",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const gatewayIdentifier = url.searchParams.get("gatewayIdentifier");

    if (!gatewayIdentifier) {
      return new Response(
        JSON.stringify({ error: "Missing gatewayIdentifier query parameter" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    try {
      const result = await ctx.runQuery(api.gateways.getGatewayPairedDevices, {
        gatewayIdentifier,
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: getErrorMessage(e) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// 7. List enabled device types (for product catalog in UI)
http.route({
  path: "/api/gateways/commands",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const gatewayIdentifier = url.searchParams.get("gatewayIdentifier");

    if (!gatewayIdentifier) {
      return new Response(
        JSON.stringify({ error: "Missing gatewayIdentifier query parameter" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    try {
      const rows = await ctx.runQuery(api.automations.pollGatewayCommands, {
        gatewayIdentifier,
      });
      return new Response(JSON.stringify(rows), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: getErrorMessage(e) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/gateways/commands/ack",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { commandId, gatewayIdentifier, status, error } = await request.json();
    if (status !== "sent" && status !== "failed") {
      return new Response(JSON.stringify({ error: "Invalid status" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const result = await ctx.runMutation(api.automations.ackGatewayCommand, {
        commandId,
        gatewayIdentifier,
        status,
        error,
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: getErrorMessage(e) }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: getErrorMessage(e) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: getErrorMessage(e) }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

export default http;
