"use client";

/**
 * <AuditFilters> — barra de filtros da aba Auditoria.
 *
 * Story 1.7 AC22+AC23+AC37+AC47. Inputs nativos (date picker padrão do browser
 * é suficiente; lib calendar é overkill pro MVP). Botão Aplicar + Limpar +
 * Exportar CSV.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AuditFilterValues {
  user_id: string | null;
  action: string | null;
  since: string | null;
  until: string | null;
}

interface UserOption {
  id: string;
  email: string;
}

export const ALL_USERS_SENTINEL = "__all__";

export function AuditFilters({
  users,
  initialValues,
  onApply,
  onExport,
  isExporting,
}: {
  users: UserOption[];
  initialValues: AuditFilterValues;
  onApply: (next: AuditFilterValues) => void;
  onExport: (current: AuditFilterValues) => void;
  isExporting: boolean;
}): React.ReactElement {
  // initialValues é "default no mount" — não sincroniza com prop em runtime
  // (parent não reseta filtros direto; só via callback handleClear interno).
  const [values, setValues] = useState<AuditFilterValues>(initialValues);

  const handleClear = useCallback((): void => {
    const cleared: AuditFilterValues = {
      user_id: null,
      action: null,
      since: null,
      until: null,
    };
    setValues(cleared);
    onApply(cleared);
  }, [onApply]);

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <div>
          <Label htmlFor="filter-user">Usuário</Label>
          <Select
            value={values.user_id ?? ALL_USERS_SENTINEL}
            onValueChange={(v) =>
              setValues((s) => ({
                ...s,
                user_id: v === ALL_USERS_SENTINEL ? null : v,
              }))
            }
          >
            <SelectTrigger id="filter-user" aria-label="Filtrar por usuário">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_USERS_SENTINEL}>Todos</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="filter-action">Ação</Label>
          <Input
            id="filter-action"
            type="text"
            placeholder="kb.update, toggle.*, whitelist.add"
            value={values.action ?? ""}
            onChange={(e) =>
              setValues((s) => ({
                ...s,
                action: e.target.value || null,
              }))
            }
            aria-label="Filtrar por ação"
          />
        </div>

        <div>
          <Label htmlFor="filter-since">Desde</Label>
          <Input
            id="filter-since"
            type="date"
            value={values.since ? values.since.slice(0, 10) : ""}
            onChange={(e) => {
              const v = e.target.value;
              setValues((s) => ({
                ...s,
                since: v ? new Date(`${v}T00:00:00Z`).toISOString() : null,
              }));
            }}
            aria-label="Data inicial"
          />
        </div>

        <div>
          <Label htmlFor="filter-until">Até</Label>
          <Input
            id="filter-until"
            type="date"
            value={values.until ? values.until.slice(0, 10) : ""}
            onChange={(e) => {
              const v = e.target.value;
              setValues((s) => ({
                ...s,
                until: v ? new Date(`${v}T23:59:59Z`).toISOString() : null,
              }));
            }}
            aria-label="Data final"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onApply(values)}>Aplicar</Button>
        <Button variant="outline" onClick={handleClear}>
          Limpar
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          onClick={() => onExport(values)}
          disabled={isExporting}
        >
          {isExporting ? "Exportando…" : "Exportar CSV"}
        </Button>
      </div>
    </div>
  );
}
