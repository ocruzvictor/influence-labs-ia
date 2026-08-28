#!/usr/bin/env node
/**
 * scripts/migrate-kb-to-tess.mjs
 *
 * Lê data/kb/conversa-v2/*.md e popula:
 *   1. Tabela `kb_items` no Postgres (idempotente por slug)
 *   2. Memories correspondentes na collection TESS (`TIRRA_KB_COLLECTION_ID`)
 *
 * Mapping de arquivo → category:
 *   faq-servicos.md           → faq
 *   fichas-tecnicas-servicos  → servicos
 *   sinonimos-servicos        → servicos
 *   info-estatica             → info
 *   regras-comerciais         → regras
 *   padroes-fala              → padroes
 *
 * Uso:
 *   DATABASE_URL=... TESS_API_TOKEN=... TIRRA_KB_COLLECTION_ID=... \
 *     node scripts/migrate-kb-to-tess.mjs
 *
 * Story: docs/stories/admin-dashboard-story-1.5-kb-editor.md (Fase 2)
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tessScriptHeaders } from "./tess-auth.mjs";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const KB_DIR = join(ROOT, "data", "kb", "conversa-v2");

const DATABASE_URL = process.env.DATABASE_URL;
const TESS_API_TOKEN = process.env.TESS_API_TOKEN;
const TESS_API_BASE = (process.env.TESS_API_BASE || "https://tess.pareto.io").replace(/\/+$/, "");
const TIRRA_KB_COLLECTION_ID = process.env.TIRRA_KB_COLLECTION_ID;

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

if (!DATABASE_URL) fail("DATABASE_URL não setado.");
if (!TESS_API_TOKEN) fail("TESS_API_TOKEN não setado.");
if (!TIRRA_KB_COLLECTION_ID) fail("TIRRA_KB_COLLECTION_ID não setado. Rode bootstrap-tess-kb.mjs primeiro.");

const COLLECTION_ID = Number(TIRRA_KB_COLLECTION_ID);
if (!Number.isInteger(COLLECTION_ID)) fail(`TIRRA_KB_COLLECTION_ID inválido: ${TIRRA_KB_COLLECTION_ID}`);

// File → metadata mapping
const FILE_MAP = {
  "faq-servicos.md":            { slug: "faq-servicos",            category: "faq",      title: "FAQ — Serviços" },
  "fichas-tecnicas-servicos.md":{ slug: "fichas-tecnicas-servicos", category: "servicos", title: "Fichas Técnicas — Serviços" },
  "sinonimos-servicos.md":      { slug: "sinonimos-servicos",      category: "servicos", title: "Sinônimos — Serviços" },
  "info-estatica.md":           { slug: "info-estatica",           category: "info",     title: "Informações Estáticas" },
  "regras-comerciais.md":       { slug: "regras-comerciais",       category: "regras",   title: "Regras Comerciais" },
  "padroes-fala.md":            { slug: "padroes-fala",            category: "padroes",  title: "Padrões de Fala" },
};

function formatMemoryForTess({ title, category, content_md }) {
  return `# ${title}\n\n_Categoria: ${category}_\n\n${content_md}`;
}

async function tessFetch(path, init = {}) {
  const url = `${TESS_API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...tessScriptHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`TESS ${init.method || "GET"} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return json;
}

async function listExistingMemories() {
  // Pagina até 50 por página
  const all = [];
  let page = 1;
  while (page <= 20) {
    const data = await tessFetch(`/api/memories?collection_id=${COLLECTION_ID}&page=${page}&per_page=50`);
    const items = data.data || data.memories || [];
    all.push(...items);
    if (items.length < 50) break;
    page++;
  }
  return all;
}

async function createMemory(content) {
  const data = await tessFetch(`/api/memories`, {
    method: "POST",
    body: JSON.stringify({ collection_id: COLLECTION_ID, memory: content }),
  });
  return data.memory || data;
}

async function main() {
  console.log(`🔌 Conectando em Postgres...`);
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  console.log(`📂 Lendo ${KB_DIR}...`);
  const files = readdirSync(KB_DIR).filter((f) => f.endsWith(".md"));
  console.log(`   ${files.length} arquivos .md encontrados`);

  console.log(`📡 Listando memories existentes em collection ${COLLECTION_ID}...`);
  const existingMemories = await listExistingMemories();
  console.log(`   ${existingMemories.length} memories já na collection`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const meta = FILE_MAP[file];
    if (!meta) {
      console.log(`⚠️  Arquivo "${file}" sem mapping em FILE_MAP — pulando`);
      skipped++;
      continue;
    }

    const content_md = readFileSync(join(KB_DIR, file), "utf8").trim();
    if (!content_md) {
      console.log(`⚠️  Arquivo "${file}" vazio — pulando`);
      skipped++;
      continue;
    }
    if (content_md.length > 32_000) {
      console.log(`⚠️  Arquivo "${file}" excede 32k chars (${content_md.length}) — pulando`);
      failed++;
      continue;
    }

    try {
      // Check idempotency: já existe no Postgres por slug?
      const { rows: existing } = await pool.query(
        `SELECT id, version, tess_memory_id FROM kb_items WHERE slug = $1 LIMIT 1`,
        [meta.slug],
      );

      if (existing[0]) {
        console.log(`ℹ️  ${meta.slug} já existe no Postgres (id=${existing[0].id}, v${existing[0].version}, tess_memory_id=${existing[0].tess_memory_id ?? "NULL"}) — pulando`);
        skipped++;
        continue;
      }

      // Criar memory no TESS primeiro (capturar memory_id)
      const formatted = formatMemoryForTess({ title: meta.title, category: meta.category, content_md });
      const memory = await createMemory(formatted);
      if (!memory.id) throw new Error(`TESS memory criada mas sem id na response: ${JSON.stringify(memory)}`);

      // INSERT em Postgres com tess_memory_id capturado
      const { rows } = await pool.query(
        `INSERT INTO kb_items
           (slug, category, title, content_md, version, active, source_file, tess_memory_id)
         VALUES ($1, $2, $3, $4, 1, TRUE, $5, $6)
         RETURNING id`,
        [meta.slug, meta.category, meta.title, content_md, `data/kb/conversa-v2/${file}`, memory.id],
      );

      console.log(`✅ ${meta.slug} → kb_items.id=${rows[0].id}, tess_memory_id=${memory.id}`);
      created++;
    } catch (err) {
      console.error(`❌ Falha em "${file}":`, err.message);
      failed++;
    }
  }

  await pool.end();

  console.log("");
  console.log("=".repeat(60));
  console.log(`✅ Criados: ${created}`);
  console.log(`ℹ️  Pulados: ${skipped}`);
  console.log(`❌ Falhou:  ${failed}`);
  console.log("=".repeat(60));

  if (failed > 0) process.exit(2);
}

main().catch((err) => fail(err.message || String(err)));
