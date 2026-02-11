"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getProduct, mergeProductsWithBackend } from "@/lib/products";
import { middleTruncate } from "@/lib/utils";
import Image from "next/image";
import { Plus, Wifi, Info } from "lucide-react";

type DiscoveryDevice = {
  _id: Id<"devices">;
  identifier: string;
  type: string;
  status: "pending" | "paired";
};

export function DeviceDiscovery() {
  const home = useQuery(api.homes.getHome);
  const devices = useQuery(
    api.gateways.getHomeDevices,
    home ? { homeId: home._id } : "skip",
  );
  const backendDeviceTypes = useQuery(api.deviceTypes.listEnabled, {});

  const pairDevice = useMutation(api.gateways.pairDevice);
  const [pairingDevice, setPairingDevice] = useState<DiscoveryDevice | null>(
    null,
  );
  const [deviceName, setDeviceName] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  const pendingDevices = devices?.filter((d) => d.status === "pending") || [];
  const productCatalog = useMemo(
    () => mergeProductsWithBackend(backendDeviceTypes),
    [backendDeviceTypes],
  );

  useEffect(() => {
    if (pendingDevices.length > 0) {
      setShowNotification(true);
    } else {
      setShowNotification(false);
    }
  }, [pendingDevices.length]);

  const handlePair = async () => {
    if (!pairingDevice || !deviceName.trim()) return;
    setIsPairing(true);
    try {
      await pairDevice({
        deviceId: pairingDevice._id,
        name: deviceName,
      });
      toast.success(`${deviceName} blev parret.`);
      setPairingDevice(null);
      setDeviceName("");
    } catch {
      toast.error("Kunne ikke parre enhed");
    } finally {
      setIsPairing(false);
    }
  };

  if (!home) return null;

  return (
    <>
      {showNotification && !pairingDevice && (
        <Card className="fixed bottom-6 right-6 z-50 w-72 shadow-lg">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <Wifi className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">
              Enhedsopdagelse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-col gap-2">
              {pendingDevices.slice(0, 3).map((device) => {
                const productWithBackend = getProduct(
                  device.type,
                  device.identifier,
                  productCatalog,
                );
                const isGeneric = productWithBackend.id === "other";
                const displayName = isGeneric
                  ? `Unit ${middleTruncate(device.identifier, 11, 4)}`
                  : productWithBackend.name;
                return (
                  <Button
                    key={device._id}
                    variant="secondary"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => {
                      setPairingDevice(device);
                      setDeviceName(device.identifier);
                    }}
                  >
                    <span className="truncate text-left">
                      Par {displayName}
                    </span>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                );
              })}
              {pendingDevices.length > 3 && (
                <p className="text-center text-xs text-muted-foreground">
                  + {pendingDevices.length - 3} yderligere enheder fundet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!pairingDevice}
        onOpenChange={(open) => !open && setPairingDevice(null)}
      >
        <DialogContent className="sm:max-w-lg">
          {pairingDevice && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">Opdagelse</Badge>
                  <span className="max-w-[220px] truncate text-xs font-mono text-muted-foreground">
                    ID: {middleTruncate(pairingDevice.identifier, 11, 4)}
                  </span>
                </div>
                <DialogTitle className="text-2xl font-bold">
                  Par{" "}
                  {
                    getProduct(
                      pairingDevice.type,
                      pairingDevice.identifier,
                      productCatalog,
                    ).name
                  }
                </DialogTitle>
                <DialogDescription>
                  {
                    getProduct(
                      pairingDevice.type,
                      pairingDevice.identifier,
                      productCatalog,
                    ).description
                  }
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 py-4">
                <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                  <Image
                    src={
                      getProduct(
                        pairingDevice.type,
                        pairingDevice.identifier,
                        productCatalog,
                      ).image
                    }
                    alt={
                      getProduct(
                        pairingDevice.type,
                        pairingDevice.identifier,
                        productCatalog,
                      ).name
                    }
                    width={300}
                    height={300}
                    className="object-contain p-4"
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="global-pair-name">Visningsnavn</Label>
                    <Input
                      id="global-pair-name"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      placeholder="f.eks. Stuetemperatur"
                    />
                  </div>

                  <div className="space-y-2 rounded-md border bg-muted/50 p-4 text-sm">
                    <div className="flex items-center gap-2 font-semibold">
                      <Info className="h-4 w-4" />
                      Nøglefunktioner
                    </div>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 list-disc list-inside text-xs text-muted-foreground">
                      {getProduct(
                        pairingDevice.type,
                        pairingDevice.identifier,
                        productCatalog,
                      ).features.map((feature: string, i: number) => (
                        <li key={i}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPairingDevice(null)}
                >
                  Annuller
                </Button>
                <Button
                  onClick={handlePair}
                  disabled={!deviceName.trim() || isPairing}
                >
                  {isPairing ? "Parrer..." : "Tilføj til hjem"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
