import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api";

const DEVICE_OFFLINE_AFTER_MS = 60 * 1000;

function normalizeDeviceType(type: string | undefined) {
  const normalized = type?.toLowerCase().trim();
  return normalized && normalized.length > 0 ? normalized : "other";
}

function attachGatewayToPayloadData(
  data: unknown,
  gatewayIdentifier: string,
): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  const record = data as Record<string, unknown>;
  const currentHubId = record.hubId;
  const missingHubId =
    currentHubId === undefined ||
    currentHubId === null ||
    String(currentHubId).trim().length === 0;

  if (!missingHubId) {
    return data;
  }

  return {
    ...record,
    hubId: gatewayIdentifier,
  };
}

// Register a new gateway (called by the Raspberry Pi)
export const register = mutation({
  args: {
    inviteCode: v.string(),
    identifier: v.string(),
    name: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Find the home by invite code
    const home = await ctx.db
      .query("homes")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.inviteCode))
      .first();

    if (!home) {
      throw new ConvexError("Invalid invite code");
    }

    // 2. Check if a gateway with this identifier already exists
    const existingGateway = await ctx.db
      .query("gateways")
      .withIndex("by_identifier", (q) => q.eq("identifier", args.identifier))
      .first();

    if (existingGateway) {
      // If it exists but is in a different home, that's a conflict
      if (existingGateway.homeId !== home._id) {
        throw new ConvexError("Gateway is already registered to another home");
      }

      // If it exists in this home, simply update it (e.g. name might have changed or re-registering)
      // We don't reset status if it's already active
      await ctx.db.patch(existingGateway._id, {
        name: args.name,
        lastSeen: Date.now(),
        type: args.type,
      });

      return { gatewayId: existingGateway._id, status: existingGateway.status };
    }

    // 3. Create new pending gateway
    const gatewayId = await ctx.db.insert("gateways", {
      name: args.name,
      identifier: args.identifier,
      homeId: home._id,
      status: "pending",
      lastSeen: Date.now(),
      type: args.type || "raspberry_pi",
    });

    return { gatewayId, status: "pending" };
  },
});

// Update heartbeat (called by the user/device to keep it 'online')
export const heartbeat = mutation({
  args: {
    identifier: v.string(),
  },
  handler: async (ctx, args) => {
    const gateway = await ctx.db
      .query("gateways")
      .withIndex("by_identifier", (q) => q.eq("identifier", args.identifier))
      .first();

    if (!gateway) {
      throw new ConvexError("Gateway not found");
    }

    await ctx.db.patch(gateway._id, {
      lastSeen: Date.now(),
    });

    return { status: gateway.status };
  },
});

// List gateways for a home (called by Dashboard or App via Invite Code)
export const get = query({
  args: {
    homeId: v.optional(v.id("homes")),
    inviteCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let homeId = args.homeId;

    // 1. If invite code is provided, use it to find the home (Public Access with Code)
    if (args.inviteCode) {
      const home = await ctx.db
        .query("homes")
        .withIndex("by_invite_code", (q) =>
          q.eq("inviteCode", args.inviteCode!),
        )
        .first();

      if (!home) {
        throw new ConvexError("Invalid invite code");
      }
      homeId = home._id;
    }
    // 2. If no invite code, require Authentication and Home ID
    else {
      if (!homeId) {
        throw new ConvexError("Must provide homeId or inviteCode");
      }

      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Unauthenticated");
      }

      // Verify user is a member or owner
      const membership = await ctx.db
        .query("home_members")
        .withIndex("by_home", (q) => q.eq("homeId", homeId!))
        .filter((q) => q.eq(q.field("userId"), identity.subject))
        .first();

      if (!membership) {
        const home = await ctx.db.get(homeId!);
        if (!home || home.userId !== identity.subject) {
          throw new ConvexError("Unauthorized");
        }
      }
    }

    if (!homeId) return []; // Should be caught above, but for safety

    const gateways = await ctx.db
      .query("gateways")
      .withIndex("by_home", (q) => q.eq("homeId", homeId!))
      .collect();

    return gateways;
  },
});

