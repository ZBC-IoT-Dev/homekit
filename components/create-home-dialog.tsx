"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CreateHomeDialogProps {
  onHomeCreated?: (homeId: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function CreateHomeDialog({
  onHomeCreated,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
}: CreateHomeDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState("");
  const createHome = useMutation(api.homes.createHome);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const homeId = await createHome({ name });
      toast.success("Hjem oprettet.");
      setOpen(false);
      setName("");
      if (onHomeCreated) {
        onHomeCreated(homeId);
      }
    } catch (error) {
      toast.error("Kunne ikke oprette hjem");
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Opret et nyt hjem</DialogTitle>
          <DialogDescription>
            Tilføj et nyt hjem til dit smart home-dashboard.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Hjemmenavn (f.eks. Sommerhus)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuller
            </Button>
            <Button type="submit">Opret</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
