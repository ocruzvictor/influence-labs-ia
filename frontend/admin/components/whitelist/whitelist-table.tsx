/**
 * WhitelistTable — tabela com header + rows + empty state.
 */

"use client";

import { WhitelistRow } from "./whitelist-row";
import type { WhitelistItem } from "@/lib/hooks/use-whitelist";

interface Props {
  items: WhitelistItem[];
  onRemove: (phone: string) => Promise<boolean>;
  mutating: boolean;
}

export function WhitelistTable({ items, onRemove, mutating }: Props): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
      <header className="grid grid-cols-[1.4fr_1fr_1.5fr_1.2fr_auto] gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] uppercase tracking-wider text-zinc-500 sm:gap-3">
        <span>Telefone</span>
        <span>Modo</span>
        <span>Motivo</span>
        <span>Adicionado por</span>
        <span className="w-7" aria-hidden="true" />
      </header>
      {items.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-zinc-500">
          Nenhum número configurado.
        </p>
      ) : (
        items.map((item) => (
          <WhitelistRow
            key={item.phone}
            item={item}
            onRemove={onRemove}
            pendingRemove={mutating}
          />
        ))
      )}
    </div>
  );
}
