"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HomeDetails } from "@/components/settings/home-details";
import { MembersList } from "@/components/settings/members-list";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SettingsPage() {
  const home = useQuery(api.homes.getHome);

  if (!home) {
    return (
      <div className="flex flex-1 flex-col gap-8 p-8 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-8">
          <div className="grid gap-8 md:grid-cols-2">
            <Card>
              <CardHeader className="gap-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="gap-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>
      <div className="grid gap-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <HomeDetails home={home} />
          </div>
          <div className="space-y-6">
            <MembersList homeId={home._id} />
          </div>
        </div>
      </div>
    </div>
  );
}
