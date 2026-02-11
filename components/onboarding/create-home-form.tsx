"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

export function CreateHomeForm() {
  const createHome = useMutation(api.homes.createHome);
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createHome({ name, address });
      router.push("/");
    } catch (error) {
      console.error("Failed to create home", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Opret et hjem</h2>
        <p className="text-sm text-muted-foreground">Start et nyt smarthjem.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Navn på hjemmet</Label>
            <Input
              id="name"
              placeholder="Mit smarte hjem"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Adresse (valgfri)</Label>
            <Input
              id="address"
              placeholder="Smartvej 123"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-11"
            />
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Opretter..." : "Opret hjem"}
        </Button>
      </form>
    </div>
  );
}
