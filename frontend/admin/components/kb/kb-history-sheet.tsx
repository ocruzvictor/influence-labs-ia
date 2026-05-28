/**
 * KbHistorySheet — drawer lateral com lista de versões + diff + restore.
 *
 * Story: 1.5 (AC27-32)
 *
 * Arquitetura: outer (Sheet shell) + inner (HistoryContent) keyed por item.id.
 * Inner remonta quando item muda → state limpo automaticamente sem effect cascading.
 */

"use client";

import { useEffect, useState } from "react";
import type { KbItem, KbVersion } from "@/lib/kb-types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { VersionRow } from "./version-row";
import { RestoreDialog } from "./restore-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: KbItem | null;
  fetchVersions: (id: string) => Promise<{ item: KbItem; versions: KbVersion[] } | null>;
  onRestore: (id: string, version: number) => Promise<void>;
  mutating: boolean;
}

export function KbHistorySheet({
  open,
  onOpenChange,
  item,
  fetchVersions,
  onRestore,
  mutating,
}: Props): React.ReactElement {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Histórico</SheetTitle>
          <SheetDescription>{item?.title ?? ""}</SheetDescription>
        </SheetHeader>

        {item && (
          <HistoryContent
            key={item.id}
            item={item}
            fetchVersions={fetchVersions}
            onRestore={onRestore}
            mutating={mutating}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Inner content — remontado via key={item.id} sempre que item muda. */
interface ContentProps {
  item: KbItem;
  fetchVersions: (id: string) => Promise<{ item: KbItem; versions: KbVersion[] } | null>;
  onRestore: (id: string, version: number) => Promise<void>;
  mutating: boolean;
}

function HistoryContent({ item, fetchVersions, onRestore, mutating }: ContentProps): React.ReactElement {
  const [versions, setVersions] = useState<KbVersion[]>([]);
  const [currentContent, setCurrentContent] = useState<string>(item.content_md);
  const [currentVersion, setCurrentVersion] = useState<number>(item.version);
  const [loading, setLoading] = useState(true);
  const [restoreTarget, setRestoreTarget] = useState<KbVersion | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVersions(item.id).then((res) => {
      if (cancelled) return;
      if (res) {
        setVersions(res.versions);
        setCurrentContent(res.item.content_md);
        setCurrentVersion(res.item.version);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [item.id, fetchVersions]);

  async function confirmRestore() {
    if (!restoreTarget) return;
    await onRestore(item.id, restoreTarget.version);
    setRestoreTarget(null);
  }

  return (
    <>
      <div className="mt-6 space-y-3 overflow-y-auto pr-2">
        {loading && (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        )}
        {!loading && versions.length === 0 && (
          <p className="text-sm text-zinc-500">
            Apenas a versão inicial. Edite o item para criar histórico.
          </p>
        )}
        {!loading &&
          versions.map((v) => (
            <VersionRow
              key={v.id}
              version={v}
              currentContent={currentContent}
              currentVersion={currentVersion}
              isLatestStored={v.version === currentVersion - 1}
              onRestore={setRestoreTarget}
              mutating={mutating}
            />
          ))}
      </div>

      <RestoreDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        targetVersion={restoreTarget?.version ?? 0}
        currentVersion={currentVersion}
        onConfirm={confirmRestore}
      />
    </>
  );
}
