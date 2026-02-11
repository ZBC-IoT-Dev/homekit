"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HomeDetails } from "@/components/settings/home-details";
import { MembersList } from "@/components/settings/members-list";
import { GatewaysList } from "@/components/settings/gateways-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Router } from "lucide-react";

export default function SettingsPage() {
  const home = useQuery(api.homes.getHome);

  if (!home) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="space-y-1">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="space-y-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your home environment and members.
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-4 grid w-full grid-cols-3">
          <TabsTrigger value="general" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Members
          </TabsTrigger>
          <TabsTrigger value="gateways" className="gap-1.5">
            <Router className="h-3.5 w-3.5" />
            Gateways
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0 outline-none">
          <HomeDetails home={home} />
        </TabsContent>

        <TabsContent value="members" className="mt-0 outline-none">
          <MembersList homeId={home._id} />
        </TabsContent>

        <TabsContent value="gateways" className="mt-0 outline-none">
          <GatewaysList homeId={home._id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
