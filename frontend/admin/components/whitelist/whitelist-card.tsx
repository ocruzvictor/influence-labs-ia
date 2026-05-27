/**
 * WhitelistCard — card container com header + tabela + dialog de add.
 *
 * Hidrata `items` iniciais da Server Component; depois passa a usar useWhitelist
 * pra mutações (refetch automático após add/remove).
 */

"use client";

import { useWhitelist } from "@/lib/hooks/use-whitelist";
import type { WhitelistRow } from "@/lib/whitelist";
import { WhitelistTable } from "./whitelist-table";
import { WhitelistAddDialog } from "./whitelist-add-dialog";

interface Props {
  initialItems: WhitelistRow[];
}

export function WhitelistCard({ initialItems }: Props): React.ReactElement {
  // useWhitelist dispara primeiro fetch no mount. Enquanto carrega (loading=true),
  // mostramos os items SSR. Após o primeiro fetch real concluir, alternamos para
  // a fonte client. Sem state derivado — React 19 reclama de setState em effect.
  const { items, loading, mutating, add, remove } = useWhitelist(true);
  const renderItems = loading ? initialItems : items;

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Whitelist por número
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {renderItems.length} {renderItems.length === 1 ? "número configurado" : "números configurados"}
          </p>
        </div>
        <WhitelistAddDialog onAdd={add} mutating={mutating} />
      </div>

      <div className="mt-4">
        <WhitelistTable items={renderItems} onRemove={remove} mutating={mutating} />
      </div>
    </section>
  );
}
