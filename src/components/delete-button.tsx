"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

export function DeleteButton({
  label = "Delete",
  confirmTitle = "Delete this item?",
  confirmDescription = "This cannot be undone.",
  onDelete,
  redirectTo,
}: {
  label?: string;
  confirmTitle?: string;
  confirmDescription?: string;
  onDelete: () => Promise<void>;
  redirectTo?: string;
}) {
  const router = useRouter();

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button type="button" size="sm" variant="destructive" />}
      >
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={async () => {
              try {
                await onDelete();
                toast.success("Deleted");
                if (redirectTo) router.push(redirectTo);
                else router.refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
