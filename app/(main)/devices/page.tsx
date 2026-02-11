"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";
import {
  Activity,
  Thermometer,
  Droplets,
  Zap,
  Power,
  Loader2,
  Box,
  Trash2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getProduct, mergeProductsWithBackend } from "@/lib/products";
import { middleTruncate } from "@/lib/utils";
import { sendHubWebSocketCommand } from "@/lib/hub-websocket";
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
  const searchParams = useSearchParams();
  const home = useQuery(api.homes.getHome);
  const categorySlug = searchParams.get("category");
  const devices = useQuery(
    api.gateways.getHomeDevices,
    home ? { homeId: home._id } : "skip",
  );
  const selectedCategory = useQuery(
    api.categories.getBySlug,
    home && categorySlug ? { homeId: home._id, slug: categorySlug } : "skip",
  );
  const backendDeviceTypes = useQuery(api.deviceTypes.listEnabled, {});

  const unpairDevice = useMutation(api.gateways.unpairDevice);

  const [selectedDevice, setSelectedDevice] = useState<DeviceCardModel | null>(
    null,
  );
  const [unpairTarget, setUnpairTarget] = useState<{
    id: Id<"devices">;
    closeDetails: boolean;
  } | null>(null);
  const [unpairing, setUnpairing] = useState(false);
  const [switchCommandLoading, setSwitchCommandLoading] = useState<
    "on" | "off" | null
  >(null);
  const productCatalog = useMemo(
    () => mergeProductsWithBackend(backendDeviceTypes),
    [backendDeviceTypes],
  );

  const resolveDevicePresentation = (device: DeviceCardModel) => {
    const product = getProduct(device.type, device.identifier, productCatalog);
    const displayName =
      device.name ||
      (product.id === "other" ? device.identifier : product.name);

    return { product, displayName };
  };

  if (!home || !devices) {
    return (
      <div className="flex flex-1 flex-col gap-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-40" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-52 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pairedDevices = devices.filter((d) => d.status === "paired");

  const handleUnpair = async (deviceId: Id<"devices">) => {
    try {
      setUnpairing(true);
      await unpairDevice({ deviceId });
      toast.success("Enhed fjernet");
      if (unpairTarget?.closeDetails) {
        setSelectedDevice(null);
      }
      setUnpairTarget(null);
    } catch {
      toast.error("Kunne ikke fjerne enhed");
    } finally {
      setUnpairing(false);
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
    if (
      type.includes("onoffsensor") ||
      type.includes("pir") ||
      type.includes("motion")
    ) {
      return <Activity className="h-5 w-5 text-violet-500" />;
    }
    return <Box className="h-5 w-5 text-muted-foreground" />;
  };

  const isMotionLikeType = (type: string) => {
    const normalizedType = type.toLowerCase();
    return (
      normalizedType.includes("onoffsensor") ||
      normalizedType.includes("pir") ||
      normalizedType.includes("motion")
    );
  };

  const isSwitchLikeType = (type: string) => {
    const normalizedType = type.toLowerCase();
    return (
      normalizedType.includes("power") ||
      normalizedType.includes("light") ||
      normalizedType.includes("switch") ||
      normalizedType.includes("relay")
    );
  };

  const getTelemetryLabel = (deviceType: string, key: string) => {
    const normalized = key.toLowerCase();
    const isMotionDevice = isMotionLikeType(deviceType);
    const isSwitchDevice = isSwitchLikeType(deviceType);
    if (normalized === "temp") return "Temperatur";
    if (normalized === "humidity" || normalized === "humid") return "Fugtighed";
    if (normalized === "state" || normalized === "motion") {
      if (isMotionDevice) return "Bevægelse";
      if (isSwitchDevice) return "Status";
      return "Status";
    }
    if (normalized === "ison") {
      if (isSwitchDevice) return "Status";
      if (isMotionDevice) return "Bevægelse";
      return "Status";
    }
    if (normalized === "id") return "Enheds-ID";
    if (normalized === "hubid") return "Hub-ID";
    if (normalized === "type") return "Enhedstype";
    return key;
  };

  const getTelemetryValue = (
    deviceType: string,
    key: string,
    value: unknown,
  ) => {
    const normalized = key.toLowerCase();
    const text = String(value ?? "—");
    const normalizedText = text.toLowerCase();
    const activeValues = new Set(["1", "true", "on", "yes"]);
    const isActive = activeValues.has(normalizedText);
    const isMotionDevice = isMotionLikeType(deviceType);
    const isSwitchDevice = isSwitchLikeType(deviceType);

    if (normalized === "state") {
      if (normalizedText === "on") {
        if (isMotionDevice) return "Bevægelse";
        if (isSwitchDevice) return "Tændt";
      }
      if (normalizedText === "off") {
        if (isMotionDevice) return "Ingen bevægelse";
        if (isSwitchDevice) return "Slukket";
      }
      return text;
    }

    if (normalized === "ison" || normalized === "motion") {
      if (normalized === "motion" || isMotionDevice) {
        return isActive ? "Bevægelse" : "Ingen bevægelse";
      }
      if (isSwitchDevice) {
        return isActive ? "Tændt" : "Slukket";
      }
      return isActive ? "Aktiv" : "Inaktiv";
    }

    if (normalized === "id" || normalized === "hubid") {
      return middleTruncate(text);
    }

    if (normalized === "type") {
      return text.replace(/([a-z])([A-Z])/g, "$1 $2");
    }

    return text;
  };

  const isSwitchLikeDevice = (device: Pick<DeviceCardModel, "type">) =>
    isSwitchLikeType(device.type);

  const sendLightFxCommand = async (
    device: Pick<DeviceCardModel, "identifier">,
    state: "ON" | "OFF",
  ) => {
    setSwitchCommandLoading(state === "ON" ? "on" : "off");
    const commandAction = state === "ON" ? "light_fx_on" : "light_fx_off";
    try {
      const result = await sendHubWebSocketCommand({
        deviceId: device.identifier,
        action: commandAction,
        command: {
          state,
          fx: state,
        },
      });

      if (result.status !== "sent") {
        throw new Error(result.error || "Command failed");
      }

      toast.success(state === "ON" ? "Lys tændt" : "Lys slukket");
    } catch {
      toast.error("Kunne ikke sende kommando til hub");
    } finally {
      setSwitchCommandLoading(null);
    }
  };

  const selectDisplayTelemetryEntries = (data: unknown) => {
    if (!data || typeof data !== "object") {
      return [];
    }

    const entries = Object.entries(data);
    const preferredOrder = [
      "state",
      "ison",
      "motion",
      "humidity",
      "humid",
      "temp",
      "id",
      "hubid",
      "type",
    ];

    const byKey = new Map(
      entries.map(([key, value]) => [key.toLowerCase(), [key, value] as const]),
    );
    const statusLikeKeys = new Set(["state", "ison", "motion"]);
    let hasAddedStatusLikeEntry = false;

    return preferredOrder
      .map((key) => {
        if (statusLikeKeys.has(key)) {
          if (hasAddedStatusLikeEntry) {
            return undefined;
          }
          const entry = byKey.get(key);
          if (entry) {
            hasAddedStatusLikeEntry = true;
          }
          return entry;
        }
        return byKey.get(key);
      })
      .filter((entry): entry is readonly [string, unknown] => Boolean(entry));
  };

  const filteredDevices = selectedCategory
    ? pairedDevices.filter(
        (device) =>
          device.type.toLowerCase().trim() ===
          selectedCategory.deviceTypeKey.toLowerCase().trim(),
      )
    : pairedDevices;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Enheder</h1>
        <p className="text-sm text-muted-foreground">
          Hjem: {home.name}
          {selectedCategory ? ` · ${selectedCategory.name}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium">
          {selectedCategory ? selectedCategory.name : "Aktive enheder"}
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredDevices.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Box className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {selectedCategory
                  ? "Ingen enheder i denne kategori endnu."
                  : "Ingen aktive enheder endnu."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredDevices.map((device) => {
            const { displayName } = resolveDevicePresentation(device);

            return (
              <Card
                key={device._id}
                className="cursor-pointer transition-colors hover:border-primary/40"
                onClick={() => setSelectedDevice(device)}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-muted p-2">
                      {getDeviceIcon(device)}
                    </div>
                    <div className="space-y-0">
                      <CardTitle className="text-base">{displayName}</CardTitle>
                      <p className="max-w-[180px] truncate text-xs font-mono text-muted-foreground">
                        {middleTruncate(device.identifier, 11, 4)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUnpairTarget({ id: device._id, closeDetails: false });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {selectDisplayTelemetryEntries(device.data).length > 0 ? (
                      selectDisplayTelemetryEntries(device.data).map(
                        ([k, v]) => (
                          <div
                            key={k}
                            className="rounded-md border bg-muted/40 p-2"
                          >
                            <span className="text-xs text-muted-foreground">
                              {getTelemetryLabel(device.type, k)}
                            </span>
                            <p
                              title={String(v)}
                              className="truncate text-sm font-medium tabular-nums"
                            >
                              {getTelemetryValue(device.type, k, v)}
                            </p>
                          </div>
                        ),
                      )
                    ) : (
                      <div className="col-span-2 rounded-md border bg-muted/40 p-2">
                        <span className="text-xs text-muted-foreground">
                          Status
                        </span>
                        <p className="text-sm font-medium">
                          {String(device.data || "Aktiv")}
                        </p>
                      </div>
                    )}
                  </div>

                  <Separator />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(device.lastSeen, {
                        addSuffix: true,
                        locale: da,
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      Online
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog
        open={!!selectedDevice}
        onOpenChange={(open) => !open && setSelectedDevice(null)}
      >
        <DialogContent className="sm:max-w-xl">
          {selectedDevice && (
            <>
              {(() => {
                const { product, displayName } =
                  resolveDevicePresentation(selectedDevice);

                return (
                  <>
                    <DialogHeader className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{product.brand}</Badge>
                        <span className="max-w-[220px] truncate text-xs font-mono text-muted-foreground">
                          {middleTruncate(selectedDevice.identifier, 11, 4)}
                        </span>
                      </div>
                      <DialogTitle>{displayName}</DialogTitle>
                      <DialogDescription>
                        Hardwarestatus og tekniske specifikationer.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                      <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                        <Image
                          src={product.image}
                          alt={product.name}
                          width={240}
                          height={240}
                          className="h-full w-full object-contain p-4"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {selectDisplayTelemetryEntries(selectedDevice.data)
                          .length > 0 ? (
                          selectDisplayTelemetryEntries(
                            selectedDevice.data,
                          ).map(([k, v]) => (
                            <div
                              key={k}
                              className="rounded-md border bg-muted/40 p-3"
                            >
                              <div className="mb-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
                                {k.toLowerCase().includes("temp") ? (
                                  <Thermometer className="h-3 w-3" />
                                ) : k.toLowerCase().includes("humid") ||
                                  k.toLowerCase().includes("humidity") ? (
                                  <Droplets className="h-3 w-3" />
                                ) : (
                                  <Activity className="h-3 w-3" />
                                )}
                                <span>
                                  {getTelemetryLabel(selectedDevice.type, k)}
                                </span>
                              </div>
                              <p
                                title={String(v)}
                                className="truncate text-lg font-semibold tabular-nums"
                              >
                                {getTelemetryValue(selectedDevice.type, k, v)}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-2 rounded-md border bg-muted/40 p-3">
                            <span className="text-xs text-muted-foreground">
                              Status
                            </span>
                            <p className="text-base font-medium">
                              {String(selectedDevice.data || "Aktiv")}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border bg-muted/40 p-3">
                          <p className="text-xs text-muted-foreground">
                            Protokol
                          </p>
                          <p className="text-sm font-medium">MQTT</p>
                        </div>
                        <div className="rounded-md border bg-muted/40 p-3">
                          <p className="text-xs text-muted-foreground">
                            Sidst set
                          </p>
                          <p className="text-sm font-medium">
                            {formatDistanceToNow(selectedDevice.lastSeen, {
                              addSuffix: true,
                              locale: da,
                            })}
                          </p>
                        </div>
                      </div>

                      {isSwitchLikeDevice(selectedDevice) ? (
                        <div className="rounded-md border bg-muted/40 p-3">
                          <p className="mb-2 text-xs text-muted-foreground">
                            Lysstyring
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="flex-1 gap-2"
                              disabled={switchCommandLoading !== null}
                              onClick={() =>
                                void sendLightFxCommand(selectedDevice, "ON")
                              }
                            >
                              {switchCommandLoading === "on" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Power className="h-3.5 w-3.5" />
                              )}
                              Tænd
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="flex-1 gap-2"
                              disabled={switchCommandLoading !== null}
                              onClick={() =>
                                void sendLightFxCommand(selectedDevice, "OFF")
                              }
                            >
                              {switchCommandLoading === "off" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Power className="h-3.5 w-3.5" />
                              )}
                              Sluk
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <DialogFooter className="flex items-center justify-between sm:justify-between">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setUnpairTarget({
                            id: selectedDevice._id,
                            closeDetails: true,
                          });
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        Fjern parring
                      </Button>
                      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Online
                      </span>
                    </DialogFooter>
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={unpairTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUnpairTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjern enhed?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil fjerne denne enhed fra dit hjem?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => unpairTarget && handleUnpair(unpairTarget.id)}
              disabled={unpairing}
            >
              {unpairing ? "Fjerner..." : "Fjern"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
