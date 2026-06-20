/**
 * PostgreSQL data access for Trinks local snapshots.
 *
 * The caller injects a db object exposing query(sql, params), which keeps this
 * module usable by the backend, workers and isolated unit tests.
 */

function createTrinksLocalStore(db) {
  if (!db || typeof db.query !== 'function') {
    throw new TypeError('db.query is required');
  }

  const firstRow = (result) => {
    if (!result) throw new Error('Postgres unavailable for Trinks local store');
    return result.rows?.[0] ?? null;
  };
  const allRows = (result) => {
    if (!result) throw new Error('Postgres unavailable for Trinks local store');
    return result.rows ?? [];
  };
  const rawJson = (value) => JSON.stringify(value ?? {});

  async function listProfessionals({ activeOnly = true } = {}) {
    const result = await db.query(
      `SELECT trinks_id, name, nickname, active, raw, source_updated_at, synced_at
         FROM trinks_professionals
        WHERE deleted_at IS NULL
          AND ($1::BOOLEAN = FALSE OR active = TRUE)
        ORDER BY COALESCE(nickname, name), trinks_id`,
      [activeOnly],
    );
    return allRows(result);
  }

  async function upsertProfessional(professional) {
    const result = await db.query(
      `INSERT INTO trinks_professionals
         (trinks_id, name, nickname, active, raw, deleted_at, source_updated_at)
       VALUES ($1, $2, $3, $4, $5::JSONB, $6, $7)
       ON CONFLICT (trinks_id) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, trinks_professionals.name),
         nickname = COALESCE(EXCLUDED.nickname, trinks_professionals.nickname),
         active = EXCLUDED.active,
         raw = EXCLUDED.raw,
         deleted_at = EXCLUDED.deleted_at,
         source_updated_at = COALESCE(EXCLUDED.source_updated_at, trinks_professionals.source_updated_at),
         updated_at = NOW(),
         synced_at = NOW()
       RETURNING *`,
      [
        String(professional.trinksId),
        professional.name ?? null,
        professional.nickname ?? null,
        professional.active !== false,
        rawJson(professional.raw),
        professional.deletedAt ?? null,
        professional.sourceUpdatedAt ?? null,
      ],
    );
    return firstRow(result);
  }

  async function listServices({ activeOnly = true } = {}) {
    const result = await db.query(
      `SELECT trinks_id, name, duration_min, price_cents, active, raw,
              source_updated_at, synced_at
         FROM trinks_services
        WHERE deleted_at IS NULL
          AND ($1::BOOLEAN = FALSE OR active = TRUE)
        ORDER BY name, trinks_id`,
      [activeOnly],
    );
    return allRows(result);
  }

  async function getService(trinksId) {
    const result = await db.query(
      `SELECT trinks_id, name, duration_min, price_cents, active, raw,
              source_updated_at, synced_at
         FROM trinks_services
        WHERE trinks_id = $1 AND deleted_at IS NULL`,
      [String(trinksId)],
    );
    return firstRow(result);
  }

  async function upsertService(service) {
    const result = await db.query(
      `INSERT INTO trinks_services
         (trinks_id, name, duration_min, price_cents, active, raw, deleted_at, source_updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::JSONB, $7, $8)
       ON CONFLICT (trinks_id) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, trinks_services.name),
         duration_min = COALESCE(EXCLUDED.duration_min, trinks_services.duration_min),
         price_cents = COALESCE(EXCLUDED.price_cents, trinks_services.price_cents),
         active = EXCLUDED.active,
         raw = EXCLUDED.raw,
         deleted_at = EXCLUDED.deleted_at,
         source_updated_at = COALESCE(EXCLUDED.source_updated_at, trinks_services.source_updated_at),
         updated_at = NOW(),
         synced_at = NOW()
       RETURNING *`,
      [
        String(service.trinksId),
        service.name ?? null,
        service.durationMin ?? null,
        service.priceCents ?? null,
        service.active !== false,
        rawJson(service.raw),
        service.deletedAt ?? null,
        service.sourceUpdatedAt ?? null,
      ],
    );
    return firstRow(result);
  }

  async function listCompatibility({ serviceId = null, professionalId = null, activeOnly = true } = {}) {
    const result = await db.query(
      `SELECT service_id, professional_id, active, raw, source_updated_at, synced_at
         FROM trinks_service_professionals
        WHERE ($1::VARCHAR IS NULL OR service_id = $1)
          AND ($2::VARCHAR IS NULL OR professional_id = $2)
          AND ($3::BOOLEAN = FALSE OR active = TRUE)
        ORDER BY service_id, professional_id`,
      [
        serviceId == null ? null : String(serviceId),
        professionalId == null ? null : String(professionalId),
        activeOnly,
      ],
    );
    return allRows(result);
  }

  async function isCompatible(serviceId, professionalId) {
    const result = await db.query(
      `SELECT EXISTS (
         SELECT 1
           FROM trinks_service_professionals
          WHERE service_id = $1 AND professional_id = $2 AND active = TRUE
       ) AS compatible`,
      [String(serviceId), String(professionalId)],
    );
    return firstRow(result)?.compatible === true;
  }

  async function upsertCompatibility(compatibility, executor = db) {
    const result = await executor.query(
      `INSERT INTO trinks_service_professionals
         (service_id, professional_id, active, raw, source_updated_at)
       VALUES ($1, $2, $3, $4::JSONB, $5)
       ON CONFLICT (service_id, professional_id) DO UPDATE SET
         active = EXCLUDED.active,
         raw = EXCLUDED.raw,
         source_updated_at = COALESCE(
           EXCLUDED.source_updated_at,
           trinks_service_professionals.source_updated_at
         ),
         updated_at = NOW(),
         synced_at = NOW()
       RETURNING *`,
      [
        String(compatibility.serviceId),
        String(compatibility.professionalId),
        compatibility.active !== false,
        rawJson(compatibility.raw),
        compatibility.sourceUpdatedAt ?? null,
      ],
    );
    return firstRow(result);
  }

  async function replaceCompatibilitySnapshot(compatibilities) {
    const execute = async (executor) => {
      await executor.query('UPDATE trinks_service_professionals SET active = FALSE, updated_at = NOW()');
      const saved = [];
      for (const compatibility of compatibilities || []) {
        saved.push(await upsertCompatibility(compatibility, executor));
      }
      return saved;
    };
    return typeof db.transaction === 'function' ? db.transaction(execute) : execute(db);
  }

  async function listSlots({
    from,
    to,
    professionalId = null,
    serviceId = null,
    availableOnly = true,
  } = {}) {
    const result = await db.query(
      `SELECT s.professional_id, s.starts_at, s.ends_at, s.available, s.raw,
              s.source_updated_at, s.synced_at
         FROM trinks_slots s
        WHERE s.starts_at >= $1
          AND s.starts_at < $2
          AND ($3::VARCHAR IS NULL OR s.professional_id = $3)
          AND ($4::BOOLEAN = FALSE OR s.available = TRUE)
          AND (
            $5::VARCHAR IS NULL OR EXISTS (
              SELECT 1
                FROM trinks_service_professionals c
               WHERE c.service_id = $5
                 AND c.professional_id = s.professional_id
                 AND c.active = TRUE
            )
          )
        ORDER BY s.starts_at, s.professional_id`,
      [
        from,
        to,
        professionalId == null ? null : String(professionalId),
        availableOnly,
        serviceId == null ? null : String(serviceId),
      ],
    );
    return allRows(result);
  }

  async function upsertSlot(slot, executor = db) {
    const result = await executor.query(
      `INSERT INTO trinks_slots
         (professional_id, starts_at, ends_at, available, raw, source_updated_at)
       VALUES ($1, $2, $3, $4, $5::JSONB, $6)
       ON CONFLICT (professional_id, starts_at) DO UPDATE SET
         ends_at = EXCLUDED.ends_at,
         available = EXCLUDED.available,
         raw = EXCLUDED.raw,
         source_updated_at = COALESCE(EXCLUDED.source_updated_at, trinks_slots.source_updated_at),
         updated_at = NOW(),
         synced_at = NOW()
       RETURNING *`,
      [
        String(slot.professionalId),
        slot.startsAt,
        slot.endsAt ?? null,
        slot.available !== false,
        rawJson(slot.raw),
        slot.sourceUpdatedAt ?? null,
      ],
    );
    return firstRow(result);
  }

  async function replaceSlotsForDate(date, slots) {
    const execute = async (executor) => {
      await executor.query(
        `DELETE FROM trinks_slots
          WHERE starts_at >= $1::DATE
            AND starts_at < ($1::DATE + INTERVAL '1 day')`,
        [date],
      );
      const saved = [];
      for (const slot of slots || []) saved.push(await upsertSlot(slot, executor));
      await executor.query(
        `INSERT INTO trinks_slot_snapshot_runs (snapshot_date, slot_count, synced_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (snapshot_date) DO UPDATE SET
           slot_count = EXCLUDED.slot_count,
           synced_at = NOW()`,
        [date, saved.length],
      );
      return saved;
    };
    return typeof db.transaction === 'function' ? db.transaction(execute) : execute(db);
  }

  async function hasSlotSnapshotForDate(date, { maxAgeHours = 24 } = {}) {
    const result = await db.query(
      `SELECT EXISTS (
         SELECT 1 FROM trinks_slot_snapshot_runs
          WHERE snapshot_date = $1::DATE
            AND synced_at >= NOW() - ($2::TEXT || ' hours')::INTERVAL
       ) AS covered`,
      [date, String(maxAgeHours)],
    );
    return firstRow(result)?.covered === true;
  }

  async function markSlotAvailable(professionalId, startsAt, available) {
    const result = await db.query(
      `UPDATE trinks_slots
          SET available = $3, updated_at = NOW(), synced_at = NOW()
        WHERE professional_id = $1 AND starts_at = $2
        RETURNING *`,
      [String(professionalId), startsAt, Boolean(available)],
    );
    return firstRow(result);
  }

  async function getClientByTrinksId(trinksId) {
    const result = await db.query(
      `SELECT trinks_id, phone, name, email, birth_date, active, raw,
              source_updated_at, synced_at
         FROM trinks_clients
        WHERE trinks_id = $1 AND deleted_at IS NULL`,
      [String(trinksId)],
    );
    return firstRow(result);
  }

  async function getClientByPhone(phone) {
    const result = await db.query(
      `SELECT trinks_id, phone, name, email, birth_date, active, raw,
              source_updated_at, synced_at
         FROM trinks_clients
        WHERE phone = $1 AND deleted_at IS NULL
        ORDER BY updated_at DESC
        LIMIT 1`,
      [phone],
    );
    return firstRow(result);
  }

  async function upsertClient(client) {
    const result = await db.query(
      `INSERT INTO trinks_clients
         (trinks_id, phone, name, email, birth_date, active, raw, deleted_at, source_updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::JSONB, $8, $9)
       ON CONFLICT (trinks_id) DO UPDATE SET
         phone = COALESCE(EXCLUDED.phone, trinks_clients.phone),
         name = COALESCE(EXCLUDED.name, trinks_clients.name),
         email = COALESCE(EXCLUDED.email, trinks_clients.email),
         birth_date = COALESCE(EXCLUDED.birth_date, trinks_clients.birth_date),
         active = EXCLUDED.active,
         raw = EXCLUDED.raw,
         deleted_at = EXCLUDED.deleted_at,
         source_updated_at = COALESCE(EXCLUDED.source_updated_at, trinks_clients.source_updated_at),
         updated_at = NOW(),
         synced_at = NOW()
       RETURNING *`,
      [
        String(client.trinksId),
        client.phone ?? null,
        client.name ?? null,
        client.email ?? null,
        client.birthDate ?? null,
        client.active !== false,
        rawJson(client.raw),
        client.deletedAt ?? null,
        client.sourceUpdatedAt ?? null,
      ],
    );
    return firstRow(result);
  }

  async function getAppointment(trinksId) {
    const result = await db.query(
      `SELECT *
         FROM trinks_appointments
        WHERE trinks_id = $1 AND deleted_at IS NULL`,
      [String(trinksId)],
    );
    return firstRow(result);
  }

  async function listAppointmentsByClient(phone, { from = new Date(0), to = null } = {}) {
    const result = await db.query(
      `SELECT *
         FROM trinks_appointments
        WHERE client_phone = $1
          AND scheduled_at >= $2
          AND ($3::TIMESTAMPTZ IS NULL OR scheduled_at < $3)
          AND deleted_at IS NULL
        ORDER BY scheduled_at`,
      [phone, from, to],
    );
    return allRows(result);
  }

  async function listAppointmentsByTrinksClient(trinksClientId, { from = new Date(0), to = null } = {}) {
    const result = await db.query(
      `SELECT *
         FROM trinks_appointments
        WHERE client_trinks_id = $1
          AND scheduled_at >= $2
          AND ($3::TIMESTAMPTZ IS NULL OR scheduled_at < $3)
          AND deleted_at IS NULL
        ORDER BY scheduled_at`,
      [String(trinksClientId), from, to],
    );
    return allRows(result);
  }

  async function upsertAppointment(appointment) {
    const result = await db.query(
      `INSERT INTO trinks_appointments
         (trinks_id, client_trinks_id, client_phone, client_name,
          professional_id, professional_name, service_id, service_name,
          status, scheduled_at, duration_min, price_cents,
          created_at_trinks, updated_at_trinks, cancelled_at, no_show_at, raw, deleted_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17::JSONB, $18)
       ON CONFLICT (trinks_id) DO UPDATE SET
         client_trinks_id = COALESCE(EXCLUDED.client_trinks_id, trinks_appointments.client_trinks_id),
         client_phone = COALESCE(EXCLUDED.client_phone, trinks_appointments.client_phone),
         client_name = COALESCE(EXCLUDED.client_name, trinks_appointments.client_name),
         professional_id = COALESCE(EXCLUDED.professional_id, trinks_appointments.professional_id),
         professional_name = COALESCE(EXCLUDED.professional_name, trinks_appointments.professional_name),
         service_id = COALESCE(EXCLUDED.service_id, trinks_appointments.service_id),
         service_name = COALESCE(EXCLUDED.service_name, trinks_appointments.service_name),
         status = EXCLUDED.status,
         scheduled_at = EXCLUDED.scheduled_at,
         duration_min = COALESCE(EXCLUDED.duration_min, trinks_appointments.duration_min),
         price_cents = COALESCE(EXCLUDED.price_cents, trinks_appointments.price_cents),
         created_at_trinks = COALESCE(
           EXCLUDED.created_at_trinks,
           trinks_appointments.created_at_trinks
         ),
         updated_at_trinks = COALESCE(
           EXCLUDED.updated_at_trinks,
           trinks_appointments.updated_at_trinks
         ),
         cancelled_at = COALESCE(EXCLUDED.cancelled_at, trinks_appointments.cancelled_at),
         no_show_at = COALESCE(EXCLUDED.no_show_at, trinks_appointments.no_show_at),
         raw = EXCLUDED.raw,
         deleted_at = EXCLUDED.deleted_at,
         synced_at = NOW()
       RETURNING *`,
      [
        String(appointment.trinksId),
        appointment.clientTrinksId == null ? null : String(appointment.clientTrinksId),
        appointment.clientPhone ?? null,
        appointment.clientName ?? null,
        appointment.professionalId == null ? null : String(appointment.professionalId),
        appointment.professionalName ?? null,
        appointment.serviceId == null ? null : String(appointment.serviceId),
        appointment.serviceName ?? null,
        appointment.status,
        appointment.scheduledAt,
        appointment.durationMin ?? null,
        appointment.priceCents ?? null,
        appointment.createdAtTrinks ?? null,
        appointment.updatedAtTrinks ?? null,
        appointment.cancelledAt ?? null,
        appointment.noShowAt ?? null,
        rawJson(appointment.raw),
        appointment.deletedAt ?? null,
      ],
    );
    return firstRow(result);
  }

  async function markAppointmentStatus(trinksId, status, extra = {}) {
    const result = await db.query(
      `UPDATE trinks_appointments
          SET status = $2,
              scheduled_at = COALESCE($3, scheduled_at),
              cancelled_at = CASE WHEN $2 = 'cancelled' THEN COALESCE($4, NOW()) ELSE cancelled_at END,
              updated_at_trinks = COALESCE($5, NOW()),
              deleted_at = COALESCE($6, deleted_at),
              synced_at = NOW()
        WHERE trinks_id = $1
        RETURNING *`,
      [
        String(trinksId),
        status,
        extra.scheduledAt ?? null,
        extra.cancelledAt ?? null,
        extra.updatedAtTrinks ?? null,
        extra.deletedAt ?? null,
      ],
    );
    return firstRow(result);
  }

  return {
    listProfessionals,
    upsertProfessional,
    listServices,
    getService,
    upsertService,
    listCompatibility,
    isCompatible,
    upsertCompatibility,
    replaceCompatibilitySnapshot,
    listSlots,
    upsertSlot,
    replaceSlotsForDate,
    hasSlotSnapshotForDate,
    markSlotAvailable,
    getClientByTrinksId,
    getClientByPhone,
    upsertClient,
    getAppointment,
    listAppointmentsByClient,
    listAppointmentsByTrinksClient,
    upsertAppointment,
    markAppointmentStatus,
  };
}

module.exports = { createTrinksLocalStore };
