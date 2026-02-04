"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function MembersList({ homeId }: { homeId: any }) {
  const members = useQuery(api.homes.getMembers, { homeId });

  const userIds = members ? members.map((m) => m.userId) : [];
  const users = useQuery(
    api.users.getBatchUsers,
    members ? { userIds } : "skip",
  );

  if (!members || !users) {
    return (
      <div className="space-y-3 max-w-2xl mx-auto">
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

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="divide-y divide-border/30">
        {users.map((user: any) => {
          const member = members.find((m) => m.userId === user.userId);
          const role = member?.role || "Member";
          const isAdmin = role === "admin";

          return (
            <div
              key={user.userId}
              className="flex items-center gap-3 py-3 group hover:bg-muted/5 transition-colors rounded-lg px-2 -mx-2"
            >
              <Avatar className="h-9 w-9 border border-border/50">
                <AvatarImage src={user.image || ""} />
                <AvatarFallback className="text-[10px] font-bold">
                  {user.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-foreground truncate">
                    {user.name}
                  </p>
                  {isAdmin && (
                    <span className="text-[10px] text-muted-foreground uppercase tracking-tighter font-bold">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate opacity-70">
                  {user.email}
                </p>
              </div>
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/50 group-hover:text-foreground transition-colors",
                  isAdmin && "text-primary/70",
                )}
              >
                {isAdmin ? (
                  <Shield className="h-3.5 w-3.5" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
