"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

export function JoinHomeForm() {
  const joinHome = useMutation(api.homes.joinHome);
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await joinHome({ inviteCode: inviteCode.toUpperCase() });
      router.push("/");
    } catch (err) {
      setError("Invalid invite code or unable to join.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Join a Home</h2>
        <p className="text-sm text-muted-foreground">
          Enter the invite code from the home owner.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inviteCode">Invite Code</Label>
            <Input
              id="inviteCode"
              placeholder="ABC1234"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              className="h-11 uppercase font-mono tracking-widest placeholder:normal-case placeholder:font-sans placeholder:tracking-normal"
            />
            {error && (
              <p className="text-sm text-red-500 font-medium">{error}</p>
            )}
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Joining..." : "Join Home"}
        </Button>
      </form>
    </div>
  );
}
