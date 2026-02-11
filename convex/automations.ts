import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

type TemperatureComparator = ">" | ">=" | "<" | "<=";
const MIN_NO_MOTION_DELAY_SECONDS = 30;

function normalizeRecord(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }
  return data as Record<string, unknown>;
}

function parseBooleanLike(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "on", "yes", "motion", "active"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "off", "no", "idle", "inactive"].includes(normalized)) {
      return false;
    }
  }
  return null;
}

function parseMotionValue(data: unknown): boolean | null {
  const payload = normalizeRecord(data);
  const candidates = ["motion", "state", "isOn", "ison"];
  for (const key of candidates) {
    if (key in payload) {
      const parsed = parseBooleanLike(payload[key]);
      if (parsed !== null) {
        return parsed;
      }
    }
  }
  return null;
}

function parseTemperatureValue(data: unknown): number | null {
  const payload = normalizeRecord(data);
  const lowerKeyMap = new Map<string, unknown>();
  for (const [key, value] of Object.entries(payload)) {
    lowerKeyMap.set(key.toLowerCase(), value);
  }

  const candidates = [
    "temp",
    "temperature",
    "tempc",
    "temperaturec",
    "celsius",
    "temperature_c",
    "temp_c",
  ];
  for (const key of candidates) {
    const value = Number(lowerKeyMap.get(key));
    if (Number.isFinite(value)) {
      return value;
    }
  }

  for (const [key, rawValue] of lowerKeyMap.entries()) {
    if (!key.includes("temp") && !key.includes("celsius")) {
      continue;
    }
    // Ignore Fahrenheit by default to keep thresholds in Celsius.
    if (key.includes("tempf") || key.includes("fahrenheit")) {
      continue;
    }
    const value = Number(rawValue);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  const nestedCandidates = ["payload", "data", "sensor", "readings"];
  for (const nestedKey of nestedCandidates) {
    const nested = lowerKeyMap.get(nestedKey);
    const nestedRecord = normalizeRecord(nested);
    if (Object.keys(nestedRecord).length === 0) continue;
    const nestedParsed = parseTemperatureValue(nestedRecord);
    if (nestedParsed !== null) {
      return nestedParsed;
    }
  }
  return null;
}

function compareTemperature(
  value: number,
  comparator: TemperatureComparator,
  threshold: number,
): boolean {
  if (comparator === ">") return value > threshold;
  if (comparator === ">=") return value >= threshold;
  if (comparator === "<") return value < threshold;
  return value <= threshold;
}

function buildCommandPayload(command: "turn_on" | "turn_off" | "toggle") {
  if (command === "turn_on") {
    return { state: "ON", fx: "ON" };
  }
  if (command === "turn_off") {
    return { state: "OFF", fx: "OFF" };
  }
  return { toggle: true };
}

export const list = query({
  args: {
    homeId: v.id("homes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }
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

    const rows = await ctx.db
      .query("automations")
      .withIndex("by_home", (q) => q.eq("homeId", args.homeId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const upsert = mutation({
  args: {
    automationId: v.optional(v.id("automations")),
    homeId: v.id("homes"),
    name: v.string(),
    enabled: v.boolean(),
    triggerType: v.union(v.literal("pir"), v.literal("temperature")),
    triggerDeviceId: v.id("devices"),
    temperatureComparator: v.optional(
      v.union(v.literal(">"), v.literal(">="), v.literal("<"), v.literal("<=")),
    ),
    temperatureThreshold: v.optional(v.number()),
    pirState: v.optional(v.union(v.literal("motion"), v.literal("no_motion"))),
    pirNoMotionDelaySeconds: v.optional(v.number()),
    trueTargetDeviceId: v.id("devices"),
    trueCommand: v.union(
      v.literal("turn_on"),
      v.literal("turn_off"),
      v.literal("toggle"),
    ),
    falseTargetDeviceId: v.optional(v.id("devices")),
    falseCommand: v.optional(
      v.union(v.literal("turn_on"), v.literal("turn_off"), v.literal("toggle")),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }
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

    if (args.triggerType === "temperature") {
      if (
        !args.temperatureComparator ||
        args.temperatureThreshold === undefined ||
        !Number.isFinite(args.temperatureThreshold)
      ) {
        throw new ConvexError("Temperature automation mangler comparator/threshold");
      }
    }

    if (args.triggerType === "pir" && !args.pirState) {
      throw new ConvexError("PIR automation mangler ønsket tilstand");
    }
    if (args.triggerType === "pir" && args.pirState === "no_motion") {
      if (
        args.pirNoMotionDelaySeconds === undefined ||
        !Number.isFinite(args.pirNoMotionDelaySeconds) ||
        args.pirNoMotionDelaySeconds < MIN_NO_MOTION_DELAY_SECONDS
      ) {
        throw new ConvexError("Ingen-bevaegelse tid skal vaere mindst 30 sekunder");
      }
    }

    const triggerDevice = await ctx.db.get(args.triggerDeviceId);
    const trueTargetDevice = await ctx.db.get(args.trueTargetDeviceId);
    const falseTargetDevice = args.falseTargetDeviceId
      ? await ctx.db.get(args.falseTargetDeviceId)
      : null;

    if (!triggerDevice || triggerDevice.homeId !== args.homeId) {
      throw new ConvexError("Ugyldig trigger-enhed");
    }
    if (!trueTargetDevice || trueTargetDevice.homeId !== args.homeId) {
      throw new ConvexError("Ugyldig true action-enhed");
    }
    if (
      args.falseTargetDeviceId &&
      (!falseTargetDevice || falseTargetDevice.homeId !== args.homeId)
    ) {
      throw new ConvexError("Ugyldig false action-enhed");
    }
    if (args.falseTargetDeviceId && !args.falseCommand) {
      throw new ConvexError("Mangler false action kommando");
    }
    if (!args.falseTargetDeviceId && args.falseCommand) {
      throw new ConvexError("Mangler false action enhed");
    }

    const now = Date.now();
    const payload = {
      homeId: args.homeId,
      name: args.name.trim() || "Automation",
      enabled: args.enabled,
      triggerType: args.triggerType,
      triggerDeviceId: args.triggerDeviceId,
      temperatureComparator: args.temperatureComparator,
      temperatureThreshold: args.temperatureThreshold,
      pirState: args.pirState,
      pirNoMotionDelaySeconds: args.pirNoMotionDelaySeconds,
      trueTargetDeviceId: args.trueTargetDeviceId,
      trueCommand: args.trueCommand,
      falseTargetDeviceId: args.falseTargetDeviceId,
      falseCommand: args.falseCommand,
      updatedAt: now,
    };

    if (args.automationId) {
      const existing = await ctx.db.get(args.automationId);
      if (!existing || existing.homeId !== args.homeId) {
        throw new ConvexError("Automation findes ikke");
      }
      await ctx.db.patch(args.automationId, payload);
      return args.automationId;
    }

    return await ctx.db.insert("automations", {
      ...payload,
      createdAt: now,
    });
  },
});

export const remove = mutation({
  args: {
    automationId: v.id("automations"),
  },
  handler: async (ctx, args) => {
    const automation = await ctx.db.get(args.automationId);
    if (!automation) {
      throw new ConvexError("Automation findes ikke");
    }
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }
    const membership = await ctx.db
      .query("home_members")
      .withIndex("by_home", (q) => q.eq("homeId", automation.homeId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();
    if (!membership) {
      const home = await ctx.db.get(automation.homeId);
      if (!home || home.userId !== identity.subject) {
        throw new ConvexError("Unauthorized");
      }
    }
    await ctx.db.delete(args.automationId);
  },
});

export const evaluateForDeviceUpdate = mutation({
  args: {
    homeId: v.id("homes"),
    triggerDeviceIdentifier: v.string(),
    triggerData: v.any(),
  },
  handler: async (ctx, args) => {
    const triggerDevice = await ctx.db
      .query("devices")
      .withIndex("by_identifier", (q) =>
        q.eq("identifier", args.triggerDeviceIdentifier),
      )
      .first();

    if (!triggerDevice || triggerDevice.homeId !== args.homeId) {
      return { evaluated: 0, queued: 0 };
    }

    const automations = await ctx.db
      .query("automations")
      .withIndex("by_home", (q) => q.eq("homeId", args.homeId))
      .collect();
    const pendingCommands = await ctx.db
      .query("gatewayCommands")
      .withIndex("by_home", (q) => q.eq("homeId", args.homeId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    const pendingByAutomation = new Map<string, Doc<"gatewayCommands">[]>();
    const hasPendingByAutomation = new Set<string>();
    for (const row of pendingCommands) {
      if (!row.automationId) continue;
      const key = row.automationId;
      const existing = pendingByAutomation.get(key);
      if (existing) {
        existing.push(row);
      } else {
        pendingByAutomation.set(key, [row]);
      }
      hasPendingByAutomation.add(key);
    }

    let evaluated = 0;
    let queued = 0;

    for (const automation of automations) {
      if (!automation.enabled) continue;
      if (automation.triggerDeviceId !== triggerDevice._id) continue;

      evaluated += 1;
      let outcome: boolean | null = null;

      if (automation.triggerType === "pir") {
        const motion = parseMotionValue(args.triggerData);
        if (motion === null) continue;
        const noMotionDelaySeconds =
          automation.pirState === "no_motion" &&
          Number.isFinite(automation.pirNoMotionDelaySeconds)
            ? Math.max(
                MIN_NO_MOTION_DELAY_SECONDS,
                Math.round(automation.pirNoMotionDelaySeconds!),
              )
            : 0;
        if (noMotionDelaySeconds >= MIN_NO_MOTION_DELAY_SECONDS) {
          const pendingForAutomation =
            pendingByAutomation.get(automation._id) || [];
          if (motion) {
            if (pendingForAutomation.length > 0) {
              await Promise.all(
                pendingForAutomation.map((pendingRow) => ctx.db.delete(pendingRow._id)),
              );
              pendingByAutomation.set(automation._id, []);
              hasPendingByAutomation.delete(automation._id);
            }
            if (automation.lastOutcome !== false) {
              await ctx.db.patch(automation._id, {
                lastOutcome: false,
                updatedAt: Date.now(),
              });
            }
            continue;
          }
          if (hasPendingByAutomation.has(automation._id)) {
            continue;
          }

          const targetDevice = await ctx.db.get(automation.trueTargetDeviceId);
          if (!targetDevice || targetDevice.homeId !== args.homeId) {
            continue;
          }
          const gateway = await ctx.db.get(targetDevice.gatewayId);
          if (!gateway || gateway.homeId !== args.homeId) {
            continue;
          }

          const now = Date.now();
          const executeAfter = now + noMotionDelaySeconds * 1000;
          await ctx.db.insert("gatewayCommands", {
            homeId: args.homeId,
            gatewayIdentifier: gateway.identifier,
            deviceIdentifier: targetDevice.identifier,
            command: buildCommandPayload(automation.trueCommand),
            status: "pending",
            automationId: automation._id,
            executeAfter,
            createdAt: now,
          });
          hasPendingByAutomation.add(automation._id);
          await ctx.db.patch(automation._id, {
            lastOutcome: true,
            updatedAt: now,
          });
          queued += 1;
          continue;
        }
        outcome = automation.pirState === "motion" ? motion : !motion;
      } else {
        const temp = parseTemperatureValue(args.triggerData);
        if (temp === null) continue;
        const comparator = automation.temperatureComparator;
        const threshold = automation.temperatureThreshold;
        if (!comparator || threshold === undefined) continue;
        outcome = compareTemperature(temp, comparator, threshold);
      }

      if (outcome === null) continue;
      if (automation.lastOutcome === outcome) continue;

      const targetDeviceId = outcome
        ? automation.trueTargetDeviceId
        : automation.falseTargetDeviceId;
      const command = outcome ? automation.trueCommand : automation.falseCommand;
      if (!targetDeviceId || !command) {
        await ctx.db.patch(automation._id, {
          lastOutcome: outcome,
          updatedAt: Date.now(),
        });
        continue;
      }
      const targetDevice: Doc<"devices"> | null = await ctx.db.get(targetDeviceId);
      if (!targetDevice || targetDevice.homeId !== args.homeId) {
        continue;
      }

      const gateway = await ctx.db.get(targetDevice.gatewayId);
      if (!gateway || gateway.homeId !== args.homeId) {
        continue;
      }

      await ctx.db.insert("gatewayCommands", {
        homeId: args.homeId,
        gatewayIdentifier: gateway.identifier,
        deviceIdentifier: targetDevice.identifier,
        command: buildCommandPayload(command),
        status: "pending",
        automationId: automation._id,
        executeAfter: Date.now(),
        createdAt: Date.now(),
      });

      await ctx.db.patch(automation._id, {
        lastOutcome: outcome,
        updatedAt: Date.now(),
      });
      queued += 1;
    }

    return { evaluated, queued };
  },
});

export const pollGatewayCommands = query({
  args: {
    gatewayIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("gatewayCommands")
      .withIndex("by_gateway_and_status", (q) =>
        q.eq("gatewayIdentifier", args.gatewayIdentifier).eq("status", "pending"),
      )
      .collect();

    return rows
      .filter((row) => !row.executeAfter || row.executeAfter <= now)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 25)
      .map((row) => ({
        id: row._id,
        deviceIdentifier: row.deviceIdentifier,
        command: row.command,
      }));
  },
});

export const ackGatewayCommand = mutation({
  args: {
    commandId: v.id("gatewayCommands"),
    gatewayIdentifier: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.commandId);
    if (!row) {
      throw new ConvexError("Command findes ikke");
    }
    if (row.gatewayIdentifier !== args.gatewayIdentifier) {
      throw new ConvexError("Gateway mismatch");
    }
    await ctx.db.patch(args.commandId, {
      status: args.status,
      error: args.error,
      sentAt: Date.now(),
    });
    return { success: true };
  },
});