// Approve or Reject a gateway (called by Dashboard)
export const updateStatus = mutation({
  args: {
    gatewayId: v.id("gateways"),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("pending"),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const gateway = await ctx.db.get(args.gatewayId);
    if (!gateway) {
      throw new ConvexError("Gateway not found");
    }

    // Check permissions
    const home = await ctx.db.get(gateway.homeId);
    if (!home) throw new ConvexError("Home not found");

    const isOwner = home.userId === identity.subject;
    // Or check membership role
    const membership = await ctx.db
      .query("home_members")
      .withIndex("by_home", (q) => q.eq("homeId", gateway.homeId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    if (!isOwner && membership?.role !== "admin") {
      throw new ConvexError("Only admins can manage gateways");
    }

    await ctx.db.patch(args.gatewayId, {
      status: args.status,
    });
  },
});

export const remove = mutation({
  args: {
    gatewayId: v.id("gateways"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const gateway = await ctx.db.get(args.gatewayId);
    if (!gateway) {
      throw new ConvexError("Gateway not found");
    }

    // Check permissions (same logic as updateStatus)
    const home = await ctx.db.get(gateway.homeId);
    if (!home) throw new ConvexError("Home not found");

    const isOwner = home.userId === identity.subject;
    const membership = await ctx.db
      .query("home_members")
      .withIndex("by_home", (q) => q.eq("homeId", gateway.homeId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    if (!isOwner && membership?.role !== "admin") {
      throw new ConvexError("Only admins can delete gateways");
    }

    await ctx.db.delete(args.gatewayId);
  },
});

export const logDeviceData = mutation({
  args: {
    identifier: v.string(),
    type: v.string(),
    data: v.optional(v.any()),
    gatewayIdentifier: v.string(), // Required to link to Home
  },
  handler: async (ctx, args) => {
    const normalizedType = normalizeDeviceType(args.type);
    const normalizedData = attachGatewayToPayloadData(
      args.data,
      args.gatewayIdentifier,
    );

    // 1. Verify Gateway Exists & Get Home ID
    const gateway = await ctx.db
      .query("gateways")
      .withIndex("by_identifier", (q) =>
        q.eq("identifier", args.gatewayIdentifier),
      )
      .first();

    if (!gateway) {
      console.error(
        "Device data received from unknown gateway:",
        args.gatewayIdentifier,
      );
      return;
    }

    // 2. Check if device already exists
    const existingDevice = await ctx.db
      .query("devices")
      .withIndex("by_identifier", (q) => q.eq("identifier", args.identifier))
      .first();

    if (existingDevice) {
      // Don't change status if it's already paired
      const updates = {
        type: normalizedType,
        lastSeen: Date.now(),
        data: normalizedData,
        gatewayId: gateway._id,
        homeId: gateway.homeId,
      };

      await ctx.db.patch(existingDevice._id, updates);
    } else {
      await ctx.db.insert("devices", {
        identifier: args.identifier,
        gatewayId: gateway._id,
        homeId: gateway.homeId,
        type: normalizedType,
        status: "pending",
        lastSeen: Date.now(),
        data: normalizedData,
      });
    }

    // 3. Log History (Measurements)
    if (normalizedData && typeof normalizedData === "object") {
      const record = normalizedData as Record<string, unknown>;
      const timestamp = Date.now();
      const deviceId =
        existingDevice?._id ??
        (
          await ctx.db
            .query("devices")
            .withIndex("by_identifier", (q) =>
              q.eq("identifier", args.identifier),
            )
            .first()
        )?._id;

      if (deviceId) {
        // Define keys we want to track historically
        const numericKeys = [
          "temp",
          "temperature",
          "humid",
          "humidity",
          "co2",
          "battery",
        ];
        const discreteKeys = ["motion", "occupancy"];

        for (const [key, val] of Object.entries(record)) {
          const normalizedKey = key.toLowerCase();

          if (numericKeys.includes(normalizedKey) && typeof val === "number") {
            await ctx.db.insert("measurements", {
              deviceId,
              type: normalizedKey === "temperature" ? "temp" : normalizedKey,
              value: val,
              timestamp,
            });
          } else if (discreteKeys.includes(normalizedKey)) {
            let numVal = -1;
            if (typeof val === "boolean") numVal = val ? 1 : 0;
            if (val === "true" || val === "active" || val === "motion")
              numVal = 1;
            if (val === "false" || val === "inactive" || val === "clear")
              numVal = 0;

            if (numVal !== -1) {
              await ctx.db.insert("measurements", {
                deviceId,
                type: normalizedKey,
                value: numVal,
                timestamp,
              });
            }
          }
        }
      }
    }

    try {
      await ctx.runMutation(api.automations.evaluateForDeviceUpdate, {
        homeId: gateway.homeId,
        triggerDeviceIdentifier: args.identifier,
        triggerData: normalizedData,
      });
    } catch (error) {
      console.error("Automation evaluation failed:", error);
    }
  },
});

export const getHomeDevices = query({
  args: {
    homeId: v.id("homes"),
    nowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check optional if we assume component handles it, but better to be safe
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Check membership
    const membership = await ctx.db
      .query("home_members")
      .withIndex("by_home", (q) => q.eq("homeId", args.homeId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    if (!membership) {
      const home = await ctx.db.get(args.homeId);
      if (!home || home.userId !== identity.subject) {
        throw new ConvexError("Unauthorized");
      }
    }

    const devices = await ctx.db
      .query("devices")
      .withIndex("by_home", (q) => q.eq("homeId", args.homeId))
      .collect();

    const referenceNowMs =
      args.nowMs !== undefined && Number.isFinite(args.nowMs)
        ? args.nowMs
        : Date.now();

    return devices.map((device) => ({
      ...device,
      isOnline: referenceNowMs - device.lastSeen < DEVICE_OFFLINE_AFTER_MS,
    }));
  },
});

// Gateway-facing query for syncing paired device memory on boot/reconnect.
export const getGatewayPairedDevices = query({
  args: {
    gatewayIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const gateway = await ctx.db
      .query("gateways")
      .withIndex("by_identifier", (q) =>
        q.eq("identifier", args.gatewayIdentifier),
      )
      .first();

    if (!gateway) {
      return [];
    }

    const homeDevices = await ctx.db
      .query("devices")
      .withIndex("by_home", (q) => q.eq("homeId", gateway.homeId))
      .collect();

    return homeDevices
      .filter((device) => device.status === "paired")
      .map((device) => ({
        identifier: device.identifier,
        type: device.type,
        name: device.name,
        lastSeen: device.lastSeen,
      }));
  },
});

export const pairDevice = mutation({
  args: {
    deviceId: v.id("devices"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      throw new ConvexError("Device not found");
    }

    // Check permissions (same as updateStatus/remove)
    const home = await ctx.db.get(device.homeId);
    if (!home) throw new ConvexError("Home not found");

    const isOwner = home.userId === identity.subject;
    const membership = await ctx.db
      .query("home_members")
      .withIndex("by_home", (q) => q.eq("homeId", device.homeId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    if (!isOwner && membership?.role !== "admin") {
      throw new ConvexError("Only admins can pair devices");
    }

    const gateway = await ctx.db.get(device.gatewayId);
    const normalizedData = gateway
      ? attachGatewayToPayloadData(device.data, gateway.identifier)
      : device.data;

    await ctx.db.patch(args.deviceId, {
      status: "paired",
      name: args.name,
      data: normalizedData,
    });
  },
});

export const unpairDevice = mutation({
  args: {
    deviceId: v.id("devices"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      throw new ConvexError("Device not found");
    }

    // Check permissions
    const home = await ctx.db.get(device.homeId);
    if (!home) throw new ConvexError("Home not found");

    const isOwner = home.userId === identity.subject;
    const membership = await ctx.db
      .query("home_members")
      .withIndex("by_home", (q) => q.eq("homeId", device.homeId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    if (!isOwner && membership?.role !== "admin") {
      throw new ConvexError("Only admins can unpair devices");
    }

    // We can either delete it or set status back to pending
    // Let's delete it so it can be re-discovered if it pulses again
    await ctx.db.delete(args.deviceId);
  },
});
