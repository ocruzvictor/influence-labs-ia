const input = $json;
const ERROR_LABELS = {
  intent_parse_failed: 'nao entendeu o que a pessoa queria',
  tess_empty_response: 'assistente nao respondeu — enviou mensagem generica',
  trinks_error: 'sistema de agenda falhou',
  booking_failed: 'nao conseguiu confirmar o agendamento',
  meta_send_failed: 'nao conseguiu enviar a resposta no WhatsApp',
};
const STATUS_EMOJI = { success: '✅', error: '❌', warning: '🟡', info: 'ℹ️' };
const maskPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length <= 4 ? '***' : `***${d.slice(-4)}`; };
const shortId = (id) => { if (!id) return '?'; const s = String(id); return s.length > 8 ? s.slice(-6) : s; };
const nowSp = () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const trunc = (t, m = 120) => { const s = String(t || '').trim(); if (!s) return '(sem texto)'; return s.length > m ? `${s.slice(0, m - 3)}...` : s; };

const status = input.status || 'info';
const emoji = STATUS_EMOJI[status] || STATUS_EMOJI.info;
const num = input.atendimento_num || shortId(input.message_id);
const cliente = input.contact_name || maskPhone(input.phone);
const pediuText = trunc(input.pediu || input.message);
const botText = trunc(input.bot_action || ERROR_LABELS[input.error_code] || 'processou a mensagem', 100);
const resultText = input.result_label || ERROR_LABELS[input.error_code] || (status === 'success' ? 'deu certo' : status === 'warning' ? 'precisa de atencao' : 'deu errado');

const owner_summary = [
  `📱 Atendimento #${num}`,
  `👤 Cliente: ${cliente}`,
  `💬 Pediu: ${pediuText}`,
  `🤖 Bot: ${botText}`,
  `${emoji} Resultado: ${resultText}`,
  `⏱️ ${nowSp()} (SP)`,
].join('\n');

return [{
  json: {
    channel: 'owner_alert',
    audience: 'owner',
    owner_summary,
    technical: {
      workflow: input.workflow || null,
      event: input.event || 'alert',
      status,
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
  },
}];
