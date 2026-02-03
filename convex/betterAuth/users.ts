import { v } from "convex/values";
import { query } from "./_generated/server";
import { tables } from "./schema";

export const getBatchUsers = query({
  args: { userIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    // We need to query the 'user' table which is defined in schema.ts (tables variable).
    // In a component query, ctx.db accesses the component's data.

    // We can't do `ctx.db.getAll(ids)` because userIds are strings (Better Auth IDs), not Convex IDs.
    // So we need to query by index or just loop. 'user' table has index "userId".
    // Or we can use `Promise.all` with queries.

    const users = await Promise.all(
      args.userIds.map(async (userId) => {
        const user = await ctx.db
          .query("user")
          .withIndex("userId", (q) => q.eq("userId", userId))
          .unique();
        return user;
      }),
    );

    // Filter out nulls
    return users.filter((u) => u !== null);
  },
});
