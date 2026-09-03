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
  const bookingCancels = [];
  let bookingReschedule = null;
  const bookingReschedules = [];
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

  const cancelRe = /\[BOOKING_CANCEL\s+([^\]]+)\]/gi;
  let cancelMatch = cancelRe.exec(clean || '');
  while (cancelMatch) {
    const a = parseInlineArgs(cancelMatch[1]);
    if (a.bookingId) {
      bookingCancels.push({
        agendamento_id: parseInt(a.bookingId, 10),
        motivo: a.motivo,
      });
    }
    cancelMatch = cancelRe.exec(clean || '');
  }
  if (bookingCancels.length) {
    bookingCancel = bookingCancels[0];
    clean = clean.replace(/\[BOOKING_CANCEL\s+[^\]]+\]/gi, '').trim();
  }

  const reschedRe = /\[BOOKING_RESCHEDULE\s+([^\]]+)\]/gi;
  let reschedMatch = reschedRe.exec(clean || '');
  while (reschedMatch) {
    const a = parseInlineArgs(reschedMatch[1]);
    if (a.bookingId && a.novoDataHoraInicio) {
      bookingReschedules.push({
        agendamento_id: parseInt(a.bookingId, 10),
        date_time: a.novoDataHoraInicio,
        service_id: a.servicoId ? parseInt(a.servicoId, 10) : undefined,
        professional_id: a.profissionalId ? parseInt(a.profissionalId, 10) : undefined,
      });
    }
    reschedMatch = reschedRe.exec(clean || '');
  }
  if (bookingReschedules.length) {
    bookingReschedule = bookingReschedules[0];
    clean = clean.replace(/\[BOOKING_RESCHEDULE\s+[^\]]+\]/gi, '').trim();
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
  if (!bookingCancels.length) {
    const cancelMatch = clean.match(/\[BOOKING_CANCEL\]\s*\n?({[\s\S]*?})/i);
    if (cancelMatch) {
      try {
        const parsed = JSON.parse(normalizeJsonQuotes(cancelMatch[1]));
        if (parsed) {
          bookingCancels.push(parsed);
          bookingCancel = parsed;
        }
      } catch (err) { console.warn('[stripBookingTags] BOOKING_CANCEL JSON parse falhou:', err.message, '| raw:', cancelMatch[1].slice(0, 200)); }
      clean = clean.replace(cancelMatch[0], '').trim();
    }
  }
  if (!bookingReschedules.length) {
    const reschedMatch = clean.match(/\[BOOKING_RESCHEDULE\]\s*\n?({[\s\S]*?})/i);
    if (reschedMatch) {
      try {
        const parsed = JSON.parse(normalizeJsonQuotes(reschedMatch[1]));
        if (parsed) {
          bookingReschedules.push(parsed);
          bookingReschedule = parsed;
        }
      } catch (err) { console.warn('[stripBookingTags] BOOKING_RESCHEDULE JSON parse falhou:', err.message, '| raw:', reschedMatch[1].slice(0, 200)); }
      clean = clean.replace(reschedMatch[0], '').trim();
    }
  }

  clean = clean.replace(/\[BOOKING_REQUEST\]\s*\n?{[\s\S]*?}/gi, '').trim();
  clean = clean.replace(/^\s*[\[\]]\s*$/gm, '').trim();

  return {
    clean,
    bookingConfirm,
    bookingCreates,
    bookingCancel,
    bookingCancels,
    bookingReschedule,
    bookingReschedules,
    handoffHuman,
  };
}

const RESIDUAL_TAG_RE = /\[(BOOKING_CREATE|BOOKING_CANCEL|BOOKING_RESCHEDULE|BOOKING_CONFIRM|BOOKING_REQUEST|HANDOFF_HUMAN)[^\]]*\]/gi;

/** Tags inventadas pelo modelo (ex. CHECK_AVAILABILITY) — nunca devem ir ao WhatsApp. */
const UNKNOWN_TAG_RE = /\[[^\]]{1,800}\]/g;

function shouldKeepBracketTag(tagBody) {
  const body = String(tagBody || '');
  if (/^BOOKING_/i.test(body)) return true;
  if (/^HANDOFF_HUMAN/i.test(body)) return true;
  if (/CLIENTE ENVIOU/i.test(body)) return true;
  if (/AUDIO TRANSCRITO/i.test(body)) return true;
  if (/STICKER/i.test(body)) return true;
  return false;
}

