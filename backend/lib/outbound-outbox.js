/**
 * Watchdog de outbound pós-ACK. Victor autorizou duplicar (2026-09-03).
 * Não muta Trinks. Copy honesta — nunca afirma sucesso de agenda (I1).
 */

const OUTBOX_COPY =
  'Tive um problema técnico agora. Não registrei nenhuma alteração na sua agenda. Pode mandar de novo?';

const DEFAULT_WAIT_MS = 45_000;

function startOutboundWatchdog({
  phone,
  sessionId,
  phoneNumberId,
  waitMs = DEFAULT_WAIT_MS,
  sendFn,
  emitEvent,
}) {
  let sentFinal = false;
  let fired = false;

  async function fire(motivo) {
    if (sentFinal || fired) return { sent: false, skipped: true };
    fired = true;
    let sent = false;
    if (typeof sendFn === 'function' && phoneNumberId) {
      try {
        await sendFn(sessionId, OUTBOX_COPY, phoneNumberId);
        sent = true;
      } catch (err) {
        console.error('[outbox] falha ao enviar copy honesta:', err.message);
        return { sent: false, skipped: false, error: err.message };
      }
    }
    if (typeof emitEvent === 'function') {
      try {
        await emitEvent({
          event: 'outbound.watchdog',
          clientPhone: phone,
          motivo,
          payload: { wait_ms: waitMs, duplicate_ok: true },
        });
      } catch (err) {
        console.error('[outbox] falha ao emitir evento:', err.message);
      }
    }
    return { sent, skipped: false };
  }

  const timer = setTimeout(() => {
    fire('ack_sem_outbound').catch(() => {});
  }, Math.max(5_000, Number(waitMs) || DEFAULT_WAIT_MS));
  if (typeof timer.unref === 'function') timer.unref();

  return {
    markFinal() {
      sentFinal = true;
      clearTimeout(timer);
    },
    async fail(motivo) {
      clearTimeout(timer);
      return fire(motivo || 'catch_sem_outbound');
    },
    copy: OUTBOX_COPY,
  };
}

module.exports = {
  OUTBOX_COPY,
  DEFAULT_WAIT_MS,
  startOutboundWatchdog,
};
