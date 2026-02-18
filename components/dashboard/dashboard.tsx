"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemperatureChart } from "./widgets/temperature-chart";
import { ControlPanel } from "./widgets/control-panel";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2 } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

type DashboardHome = {
  _id: Id<"homes">;
  name: string;
};

export function Dashboard({ home }: { home: DashboardHome }) {
  const devices = useQuery(api.gateways.getHomeDevices, { homeId: home._id });

  // Filter devices for chart (temp/humidity sensors)
  const chartDevices =
    devices
      ?.filter((d) => {
        const type = d.type.toLowerCase();
        return (
          type.includes("temp") ||
          type.includes("humid") ||
          type.includes("climate")
        );
      })
      .map((d) => ({
        id: d._id,
        name: d.name || d.identifier,
        type: d.type,
      })) || [];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Oversigt</h1>
        <p className="text-muted-foreground">
          Velkommen til{" "}
          <span className="font-medium text-foreground">{home.name}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <TemperatureChart devices={chartDevices} />
        </div>
        <div className="col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Hjemmestyring</CardTitle>
            </CardHeader>
            <CardContent>
              {devices ? (
                <ControlPanel
                  devices={devices.map((d) => ({
                    ...d,
                    name: d.name ?? d.identifier, // Fallback to identifier if name is missing
                  }))}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="animate-spin" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
