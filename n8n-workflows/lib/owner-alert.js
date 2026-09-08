/**
 * Monta payload duplo para ALERT_WEBHOOK_URL:
 * - technical: JSON completo para logs entre agentes
 * - owner_summary: texto humano para o dono (Victor / Grok Bot)
 */

const ERROR_LABELS = {
  intent_parse_failed: 'nao entendeu o que a pessoa queria',
  tess_empty_response: 'assistente nao respondeu — enviou mensagem generica',
  trinks_error: 'sistema de agenda falhou',
  booking_failed: 'nao conseguiu confirmar o agendamento',
  meta_send_failed: 'nao conseguiu enviar a resposta no WhatsApp',
  router_dispatch: 'mensagem roteada para o agente correto',
};

const STATUS_EMOJI = {
  success: '✅',
  error: '❌',
  warning: '🟡',
  info: 'ℹ️',
};

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  return `***${digits.slice(-4)}`;
}

function shortId(messageId) {
  if (!messageId) return '?';
  const s = String(messageId);
  return s.length > 8 ? s.slice(-6) : s;
}

function nowSp() {
  return new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function truncate(text, max = 120) {
  const s = String(text || '').trim();
  if (!s) return '(sem texto)';
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

function buildOwnerSummary(input) {
  const status = input.status || 'info';
  const emoji = STATUS_EMOJI[status] || STATUS_EMOJI.info;
  const num = input.atendimento_num || shortId(input.message_id);
  const cliente = input.contact_name || maskPhone(input.phone);
  const pediuText = truncate(input.pediu || input.message);
  const botText = truncate(
    input.bot_action || ERROR_LABELS[input.error_code] || 'processou a mensagem',
    100,
  );
  const resultText =
    input.result_label ||
    ERROR_LABELS[input.error_code] ||
    (status === 'success' ? 'deu certo' : status === 'warning' ? 'precisa de atencao' : 'deu errado');

  return [
    `📱 Atendimento #${num}`,
    `👤 Cliente: ${cliente}`,
    `💬 Pediu: ${pediuText}`,
    `🤖 Bot: ${botText}`,
    `${emoji} Resultado: ${resultText}`,
    `⏱️ ${nowSp()} (SP)`,
  ].join('\n');
}

function buildAlertPayload(input) {
  const owner_summary = buildOwnerSummary(input);
  return {
    channel: 'owner_alert',
    audience: 'owner',
    owner_summary,
    technical: {
      workflow: input.workflow || null,
      event: input.event || 'alert',
      status: input.status || 'info',
      error_code: input.error_code || null,
      message_id: input.message_id || null,
      phone: input.phone || null,
      contact_name: input.contact_name || null,
      intent: input.intent || null,
      confidence: input.confidence ?? null,
      pediu: input.pediu || input.message || null,
      bot_action: input.bot_action || null,
      details: input.details || null,
      timestamp: new Date().toISOString(),
    },
  };
}

/** Versao compacta para colar em Code nodes do n8n (sem require). */
function buildAlertPayloadInline(input) {
  return buildAlertPayload(input);
}

module.exports = {
  ERROR_LABELS,
  STATUS_EMOJI,
  maskPhone,
  shortId,
  buildOwnerSummary,
  buildAlertPayload,
  buildAlertPayloadInline,
};
