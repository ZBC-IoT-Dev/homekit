import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Update getHome to check membership
export const getHome = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Find where user is a member
    const membership = await ctx.db
      .query("home_members")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (!membership) return null;

    const home = await ctx.db.get(membership.homeId);
    return home;
  },
});

export const getHomes = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const memberships = await ctx.db
      .query("home_members")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const homes = await Promise.all(
      memberships.map((m) => ctx.db.get(m.homeId)),
    );

    return homes.filter((h) => h !== null);
  },
});

export const createHome = mutation({
  args: {
    name: v.string(),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // specific random code generator
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const homeId = await ctx.db.insert("homes", {
      name: args.name,
      address: args.address,
      userId: identity.subject, // creator/owner
      inviteCode,
    });

    // Add creator as admin member
    await ctx.db.insert("home_members", {
      homeId,
      userId: identity.subject,
      role: "admin",
    });

    return homeId;
  },
});

export const joinHome = mutation({
  args: {
    inviteCode: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const home = await ctx.db
      .query("homes")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.inviteCode))
      .first();

    if (!home) {
      throw new Error("Invalid invite code");
    }

    // Check if already a member
    const existing = await ctx.db
      .query("home_members")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("homeId"), home._id)) // although strictly we only allow 1 home per user?
      // User request says "join a room". Usually IoT apps have 1 active home.
      // But let's assume multiple memberships are possible technically, but getHome returns first.
      .first();

    if (existing) {
      if (existing.homeId === home._id) return home._id; // already joined
      // If we want to support multiple homes, we should change getHome to getHomes or returns list.
      // For now, let's stick to single home per user for simplicity as `getHome` returns single.
    }

    // If user already has a home, maybe prevent joining another?
    // Or switch active home.
    // For now, just insert.

    await ctx.db.insert("home_members", {
      homeId: home._id,
      userId: identity.subject,
      role: "member",
    });

    return home._id;
  },
});

export const getMembers = query({
  args: { homeId: v.id("homes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Check membership
    const membership = await ctx.db
      .query("home_members")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("homeId"), args.homeId))
      .first();

    if (!membership) throw new Error("Not a member of this home");

    const members = await ctx.db
      .query("home_members")
      .withIndex("by_home", (q) => q.eq("homeId", args.homeId))
      .collect();

    // Fetch user details for each member
    // Since users are in Better Auth 'user' table (namespaced in betterAuth component?)
    // Wait, the better-auth tables are in the component. We can't access them directly easily unless we expose them?
    // Or we use the `authComponent`.
    // Actually, `ctx.db.query("betterAuth_user")`? No.
    // The instructions say "Convex components can be installed from NPM or a local folder."
    // If local, maybe we can query the tables?
    // BUT better-auth uses its own schema.
    // We might need an internal function in `convex/betterAuth/` to fetch users by IDs?

    // For now, let's just return the member with userId. The UI might need to fetch user details separately or we improve this.
    // Actually, better-auth provides `auth.api.listUsers`? No.

    // Let's rely on finding the user info.
    // If better-auth stores users in `user` table, and `convex/betterAuth/schema.ts` defines `user`.
    // Can we query `user` table from `homes.ts`?
    // If `betterAuth` is a component, its tables are isolated usually.
    // But since it's a local component (folder), maybe they are shared?
    // "create a `convex/betterAuth/convex.config.ts` file to define the component. This will signal to Convex that the `convex/betterAuth` directory is a locally installed component."
    // Components have isolated data.

    // We should export a function from `betterAuth` component to get users by IDs.
    // `convex/betterAuth/api.ts`?

    // Let's create `convex/betterAuth/users.ts` with a query `getUsersByIds`.
    // And call it from client? Or call it from `homes.ts` (cross-component call)?
    // Cross-component calls are `ctx.runQuery`?

    // Let's return just `members` (userIds) for now and let the client fetch user details via `authClient` or a separate query if possible.
    // Better Auth client has `useSession` but not generic "get user info".
    // We probably need a function in `convex/betterAuth/users.ts`.

    return members;
  },
});

export const updateHome = mutation({
  args: {
    id: v.id("homes"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const home = await ctx.db.get(args.id);
    if (!home) throw new Error("Home not found");
    if (home.userId !== identity.subject) throw new Error("Unauthorized");

    await ctx.db.patch(args.id, {
      name: args.name,
      address: args.address,
    });
  },
});

export const deleteHome = mutation({
  args: { id: v.id("homes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const home = await ctx.db.get(args.id);
    if (!home) throw new Error("Home not found");

    // Only owner can delete
    if (home.userId !== identity.subject) {
      throw new Error("Only the home owner can delete this home");
    }

    // Delete all members associations
    const members = await ctx.db
      .query("home_members")
      .withIndex("by_home", (q) => q.eq("homeId", args.id))
      .collect();

    await Promise.all(members.map((m) => ctx.db.delete(m._id)));

    // Delete the home
    await ctx.db.delete(args.id);
  },
});