function stripUnknownTags(text) {
  return String(text || '').replace(UNKNOWN_TAG_RE, (match) => {
    const body = match.slice(1, -1);
    return shouldKeepBracketTag(body) ? match : '';
  });
}

function stripModelScratch(text) {
  const fence = '`'.repeat(3);
  let s = String(text || '');
  const fenceRe = new RegExp(fence + '[\\s\\S]*?' + fence, 'g');
  const unclosedRe = new RegExp(fence + '[\\s\\S]*$', 'g');
  s = s.replace(fenceRe, '');
  s = s.replace(unclosedRe, '');
  s = s.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  s = s.replace(/<\/?(?:function_call|tool_call|tool_use|invoke)[^>]*>/gi, '');
  s = s.replace(/^\s*\[Valid[^\n]*$/gim, '');
  return s;
}

const STRIP_TAG_FALLBACK = 'Deixa eu conferir esse horário.';

function stripResidualBookingTags(text) {
  let s = String(text || '');
  s = s.replace(RESIDUAL_TAG_RE, '');
  s = s.replace(/\[BOOKING_CONFIRM\]\s*\n?{[\s\S]*?}/gi, '');
  s = s.replace(/\[BOOKING_CANCEL\]\s*\n?{[\s\S]*?}/gi, '');
  s = s.replace(/\[BOOKING_RESCHEDULE\]\s*\n?{[\s\S]*?}/gi, '');
  s = s.replace(/\[BOOKING_REQUEST\]\s*\n?{[\s\S]*?}/gi, '');
  s = stripModelScratch(s);
  s = stripUnknownTags(s);
  s = s.replace(/\bTA\s*-\s*/g, '');
  s = s.replace(/^\s*[\[\]]\s*$/gm, '');
  s = s.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!s) return STRIP_TAG_FALLBACK;
  return s;
}

const PREMATURE_CONFIRM_PATTERNS = [
  /\b(agendado|confirmado|pronto)\s*[,!.]*/gi,
  /\b(agendamento )?(realizado|finalizado|fechado)\b/gi,
  /\bte esperamos\b/gi,
  /\b(cancelando|cancelado)\b[^\n]*/gi,
  /\bvou (pedir o )?cancelamento\b[^\n]*/gi,
  /\b(já )?cancelei\b[^\n]*/gi,
  /\bdesmarquei\b[^\n]*/gi,
  /\bvou cancelar\b[^\n]*/gi,
  /\bta garantido\b[^\n]*/gi,
  /\btá garantido\b[^\n]*/gi,
  /\bvou registrar\b[^\n]*/gi,
  /\bgabriel confere\b[^\n]*/gi,
  /\brecepcao confere\b[^\n]*/gi,
  /\brecepção confere\b[^\n]*/gi,
  /\bjá marcado\b[^\n]*/gi,
  /\bja marcado\b[^\n]*/gi,
  /\bjá está marcado\b[^\n]*/gi,
  /\bja esta marcado\b[^\n]*/gi,
  /\bvou reagendar\b[^\n]*/gi,
];

const POST_FAIL_CONFIRM_PATTERNS = [
  /\bj[aá]\s+confirmamos\b[^\n]*/gi,
  /\btudo certo com\b[^\n]*/gi,
  /\bseu agendamento est[aá][^\n]*/gi,
];

const COMBO_FUSION_PATTERNS = [
  /\bprontinho\b[^\n]*/gi,
  /\b(?:franja|escova|corte|barba|manicure)[^\n]*\b(?:\+| e )\b[^\n]*(?:franja|escova|corte|barba|manicure)[^\n]*(?:est[aá]|marcad)/gi,
];

const CREATE_SKIP_CONFIRM_PATTERNS = [
  /\bconfirmo aqui\b[^\n]*/gi,
];

const HONEST_CREATE_SKIP_COPY =
  'Esse horário já está na sua agenda. Se quiser outro dia ou horário, me fala.';

const HONEST_CANCEL_FAIL_COPY =
  'Não consegui localizar/cancelar seu horário automaticamente 😕\nVou pedir pra recepção resolver com você. Um momento!';

function sanitizePrematureConfirm(text, options = {}) {
  let s = text;
  for (const re of PREMATURE_CONFIRM_PATTERNS) s = s.replace(re, '');
  if (options.afterFailOrBlock) {
    for (const re of POST_FAIL_CONFIRM_PATTERNS) s = s.replace(re, '');
  }
  if (options.comboSecondBlocked) {
    for (const re of COMBO_FUSION_PATTERNS) s = s.replace(re, '');
  }
  if (options.createIdempotentSkip) {
    for (const re of CREATE_SKIP_CONFIRM_PATTERNS) s = s.replace(re, '');
  }
  s = s.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return s || 'Deixa eu conferir esse horário na agenda.';
}

