import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createHome = mutation({
  args: {
    name: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const homeId = await ctx.db.insert("homes", {
      name: args.name,
      userId: args.userId,
    });
    return homeId;
  },
});

export const getHomes = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const homes = await ctx.db
      .query("homes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return homes;
  },
});
