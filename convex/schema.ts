import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  homes: defineTable({
    name: v.string(),
    userId: v.string(),
    address: v.optional(v.string()),
    inviteCode: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_invite_code", ["inviteCode"]),
  home_members: defineTable({
    homeId: v.id("homes"),
    userId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  })
    .index("by_home", ["homeId"])
    .index("by_user", ["userId"]),
});
