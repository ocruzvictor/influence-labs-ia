/**
 * Admin audit log — fail-silent INSERT (mesmo contrato do frontend admin/lib/audit.ts).
 */

async function logAudit(db, entry) {
  if (!db || !entry?.action) return;
  try {
    await db.query(
      `INSERT INTO admin_audit_log
         (user_id, action, target_type, target_id, payload, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.userId ?? null,
        entry.action,
        entry.targetType ?? null,
        entry.targetId ?? null,
        entry.payload ? JSON.stringify(entry.payload) : null,
        entry.ip ?? null,
        entry.userAgent ?? null,
      ],
    );
  } catch (err) {
    console.error('[audit] failed to log entry:', entry.action, err.message);
  }
}

module.exports = { logAudit };
