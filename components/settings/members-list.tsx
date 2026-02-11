"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, User, Users } from "lucide-react";

type MemberRecord = {
  userId: string;
  role?: string;
};

type UserRecord = {
  userId: string;
  name?: string;
  email?: string;
  image?: string;
};

export function MembersList({ homeId }: { homeId: Id<"homes"> }) {
  const members = useQuery(api.homes.getMembers, { homeId });

  const userIds = members ? members.map((m) => m.userId) : [];
  const users = useQuery(
    api.users.getBatchUsers,
    members ? { userIds } : "skip",
  );

  if (!members || !users) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (members.length === 0 || users.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="mb-2 h-6 w-6" />
            <p className="text-sm text-muted-foreground">No members yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="divide-y p-0">
        {users.map((user) => {
          const typedUser = user as UserRecord;
          const member = (members as MemberRecord[]).find(
            (m) => m.userId === typedUser.userId,
          );
          const role = member?.role || "Member";
          const isAdmin = role === "admin";

          return (
            <div
              key={typedUser.userId}
              className="flex items-center gap-3 px-4 py-3"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={typedUser.image || ""} />
                <AvatarFallback className="text-xs font-semibold">
                  {typedUser.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-foreground truncate">
                    {typedUser.name}
                  </p>
                  {isAdmin && (
                    <span className="text-xs text-muted-foreground">
                      Admin
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {typedUser.email}
                </p>
              </div>
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                {isAdmin ? (
                  <Shield className="h-3.5 w-3.5" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
