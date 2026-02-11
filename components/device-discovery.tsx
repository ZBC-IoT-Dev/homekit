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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { getProduct, mergeProductsWithBackend } from "@/lib/products";
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
      toast.success(`${deviceName} paired successfully!`);
      setPairingDevice(null);
      setDeviceName("");
    } catch {
      toast.error("Failed to pair device");
    } finally {
      setIsPairing(false);
    }
  };

  if (!home) return null;

  return (
    <>
      {/* Global Floating Notification */}
      {showNotification && !pairingDevice && (
        <Card className="fixed bottom-6 right-6 z-50 w-64 shadow-2xl border-primary/10 animate-in fade-in slide-in-from-bottom-5 rounded-2xl bg-card/95 backdrop-blur-md overflow-hidden">
          <CardHeader className="flex flex-row items-center space-y-0 gap-2 p-3 pb-1.5">
            <Wifi className="h-3 w-3 text-primary animate-pulse" />
            <CardTitle className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
              Device Discovery
            </CardTitle>
          </CardHeader>
          <CardContent className="w-full p-0 px-2">
            <div className="flex flex-col gap-1.5">
              {pendingDevices.slice(0, 3).map((device) => {
                const productWithBackend = getProduct(
                  device.type,
                  device.identifier,
                  productCatalog,
                );
                const isGeneric = productWithBackend.id === "other";
                const displayName = isGeneric
                  ? `Unit ${device.identifier}`
                  : productWithBackend.name;
                return (
                  <Button
                    key={device._id}
                    variant="secondary"
                    size="sm"
                    className="w-full justify-between h-8 text-[10px] font-semibold bg-secondary/40 hover:bg-secondary/70 rounded-lg border-0 transition-all hover:translate-x-0.5"
                    onClick={() => {
                      setPairingDevice(device);
                      setDeviceName(device.identifier);
                    }}
                  >
                    <span className="truncate flex-1 text-left opacity-90">
                      Pair {displayName}
                    </span>
                    <Plus className="h-3 w-3 opacity-30" />
                  </Button>
                );
              })}
              {pendingDevices.length > 3 && (
                <p className="text-[8px] text-center text-muted-foreground/30 w-full pt-1 font-bold">
                  + {pendingDevices.length - 3} additional units Detected
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Global Pairing Dialog */}
      <Dialog
        open={!!pairingDevice}
        onOpenChange={(open) => !open && setPairingDevice(null)}
      >
        <DialogContent className="sm:max-w-lg">
          {pairingDevice && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="rounded-sm">
                    Discovery
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    ID: {pairingDevice.identifier}
                  </span>
                </div>
                <DialogTitle className="text-2xl font-bold">
                  Pair{" "}
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
                <div className="relative aspect-video w-full bg-muted rounded-md flex items-center justify-center overflow-hidden border">
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
                    className="object-contain drop-shadow-md"
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="global-pair-name">Display Name</Label>
                    <Input
                      id="global-pair-name"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      placeholder="e.g. Living Room Temperature"
                    />
                  </div>

                  <div className="bg-muted/50 p-4 rounded-md border text-sm space-y-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <Info className="h-4 w-4" />
                      Key Features
                    </div>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 list-disc list-inside text-muted-foreground text-xs font-medium">
                      {getProduct(
                        pairingDevice.type,
                        pairingDevice.identifier,
                        productCatalog,
                      ).features.map(
                        (feature: string, i: number) => (
                          <li key={i}>{feature}</li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPairingDevice(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePair}
                  disabled={!deviceName.trim() || isPairing}
                >
                  {isPairing ? "Pairing..." : "Add to Home"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
