/**
 * VersionRow — single row de versão histórica com ações (ver diff, restaurar).
 *
 * Story: 1.5 (AC28-29)
 */

"use client";

import { useState } from "react";
import type { KbVersion } from "@/lib/kb-types";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format/date";
import { DiffViewer } from "./diff-viewer";

interface Props {
  version: KbVersion;
  currentContent: string;
  currentVersion: number;
  isLatestStored: boolean;
  onRestore: (v: KbVersion) => void;
  mutating: boolean;
}

export function VersionRow({
  version,
  currentContent,
  currentVersion,
  isLatestStored,
  onRestore,
  mutating,
}: Props): React.ReactElement {
  const [showDiff, setShowDiff] = useState(false);

  return (
    <article className="rounded-md border border-zinc-200 bg-white p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium text-[#1A1A2E]">v{version.version}</span>
          <span className="text-xs text-zinc-500">
            {version.updated_by_email ?? "sistema"} • {formatRelative(version.created_at)}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDiff((v) => !v)}>
            {showDiff ? "Esconder diff" : "Ver diff"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRestore(version)}
            disabled={mutating || version.version >= currentVersion}
            title={
              version.version >= currentVersion
                ? "Versão atual ou posterior — nada a restaurar"
                : `Restaurar conteúdo de v${version.version}`
            }
          >
            Restaurar
          </Button>
        </div>
      </header>

      {version.diff_summary && (
        <p className="mt-2 text-xs text-zinc-600">
          {isLatestStored ? "Mudanças até a versão atual:" : "Mudanças nesta versão:"}{" "}
          <span className="font-mono">{version.diff_summary}</span>
        </p>
      )}

      {showDiff && (
        <div className="mt-3 overflow-hidden rounded border border-zinc-200">
          <DiffViewer
            oldValue={version.content_md}
            newValue={currentContent}
            oldTitle={`v${version.version}`}
            newTitle={`v${currentVersion} (atual)`}
          />
        </div>
      )}
    </article>
  );
}
