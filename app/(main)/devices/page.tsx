"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { Activity, Thermometer, Droplets, Zap, Box } from "lucide-react";

export default function DevicesPage() {
  const home = useQuery(api.homes.getHome);
  const devices = useQuery(
    api.gateways.getHomeDevices,
    home ? { homeId: home._id } : "skip",
  );

  if (!home || !devices) {
    return (
      <div className="flex flex-1 flex-col gap-10 p-8 md:p-12 max-w-6xl mx-auto w-full">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Helper to get icon based on device type or data
  const getDeviceIcon = (type: string) => {
    if (type.includes("temp"))
      return <Thermometer className="h-6 w-6 text-orange-500" />;
    if (type.includes("humid"))
      return <Droplets className="h-6 w-6 text-blue-500" />;
    if (type.includes("power"))
      return <Zap className="h-6 w-6 text-yellow-500" />;
    return <Box className="h-6 w-6 text-gray-500" />;
  };

  return (
    <div className="flex flex-1 flex-col gap-10 p-8 md:p-12 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Devices</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-wider font-medium">
            Live sensor data from {home.name}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {devices.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No devices found. Connect a gateway to start receiving data.
          </div>
        ) : (
          devices.map((device) => (
            <Card
              key={device._id}
              className="border shadow-sm hover:shadow-md transition-shadow"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {device.identifier}
                </CardTitle>
                {getDeviceIcon(device.type)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {/* Simple visualization of 'data' payload */}
                  {device.data && typeof device.data === "object" ? (
                    <div className="text-sm space-y-1 mt-2">
                      {Object.entries(device.data)
                        .slice(0, 3)
                        .map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-muted-foreground capitalize">
                              {k}:
                            </span>
                            <span className="font-mono">{String(v)}</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <span>{String(device.data || "No Data")}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  Updated {formatDistanceToNow(device.lastSeen)} ago
                </p>
                <div className="mt-2 text-xs text-muted-foreground bg-muted p-1 rounded px-2 inline-block">
                  Type: {device.type}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
