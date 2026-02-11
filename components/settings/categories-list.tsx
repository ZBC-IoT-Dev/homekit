"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { CategoryActions } from "@/components/category-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Folder } from "lucide-react";
import { mergeProductsWithBackend } from "@/lib/products";

export function CategoriesList({ homeId }: { homeId: Id<"homes"> }) {
  const categories = useQuery(api.categories.listByHome, { homeId });
  const backendDeviceTypes = useQuery(api.deviceTypes.listEnabled, {});
  const productCatalog = useMemo(
    () => mergeProductsWithBackend(backendDeviceTypes),
    [backendDeviceTypes],
  );

  if (!categories) {
    return null;
  }

  if (categories.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <Folder className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Ingen kategorier endnu</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="divide-y p-0">
        {categories.map((category) => {
          const product = productCatalog.find(
            (item) => item.id === category.deviceTypeKey,
          );

          return (
            <div
              key={category._id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{category.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Enhedstype: {product?.name ?? category.deviceTypeKey}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  {category.deviceTypeKey}
                </Badge>
                <CategoryActions
                  categoryId={category._id}
                  categoryName={category.name}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
