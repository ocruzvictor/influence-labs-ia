/**
 * TESS REST client — wrapper sobre TESS API pra CRUD em memory_collections + memories.
 *
 * Usado pelos route handlers do KB editor (Story 1.5). Lê `TESS_API_TOKEN` e
 * `TESS_API_BASE` do env. Reusa mesmo token do backend Tirra.
 *
 * Retry simples: 1 retry em 5xx + network error. Timeout 10s.
 *
 * Side effects (audit log) ficam no handler, não aqui. Este client é I/O puro.
 */

import { env } from "./env";

const DEFAULT_BASE = "https://tess.pareto.io";
const TIMEOUT_MS = 10_000;

export interface TessMemory {
  id: number;
  memory: string;
  collection_id?: number;
}

export interface TessMemoryCollection {
  id: number;
  name: string;
  description?: string;
}

class TessError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "TessError";
    this.status = status;
    this.body = body;
  }
}

function tessBase(): string {
  return (env.TESS_API_BASE || DEFAULT_BASE).replace(/\/+$/, "");
}

function tessToken(): string {
  if (!env.TESS_API_TOKEN) {
    throw new Error("TESS_API_TOKEN não configurado — adicione em infra/.env");
  }
  return env.TESS_API_TOKEN;
}

async function tessFetch(path: string, init: RequestInit & { retryOn5xx?: boolean } = {}): Promise<unknown> {
  const url = `${tessBase()}${path}`;
  const retryOn5xx = init.retryOn5xx !== false;

  async function once(): Promise<Response> {
    return await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${tessToken()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }

  let res: Response;
  try {
    res = await once();
    if (!res.ok && res.status >= 500 && retryOn5xx) {
      // 1 retry com pequeno backoff
      await new Promise((r) => setTimeout(r, 500));
      res = await once();
    }
  } catch (err) {
    throw new TessError(
      0,
      String(err),
      `TESS network error (${init.method ?? "GET"} ${path}): ${(err as Error).message}`,
    );
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new TessError(
      res.status,
      json,
      `TESS ${init.method ?? "GET"} ${path} → ${res.status}`,
    );
  }
  return json;
}

// =============================================================================
// Memory CRUD
// =============================================================================

export async function createMemory(collectionId: number, content: string): Promise<TessMemory> {
  const data = (await tessFetch(`/api/memories`, {
    method: "POST",
    body: JSON.stringify({ collection_id: collectionId, memory: content }),
  })) as { memory?: TessMemory } & TessMemory;
  const memory = data.memory ?? (data as TessMemory);
  if (!memory.id) throw new TessError(0, data, "TESS createMemory: response sem id");
  return memory;
}

export async function updateMemory(memoryId: number, content: string): Promise<TessMemory> {
  const data = (await tessFetch(`/api/memories/${memoryId}`, {
    method: "PUT",
    body: JSON.stringify({ memory: content }),
  })) as { memory?: TessMemory } & TessMemory;
  return data.memory ?? (data as TessMemory);
}

export async function deleteMemory(memoryId: number): Promise<void> {
  await tessFetch(`/api/memories/${memoryId}`, {
    method: "DELETE",
    retryOn5xx: false, // delete não retry — pode causar 404 spurioso
  });
}

// =============================================================================
// Memory collection (lookup — útil pra health check)
// =============================================================================

export async function listMemoriesInCollection(
  collectionId: number,
  page = 1,
  perPage = 50,
): Promise<TessMemory[]> {
  const data = (await tessFetch(
    `/api/memories?collection_id=${collectionId}&page=${page}&per_page=${perPage}`,
  )) as { data?: TessMemory[]; memories?: TessMemory[] };
  return data.data || data.memories || [];
}

export { TessError };
