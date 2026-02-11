"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";

export default function SignIn() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/",
    });
    // Note: better-auth social sign in usually redirects, so setLoading(false) might not be reached or needed.
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome to HomeKit</CardTitle>
        <CardDescription>
          Sign in to manage your devices and home settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleSignIn} disabled={loading} className="w-full">
          {loading ? "Signing in..." : "Sign in with GitHub"}
        </Button>
      </CardContent>
    </Card>
  );
}
