import { v } from "convex/values";
import { query } from "./_generated/server";
import { ConvexError } from "convex/values";

// Time ranges for charts
export const ONE_HOUR = 60 * 60 * 1000;
export const ONE_DAY = 24 * 60 * 60 * 1000;
export const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

export const getHistory = query({
  args: {
    deviceId: v.id("devices"),
    type: v.string(),
    duration: v.optional(v.number()), // default 24h
  },
  handler: async (ctx, args) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      throw new ConvexError("Device not found");
    }

    // Check membership
    const membership = await ctx.db
      .query("home_members")
      .withIndex("by_home", (q) => q.eq("homeId", device.homeId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    if (!membership) {
      const home = await ctx.db.get(device.homeId);
      if (!home || home.userId !== identity.subject) {
        throw new ConvexError("Unauthorized");
      }
    }

    const duration = args.duration || ONE_DAY;
    const since = Date.now() - duration;

    // 2. Fetch measurements
    // We use the index capabilities to fetch range
    const measurements = await ctx.db
      .query("measurements")
      .withIndex("by_device_type_time", (q) =>
        q
          .eq("deviceId", args.deviceId)
          .eq("type", args.type)
          .gte("timestamp", since),
      )
      .order("asc") // Oldest first for charts
      .collect(); // Limit if needed, but for < 24h usually fine

    return measurements.map((m) => ({
      timestamp: m.timestamp,
      value: m.value,
    }));
  },
});
