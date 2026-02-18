"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Zap, Activity } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { sendHubWebSocketCommand } from "@/lib/hub-websocket";

interface DeviceItem {
  _id: Id<"devices">;
  name: string;
  type: string;
  isOnline: boolean;
  data?: unknown;
  identifier: string;
}

interface ControlPanelProps {
  devices: DeviceItem[];
}

export function ControlPanel({ devices }: ControlPanelProps) {
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const lights = devices.filter((d) =>
    ["light", "power", "switch", "relay", "outlet"].some((t) =>
      d.type.toLowerCase().includes(t),
    ),
  );

  const sensors = devices.filter((d) =>
    ["motion", "pir", "contact", "door"].some((t) =>
      d.type.toLowerCase().includes(t),
    ),
  );

  const toggleLight = async (device: DeviceItem, currentState: boolean) => {
    const newState = !currentState;
    const commandState = newState ? "ON" : "OFF";
    const action = newState ? "light_fx_on" : "light_fx_off";

    setLoadingIds((prev) => new Set(prev).add(device._id));

    try {
      const result = await sendHubWebSocketCommand({
        deviceId: device.identifier,
        action: action,
        command: {
          state: commandState,
          fx: commandState,
        },
      });

      if (result.status !== "sent") {
        throw new Error(result.error || "Command failed");
      }
      toast.success(`${device.name} ${newState ? "tændt" : "slukket"}`);
    } catch (e) {
      toast.error("Kunne ikke skifte status");
      console.error(e);
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(device._id);
        return next;
      });
    }
  };

  const getDeviceState = (device: DeviceItem): boolean => {
    const data = device.data as Record<string, unknown>;
    if (!data) return false;

    const val = data.state || data.isOn || data.value;
    if (typeof val === "boolean") return val;
    if (typeof val === "string")
      return ["on", "true", "active"].includes(val.toLowerCase());
    if (typeof val === "number") return val > 0;
    return false;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Lys & Strøm
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {lights.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ingen enheder fundet.
            </p>
          )}
          {lights.map((device) => {
            const isOn = getDeviceState(device);
            const isLoading = loadingIds.has(device._id);
            return (
              <div
                key={device._id}
                className="flex items-center justify-between space-x-4 rounded-md border p-3"
              >
                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium leading-none">
                    {device.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {device.isOnline ? "Online" : "Offline"}
                  </span>
                </div>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    checked={isOn}
                    onCheckedChange={() => toggleLight(device, isOn)}
                    disabled={!device.isOnline}
                  />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            Sensor Status
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {sensors.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ingen sensorer fundet.
            </p>
          )}
          {sensors.map((device) => {
            const isActive = getDeviceState(device);
            return (
              <div
                key={device._id}
                className="flex items-center justify-between space-x-4 rounded-md border p-3 bg-muted/20"
              >
                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium leading-none">
                    {device.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {device.type.includes("motion") ? "Bevægelse" : "Status"}
                  </span>
                </div>
                <div
                  className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${isActive ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${isActive ? "bg-red-500" : "bg-green-500"}`}
                  />
                  {isActive ? "Aktiv" : "Klar"}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
