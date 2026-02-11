"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Wifi, XCircle, Activity, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";
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
    if (confirm("Fjern gateway?")) {
      await removeGateway({ gatewayId });
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
      {gateways.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Wifi className="h-6 w-6 mb-2" />
          <p className="text-sm text-muted-foreground">
            Ingen gateways tilsluttet
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {gateways.map((gateway) => (
            <div
              key={gateway._id}
              className="group flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border",
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
                      <Badge variant="secondary">
                        Afventer
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {gateway.type || "Gateway"} •{" "}
                    {formatDistanceToNow(gateway.lastSeen, {
                      addSuffix: true,
                      locale: da,
                    })}
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
                    Godkend
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
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
                        Fjern
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </CardContent>
    </Card>
  );
}
