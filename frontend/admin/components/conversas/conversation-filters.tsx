/**
 * ConversationFilters — search + dropdowns de status/takeover + refresh.
 *
 * Estado é controlado externamente (props) — componente é "stateless visual".
 * O parent (ConversationList) gerencia state, sincroniza com URL, e dispara fetches.
 *
 * Debounce de search é responsabilidade do parent (via useEffect com timeout).
 */

"use client";

import { useId } from "react";
import { Search, RotateCw } from "lucide-react";
import type { ConversationStatus, ConversationTakeover } from "@/lib/conversas";

export interface ConversationFiltersValue {
  status: ConversationStatus;
  takeover: ConversationTakeover;
  search: string;
}

interface Props {
  value: ConversationFiltersValue;
  onChange: (next: ConversationFiltersValue) => void;
  onRefresh: () => void;
  /** Quando true, mostra spinner no botão refresh. */
  loading?: boolean;
}

const STATUS_OPTIONS: { value: ConversationStatus; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Ativas" },
  { value: "inactive", label: "Inativas" },
];

const TAKEOVER_OPTIONS: { value: ConversationTakeover; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "yes", label: "Com takeover" },
  { value: "no", label: "Sem takeover" },
];

export function ConversationFilters({ value, onChange, onRefresh, loading }: Props): React.ReactElement {
  const searchId = useId();
  const statusId = useId();
  const takeoverId = useId();

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor={searchId} className="mb-1 block text-xs font-medium text-zinc-600">
          Buscar
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            inputMode="numeric"
            placeholder="Telefone..."
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            className="h-9 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#4338CA]/30"
            maxLength={50}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label htmlFor={statusId} className="mb-1 block text-xs font-medium text-zinc-600">
            Status
          </label>
          <select
            id={statusId}
            value={value.status}
            onChange={(e) => onChange({ ...value, status: e.target.value as ConversationStatus })}
            className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4338CA]/30"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={takeoverId} className="mb-1 block text-xs font-medium text-zinc-600">
            Takeover
          </label>
          <select
            id={takeoverId}
            value={value.takeover}
            onChange={(e) => onChange({ ...value, takeover: e.target.value as ConversationTakeover })}
            className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4338CA]/30"
          >
            {TAKEOVER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          aria-label="Recarregar lista"
        >
          <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          <span className="hidden sm:inline">Recarregar</span>
        </button>
      </div>
    </div>
  );
}
