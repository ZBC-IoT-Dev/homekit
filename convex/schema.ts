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
  gateways: defineTable({
    name: v.string(),
    identifier: v.string(),
    homeId: v.id("homes"),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("inactive"),
    ),
    lastSeen: v.number(),
    type: v.optional(v.string()), // e.g., "raspberry_pi_4"
  })
    .index("by_identifier", ["identifier"])
    .index("by_home", ["homeId"]),
  devices: defineTable({
    identifier: v.string(), // Device ID
    name: v.optional(v.string()), // Friendly name
    status: v.union(v.literal("pending"), v.literal("paired")),
    gatewayId: v.id("gateways"),
    homeId: v.id("homes"), // Linked Home
    type: v.string(),
    lastSeen: v.number(),
    data: v.optional(v.any()), // Sensor readings
  })
    .index("by_identifier", ["identifier"])
    .index("by_gateway", ["gatewayId"])
    .index("by_home", ["homeId"]), // For dashboard queries
  deviceTypes: defineTable({
    key: v.string(),
    name: v.string(),
    brand: v.string(),
    image: v.string(),
    description: v.string(),
    features: v.array(v.string()),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_enabled", ["enabled"]),
});
