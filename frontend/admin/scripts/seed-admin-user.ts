/**
 * Idempotent CLI: cria (ou reativa) um admin user.
 *
 * Uso:
 *   npm run seed:admin -- tiago@studiotirra.com.br "Tiago Rocha"
 *   npm run seed:admin -- gabriel@studiotirra.com.br "Gabriel" admin
 *
 * Re-rodar com mesmo email reativa (active=true) e atualiza nome/role.
 */

import { query } from "../lib/db";

async function main(): Promise<void> {
  const [, , emailArg, nameArg, roleArg] = process.argv;

  if (!emailArg || !nameArg) {
    console.error("Usage: npm run seed:admin -- <email> \"<name>\" [role=admin]");
    process.exit(1);
  }

  const email = emailArg.toLowerCase().trim();
  const name = nameArg.trim();
  const role = (roleArg ?? "admin").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`Invalid email: ${email}`);
    process.exit(1);
  }
  if (!["admin", "viewer"].includes(role)) {
    console.error(`Invalid role: ${role}. Must be 'admin' or 'viewer'.`);
    process.exit(1);
  }

  const rows = await query<{ id: string; created: boolean }>(
    `INSERT INTO admin_users (email, name, role, active)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           role = EXCLUDED.role,
           active = TRUE,
           updated_at = NOW()
     RETURNING id, (xmax = 0) AS created`,
    [email, name, role],
  );

  const row = rows[0];
  if (!row) {
    console.error("Insert returned no row — schema may be missing. Apply migration 001 first.");
    process.exit(1);
  }

  const verb = row.created ? "Created" : "Updated";
  console.log(`✅ ${verb} admin user ${email} (id=${row.id}, role=${role})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed to seed admin user:", err);
  process.exit(1);
});
