"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignIn() {
  const router = useRouter();
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
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-2xl font-bold">Welcome Home</h1>
      <Button onClick={handleSignIn} disabled={loading}>
        {loading ? "Signing in..." : "Sign in with GitHub"}
      </Button>
    </div>
  );
}