function selectOutboundBlocks({
  formattedResponses = [],
  finalMessages = [],
  createIdempotentSkip = false,
  bookingCreatedThisTurn = null,
  bookingResult = null,
  cancelsToRun = [],
  cancelSuccessCount = 0,
} = {}) {
  if (Array.isArray(cancelsToRun)
    && cancelsToRun.length
    && cancelSuccessCount < cancelsToRun.length) {
    if (finalMessages.length) return [...finalMessages];
    return formattedResponses.length ? [...formattedResponses] : [HONEST_CANCEL_FAIL_COPY];
  }
  const hasCreateCommit = bookingCreatedThisTurn === null
    ? Boolean(bookingResult)
    : Boolean(bookingCreatedThisTurn);
  if (createIdempotentSkip && !hasCreateCommit) {
    if (finalMessages.length) return [...finalMessages];
    return [HONEST_CREATE_SKIP_COPY];
  }
  return [...formattedResponses, ...finalMessages];
}

function resolveServiceName(servicesData, serviceId) {
  if (!serviceId || !Array.isArray(servicesData)) return null;
  const match = servicesData.find(s => String(s.id) === String(serviceId));
  return match?.nome || null;
}

const HABILITACAO_HEADER = 'HABILITACAO (só ofereça profissional listado no serviço pedido; ignore HORARIOS VAGOS de quem não faz o serviço):';
const MAX_HABILITACAO_LINES = 120;

function isMaquiagemServiceName(name) {
  const norm = normalizeServiceName(name);
  if (!norm) return false;
  if (norm.includes('maquiagem')) return true;
  return norm === 'make' || norm.startsWith('make ') || norm.includes('make-up') || norm.includes('make up');
}

function isPenteadoServiceName(name) {
  const norm = normalizeServiceName(name);
  return Boolean(norm && norm.includes('penteado'));
}

function nameMatchesFefe(name) {
  const n = normalizeServiceName(name);
  return n.includes('fefe') || n.includes('fernanda');
}

function nameMatchesGi(name) {
  const n = normalizeServiceName(name);
  if (!n) return false;
  if (n.includes('giovanna')) return true;
  return n === 'gi' || n.startsWith('gi ') || n.includes('(gi)');
}

function applyOperationalHabilitacao(servicesData) {
  if (!Array.isArray(servicesData)) return [];
  return servicesData.map((s) => {
    const names = Array.isArray(s.profissionais) ? s.profissionais.filter(Boolean) : [];
    if (isMaquiagemServiceName(s.nome)) {
      const filtered = names.filter(nameMatchesFefe);
      return { ...s, profissionais: filtered.length ? filtered : ['Fefe'] };
    }
    if (isPenteadoServiceName(s.nome)) {
      const filtered = names.filter(nameMatchesGi);
      return { ...s, profissionais: filtered.length ? filtered : ['Giovanna Ferraz'] };
    }
    return s;
  });
}

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

const FREE_SERVICE_NAMES = [
  'corte de franja',
  'teste de mechas',
  'avaliacao',
  'futura mamae',
  'tratamento de retorno de mechas',
];

const CONSULTIVE_COLOR_KEYWORDS = ['mechas', 'luzes', 'californianas', 'balayage', 'platinado'];

function normalizeServiceName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isFreeAllowlistedService(name) {
  const norm = normalizeServiceName(name);
  if (!norm) return false;
  return FREE_SERVICE_NAMES.some(
    (allowed) => norm === allowed || norm.startsWith(`${allowed} `) || norm.startsWith(allowed),
  );
}

function isConsultiveColorService(name) {
  const norm = normalizeServiceName(name);
  if (!norm) return false;
  if (norm.includes('teste de mechas')) return false;
  if (norm.includes('tratamento de retorno de mechas')) return false;
  if (norm.startsWith('avaliacao')) return false;
  if (isFreeAllowlistedService(name)) return false;
  return CONSULTIVE_COLOR_KEYWORDS.some((kw) => norm.includes(kw));
}

