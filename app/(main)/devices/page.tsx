"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  Thermometer,
  Droplets,
  Zap,
  Box,
  Trash2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getProduct, mergeProductsWithBackend } from "@/lib/products";
import Image from "next/image";

type DeviceCardModel = {
  _id: Id<"devices">;
  identifier: string;
  type: string;
  status: "pending" | "paired";
  name?: string;
  lastSeen: number;
  data?: unknown;
};

export default function DevicesPage() {
  const home = useQuery(api.homes.getHome);
  const devices = useQuery(
    api.gateways.getHomeDevices,
    home ? { homeId: home._id } : "skip",
  );
  const backendDeviceTypes = useQuery(api.deviceTypes.listEnabled, {});

  const unpairDevice = useMutation(api.gateways.unpairDevice);

  const [selectedDevice, setSelectedDevice] = useState<DeviceCardModel | null>(
    null,
  );
  const productCatalog = useMemo(
    () => mergeProductsWithBackend(backendDeviceTypes),
    [backendDeviceTypes],
  );

  if (!home || !devices) {
    return (
      <div className="flex flex-1 flex-col gap-10 p-8 md:p-12 max-w-6xl mx-auto w-full">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pairedDevices = devices.filter((d) => d.status === "paired");

  const handleUnpair = async (deviceId: Id<"devices">) => {
    if (!confirm("Are you sure you want to remove this device?")) return;
    try {
      await unpairDevice({ deviceId });
      toast.success("Device removed");
    } catch {
      toast.error("Failed to remove device");
    }
  };

  const getDeviceIcon = (device: Pick<DeviceCardModel, "type">) => {
    const type = device.type.toLowerCase();
    if (type.includes("temp"))
      return <Thermometer className="h-5 w-5 text-orange-500" />;
    if (type.includes("humid"))
      return <Droplets className="h-5 w-5 text-blue-500" />;
    if (type.includes("power"))
      return <Zap className="h-5 w-5 text-yellow-500" />;
    return <Box className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 max-w-7xl mx-auto w-full">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
        <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-50">
          Hardware Cluster: {home.name}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 opacity-60">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-widest">
            Active Units
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pairedDevices.length === 0 ? (
            <Card className="col-span-full py-16 bg-muted/10 border-dashed border-border/50 rounded-2xl">
              <CardContent className="flex flex-col items-center gap-4 text-center">
                <Box className="h-10 w-10 text-muted-foreground/20" />
                <div className="space-y-1">
                  <p className="font-bold text-sm uppercase tracking-widest opacity-40">
                    No active units
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            pairedDevices.map((device) => {
              return (
                <Card
                  key={device._id}
                  className="group relative cursor-pointer hover:border-primary/20 transition-all shadow-none hover:shadow-2xl hover:-translate-y-0.5 rounded-2xl border-border/40 bg-card/50"
                  onClick={() => setSelectedDevice(device)}
                >
                  <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 space-y-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary/50 rounded-xl">
                        {getDeviceIcon(device)}
                      </div>
                      <div>
                        <CardTitle className="text-xs font-bold tracking-tight">
                          {device.name ||
                            (getProduct(
                              device.type,
                              device.identifier,
                              productCatalog,
                            ).id === "other"
                              ? device.identifier
                              : getProduct(
                                  device.type,
                                  device.identifier,
                                  productCatalog,
                                ).name)}
                        </CardTitle>
                        <p className="text-[9px] text-muted-foreground/40 font-mono tracking-tighter">
                          {device.identifier}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnpair(device._id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="grid grid-cols-2 gap-1.5 mb-3">
                      {device.data && typeof device.data === "object" ? (
                        Object.entries(device.data).map(([k, v]) => (
                          <div
                            key={k}
                            className="p-2 bg-muted/20 rounded-xl border border-border/30 flex flex-col gap-0"
                          >
                            <span className="text-[8px] text-muted-foreground/40 uppercase font-bold tracking-widest">
                              {k}
                            </span>
                            <span className="text-sm font-bold tabular-nums tracking-tight">
                              {String(v)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-2 p-2 bg-muted/20 rounded-xl border border-border/30">
                          <span className="text-[8px] text-muted-foreground/40 uppercase font-bold tracking-widest block">
                            Status
                          </span>
                          <span className="text-xs font-bold">
                            {String(device.data || "Active")}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[8px] text-muted-foreground/40 font-bold uppercase tracking-tighter pt-2 border-t border-border/30">
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5 opacity-50" />
                        {formatDistanceToNow(device.lastSeen)} ago
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="h-1 w-1 rounded-full bg-green-500/50" />
                        <span>Live</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Device Detail Dialog */}
      <Dialog
        open={!!selectedDevice}
        onOpenChange={(open) => !open && setSelectedDevice(null)}
      >
        <DialogContent className="sm:max-w-lg">
          {selectedDevice && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant="secondary"
                    className="rounded-sm text-[10px] font-bold uppercase tracking-widest px-1.5 h-5 bg-secondary/50"
                  >
                    {
                      getProduct(
                        selectedDevice.type,
                        selectedDevice.identifier,
                        productCatalog,
                      ).brand
                    }
                  </Badge>
                  <span className="text-[10px] text-muted-foreground/50 font-mono tracking-tighter">
                    {selectedDevice.identifier}
                  </span>
                </div>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  {selectedDevice.name ||
                    (getProduct(
                      selectedDevice.type,
                      selectedDevice.identifier,
                      productCatalog,
                    ).id === "other"
                      ? selectedDevice.identifier
                      : getProduct(
                          selectedDevice.type,
                          selectedDevice.identifier,
                          productCatalog,
                        ).name)}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Hardware status and technical specifications.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 py-4">
                <div className="aspect-video w-full bg-muted/20 rounded-xl flex items-center justify-center border border-border/50 overflow-hidden">
                  <Image
                    src={
                      getProduct(
                        selectedDevice.type,
                        selectedDevice.identifier,
                        productCatalog,
                      ).image
                    }
                    alt={
                      getProduct(
                        selectedDevice.type,
                        selectedDevice.identifier,
                        productCatalog,
                      ).name
                    }
                    width={200}
                    height={200}
                    className="object-contain opacity-90"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {selectedDevice.data &&
                  typeof selectedDevice.data === "object" ? (
                    Object.entries(selectedDevice.data).map(([k, v]) => (
                      <div
                        key={k}
                        className="p-3 bg-muted/20 rounded-xl border border-border/50 flex flex-col gap-0.5"
                      >
                        <div className="flex items-center gap-2 text-muted-foreground/60 mb-0.5">
                          {k.toLowerCase().includes("temp") ? (
                            <Thermometer className="h-3 w-3" />
                          ) : k.toLowerCase().includes("humid") ? (
                            <Droplets className="h-3 w-3" />
                          ) : (
                            <Activity className="h-3 w-3" />
                          )}
                          <span className="text-[9px] font-bold uppercase tracking-wider">
                            {k}
                          </span>
                        </div>
                        <span className="text-xl font-semibold tabular-nums tracking-tight">
                          {String(v)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 p-3 bg-muted/20 rounded-xl border border-border/50">
                      <span className="text-[9px] font-bold text-muted-foreground/60 uppercase mb-1 block tracking-wider">
                        Status
                      </span>
                      <span className="text-base font-semibold italic">
                        {String(selectedDevice.data || "Operational")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 pl-1">
                    Technical Detail
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2.5 bg-muted/10 rounded-lg flex flex-col gap-0.5">
                      <span className="text-muted-foreground/40 uppercase font-medium">
                        Protocol
                      </span>
                      <span className="font-semibold">MQTT</span>
                    </div>
                    <div className="p-2.5 bg-muted/10 rounded-lg flex flex-col gap-0.5">
                      <span className="text-muted-foreground/40 uppercase font-medium">
                        Last Seen
                      </span>
                      <span className="font-semibold">
                        {formatDistanceToNow(selectedDevice.lastSeen)} ago
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between sm:justify-between w-full border-t border-border/40 pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("Remove this device from your home?")) {
                      handleUnpair(selectedDevice._id);
                      setSelectedDevice(null);
                    }
                  }}
                  className="text-destructive/60 hover:text-destructive hover:bg-destructive/5 font-bold text-[10px] uppercase h-8 px-3"
                >
                  Unpair unit
                </Button>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500/60" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">
                    Online
                  </span>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
