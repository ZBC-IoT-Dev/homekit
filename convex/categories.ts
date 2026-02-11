import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

function normalizeName(value: string) {
  return value.trim();
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function requireCategoryAdminAccess(
  ctx: MutationCtx,
  homeId: Id<"homes">,
  userId: string,
) {
  const home = await ctx.db.get(homeId);
  if (!home) {
    throw new ConvexError("Home not found");
  }

  const membership = await ctx.db
    .query("home_members")
    .withIndex("by_home", (q) => q.eq("homeId", homeId))
    .filter((q) => q.eq(q.field("userId"), userId))
    .first();

  const isOwner = home.userId === userId;
  if (!isOwner && membership?.role !== "admin") {
    throw new ConvexError("Only admins can manage categories");
  }

  return home;
}

export const listByHome = query({
  args: { homeId: v.id("homes") },
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
      .query("categories")
      .withIndex("by_home", (q) => q.eq("homeId", args.homeId))
      .collect();

    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getBySlug = query({
  args: {
    homeId: v.id("homes"),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const normalizedSlug = slugify(args.slug);
    if (!normalizedSlug) {
      return null;
    }

    const row = await ctx.db
      .query("categories")
      .withIndex("by_home_and_slug", (q) =>
        q.eq("homeId", args.homeId).eq("slug", normalizedSlug),
      )
      .first();

    return row ?? null;
  },
});

export const create = mutation({
  args: {
    homeId: v.id("homes"),
    name: v.string(),
    deviceTypeKey: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    await requireCategoryAdminAccess(ctx, args.homeId, identity.subject);

    const normalizedName = normalizeName(args.name);
    const normalizedDeviceTypeKey = normalizeKey(args.deviceTypeKey);
    if (!normalizedName) {
      throw new ConvexError("Category name is required");
    }
    if (!normalizedDeviceTypeKey) {
      throw new ConvexError("Device type is required");
    }

    const deviceType = await ctx.db
      .query("deviceTypes")
      .withIndex("by_key", (q) => q.eq("key", normalizedDeviceTypeKey))
      .first();

    // Allow built-in fallback device keys even when no backend type row exists.
    const builtinTypeKeys = new Set([
      "temp",
      "humid",
      "climatesensor",
      "climate",
      "climate_sensor",
      "power",
      "other",
    ]);
    const isBuiltinType = builtinTypeKeys.has(normalizedDeviceTypeKey);

    if (!isBuiltinType && (!deviceType || deviceType.enabled === false)) {
      throw new ConvexError("Device type is invalid");
    }

    const baseSlug = slugify(normalizedName);
    if (!baseSlug) {
      throw new ConvexError("Category name is invalid");
    }

    let slug = baseSlug;
    let suffix = 1;
    while (
      await ctx.db
        .query("categories")
        .withIndex("by_home_and_slug", (q) =>
          q.eq("homeId", args.homeId).eq("slug", slug),
        )
        .first()
    ) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const now = Date.now();
    const id = await ctx.db.insert("categories", {
      homeId: args.homeId,
      name: normalizedName,
      slug,
      deviceTypeKey: normalizedDeviceTypeKey,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const rename = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new ConvexError("Category not found");
    }

    await requireCategoryAdminAccess(ctx, category.homeId, identity.subject);

    const normalizedName = normalizeName(args.name);
    if (!normalizedName) {
      throw new ConvexError("Category name is required");
    }

    const baseSlug = slugify(normalizedName);
    if (!baseSlug) {
      throw new ConvexError("Category name is invalid");
    }

    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_home_and_slug", (q) =>
          q.eq("homeId", category.homeId).eq("slug", slug),
        )
        .first();
      if (!existing || existing._id === args.categoryId) {
        break;
      }
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    await ctx.db.patch(args.categoryId, {
      name: normalizedName,
      slug,
      updatedAt: Date.now(),
    });

    return args.categoryId;
  },
});

export const remove = mutation({
  args: {
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new ConvexError("Category not found");
    }

    await requireCategoryAdminAccess(ctx, category.homeId, identity.subject);
    await ctx.db.delete(args.categoryId);

    return args.categoryId;
  },
});
