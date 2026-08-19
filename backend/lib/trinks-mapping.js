/**
 * Trinks → trinks_appointments mapping (Story 1.6).
 *
 * Funções PURAS (sem I/O) — fáceis de testar. O de-para de status e o shape
 * do registro foram confirmados na Fase 0 (ver story 1.6, Completion Notes):
 *   GET /agendamentos?dataInicio&dataFim → { data:[{ id, status:{id,nome},
 *     cliente:{id,nome}, servico:{id,nome}, profissional:{id,nome},
 *     dataHoraInicio, duracaoEmMinutos, valor }], page, pageSize, totalPages }
 *
 * Gaps conhecidos da API (Fase 0):
 *   • Não há data de criação do booking → created_at_trinks fica NULL.
 *   • Telefone não vem no agendamento (só em /clientes/:id) → resolvido à parte.
 */

// status.id (estável) → enum da coluna trinks_appointments.status (migration 001)
const STATUS_BY_ID = {
  4: 'confirmed', // Confirmado
  6: 'no_show', // Cliente não compareceu
  8: 'completed', // Finalizado
  9: 'cancelled', // Cancelado
};

// PATCH /agendamentos/{id}/status/cancelado — quemCancelou é enum int32, NÃO id de cliente/profissional.
// Doc Trinks: 1=cliente, 2=profissional, 3=estabelecimento, 4=outro.
const QUEM_CANCELOU = {
  CLIENTE: 1,
  PROFISSIONAL: 2,
  ESTABELECIMENTO: 3,
  OUTRO: 4,
};

/** Monta body do PATCH cancelado com quemCancelou coerced para int32 válido. */
function buildCancelPayload(motivo, quemCancelou = QUEM_CANCELOU.CLIENTE) {
  const actor = Number(quemCancelou);
  if (!Number.isInteger(actor) || actor < 1 || actor > 4) {
    throw new Error(`quemCancelou invalido: ${quemCancelou}`);
  }
  const reason = String(motivo ?? '').trim();
  return {
    quemCancelou: actor,
    motivo: reason || 'Cancelado pelo cliente via WhatsApp',
  };
}

/** Mapeia status.id da Trinks → enum normalizado. Desconhecido → 'unknown'. */
function mapStatus(statusId) {
  return STATUS_BY_ID[Number(statusId)] || 'unknown';
}

/**
 * Normaliza telefone BR para o formato de conversation_history.client_phone:
 * E.164 sem '+' (ex.: 5511964540007). A Trinks devolve 10-11 dígitos (DDD+número,
 * sem o 55); conversation_history guarda 12-13 dígitos (com 55).
 * Retorna null se não houver dígitos suficientes.
 */
function normalizePhoneBR(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  // DDD + número (10-11 dígitos): prefixa 55 → 12-13 dígitos.
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  // Já vem com DDI 55 (12-13 dígitos): mantém.
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  // Qualquer outra coisa (curto demais, longo demais, ou multi-número concatenado
  // que estouraria VARCHAR(20)) → descarta. Telefone é só pra taxa de sucesso (best-effort).
  return null;
}

/** Brasil sem DST desde 2019; Trinks envia dataHoraInicio como horário local naive. */
const BR_OFFSET = '-03:00';

const TZ_AWARE_RE = /[zZ]|[+-]\d{2}:?\d{2}$/;
const NAIVE_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;
const NAIVE_SPACE_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;

/**
 * Converte datetime naive da Trinks (horário de São Paulo) → string timestamptz.
 * Preserva valores já tz-aware (Z ou ±offset). null/empty passam intactos.
 */
function toTimestamptz(s) {
  if (s == null || s === '') return s;
  if (typeof s !== 'string') return s;
  const trimmed = s.trim();
  if (!trimmed) return s;
  if (TZ_AWARE_RE.test(trimmed)) return trimmed;
  if (NAIVE_SPACE_RE.test(trimmed)) {
    return `${trimmed.replace(' ', 'T')}${BR_OFFSET}`;
  }
  if (NAIVE_ISO_RE.test(trimmed)) {
    return `${trimmed}${BR_OFFSET}`;
  }
  // Fallback: naive desconhecido — append offset BR (compat com worker legado).
  return `${trimmed}${BR_OFFSET}`;
}

/** valor em reais (ex.: 105 ou 105.5) → price_cents inteiro. null-safe. */
function valorToCents(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/**
 * Mapeia um registro da listagem Trinks → row de trinks_appointments.
 * `phone` (já normalizado) é injetado à parte (vem de /clientes/:id).
 * Retorna null se faltar campo obrigatório (id ou dataHoraInicio).
 */
function mapAppointment(rec, phone = null) {
  if (!rec || rec.id == null || !rec.dataHoraInicio) return null;
  return {
    trinks_id: String(rec.id),
    client_trinks_id: rec.cliente?.id != null ? String(rec.cliente.id) : null,
    client_phone: phone,
    client_name: rec.cliente?.nome ?? null,
    professional_id: rec.profissional?.id != null ? String(rec.profissional.id) : null,
    professional_name: rec.profissional?.nome ?? null,
    service_id: rec.servico?.id != null ? String(rec.servico.id) : null,
    service_name: rec.servico?.nome ?? null,
    status: mapStatus(rec.status?.id),
    scheduled_at: toTimestamptz(rec.dataHoraInicio),
    // CHECK (duration_min > 0): duração 0/negativa/inválida → null.
    duration_min: Number(rec.duracaoEmMinutos) > 0 ? Number(rec.duracaoEmMinutos) : null,
    price_cents: valorToCents(rec.valor),
    // Gaps Fase 0: a listagem não traz criação/cancelamento; ficam NULL.
    created_at_trinks: null,
    updated_at_trinks: rec.dataHoraUltimaAlteracao != null
      ? toTimestamptz(rec.dataHoraUltimaAlteracao)
      : null,
    cancelled_at: null,
    no_show_at: null,
    raw: rec,
  };
}

module.exports = {
  mapStatus,
  normalizePhoneBR,
  valorToCents,
  toTimestamptz,
  mapAppointment,
  buildCancelPayload,
  STATUS_BY_ID,
  QUEM_CANCELOU,
  BR_OFFSET,
};
