"use client";

/**
 * Tab "Auditoria" — tabela de admin_audit_log com filtros + paginação + modal.
 *
 * Story 1.7 AC21-AC32 + AC42-AC44.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AuditFilters,
  type AuditFilterValues,
} from "./audit-filters";
import { AuditDetailDialog } from "./audit-detail-dialog";
import type { AuditLogItem } from "@/lib/audit-log";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatRelative, formatAbsolute } from "@/lib/format/date";

interface State {
  items: AuditLogItem[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  /** True só na carga inicial (primeira request sem filtros). */
  initial: boolean;
}

const INITIAL_VALUES: AuditFilterValues = {
  user_id: null,
  action: null,
  since: null,
  until: null,
};

function buildQuery(
  values: AuditFilterValues,
  cursor: string | null,
): string {
  const params = new URLSearchParams();
  if (values.user_id) params.set("user_id", values.user_id);
  if (values.action) params.set("action", values.action);
  if (values.since) params.set("since", values.since);
  if (values.until) params.set("until", values.until);
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

function actionBadgeClass(action: string): string {
  if (action.startsWith("login") || action.startsWith("logout") || action.startsWith("session.")) {
    return "bg-neutral-100 text-neutral-700 border-neutral-200";
  }
  if (action.startsWith("kb.")) {
    return "bg-indigo-50 text-indigo-700 border-indigo-200";
  }
  if (action.startsWith("toggle.")) {
    return "bg-purple-50 text-purple-700 border-purple-200";
  }
  if (action.startsWith("whitelist.")) {
    return "bg-cyan-50 text-cyan-700 border-cyan-200";
  }
  if (action.startsWith("audit.")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-neutral-100 text-neutral-700 border-neutral-200";
}

function maskIp(ip: string | null): string {
  if (!ip) return "—";
  // IPv4: 192.168.1.42 → 192.168.1.*
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.\d+$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.*`;
  // IPv6 ou outros: trunca em 16 chars + ellipsis
  if (ip.length > 16) return `${ip.slice(0, 16)}…`;
  return ip;
}

function formatTargetShort(item: AuditLogItem): string {
  if (item.target_type && item.target_id) {
    const t = item.target_type;
    const id = item.target_id.length > 12 ? `${item.target_id.slice(0, 8)}…` : item.target_id;
    return `${t}:${id}`;
  }
  return item.target_type ?? item.target_id ?? "—";
}

export function AuditTab(): React.ReactElement {
  const [values, setValues] = useState<AuditFilterValues>(INITIAL_VALUES);
  const [appliedValues, setAppliedValues] = useState<AuditFilterValues>(INITIAL_VALUES);
  const [state, setState] = useState<State>({
    items: [],
    nextCursor: null,
    loading: true,
    loadingMore: false,
    error: null,
    initial: true,
  });
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [selected, setSelected] = useState<AuditLogItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showFullIp, setShowFullIp] = useState(false);

  // Fetch admin users on mount pra alimentar filtro
  useEffect(() => {
    fetch("/api/admin-users")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d: { users?: { id: string; email: string }[] }) => {
        setUsers(d.users ?? []);
      })
      .catch(() => setUsers([]));
  }, []);

  const fetchPage = useCallback(
    async (filters: AuditFilterValues, cursor: string | null): Promise<void> => {
      const isFirstPage = !cursor;
      setState((s) => ({
        ...s,
        loading: isFirstPage,
        loadingMore: !isFirstPage,
        error: null,
      }));
      try {
        const qs = buildQuery(filters, cursor);
        const url = qs ? `/api/audit-log?${qs}` : "/api/audit-log";
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`http_${res.status}`);
        const data: {
          items: AuditLogItem[];
          next_cursor: string | null;
        } = await res.json();
        setState((s) => ({
          items: isFirstPage ? data.items : [...s.items, ...data.items],
          nextCursor: data.next_cursor,
          loading: false,
          loadingMore: false,
          error: null,
          initial: false,
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        setState((s) => ({
          ...s,
          loading: false,
          loadingMore: false,
          error: msg,
          initial: false,
        }));
      }
    },
    [],
  );

  // Carga inicial — setTimeout 0 escapa do "synchronous setState in effect"
  // (react-hooks/set-state-in-effect, React 19 / Next 16). Padrão da Story 1.5.
  useEffect(() => {
    const id = setTimeout(() => void fetchPage(INITIAL_VALUES, null), 0);
    return () => clearTimeout(id);
  }, [fetchPage]);

  const handleApply = useCallback(
    (next: AuditFilterValues): void => {
      setValues(next);
      setAppliedValues(next);
      void fetchPage(next, null);
    },
    [fetchPage],
  );

  const handleLoadMore = useCallback((): void => {
    if (state.nextCursor) void fetchPage(appliedValues, state.nextCursor);
  }, [fetchPage, appliedValues, state.nextCursor]);

  const handleExport = useCallback((current: AuditFilterValues): void => {
    setIsExporting(true);
    const qs = buildQuery(current, null);
    const url = qs ? `/api/audit-log/export?${qs}` : "/api/audit-log/export";
    // Browser download nativo segue cookie httponly de sessão
    window.location.href = url;
    setTimeout(() => setIsExporting(false), 2000);
  }, []);

  const handleRowClick = useCallback((item: AuditLogItem): void => {
    setSelected(item);
    setDialogOpen(true);
  }, []);

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent, item: AuditLogItem): void => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleRowClick(item);
      }
    },
    [handleRowClick],
  );

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-[#1A1A2E]">Auditoria</h2>
        <p className="text-sm text-neutral-600">
          Rastro de mudanças do painel. Append-only.
        </p>
      </header>

      <AuditFilters
        users={users}
        initialValues={values}
        onApply={handleApply}
        onExport={handleExport}
        isExporting={isExporting}
      />

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          {state.items.length} evento{state.items.length === 1 ? "" : "s"} carregado
          {state.items.length === 1 ? "" : "s"}
          {state.nextCursor ? " (há mais)" : ""}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowFullIp((v) => !v)}
          aria-label={showFullIp ? "Mascarar IPs" : "Mostrar IPs completos"}
          title={
            showFullIp
              ? "Mascarar IPs (recomendado pra screenshots)"
              : "Mostrar IPs completos"
          }
        >
          {showFullIp ? "Mascarar IPs" : "Mostrar IPs"}
        </Button>
      </div>

      {state.loading && state.initial && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!state.loading && state.error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <p className="font-medium">Não foi possível carregar auditoria</p>
          <p className="mt-1 text-xs text-rose-700">{state.error}</p>
          <Button
            className="mt-2"
            size="sm"
            variant="outline"
            onClick={() => void fetchPage(appliedValues, null)}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {!state.loading && !state.error && state.items.length === 0 && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
          <p className="text-sm text-neutral-600">
            Nenhum evento no período. Ajuste os filtros.
          </p>
        </div>
      )}

      {!state.loading && !state.error && state.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border border-neutral-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Quando</TableHead>
                  <TableHead className="min-w-[180px]">Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead className="hidden sm:table-cell">Alvo</TableHead>
                  <TableHead className="hidden md:table-cell w-[140px]">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.items.map((item) => (
                  <TableRow
                    key={item.id}
                    onClick={() => handleRowClick(item)}
                    onKeyDown={(e) => handleRowKeyDown(e, item)}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    aria-label={`Ver detalhes de ${item.action} em ${item.created_at}`}
                  >
                    <TableCell title={formatAbsolute(item.created_at)}>
                      {formatRelative(item.created_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.user_email ?? <span className="italic text-neutral-500">sistema</span>}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={actionBadgeClass(item.action)}
                      >
                        {item.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs">
                      {formatTargetShort(item)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs">
                      {showFullIp
                        ? item.ip_address ?? "—"
                        : maskIp(item.ip_address)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {state.nextCursor && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={state.loadingMore}
              >
                {state.loadingMore ? "Carregando…" : "Carregar mais"}
              </Button>
            </div>
          )}
        </>
      )}

      <AuditDetailDialog
        item={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
