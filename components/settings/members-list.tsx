"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { components } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Skeleton } from "@/components/ui/skeleton";

export function MembersList({ homeId }: { homeId: any }) {
  const members = useQuery(api.homes.getMembers, { homeId });

  const userIds = members ? members.map((m) => m.userId) : [];
  const users = useQuery(
    api.users.getBatchUsers,
    members ? { userIds } : "skip",
  );

  if (!members || !users) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>People with access to this home.</CardDescription>
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
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>People with access to this home.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {users.map((user: any) => (
          <div
            key={user.userId}
            className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50"
          >
            <Avatar>
              <AvatarImage src={user.image || ""} />
              <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {/* Role could be found in members array matching userId */}
              {members.find((m) => m.userId === user.userId)?.role}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
