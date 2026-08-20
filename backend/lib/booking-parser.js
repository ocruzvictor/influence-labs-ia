/**
 * Parser de tags de booking emitidas pelo TESS Conversa.
 *
 * Single source of truth. Importado por:
 *   - backend/server.js (uso em prod)
 *   - scripts/test-parser-tags.mjs (testes unitários)
 *
 * Suporta dois formatos:
 *
 *   v2 inline (canônico atual, formato preferido pelo prompt v2):
 *     [BOOKING_CREATE servicoId=1 profissionalId=3 dataHoraInicio=2026-05-30T10:30:00-03:00 valor=85 duracaoMinutos=60]
 *     [BOOKING_CANCEL bookingId=12345 motivo=cliente_desistiu]
 *     [BOOKING_RESCHEDULE bookingId=12345 novoDataHoraInicio=2026-06-01T14:00:00-03:00 servicoId=1 profissionalId=3]
 *     [HANDOFF_HUMAN motivo=reclamacao_atraso]
 *
 *   v1 legacy (preservado pra retrocompat com agentes antigos):
 *     [BOOKING_CONFIRM]
 *     {"service_id":1,"professional_id":3,"date_time":"...","valor":85}
 *
 *     [BOOKING_CANCEL]
 *     {"agendamento_id":12345,"motivo":"..."}
 *
 *     [BOOKING_RESCHEDULE]
 *     {"agendamento_id":12345,"date_time":"..."}
 */

function normalizeJsonQuotes(s) {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/ /g, ' ');
}

function parseInlineArgs(argsStr) {
  const args = {};
  const re = /(\w+)=([^\s\]]+)/g;
  let m;
  while ((m = re.exec(argsStr)) !== null) {
    args[m[1]] = m[2];
  }
  return args;
}

function parseCreateArgs(argsStr) {
  const a = parseInlineArgs(argsStr);
  if (!a.servicoId && !a.dataHoraInicio && !a.profissionalId) return null;
  return {
    service_id: a.servicoId ? parseInt(a.servicoId, 10) : undefined,
    professional_id: a.profissionalId ? parseInt(a.profissionalId, 10) : undefined,
    date_time: a.dataHoraInicio || undefined,
    valor: a.valor ? parseFloat(a.valor) : undefined,
    duration_minutes: a.duracaoMinutos ? parseInt(a.duracaoMinutos, 10) : undefined,
  };
}

/**
 * Remove tags de booking do texto e retorna estrutura normalizada.
 */
function stripBookingTags(tessText) {
  let clean = tessText;
  let bookingConfirm = null;
  const bookingCreates = [];
  let bookingCancel = null;
  let bookingReschedule = null;
  let handoffHuman = null;

  const createRe = /\[BOOKING_CREATE\s+([^\]]+)\]/gi;
  let createMatch = createRe.exec(clean || '');
  while (createMatch) {
    const parsed = parseCreateArgs(createMatch[1]);
    if (parsed) bookingCreates.push(parsed);
    createMatch = createRe.exec(clean || '');
  }
  if (bookingCreates.length) {
    bookingConfirm = bookingCreates[0];
    clean = clean.replace(/\[BOOKING_CREATE\s+[^\]]+\]/gi, '').trim();
  }

  const cancelInline = clean.match(/\[BOOKING_CANCEL\s+([^\]]+)\]/i);
  if (cancelInline) {
    const a = parseInlineArgs(cancelInline[1]);
    if (a.bookingId) {
      bookingCancel = {
        agendamento_id: parseInt(a.bookingId, 10),
        motivo: a.motivo,
      };
    }
    clean = clean.replace(cancelInline[0], '').trim();
  }

  const reschedInline = clean.match(/\[BOOKING_RESCHEDULE\s+([^\]]+)\]/i);
  if (reschedInline) {
    const a = parseInlineArgs(reschedInline[1]);
    if (a.bookingId && a.novoDataHoraInicio) {
      bookingReschedule = {
        agendamento_id: parseInt(a.bookingId, 10),
        date_time: a.novoDataHoraInicio,
        service_id: a.servicoId ? parseInt(a.servicoId, 10) : undefined,
        professional_id: a.profissionalId ? parseInt(a.profissionalId, 10) : undefined,
      };
    }
    clean = clean.replace(reschedInline[0], '').trim();
  }

  const handoffInline = clean.match(/\[HANDOFF_HUMAN(?:\s+([^\]]+))?\]/i);
  if (handoffInline) {
    const a = handoffInline[1] ? parseInlineArgs(handoffInline[1]) : {};
    handoffHuman = { motivo: a.motivo || 'cliente_pediu_humano' };
    clean = clean.replace(handoffInline[0], '').trim();
  }

  if (!bookingConfirm) {
    const confMatch = clean.match(/\[BOOKING_CONFIRM\]\s*\n?({[\s\S]*?})/i);
    if (confMatch) {
      try { bookingConfirm = JSON.parse(normalizeJsonQuotes(confMatch[1])); }
      catch (err) { console.warn('[stripBookingTags] BOOKING_CONFIRM JSON parse falhou:', err.message, '| raw:', confMatch[1].slice(0, 200)); }
      clean = clean.replace(confMatch[0], '').trim();
      if (bookingConfirm) bookingCreates.push(bookingConfirm);
    }
  }
  if (!bookingCancel) {
    const cancelMatch = clean.match(/\[BOOKING_CANCEL\]\s*\n?({[\s\S]*?})/i);
    if (cancelMatch) {
      try { bookingCancel = JSON.parse(normalizeJsonQuotes(cancelMatch[1])); }
      catch (err) { console.warn('[stripBookingTags] BOOKING_CANCEL JSON parse falhou:', err.message, '| raw:', cancelMatch[1].slice(0, 200)); }
      clean = clean.replace(cancelMatch[0], '').trim();
    }
  }
  if (!bookingReschedule) {
    const reschedMatch = clean.match(/\[BOOKING_RESCHEDULE\]\s*\n?({[\s\S]*?})/i);
    if (reschedMatch) {
      try { bookingReschedule = JSON.parse(normalizeJsonQuotes(reschedMatch[1])); }
      catch (err) { console.warn('[stripBookingTags] BOOKING_RESCHEDULE JSON parse falhou:', err.message, '| raw:', reschedMatch[1].slice(0, 200)); }
      clean = clean.replace(reschedMatch[0], '').trim();
    }
  }

  clean = clean.replace(/\[BOOKING_REQUEST\]\s*\n?{[\s\S]*?}/gi, '').trim();
  clean = clean.replace(/^\s*[\[\]]\s*$/gm, '').trim();

  return { clean, bookingConfirm, bookingCreates, bookingCancel, bookingReschedule, handoffHuman };
}

