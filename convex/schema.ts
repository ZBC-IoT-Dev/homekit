import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  homes: defineTable({
    name: v.string(),
    userId: v.string(),
  }).index("by_user", ["userId"]),
});
