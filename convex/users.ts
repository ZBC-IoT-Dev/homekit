import { v } from "convex/values";
import { query } from "./_generated/server";
import { components } from "./_generated/api";

export const getBatchUsers = query({
  args: { userIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    // Call the component's query
    // We assume the component is named "betterAuth" in `convex.config.ts`
    const users = await ctx.runQuery(
      components.betterAuth.users.getBatchUsers,
      {
        userIds: args.userIds,
      },
    );
    return users;
  },
});