const PREMATURE_CONFIRM_PATTERNS = [
  /\b(agendado|confirmado|pronto)\s*!+/gi,
  /\b(agendamento )?(realizado|finalizado|fechado)\b/gi,
  /\bte esperamos\b/gi,
  /\b(cancelando|cancelado)\b[^\n]*/gi,
  /\bvou (pedir o )?cancelamento\b[^\n]*/gi,
];

function sanitizePrematureConfirm(text) {
  let s = text;
  for (const re of PREMATURE_CONFIRM_PATTERNS) s = s.replace(re, '');
  s = s.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return s || 'Confirmo aqui então 👀';
}

function resolveServiceName(servicesData, serviceId) {
  if (!serviceId || !Array.isArray(servicesData)) return null;
  const match = servicesData.find(s => String(s.id) === String(serviceId));
  return match?.nome || null;
}

const HABILITACAO_HEADER = 'HABILITACAO (só ofereça profissional listado no serviço pedido; ignore HORARIOS VAGOS de quem não faz o serviço):';
const MAX_HABILITACAO_LINES = 120;

function renderHabilitacaoMap(servicesData) {
  if (!Array.isArray(servicesData) || servicesData.length === 0) return '';
  const lines = [];
  for (const s of servicesData) {
    const names = Array.isArray(s.profissionais) ? s.profissionais.filter(Boolean) : [];
    if (!names.length) continue;
    const id = s.id != null ? s.id : '?';
    const nome = s.nome || 'Serviço';
    lines.push(`- ${nome} (ID ${id}): ${names.join(', ')}`);
    if (lines.length >= MAX_HABILITACAO_LINES) break;
  }
  if (!lines.length) return '';
  let out = `\n${HABILITACAO_HEADER}\n${lines.join('\n')}`;
  if (lines.length >= MAX_HABILITACAO_LINES) {
    out += '\n- ... (lista truncada; consulte SERVICOS DISPONIVEIS para demais)';
  }
  return out;
}

function formatBrl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return `R$ ${n}`;
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

const LASER_SKU_NAMES = new Set([
  'Depilação em 1 área',
  'Depilação em 3 áreas',
  'Depilação em corpo todo',
]);

