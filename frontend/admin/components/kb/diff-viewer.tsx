/**
 * DiffViewer — wrapper sobre react-diff-viewer-continued com toggle split/unified.
 *
 * Story: 1.5 (AC29, AC46)
 */

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

const ReactDiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
  loading: () => <div className="p-4 text-sm text-zinc-500">Carregando diff…</div>,
});

interface Props {
  oldValue: string;
  newValue: string;
  oldTitle?: string;
  newTitle?: string;
}

export function DiffViewer({ oldValue, newValue, oldTitle, newTitle }: Props): React.ReactElement {
  const [splitView, setSplitView] = useState(true);

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
        <Button
          variant={splitView ? "default" : "outline"}
          size="sm"
          onClick={() => setSplitView(true)}
        >
          Split
        </Button>
        <Button
          variant={!splitView ? "default" : "outline"}
          size="sm"
          onClick={() => setSplitView(false)}
        >
          Unified
        </Button>
      </div>
      <div className="max-h-[400px] overflow-auto">
        <ReactDiffViewer
          oldValue={oldValue}
          newValue={newValue}
          splitView={splitView}
          leftTitle={oldTitle}
          rightTitle={newTitle}
          showDiffOnly={false}
          useDarkTheme={false}
          styles={{
            contentText: { fontSize: 12, lineHeight: 1.5, fontFamily: "ui-monospace, monospace" },
          }}
        />
      </div>
    </div>
  );
}
