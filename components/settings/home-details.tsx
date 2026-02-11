"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { Trash2, Copy, Check } from "lucide-react";

type HomeDetailsHome = {
  _id: Id<"homes">;
  name: string;
  address?: string;
  inviteCode: string;
};

export function HomeDetails({ home }: { home: HomeDetailsHome }) {
  const updateHome = useMutation(api.homes.updateHome);
  const deleteHome = useMutation(api.homes.deleteHome);
  const [name, setName] = useState(home.name);
  const [address, setAddress] = useState(home.address || "");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateHome({ id: home._id, name, address });
      toast.success("Hjem opdateret");
    } catch {
      toast.error("Kunne ikke opdatere hjem");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteHome({ id: home._id });
      toast.success("Hjem slettet");
      router.push("/");
    } catch {
      toast.error("Kunne ikke slette hjem");
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(home.inviteCode);
    setCopied(true);
    toast.success("Kopieret til udklipsholder");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generelt</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Hjemmenavn
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10"
                  placeholder="f.eks. Mit smarte hjem"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="address" className="text-sm font-medium">
                  Adresse
                </Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-10"
                  placeholder="Smartvej 123, Teknikby"
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/40 p-4">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Invitationskode
                  </p>
                  <code className="text-base font-mono font-semibold">
                    {home.inviteCode}
                  </code>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={copyInviteCode}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Kopieret" : "Kopier"}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Slet hjem
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Dette vil permanent slette {home.name} og alle dets
                      enheder.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuller</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Slet
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                type="submit"
                disabled={loading}
                size="sm"
                className="h-10 px-6"
              >
                {loading ? "Gemmer..." : "Gem ændringer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
