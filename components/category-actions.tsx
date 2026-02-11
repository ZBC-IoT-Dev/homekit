"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CategoryActionsProps = {
  categoryId: Id<"categories">;
  categoryName: string;
  triggerClassName?: string;
  onRemoved?: () => void;
  onRenamed?: (nextName: string) => void;
};

export function CategoryActions({
  categoryId,
  categoryName,
  triggerClassName,
  onRemoved,
  onRenamed,
}: CategoryActionsProps) {
  const renameCategory = useMutation(api.categories.rename);
  const removeCategory = useMutation(api.categories.remove);

  const [renameOpen, setRenameOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [name, setName] = useState(categoryName);
  const [submittingRename, setSubmittingRename] = useState(false);
  const [submittingRemove, setSubmittingRemove] = useState(false);

  const resetRename = () => {
    setName(categoryName);
    setSubmittingRename(false);
  };

  const handleRename = async () => {
    const nextName = name.trim();
    if (!nextName) {
      toast.error("Kategori navn er påkrævet");
      return;
    }

    try {
      setSubmittingRename(true);
      await renameCategory({ categoryId, name: nextName });
      toast.success("Kategori opdateret");
      setRenameOpen(false);
      onRenamed?.(nextName);
    } catch {
      toast.error("Kunne ikke opdatere kategori");
    } finally {
      setSubmittingRename(false);
    }
  };

  const handleRemove = async () => {
    try {
      setSubmittingRemove(true);
      await removeCategory({ categoryId });
      toast.success("Kategori slettet");
      setRemoveOpen(false);
      onRemoved?.();
    } catch {
      toast.error("Kunne ikke slette kategori");
    } finally {
      setSubmittingRemove(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={triggerClassName ?? "h-7 w-7"}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Kategori handlinger</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setRenameOpen(true);
              setName(categoryName);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Omdøb
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              setRemoveOpen(true);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Slet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open);
          if (!open) {
            resetRename();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Omdøb kategori</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kategori navn"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setRenameOpen(false);
                resetRename();
              }}
            >
              Annuller
            </Button>
            <Button type="button" onClick={handleRename} disabled={submittingRename}>
              {submittingRename ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet kategori?</AlertDialogTitle>
            <AlertDialogDescription>
              Kategori <strong>{categoryName}</strong> bliver permanent slettet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleRemove}
              disabled={submittingRemove}
            >
              {submittingRemove ? "Sletter..." : "Slet"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
