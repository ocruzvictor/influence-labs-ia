/**
 * Phone formatting — E.164 numeric string (DB shape) → display string.
 *
 * Database stores phones as digits-only without "+" (Kapso/Meta convention).
 * Example: "5511964540007" → "+55 (11) 96454-0007".
 *
 * Casos suportados:
 *   • 13 dígitos (celular BR pós-9o dígito) → "+DD (NN) 9XXXX-XXXX"
 *   • 12 dígitos (fixo BR ou pré-9o)         → "+DD (NN) XXXX-XXXX"
 *   • Demais formatos válidos E.164          → "+<DDI> <restante>" (degrada elegante)
 *   • Inválidos (não-numérico, comprimento fora de 10-15) → string crua original
 */

const E164_REGEX = /^\d{10,15}$/;

export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  const digits = raw.trim();
  if (!E164_REGEX.test(digits)) return raw;

  // Celular brasileiro: 55 (2) + DDD (2) + 9 (1) + número (8) = 13
  if (digits.length === 13 && digits.startsWith("55")) {
    const ddi = digits.slice(0, 2);
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 9);
    const part2 = digits.slice(9);
    return `+${ddi} (${ddd}) ${part1}-${part2}`;
  }

  // Fixo brasileiro: 55 + DDD + 8 dígitos = 12
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddi = digits.slice(0, 2);
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 8);
    const part2 = digits.slice(8);
    return `+${ddi} (${ddd}) ${part1}-${part2}`;
  }

  // Fallback E.164 — DDI implícito de 1-3 digits + restante
  // Não tenta adivinhar split de outros países
  return `+${digits}`;
}

/** Strip não-numéricos. Útil em onChange de inputs. */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

/** Valida formato esperado pela API (`/^\d{10,15}$/`). */
export function isValidPhone(input: string): boolean {
  return E164_REGEX.test(input);
}