/** Penteado / maquiagem — foto + handoff; escova e mechas ficam fora. */
function needsReferenceService(name) {
  const norm = normalizeServiceName(name);
  if (!norm) return false;
  if (norm.includes('escova')) return false;
  if (isConsultiveColorService(name)) return false;
  if (norm.includes('maquiagem')) return true;
  if (norm === 'make' || norm.startsWith('make ') || norm.includes('make-up') || norm.includes('make up')) {
    return true;
  }
  if (norm.includes('penteado')) return true;
  return false;
}

function usesApartirDePricing(name) {
  const norm = normalizeServiceName(name);
  if (!norm) return false;
  if (norm.includes('escova')) return true;
  return needsReferenceService(name);
}

const CLIENT_IMAGE_MARKER = '[CLIENTE ENVIOU IMAGEM]';

function hasRecentClientImageMarker(history, limit = 8) {
  const rows = Array.isArray(history) ? history.slice(-limit) : [];
  return rows.some(
    (m) => m?.role === 'user' && String(m.content || '').includes(CLIENT_IMAGE_MARKER),
  );
}

function formatConsultiveBlockMessage() {
  return 'Pra mechas e luzes o primeiro passo é o Teste de Mechas gratuito — o profissional avalia o cabelo presencialmente e aí sim passa o valor. Quer que eu te encaixe no teste?';
}

function formatZeroPriceBlockMessage() {
  return 'Esse serviço tem preço sob avaliação — nossa equipe confirma o valor certinho antes de agendar. Quer que eu passe pra recepção te ajudar?';
}

function formatNeedsReferenceBlockMessage({ serviceName, price, hasReferenceImage = false } = {}) {
  const norm = normalizeServiceName(serviceName);
  const isMaquiagem = norm.includes('maquiagem')
    || norm === 'make'
    || norm.startsWith('make ')
    || norm.includes('make-up')
    || norm.includes('make up');
  const prof = isMaquiagem ? 'Fefe (Fernanda)' : 'Gi (Giovanna Ferraz)';
  const svcLabel = serviceName || (isMaquiagem ? 'maquiagem' : 'penteado');

  let pricePart = '';
  const preco = Number(price);
  if (Number.isFinite(preco) && preco > 0) {
    pricePart = ` O valor é a partir de ${formatBrl(preco)}.`;
  }

  if (hasReferenceImage) {
    return `Recebi sua referência! Vou passar pra ${prof} — ela confirma duração e valor certinho e a gente te retorna em breve.${pricePart}`;
  }

  return `Pra ${svcLabel}, preciso de uma foto de referência do look que você quer.${pricePart} Depois a ${prof} confirma os detalhes e a gente te encaixa. Pode me mandar a foto?`;
}

