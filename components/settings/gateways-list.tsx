"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wifi, XCircle, Activity, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function GatewaysList({ homeId }: { homeId: Id<"homes"> }) {
  const gateways = useQuery(api.gateways.get, { homeId });
  const updateStatus = useMutation(api.gateways.updateStatus);
  const removeGateway = useMutation(api.gateways.remove);

  if (!gateways) return null;

  const handleApprove = async (gatewayId: Id<"gateways">) => {
    await updateStatus({ gatewayId, status: "active" });
  };

  const handleReject = async (gatewayId: Id<"gateways">) => {
    if (confirm("Remove gateway?")) {
      await removeGateway({ gatewayId });
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      {gateways.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center opacity-60">
          <Wifi className="h-6 w-6 mb-2" />
          <p className="text-sm">No gateways connected</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {gateways.map((gateway) => (
            <div
              key={gateway._id}
              className="flex items-center justify-between py-3 group hover:bg-muted/5 transition-colors rounded-lg px-2 -mx-2"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center border border-border/50",
                    gateway.status === "active"
                      ? "text-green-500"
                      : "text-muted-foreground",
                  )}
                >
                  <Activity className="h-4 w-4" />
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{gateway.name}</h4>
                    {gateway.status === "pending" && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-4 uppercase tracking-tighter"
                      >
                        Pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground opacity-70">
                    {gateway.type || "Gateway"} •{" "}
                    {formatDistanceToNow(gateway.lastSeen)} ago
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {gateway.status === "pending" ? (
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => handleApprove(gateway._id)}
                  >
                    Approve
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleReject(gateway._id)}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
