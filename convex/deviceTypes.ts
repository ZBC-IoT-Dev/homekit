import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

function normalizeKey(input: string) {
  return input.toLowerCase().trim();
}

export const listEnabled = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("deviceTypes")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();

    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const rows = await ctx.db.query("deviceTypes").collect();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const upsert = mutation({
  args: {
    key: v.string(),
    name: v.string(),
    brand: v.string(),
    image: v.string(),
    description: v.string(),
    features: v.array(v.string()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const key = normalizeKey(args.key);
    if (!key) {
      throw new ConvexError("Device type key is required");
    }

    const now = Date.now();

    const existing = await ctx.db
      .query("deviceTypes")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        key,
        name: args.name,
        brand: args.brand,
        image: args.image,
        description: args.description,
        features: args.features,
        enabled: args.enabled ?? true,
        updatedAt: now,
      });
      return { id: existing._id, mode: "updated" as const };
    }

    const id = await ctx.db.insert("deviceTypes", {
      key,
      name: args.name,
      brand: args.brand,
      image: args.image,
      description: args.description,
      features: args.features,
      enabled: args.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });

    return { id, mode: "created" as const };
  },
});

export const remove = mutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const key = normalizeKey(args.key);
    const existing = await ctx.db
      .query("deviceTypes")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (!existing) {
      throw new ConvexError("Device type not found");
    }

    await ctx.db.delete(existing._id);
    return { success: true };
  },
});