function formatServiceCatalogLine(service) {
  const s = service || {};
  const names = Array.isArray(s.profissionais) ? s.profissionais.filter(Boolean) : [];
  const prof = names.length ? ` [${names.join(', ')}]` : '';
  const preco = Number(s.preco);
  const dur = s.duracaoEmMinutos ? ` · ${s.duracaoEmMinutos}min` : '';
  let pricePart = '';
  if (Number.isFinite(preco) && preco === 0) {
    pricePart = isFreeAllowlistedService(s.nome)
      ? ` — gratuito${dur}`
      : ` — preço sob avaliação${dur}`;
  } else if (Number.isFinite(preco) && preco > 0) {
    const apartir = usesApartirDePricing(s.nome) ? 'a partir de ' : '';
    pricePart = ` — ${apartir}${formatBrl(preco)}${dur}`;
  }
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

const FILTER_SERVICE_KEYWORDS = [
  'cort', 'barba', 'mecha', 'escova', 'color', 'camuflag', 'progressiva', 'hidrat',
  'manicure', 'pedicure', 'sobrancelha', 'cilio', 'cílio', 'depil', 'limpeza',
  'maquiagem', 'make', 'penteado', 'laser', 'botox', 'cauteriz', 'tonaliz', 'retoque',
  'avaliacao', 'avaliação', 'global', 'combo', 'cabelo',
];

function filterServicesByKeywords(servicesData, messageText) {
  if (!Array.isArray(servicesData) || servicesData.length === 0) return [];
  const norm = String(messageText || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const hits = FILTER_SERVICE_KEYWORDS.filter((kw) => norm.includes(kw));
  // KB sinonimos-servicos.md: "pé" → Pedicure (default); "mão" → Manicure.
  const padded = ` ${norm} `;
  const peMatch = /(^|[\s,.;:!?])(pe|pes)($|[\s,.;:!?])/.test(padded);
  const maoMatch = /(^|[\s,.;:!?])(mao|maos)($|[\s,.;:!?])/.test(padded);
  if (peMatch) hits.push('pedicure');
  if (maoMatch) hits.push('manicure');
  if (!hits.length) return null;
  const filtered = servicesData.filter((s) => {
    const name = normalizeServiceName(s.nome);
    if (hits.some((kw) => name.includes(kw))) return true;
    if (peMatch && /depilacao de pe|spa dos pes|escalda/.test(name)) return true;
    return false;
  });
  return filtered.length ? filtered : null;
}

function formatServicesText(servicesData) {
  if (!Array.isArray(servicesData) || !servicesData.length) {
    return { text: '', data: [] };
  }
  let txt = 'SERVICOS DISPONIVEIS (use o nome EXATO; snapshot é autoritativo para SKUs com preço; linhas com "preço sob avaliação" seguem regras comerciais — não são cotação):\n';
  for (const s of servicesData) {
    txt += `${formatServiceCatalogLine(s)}\n`;
  }
  return { text: txt, data: servicesData };
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
function buildPersistedSection(persistedMemory, channelPhone, canonicalName) {
  const client = persistedMemory?.client || null;
  const history = persistedMemory?.history;
  const phone = String(channelPhone || client?.phone || '').replace(/\D/g, '');
  const displayName = canonicalName || client?.name || null;
  const lines = [];
  if (displayName) lines.push(`Nome: ${displayName} (WhatsApp — NAO peca de novo)`);
  if (phone) lines.push(`Telefone: ${phone}`);
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
  return '\n\nAGENDAMENTOS FUTUROS DO CLIENTE (cliente já identificado — NAO peca nome; use o bookingId EXATO em [BOOKING_CANCEL]/[BOOKING_RESCHEDULE]; se houver mais de um e o cliente não especificar, PERGUNTE qual):\n'
    + lines.join('\n');
}

function isBookingOwnedByClient(bookingId, futureBookings) {
  const id = String(bookingId || '');
  if (!id) return false;
  return (Array.isArray(futureBookings) ? futureBookings : []).some(
    (b) => String(b.trinks_id) === id,
  );
}

function serviceSkuMatches(appointment, serviceName, serviceId) {
  if (!appointment) return false;
  if (serviceId != null && appointment.service_id != null) {
    return String(appointment.service_id) === String(serviceId);
  }
  if (!serviceName || !appointment.service_name) return false;
  const a = normalizeServiceName(appointment.service_name);
  const b = normalizeServiceName(serviceName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function isKnownServiceSkuNotBookingId(requestedId, { knownServiceIds = [], futureBookings = [] } = {}) {
  const id = String(requestedId || '');
  if (!id) return false;
  const rosa = Array.isArray(futureBookings) ? futureBookings : [];
  if (rosa.some((b) => String(b.trinks_id) === id)) return false;
  const known = new Set((knownServiceIds || []).map((sku) => String(sku)));
  for (const b of rosa) {
    if (b?.service_id != null) known.add(String(b.service_id));
  }
  return known.has(id);
}

/**
 * Resolve agendamentoId para PATCH cancel — só trinks_id de AGENDAMENTOS FUTUROS (B2 / 0007).
 * SKU de serviço nunca é o id do PATCH. Remap SKU→trinks_id só se exatamente 1 futuro tem aquele service_id.
 */
function resolveCancelAgendamentoId({
  cancelTag,
  futureBookings,
  knownServiceIds = [],
} = {}) {
  const rosa = Array.isArray(futureBookings) ? futureBookings : [];
  const requested = cancelTag?.agendamento_id != null && String(cancelTag.agendamento_id) !== ''
    ? String(cancelTag.agendamento_id)
    : '';

  if (!requested) {
    return { agendamentoId: null, reason: 'unresolved' };
  }

  const owned = rosa.find((b) => String(b.trinks_id) === requested);
  if (owned && isBookingOwnedByClient(requested, rosa)) {
    return { agendamentoId: requested, reason: null };
  }

  if (isKnownServiceSkuNotBookingId(requested, { knownServiceIds, futureBookings: rosa })) {
    const skuHits = rosa.filter((b) => String(b.service_id) === requested);
    if (skuHits.length === 1) {
      return { agendamentoId: String(skuHits[0].trinks_id), reason: null };
    }
    if (skuHits.length > 1) {
      return { agendamentoId: null, reason: 'sku_ambiguous' };
    }
    return { agendamentoId: null, reason: 'sku_not_booking' };
  }

  return { agendamentoId: null, reason: 'not_owned' };
}

/**
 * Resolve agendamentoId para PUT reschedule — bind SKU Rosa (P0.6).
 * Retorna { agendamentoId, reason } — reason preenchido quando 0 PUT.
 */
function resolveRescheduleAgendamentoId({
  bookingReschedule,
  futureBookings,
  findClientBookingResult = null,
}) {
  const rosa = Array.isArray(futureBookings) ? futureBookings : [];
  const targetName = bookingReschedule?.service_name;
  const targetId = bookingReschedule?.service_id;

  if (bookingReschedule?.agendamento_id) {
    const id = String(bookingReschedule.agendamento_id);
    const owned = rosa.find((b) => String(b.trinks_id) === id);
    if (!owned || !isBookingOwnedByClient(id, rosa)) {
      return { agendamentoId: null, reason: 'not_owned' };
    }
    if (!serviceSkuMatches(owned, targetName, targetId)) {
      return { agendamentoId: null, reason: 'sku_mismatch' };
    }
    return { agendamentoId: id, reason: null };
  }

  if (!rosa.length) {
    return { agendamentoId: null, reason: 'rosa_vazio' };
  }

  let candidates = rosa.filter((b) => serviceSkuMatches(b, targetName, targetId));
  if (bookingReschedule?.professional_id && candidates.length > 1) {
    const profFiltered = candidates.filter(
      (b) => String(b.professional_id) === String(bookingReschedule.professional_id),
    );
    if (profFiltered.length) candidates = profFiltered;
  }

  if (candidates.length === 1) {
    return { agendamentoId: String(candidates[0].trinks_id), reason: null };
  }

  if (findClientBookingResult) {
    const foundId = String(findClientBookingResult.id || findClientBookingResult.trinks_id || '');
    const owned = rosa.find((b) => String(b.trinks_id) === foundId);
    if (owned && serviceSkuMatches(owned, targetName, targetId)) {
      return { agendamentoId: foundId, reason: null };
    }
    return { agendamentoId: null, reason: 'sku_mismatch' };
  }

  if (candidates.length > 1) {
    return { agendamentoId: null, reason: 'ambiguous' };
  }

  return { agendamentoId: null, reason: 'sku_mismatch' };
}

function formatRescheduleRefusalMessage(reason) {
  if (reason === 'rosa_vazio') {
    return 'Não encontrei um agendamento seu na agenda pra remarcar. Me confirma qual serviço e horário você tinha, ou fala com a recepção.';
  }
  return 'Não consegui remarcar esse horário automaticamente — o serviço não bate com o que está na agenda. Me confirma qual agendamento você quer mudar, ou a recepção te ajuda.';
}

module.exports = {
  normalizeJsonQuotes,
  parseInlineArgs,
  parseCreateArgs,
  stripBookingTags,
  stripResidualBookingTags,
  stripUnknownTags,
  stripModelScratch,
  sanitizePrematureConfirm,
  selectOutboundBlocks,
  resolveCancelAgendamentoId,
  isKnownServiceSkuNotBookingId,
  sanitizeInventedClientTurns,
  resolveServiceName,
  applyOperationalHabilitacao,
  isMaquiagemServiceName,
  isPenteadoServiceName,
  renderHabilitacaoMap,
  formatBrl,
  formatServiceCatalogLine,
  formatConsultiveBlockMessage,
  formatZeroPriceBlockMessage,
  formatNeedsReferenceBlockMessage,
  servicesForProfessional,
  filterServicesByKeywords,
  formatServicesText,
  formatIncompatibleProfServiceMessage,
  buildPersistedSection,
  renderFutureBookings,
  isFreeAllowlistedService,
  isConsultiveColorService,
  needsReferenceService,
  usesApartirDePricing,
  hasRecentClientImageMarker,
  isBookingOwnedByClient,
  serviceSkuMatches,
  resolveRescheduleAgendamentoId,
  formatRescheduleRefusalMessage,
  normalizeServiceName,
  CLIENT_IMAGE_MARKER,
  FREE_SERVICE_NAMES,
  HABILITACAO_HEADER,
  PREMATURE_CONFIRM_PATTERNS,
  POST_FAIL_CONFIRM_PATTERNS,
  CREATE_SKIP_CONFIRM_PATTERNS,
  HONEST_CREATE_SKIP_COPY,
  HONEST_CANCEL_FAIL_COPY,
};
