#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function loadEnvFile(filePath, options = {}) {
  const { override = false } = options;
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const sepIndex = trimmed.indexOf('=');
    if (sepIndex <= 0) continue;

    const key = trimmed.slice(0, sepIndex).trim();
    const value = trimmed.slice(sepIndex + 1).trim();
    if (override || !process.env[key]) process.env[key] = value;
  }
}

function isPlaceholderValue(value) {
  if (!value) return true;
  const normalized = String(value).trim();
  if (!normalized) return true;
  return /^TROCAR/i.test(normalized) || /^CHANGE[_-]?ME/i.test(normalized);
}

function firstUsable(...values) {
  for (const value of values) {
    if (!isPlaceholderValue(value)) return String(value).trim();
  }
  return '';
}

function parseArgs(argv) {
  const args = {
    days: 90,
    dryRun: false,
    start: null,
    end: null,
    pageSize: 50,
    throttleMs: 1200,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--days' && argv[i + 1]) {
      args.days = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--start' && argv[i + 1]) {
      args.start = argv[i + 1];
      i += 1;
    } else if (arg === '--end' && argv[i + 1]) {
      args.end = argv[i + 1];
      i += 1;
    } else if (arg === '--page-size' && argv[i + 1]) {
      args.pageSize = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--throttle-ms' && argv[i + 1]) {
      args.throttleMs = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    }
  }

  if (!Number.isFinite(args.days) || args.days <= 0 || args.days > 365) {
    throw new Error('--days deve ser um numero entre 1 e 365.');
  }
  if (!Number.isFinite(args.pageSize) || args.pageSize <= 0 || args.pageSize > 200) {
    throw new Error('--page-size deve ser um numero entre 1 e 200.');
  }
  if (!Number.isFinite(args.throttleMs) || args.throttleMs < 0 || args.throttleMs > 60000) {
    throw new Error('--throttle-ms deve ser um numero entre 0 e 60000.');
  }

  return args;
}

function asDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function fmtDate(date) {
  return date.toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStatus(rawStatus) {
  const value = String(rawStatus || '').toLowerCase();
  if (!value) return 'created';
  if (/(no[_\s-]?show|noshow|nao[_\s-]?compareceu)/.test(value)) return 'no_show';
  if (/(rebook|resched|reagend)/.test(value)) return 'rebooked';
  if (/(cancel)/.test(value)) return 'cancelled';
  if (/(confirm|complete|done|realiz)/.test(value)) return 'confirmed';
  if (/(create|new|book|agend|pend)/.test(value)) return 'created';
  return 'created';
}

function getRawStatus(appointment) {
  const candidates = [
    appointment.status,
    appointment.appointmentStatus,
    appointment.appointment_status,
    appointment.status?.nome,
    appointment.status?.name,
    appointment.appointment?.status,
    appointment.appointment?.status?.nome,
    appointment.appointment?.status?.name,
    appointment.situacao,
    appointment.state,
    appointment.action,
    appointment.eventType,
    appointment.event_type,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

function getExternalBaseId(appointment) {
  const candidates = [
    appointment.id,
    appointment.external_id,
    appointment.externalId,
    appointment.appointment_id,
    appointment.codigo,
    appointment.code,
  ];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const value = String(candidate).trim();
    if (value) return value;
  }
  return '';
}

function parseAppointmentDate(appointment) {
  const raw = firstUsable(
    appointment.dataHoraInicio,
    appointment.data_hora_inicio,
    appointment.start_time,
    appointment.date_time,
    appointment.dataHora,
    appointment.date,
  );
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toJsonList(payload) {
  const list = payload?.data || payload?.appointments || payload?.items || [];
  return Array.isArray(list) ? list : [];
}

async function fetchAppointmentsPage(baseUrl, headers, page, pageSize) {
  const endpoints = ['agendamentos', 'appointments'];
  let lastError = null;

  for (const endpoint of endpoints) {
    const url = new URL(endpoint, `${baseUrl.replace(/\/+$/, '')}/`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(20000),
      });

      if (response.status === 404) {
        lastError = new Error(`Endpoint ${endpoint} retornou 404 (page=${page}).`);
        break;
      }

      if (response.status === 429) {
        const waitMs = Math.min(20000, attempt * 3000);
        await sleep(waitMs);
        lastError = new Error(`Falha 429 em ${url.toString()} :: {\"message\":\"Too Many Requests\"}`);
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Falha ${response.status} em ${url.toString()} :: ${text.slice(0, 240)}`);
      }

      const payload = await response.json();
      const list = toJsonList(payload);
      return {
        endpoint,
        list,
        totalPages: Number(payload?.totalPages || 0) || null,
        totalRecords: Number(payload?.totalRecords || 0) || null,
      };
    }
  }

  throw lastError || new Error(`Nenhum endpoint de appointments disponivel (page=${page}).`);
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildSql(rows) {
  const lines = [];
  lines.push('BEGIN;');
  lines.push("DELETE FROM trinks_sync_events WHERE payload->>'source' = 'trinks_backfill_90d';");

  for (const row of rows) {
    lines.push(
      `INSERT INTO trinks_sync_events (event_type, external_id, payload, processed, created_at, processed_at) VALUES (` +
        `${sqlQuote(row.eventType)}, ` +
        `${row.externalId ? sqlQuote(row.externalId) : 'NULL'}, ` +
        `${sqlQuote(JSON.stringify(row.payload))}::jsonb, ` +
        `TRUE, ${sqlQuote(row.createdAt)}::timestamptz, NOW());`,
    );
  }

  lines.push('COMMIT;');
  return `${lines.join('\n')}\n`;
}

function applySql(sql) {
  const commandArgs = [
    'compose',
    '--env-file',
    'infra/.env',
    '-f',
    'infra/docker-compose.yml',
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'postgres',
    '-d',
    'influence_labs_salon',
  ];

  const result = spawnSync('docker', commandArgs, {
    cwd: process.cwd(),
    input: sql,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error(`Falha ao aplicar SQL no Postgres.\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`);
  }
}

async function main() {
  loadEnvFile(path.join(process.cwd(), 'infra/.env'));
  loadEnvFile(path.join(process.cwd(), 'backend/.env'), { override: true });
  loadEnvFile(path.join(process.cwd(), '.env'));

  const args = parseArgs(process.argv.slice(2));

  const trinksApiBaseUrl = firstUsable(
    process.env.TRINKS_API_BASE_URL,
    process.env.TRINKS_API_BASE,
    'https://api.trinks.com/v1',
  );
  const trinksApiKey = firstUsable(process.env.TRINKS_API_KEY);
  const trinksSalonId = firstUsable(process.env.TRINKS_SALON_ID, process.env.TRINKS_ESTABELECIMENTO_ID);

  if (!trinksApiKey) {
    throw new Error('TRINKS_API_KEY ausente. Defina em infra/.env ou backend/.env.');
  }
  if (!trinksSalonId) {
    throw new Error('TRINKS_SALON_ID/TRINKS_ESTABELECIMENTO_ID ausente.');
  }

  const headers = {
    Authorization: `Bearer ${trinksApiKey}`,
    'X-Api-Key': trinksApiKey,
    estabelecimentoId: String(trinksSalonId),
    'Content-Type': 'application/json',
  };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const endDate = args.end ? asDate(args.end) : today;
  if (!endDate) throw new Error('Parametro --end invalido. Use YYYY-MM-DD.');

  const startDate = args.start
    ? asDate(args.start)
    : new Date(endDate.getTime() - (args.days - 1) * 24 * 60 * 60 * 1000);
  if (!startDate) throw new Error('Parametro --start invalido. Use YYYY-MM-DD.');
  if (startDate > endDate) throw new Error('--start nao pode ser maior que --end.');

  const windowStartTs = startDate.getTime();
  const windowEndTs = endDate.getTime() + (24 * 60 * 60 * 1000) - 1;

  const summary = {
    requestedDays: Math.floor((windowEndTs - windowStartTs) / (24 * 60 * 60 * 1000)) + 1,
    fetchedPages: 0,
    failedPages: 0,
    scannedAppointments: 0,
    inWindowAppointments: 0,
    dedupSkipped: 0,
    events: 0,
    byStage: {
      created: 0,
      confirmed: 0,
      cancelled: 0,
      rebooked: 0,
      no_show: 0,
    },
    errors: [],
  };

  const rows = [];
  const dedupe = new Set();

  let page = 1;
  let totalPages = Infinity;
  let reachedBeforeWindow = false;

  while (page <= totalPages) {
    try {
      const response = await fetchAppointmentsPage(trinksApiBaseUrl, headers, page, args.pageSize);
      summary.fetchedPages += 1;

      if (response.totalPages && Number.isFinite(response.totalPages)) {
        totalPages = response.totalPages;
      }

      const list = response.list;
      if (!Array.isArray(list) || list.length === 0) {
        break;
      }

      summary.scannedAppointments += list.length;
      let pageMinTs = Infinity;

      for (let index = 0; index < list.length; index += 1) {
        const appointment = list[index];
        const appointmentDate = parseAppointmentDate(appointment);
        if (!appointmentDate) continue;

        const eventTs = appointmentDate.getTime();
        if (eventTs < pageMinTs) pageMinTs = eventTs;

        if (eventTs < windowStartTs) {
          reachedBeforeWindow = true;
          continue;
        }
        if (eventTs > windowEndTs) continue;

        const rawStatus = getRawStatus(appointment);
        const stage = normalizeStatus(rawStatus);
        const baseId = getExternalBaseId(appointment);
        const snapshotDay = fmtDate(appointmentDate);

        const clientRef = firstUsable(
          appointment.phone,
          appointment.cliente?.telefone,
          appointment.cliente?.celular,
          appointment.client?.phone,
          appointment.cliente?.id,
          appointment.client?.id,
        );

        const externalId = baseId
          ? `${baseId}:${stage}`
          : `snapshot_${snapshotDay.replace(/-/g, '')}_${page}_${index + 1}:${stage}`;

        if (dedupe.has(externalId)) {
          summary.dedupSkipped += 1;
          continue;
        }
        dedupe.add(externalId);

        const payload = {
          source: 'trinks_backfill_90d',
          snapshot_date: snapshotDay,
          action: stage,
          appointmentStatus: rawStatus || null,
          status: rawStatus || null,
          appointment_id: baseId || null,
          id: baseId || null,
          phone: clientRef || null,
          client_id: firstUsable(appointment.cliente?.id, appointment.client?.id) || null,
          mapped_status: stage,
          fetched_endpoint: response.endpoint,
          fetched_at: new Date().toISOString(),
          page,
          appointment,
        };

        rows.push({
          eventType: stage,
          externalId,
          payload,
          createdAt: appointmentDate.toISOString(),
        });

        summary.inWindowAppointments += 1;
        summary.events += 1;
        summary.byStage[stage] = (summary.byStage[stage] || 0) + 1;
      }

      process.stdout.write(`OK page ${page}/${Number.isFinite(totalPages) ? totalPages : '?'}: ${list.length} agendamentos\n`);

      if (pageMinTs < windowStartTs || reachedBeforeWindow) {
        break;
      }
    } catch (error) {
      summary.failedPages += 1;
      summary.errors.push({ page, message: error.message });
      process.stdout.write(`ERRO page ${page}: ${error.message}\n`);
    }

    page += 1;
    await sleep(args.throttleMs);
  }

  const sql = buildSql(rows);
  const sqlPath = '/tmp/trinks-backfill-90d.sql';
  fs.writeFileSync(sqlPath, sql, 'utf8');

  if (!args.dryRun && rows.length > 0) {
    applySql(sql);
  }

  process.stdout.write('\nResumo backfill Trinks (90d)\n');
  process.stdout.write(`- Janela solicitada: ${fmtDate(startDate)} ate ${fmtDate(endDate)}\n`);
  process.stdout.write(`- Dias solicitados: ${summary.requestedDays}\n`);
  process.stdout.write(`- Paginas lidas: ${summary.fetchedPages}\n`);
  process.stdout.write(`- Paginas com falha: ${summary.failedPages}\n`);
  process.stdout.write(`- Agendamentos escaneados: ${summary.scannedAppointments}\n`);
  process.stdout.write(`- Agendamentos na janela: ${summary.inWindowAppointments}\n`);
  process.stdout.write(`- Duplicidades descartadas: ${summary.dedupSkipped}\n`);
  process.stdout.write(`- Eventos gravados: ${summary.events}\n`);
  process.stdout.write(`- Stage created: ${summary.byStage.created || 0}\n`);
  process.stdout.write(`- Stage confirmed: ${summary.byStage.confirmed || 0}\n`);
  process.stdout.write(`- Stage cancelled: ${summary.byStage.cancelled || 0}\n`);
  process.stdout.write(`- Stage rebooked: ${summary.byStage.rebooked || 0}\n`);
  process.stdout.write(`- Stage no_show: ${summary.byStage.no_show || 0}\n`);
  process.stdout.write(`- SQL gerado: ${sqlPath}\n`);
  process.stdout.write(`- Modo: ${args.dryRun ? 'dry-run (nao aplicado)' : 'aplicado no Postgres'}\n`);

  if (summary.errors.length > 0) {
    process.stdout.write('\nFalhas por pagina:\n');
    summary.errors.forEach((entry) => {
      process.stdout.write(`- page ${entry.page}: ${entry.message}\n`);
    });
  }

  if (rows.length === 0) {
    throw new Error('Backfill sem sucesso: nenhum agendamento encontrado dentro da janela solicitada.');
  }

  if (summary.failedPages > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