function formatServiceCatalogLine(service) {
  const s = service || {};
  const names = Array.isArray(s.profissionais) ? s.profissionais.filter(Boolean) : [];
  const prof = names.length ? ` [${names.join(', ')}]` : '';
  const price = formatBrl(s.preco);
  const dur = s.duracaoEmMinutos ? ` · ${s.duracaoEmMinutos}min` : '';
  const pricePart = price ? ` — ${price}${dur}` : '';
  const id = s.id != null ? s.id : '?';
  const nome = s.nome || 'Serviço';
  const laserAlias = LASER_SKU_NAMES.has(nome) ? ' (laser)' : '';
  return `- ${nome}${laserAlias}${prof} (ID ${id})${pricePart}`;
}

function servicesForProfessional(servicesData, professionalName) {
  const target = String(professionalName || '').trim().toLowerCase();
  if (!target || !Array.isArray(servicesData)) return [];
  const names = [];
  for (const s of servicesData) {
    const team = Array.isArray(s.profissionais) ? s.profissionais : [];
    const hit = team.some((n) => String(n).toLowerCase() === target);
    if (hit && s.nome) names.push(s.nome);
  }
  return names;
}

function formatVisitDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
}

/**
 * Cadastro injetado no TESS. Header DADOS_CLIENTE (o prompt NUNCA lê PERFIL).
 * Telefone do canal WhatsApp sempre que existir — mesmo cliente novo sem row em clients.
 */
function buildPersistedSection(persistedMemory, channelPhone) {
  const client = persistedMemory?.client || null;
  const history = persistedMemory?.history;
  const phone = String(channelPhone || client?.phone || '').replace(/\D/g, '');
  const lines = [];
  if (client?.name) lines.push(`Nome: ${client.name}`);
  if (phone) lines.push(`Telefone: ${phone} (WhatsApp — NAO peca de novo)`);
  if (client?.last_service) lines.push(`Ultimo servico: ${client.last_service}`);
  if (client?.last_visit) lines.push(`Ultima visita: ${formatVisitDate(client.last_visit)}`);
  if (client?.visit_count) lines.push(`Total de visitas: ${client.visit_count}`);

  let section = '';
  if (lines.length) section += '\nDADOS_CLIENTE:\n' + lines.map((l) => `- ${l}`).join('\n');
  if (history?.length) {
    section += '\n\nHISTORICO ANTERIOR (sessoes anteriores):\n'
      + history.map((m) => `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`).join('\n');
  }
  return section;
}

function formatIncompatibleProfServiceMessage({
  professionalName,
  serviceName,
  enabledProfessionals = [],
  professionalServices = [],
} = {}) {
  const prof = professionalName || 'Esse profissional';
  const svc = serviceName || 'esse serviço';
  const habilitados = Array.isArray(enabledProfessionals) && enabledProfessionals.length
    ? enabledProfessionals.join(', ')
    : 'outros profissionais habilitados listados em HABILITACAO';
  let msg = `${prof} não realiza ${svc} aqui no salão.\n\n`;
  const own = Array.isArray(professionalServices) ? professionalServices.filter(Boolean) : [];
  if (own.length) {
    const shown = own.slice(0, 8);
    const extra = own.length > 8 ? '…' : '';
    msg += `${prof} atende: ${shown.join(', ')}${extra}\n\n`;
  }
  msg += `Posso te oferecer horário com ${habilitados}. Qual prefere?`;
  return msg;
}

function sanitizeInventedClientTurns(text) {
  let s = String(text || '');
  s = s.replace(/^\s*Cliente:\s*.+$/gim, '');
  s = s.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

function renderFutureBookings(bookings, fmtDateTime) {
  if (!Array.isArray(bookings) || bookings.length === 0) return '';
  const fmt = typeof fmtDateTime === 'function' ? fmtDateTime : (v) => String(v);
  const lines = bookings.map(b => {
    const when = fmt(b.scheduled_at);
    const svc = b.service_name || 'serviço';
    const prof = b.professional_name ? ` com ${b.professional_name}` : '';
    return `- bookingId=${b.trinks_id} | ${svc}${prof} em ${when}`;
  });
  return '\n\nAGENDAMENTOS FUTUROS DO CLIENTE (use o bookingId EXATO em [BOOKING_CANCEL]/[BOOKING_RESCHEDULE]; se houver mais de um e o cliente não especificar, PERGUNTE qual):\n'
    + lines.join('\n');
}

module.exports = {
  normalizeJsonQuotes,
  parseInlineArgs,
  parseCreateArgs,
  stripBookingTags,
  sanitizePrematureConfirm,
  sanitizeInventedClientTurns,
  resolveServiceName,
  renderHabilitacaoMap,
  formatBrl,
  formatServiceCatalogLine,
  servicesForProfessional,
  formatIncompatibleProfServiceMessage,
  buildPersistedSection,
  renderFutureBookings,
  HABILITACAO_HEADER,
  PREMATURE_CONFIRM_PATTERNS,
};
