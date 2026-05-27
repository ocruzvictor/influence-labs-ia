/**
 * Date formatting — wrappers de `date-fns` com locale pt-BR.
 *
 * `formatRelative(date)` → "há 4 minutos", "há 2 horas", "há 3 dias", "agora"
 * `formatAbsolute(date)` → "27/05/2026 14:32"
 *
 * Aceita Date, ISO string, ou null/undefined (retorna fallback "—" em casos inválidos).
 */

import { formatDistanceToNow, format as fmt, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function toDate(input: Date | string | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  try {
    const d = parseISO(input);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function formatRelative(input: Date | string | null | undefined): string {
  const d = toDate(input);
  if (!d) return "—";
  return formatDistanceToNow(d, { locale: ptBR, addSuffix: true });
}

export function formatAbsolute(
  input: Date | string | null | undefined,
  pattern = "dd/MM/yyyy HH:mm",
): string {
  const d = toDate(input);
  if (!d) return "—";
  return fmt(d, pattern, { locale: ptBR });
}
