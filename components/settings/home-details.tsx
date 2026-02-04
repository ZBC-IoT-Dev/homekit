"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Trash2, Copy, Check, Save } from "lucide-react";

export function HomeDetails({ home }: { home: any }) {
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
      toast.success("Home updated");
    } catch (error) {
      toast.error("Failed to update home");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteHome({ id: home._id });
      toast.success("Home deleted");
      router.push("/");
    } catch (error) {
      toast.error("Failed to delete home");
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(home.inviteCode);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Card className="border-none shadow-none bg-transparent">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Home Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 bg-muted/20 border-border/50 focus:bg-background transition-all"
                placeholder="e.g. My Smart Home"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address" className="text-sm font-medium">
                Address
              </Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="h-10 bg-muted/20 border-border/50 focus:bg-background transition-all"
                placeholder="123 Smart St, Tech City"
              />
            </div>

            <div className="p-4 rounded-lg bg-muted/20 border border-border/50 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Invite Code
                </p>
                <code className="text-lg font-mono font-bold tracking-widest">
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
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Home
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{home.name}" and all its
                    devices.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              type="submit"
              disabled={loading}
              size="sm"
              className="px-6 h-10 shadow-sm"
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
