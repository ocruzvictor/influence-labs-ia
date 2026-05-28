#!/usr/bin/env node
/**
 * scripts/bootstrap-tess-kb.mjs
 *
 * Cria a memory collection "Tirra KB Production" no TESS workspace.
 * Idempotente: se já existir collection com mesmo nome, retorna ID existente.
 *
 * Uso:
 *   TESS_API_TOKEN=... node scripts/bootstrap-tess-kb.mjs
 *   TESS_API_TOKEN=... TESS_API_BASE=https://api.tess.im node scripts/bootstrap-tess-kb.mjs
 *
 * Saída:
 *   ✅ Collection "Tirra KB Production" disponível (id=39430)
 *   👉 Adicione em infra/.env:
 *      TIRRA_KB_COLLECTION_ID=39430
 *
 * Story: docs/stories/admin-dashboard-story-1.5-kb-editor.md (Fase 1)
 */

const COLLECTION_NAME = "Tirra KB Production";
const TESS_API_TOKEN = process.env.TESS_API_TOKEN;
const TESS_API_BASE = (process.env.TESS_API_BASE || "https://tess.pareto.io").replace(/\/+$/, "");

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

if (!TESS_API_TOKEN) {
  fail("TESS_API_TOKEN não setado. Exporte a env antes de rodar.");
}

async function tessFetch(path, init = {}) {
  const url = `${TESS_API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${TESS_API_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    fail(`TESS ${res.method ?? "GET"} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return json;
}

async function findCollection(name) {
  // Lista collections paginado, busca por name exato
  let page = 1;
  while (page <= 20) {
    const data = await tessFetch(`/api/memory-collections?page=${page}&per_page=50`);
    const collections = data.collections || data.data || [];
    const match = collections.find((c) => c.name === name);
    if (match) return match;
    const total = data.meta?.total ?? data.total ?? collections.length;
    if (page * 50 >= total || collections.length === 0) break;
    page++;
  }
  return null;
}

async function createCollection(name) {
  const data = await tessFetch(`/api/memory-collections`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data.collection || data;
}

async function main() {
  console.log(`🔍 Procurando collection "${COLLECTION_NAME}" em ${TESS_API_BASE}...`);
  const existing = await findCollection(COLLECTION_NAME);

  let collection;
  if (existing) {
    collection = existing;
    console.log(`ℹ️  Collection já existe (id=${collection.id})`);
  } else {
    console.log(`📦 Criando collection nova...`);
    collection = await createCollection(COLLECTION_NAME);
    console.log(`✅ Collection criada (id=${collection.id})`);
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`✅ Collection "${COLLECTION_NAME}" disponível (id=${collection.id})`);
  console.log("=".repeat(60));
  console.log("");
  console.log("👉 Próximo passo: adicione em infra/.env:");
  console.log("");
  console.log(`   TIRRA_KB_COLLECTION_ID=${collection.id}`);
  console.log("");
  console.log("E também em backend/.env (mesma variável) pra que o backend Tirra");
  console.log("envie memory_collections em cada chamada execute_agent.");
  console.log("");
  console.log("Depois rode: node scripts/migrate-kb-to-tess.mjs");
}

main().catch((err) => fail(err.message || String(err)));
