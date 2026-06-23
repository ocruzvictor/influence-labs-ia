const { mapAppointment, normalizePhoneBR, valorToCents } = require('./trinks-mapping');

function parseJson(value) {
  if (value == null) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return { raw: value }; }
}

function unwrapMessage(envelope) {
  const message = parseJson(envelope?.Message);
  const payload = message.Data || message.data || message.Payload || message.payload
    || message.Object || message.object || message;
  const eventId = Number(
    message.EventId ?? message.eventId ?? message.EventoId ?? message.eventoId
    ?? message.EventType ?? message.eventType ?? message.TipoEvento ?? message.tipoEvento,
  );
  const actionId = Number(message.Action ?? message.action ?? message.Acao ?? message.acao);
  return {
    message,
    payload: payload && typeof payload === 'object' ? payload : {},
    eventId: Number.isFinite(eventId) ? eventId : null,
    actionId: Number.isFinite(actionId) ? actionId : null,
  };
}

function getId(payload) {
  return payload.id ?? payload.Id ?? payload.ID ?? payload.clienteId
    ?? payload.profissionalId ?? payload.agendamentoId;
}

function mapClient(payload, deleted = false) {
  const id = getId(payload);
  if (id == null) return null;
  return {
    trinksId: id,
    phone: normalizePhoneBR(payload.telefone ?? payload.phone ?? payload.celular),
    name: payload.nome ?? payload.name ?? null,
    email: payload.email ?? null,
    birthDate: payload.dataNascimento ?? payload.birthDate ?? null,
    active: !deleted && payload.ativo !== false,
    deletedAt: deleted ? new Date() : null,
    sourceUpdatedAt: payload.dataHoraUltimaAlteracao ?? payload.updatedAt ?? null,
    raw: payload,
  };
}

function mapProfessional(payload, deleted = false) {
  const id = getId(payload);
  if (id == null) return null;
  return {
    trinksId: id,
    name: payload.nome ?? payload.name ?? null,
    nickname: payload.apelido ?? payload.nickname ?? null,
    active: !deleted && payload.ativo !== false,
    deletedAt: deleted ? new Date() : null,
    sourceUpdatedAt: payload.dataHoraUltimaAlteracao ?? payload.updatedAt ?? null,
    raw: payload,
  };
}

function normalizeAppointmentPayload(payload) {
  if (payload.profissionalId != null && !payload.profissional) {
    payload = {
      ...payload,
      profissional: { id: payload.profissionalId, nome: payload.profissionalNome },
      servico: { id: payload.servicoId, nome: payload.servicoNome },
      cliente: { id: payload.clienteId, nome: payload.clienteNome },
      status: payload.status && typeof payload.status === 'object'
        ? payload.status
        : { id: payload.statusId ?? payload.status },
    };
  }
  return payload;
}

function mapWebhookAppointment(payload, { deleted = false, clientPhone = null } = {}) {
  const normalized = normalizeAppointmentPayload(payload);
  const mapped = mapAppointment(normalized, clientPhone);
  if (!mapped) return null;
  return {
    trinksId: mapped.trinks_id,
    clientTrinksId: mapped.client_trinks_id,
    clientPhone: mapped.client_phone,
    clientName: mapped.client_name,
    professionalId: mapped.professional_id,
    professionalName: mapped.professional_name,
    serviceId: mapped.service_id,
    serviceName: mapped.service_name,
    status: deleted ? 'cancelled' : mapped.status,
    scheduledAt: mapped.scheduled_at,
    durationMin: mapped.duration_min,
    priceCents: mapped.price_cents ?? valorToCents(payload.valor),
    createdAtTrinks: payload.dataHoraCriacao ?? payload.createdAt ?? null,
    updatedAtTrinks: mapped.updated_at_trinks,
    cancelledAt: deleted ? new Date() : null,
    deletedAt: deleted ? new Date() : null,
    raw: payload,
  };
}

function createTrinksWebhookProcessor({ db, store }) {
  async function getConfirmedTopicArn() {
    const result = await db.query(
      `SELECT topic_arn
         FROM trinks_webhook_events
        WHERE message_type = 'SubscriptionConfirmation'
          AND processing_status = 'processed'
        ORDER BY processed_at DESC
        LIMIT 1`,
    );
    if (!result) throw new Error('Postgres unavailable while reading trusted SNS topic');
    return result.rows?.[0]?.topic_arn || null;
  }

  async function persistEnvelope(envelope) {
    const parsed = unwrapMessage(envelope);
    const result = await db.query(
      `INSERT INTO trinks_webhook_events
        (message_id, topic_arn, message_type, event_id, action_id, subject,
         envelope, message_payload, processing_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, 'processing')
       ON CONFLICT (message_id) DO UPDATE SET
         processing_status = 'processing',
         attempts = trinks_webhook_events.attempts + 1,
         error = NULL,
         received_at = NOW()
       WHERE trinks_webhook_events.processing_status = 'failed'
          OR (
            trinks_webhook_events.processing_status = 'processing'
            AND trinks_webhook_events.received_at < NOW() - INTERVAL '5 minutes'
          )
       RETURNING message_id`,
      [
        envelope.MessageId,
        envelope.TopicArn,
        envelope.Type,
        parsed.eventId,
        parsed.actionId,
        envelope.Subject || null,
        JSON.stringify(envelope),
        JSON.stringify(parsed.message),
      ],
    );
    if (!result) throw new Error('Postgres unavailable while persisting Trinks webhook');
    return result?.rows?.length ? { duplicate: false } : { duplicate: true };
  }

  async function markProcessed(messageId, error = null) {
    const result = await db.query(
      `UPDATE trinks_webhook_events
          SET processing_status = $3,
              error = $2,
              processed_at = NOW()
        WHERE message_id = $1`,
      [messageId, error, error ? 'failed' : 'processed'],
    );
    if (!result) throw new Error('Postgres unavailable while updating Trinks webhook');
  }

  async function processNotification(envelope) {
    const parsed = unwrapMessage(envelope);
    const deleted = parsed.actionId === 3 || [7, 13].includes(parsed.eventId);
    try {
      if ([3, 4].includes(parsed.eventId)) {
        const client = mapClient(parsed.payload, deleted);
        if (client) await store.upsertClient(client);
      } else if ([5, 6, 7].includes(parsed.eventId)) {
        const professional = mapProfessional(parsed.payload, deleted);
        if (professional) await store.upsertProfessional(professional);
      } else if ([11, 12, 13].includes(parsed.eventId)) {
        const clientId = parsed.payload.cliente?.id ?? parsed.payload.clienteId;
        const localClient = clientId == null ? null : await store.getClientByTrinksId(clientId);
        const appointment = mapWebhookAppointment(parsed.payload, {
          deleted,
          clientPhone: localClient?.phone || null,
        });
        if (appointment) await store.upsertAppointment(appointment);
      } else {
        throw new Error(`Unsupported Trinks webhook event: ${parsed.eventId}`);
      }
      await markProcessed(envelope.MessageId);
      return { eventId: parsed.eventId, actionId: parsed.actionId };
    } catch (err) {
      await markProcessed(envelope.MessageId, String(err.message).slice(0, 500));
      throw err;
    }
  }

  return {
    getConfirmedTopicArn,
    persistEnvelope,
    processNotification,
    markProcessed,
    unwrapMessage,
  };
}

module.exports = {
  createTrinksWebhookProcessor,
  unwrapMessage,
  mapClient,
  mapProfessional,
  mapWebhookAppointment,
};
