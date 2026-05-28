/**
 * RestoreDialog — AlertDialog de confirmação pra restaurar versão antiga.
 *
 * Story: 1.5 (AC30, AC45)
 */

"use client";

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetVersion: number;
  currentVersion: number;
  onConfirm: () => Promise<void>;
}

export function RestoreDialog({
  open,
  onOpenChange,
  targetVersion,
  currentVersion,
  onConfirm,
}: Props): React.ReactElement {
  const newVersion = currentVersion + 1;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restaurar v{targetVersion}?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso criará uma nova versão v{newVersion} idêntica ao conteúdo de v{targetVersion}. O
            histórico atual será preservado — você pode reverter a qualquer momento.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel autoFocus>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onConfirm()}>Restaurar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
