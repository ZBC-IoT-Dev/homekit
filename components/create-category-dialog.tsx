"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mergeProductsWithBackend } from "@/lib/products";
import { toast } from "sonner";

interface CreateCategoryDialogProps {
  homeId: Id<"homes">;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function CreateCategoryDialog({
  homeId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
}: CreateCategoryDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState("");
  const [deviceTypeKey, setDeviceTypeKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const backendDeviceTypes = useQuery(api.deviceTypes.listEnabled, {});
  const createCategory = useMutation(api.categories.create);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const options = useMemo(
    () => mergeProductsWithBackend(backendDeviceTypes),
    [backendDeviceTypes],
  );

  const reset = () => {
    setName("");
    setDeviceTypeKey("");
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Kategori er påkrævet");
      return;
    }
    if (!deviceTypeKey) {
      toast.error("Enhedstype er påkrævet");
      return;
    }

    try {
      setSubmitting(true);
      await createCategory({
        homeId,
        name: name.trim(),
        deviceTypeKey,
      });
      toast.success("Kategori oprettet");
      setOpen(false);
      reset();
    } catch {
      toast.error("Kunne ikke oprette kategori");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          reset();
        }
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Opret kategori</DialogTitle>
          <DialogDescription>Vaelg enhedstype</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Kategorinavn</Label>
            <Input
              id="category-name"
              placeholder="Kategorinavn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-device-type">Enhedstype</Label>
            <Select value={deviceTypeKey} onValueChange={setDeviceTypeKey}>
              <SelectTrigger id="category-device-type" className="w-full">
                <SelectValue placeholder="Vaelg enhedstype" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Annuller
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Opretter..." : "Opret"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
