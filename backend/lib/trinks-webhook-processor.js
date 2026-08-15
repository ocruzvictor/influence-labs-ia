const { mapAppointment, normalizePhoneBR, valorToCents } = require('./trinks-mapping');

/** Eventos Trinks que recebemos mas não consumimos — ack sem falha (jul/2026 expansão SNS). */
const IGNORED_EVENT_IDS = new Set([1, 2, 8, 9, 10]);

const STATUS_LABEL_TO_ID = {
  Confirmado: 4,
  'Cliente não compareceu': 6,
  Finalizado: 8,
  Cancelado: 9,
  'Aguardando confirmação': 3,
  'Aguardando confirmacao': 3,
};

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
    ?? message.EventType ?? message.eventType ?? message.TipoEvento ?? message.tipoEvento
    ?? message.TipoDeEvento ?? message.tipoDeEvento,
  );
  const actionId = Number(message.Action ?? message.action ?? message.Acao ?? message.acao);
  return {
    message,
    payload: payload && typeof payload === 'object' ? payload : {},
    eventId: Number.isFinite(eventId) ? eventId : null,
    actionId: Number.isFinite(actionId) ? actionId : null,
  };
}

function extractPhoneFromTelefoneDoCliente(telefones) {
  if (!Array.isArray(telefones) || telefones.length === 0) return null;
  const whatsapp = telefones.find(t => Number(t.Tipo ?? t.tipo) === 6);
  const entry = whatsapp || telefones.find(t => (t.DDD ?? t.ddd) && (t.Numero ?? t.numero)) || telefones[0];
  if (!entry) return null;
  const ddd = entry.DDD ?? entry.ddd ?? '';
  const numero = entry.Numero ?? entry.numero ?? '';
  return normalizePhoneBR(`${ddd}${numero}`)
    || normalizePhoneBR(entry.TelefoneCompleto ?? entry.telefoneCompleto);
}

function parseBrazilianDecimal(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function statusIdFromLabel(status) {
  if (status == null) return null;
  if (typeof status === 'object') return status.id ?? status.Id ?? null;
  const label = String(status).trim();
  if (STATUS_LABEL_TO_ID[label] != null) return STATUS_LABEL_TO_ID[label];
  const match = Object.keys(STATUS_LABEL_TO_ID).find(k => k.toLowerCase() === label.toLowerCase());
  return match ? STATUS_LABEL_TO_ID[match] : null;
}

function getId(payload) {
  return payload.id ?? payload.Id ?? payload.ID ?? payload.clienteId
    ?? payload.profissionalId ?? payload.agendamentoId
    ?? payload.IdDoClienteNoEstabelecimento ?? payload.IdDoCliente
    ?? payload.IdDoProfissionalNoEstabelecimento ?? payload.IdDoProfissional;
}

function mapClient(payload, deleted = false) {
  const id = getId(payload);
  if (id == null) return null;
  return {
    trinksId: id,
    phone: normalizePhoneBR(payload.telefone ?? payload.phone ?? payload.celular)
      ?? extractPhoneFromTelefoneDoCliente(payload.TelefoneDoCliente),
    name: payload.nome ?? payload.name ?? payload.NomeDoCliente ?? null,
    email: payload.email ?? payload.EmailDoCliente ?? null,
    birthDate: payload.dataNascimento ?? payload.birthDate ?? payload.DataDeNascimentoDoCliente ?? null,
    active: !deleted && payload.ativo !== false,
    deletedAt: deleted ? new Date() : null,
    sourceUpdatedAt: payload.dataHoraUltimaAlteracao ?? payload.updatedAt
      ?? payload.DataHoraEventoGerado ?? null,
    raw: payload,
  };
}

function mapProfessional(payload, deleted = false) {
  const id = getId(payload);
  if (id == null) return null;
  return {
    trinksId: id,
    name: payload.nome ?? payload.name ?? payload.NomeDoProfissional ?? null,
    nickname: payload.apelido ?? payload.nickname ?? null,
    active: !deleted && payload.ativo !== false,
    deletedAt: deleted ? new Date() : null,
    sourceUpdatedAt: payload.dataHoraUltimaAlteracao ?? payload.updatedAt
      ?? payload.DataHoraEventoGerado ?? null,
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

function normalizeSnsAppointmentPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (payload.IdDoAgendamento == null && payload.id != null) {
    return normalizeAppointmentPayload(payload);
  }
  if (payload.IdDoAgendamento == null) return normalizeAppointmentPayload(payload);

  const phone = extractPhoneFromTelefoneDoCliente(payload.TelefoneDoCliente);
  const statusId = statusIdFromLabel(payload.Status ?? payload.status);
  const valor = parseBrazilianDecimal(payload.PrecoDoServicoNoAgendamento ?? payload.valor);

  return normalizeAppointmentPayload({
    id: payload.IdDoAgendamento ?? payload.id,
    dataHoraInicio: payload.DataHoraInicioDoAgendamento ?? payload.dataHoraInicio,
    cliente: {
      id: payload.IdDoClienteNoEstabelecimento ?? payload.IdDoCliente ?? payload.cliente?.id,
      nome: payload.NomeDoCliente ?? payload.cliente?.nome,
      telefone: phone,
    },
    profissional: {
      id: payload.IdDoProfissionalNoEstabelecimento ?? payload.IdDoProfissional ?? payload.profissional?.id,
      nome: payload.profissional?.nome ?? null,
    },
    servico: {
      id: payload.IdDoServicoNoEstabelecimento ?? payload.IdDoServico ?? payload.servico?.id,
      nome: payload.NomeDoServicoNoEstabelecimento ?? payload.servico?.nome,
    },
    duracaoEmMinutos: payload.DuracaoDoAgendamento ?? payload.duracaoEmMinutos,
    valor,
    status: statusId != null ? { id: statusId } : payload.status,
    dataHoraUltimaAlteracao: payload.DataHoraEventoGerado ?? payload.dataHoraUltimaAlteracao,
  });
}

function mapWebhookAppointment(payload, { deleted = false, clientPhone = null } = {}) {
  const normalized = normalizeSnsAppointmentPayload(payload);
  const phone = clientPhone ?? normalized.cliente?.telefone ?? null;
  const mapped = mapAppointment(normalized, phone);
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
    priceCents: mapped.price_cents ?? valorToCents(normalized.valor),
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
      if (parsed.eventId == null) {
        throw new Error(`Unsupported Trinks webhook event: ${parsed.eventId}`);
      }
      if (IGNORED_EVENT_IDS.has(parsed.eventId)) {
        await markProcessed(envelope.MessageId);
        return { eventId: parsed.eventId, actionId: parsed.actionId, ignored: true };
      }
      if ([3, 4].includes(parsed.eventId)) {
        const client = mapClient(parsed.payload, deleted);
        if (client) await store.upsertClient(client);
      } else if ([5, 6, 7].includes(parsed.eventId)) {
        const professional = mapProfessional(parsed.payload, deleted);
        if (professional) await store.upsertProfessional(professional);
      } else if ([11, 12, 13].includes(parsed.eventId)) {
        const normalized = normalizeSnsAppointmentPayload(parsed.payload);
        const clientId = normalized.cliente?.id ?? normalized.clienteId;
        const localClient = clientId == null ? null : await store.getClientByTrinksId(clientId);
        const appointment = mapWebhookAppointment(parsed.payload, {
          deleted,
          clientPhone: localClient?.phone || normalized.cliente?.telefone || null,
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
  normalizeSnsAppointmentPayload,
  extractPhoneFromTelefoneDoCliente,
};
