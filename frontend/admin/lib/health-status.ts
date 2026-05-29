/**
 * Derive UI card states a partir do payload `/api/saude`.
 *
 * Story 1.7 AC15+AC16. Funções puras, testáveis isoladas.
 *
 * Categorias renderizadas: WhatsApp, TESS, Trinks, Postgres.
 * Status: 'ok' (verde) | 'warn' (amarelo) | 'down' (vermelho).
 */

export interface HealthPayload {
  status?: string;
  service?: string;
  backend_unreachable?: boolean;
  last_checked_at?: string;
  uptime?: number;
  tess?: {
    agent_id?: string | number;
    url?: string;
  };
  postgres?: {
    pool?: { total: number; idle: number; waiting: number } | null;
    uptime_seconds?: number;
    last_ok_query_at?: string | null;
  };
  trinks_ping?: {
    status?: "ok" | "slow" | "down";
    latency_ms?: number | null;
    last_checked_at?: string;
    cached?: boolean;
    error?: string;
  };
  whatsapp_window?: {
    configured?: boolean;
    status?: "green" | "yellow" | "red";
    last_inbound_at?: string | null;
    hours_since?: number | null;
    reason?: string;
  };
}

export type CardStatus = "ok" | "warn" | "down";

export interface CardMetric {
  label: string;
  value: string;
}

export interface CardData {
  title: string;
  status: CardStatus;
  statusLabel: string;
  metrics: CardMetric[];
}

const STATUS_LABEL: Record<CardStatus, string> = {
  ok: "OK",
  warn: "Atenção",
  down: "Erro",
};

function safeHostname(url: string | undefined): string {
  if (!url) return "—";
  try {
    return new URL(url).hostname;
  } catch {
    return "URL inválida";
  }
}

function safeIsoMinute(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "data inválida";
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function uptimeLabel(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return "—";
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function whatsAppHoursRemaining(
  hoursSince: number | null | undefined,
): string {
  if (hoursSince === null || hoursSince === undefined) return "—";
  const remaining = 24 - hoursSince;
  if (remaining <= 0) return "Fechada";
  if (remaining >= 1) return `${remaining.toFixed(1)}h restantes`;
  return `${Math.floor(remaining * 60)}min restantes`;
}

function mapWaStatus(s: string | undefined): CardStatus {
  if (s === "green") return "ok";
  if (s === "yellow") return "warn";
  if (s === "red") return "down";
  return "down";
}

function mapTrinksStatus(s: string | undefined): CardStatus {
  if (s === "ok") return "ok";
  if (s === "slow") return "warn";
  if (s === "down") return "down";
  return "down";
}

function mapPgStatus(
  pg: HealthPayload["postgres"],
): { status: CardStatus; reason?: string } {
  if (!pg || !pg.pool) return { status: "down", reason: "pool_unavailable" };
  const w = pg.pool.waiting ?? 0;
  if (w >= 5) return { status: "down" };
  if (w > 0) return { status: "warn" };
  return { status: "ok" };
}

function deriveBackendUnreachable(): CardData[] {
  return ["WhatsApp", "TESS", "Trinks", "Postgres"].map((title) => ({
    title,
    status: "down" as const,
    statusLabel: STATUS_LABEL.down,
    metrics: [{ label: "Estado", value: "Backend não responde" }],
  }));
}

export function deriveCardStatus(h: HealthPayload): CardData[] {
  if (h.backend_unreachable) return deriveBackendUnreachable();

  const wa: CardData = (() => {
    const win = h.whatsapp_window;
    if (!win?.configured) {
      return {
        title: "WhatsApp",
        status: "down",
        statusLabel: STATUS_LABEL.down,
        metrics: [{ label: "Configuração", value: "TIAGO_NOTIFICATION_PHONE ausente" }],
      };
    }
    const status = mapWaStatus(win.status);
    return {
      title: "WhatsApp",
      status,
      statusLabel: STATUS_LABEL[status],
      metrics: [
        { label: "Janela", value: whatsAppHoursRemaining(win.hours_since) },
        { label: "Última msg", value: safeIsoMinute(win.last_inbound_at) },
      ],
    };
  })();

  const tess: CardData = (() => {
    const status: CardStatus = h.tess?.agent_id ? "ok" : "down";
    return {
      title: "TESS",
      status,
      statusLabel: STATUS_LABEL[status],
      metrics: [
        { label: "Agent ID", value: String(h.tess?.agent_id ?? "—") },
        { label: "URL", value: safeHostname(h.tess?.url) },
      ],
    };
  })();

  const trinks: CardData = (() => {
    const status = mapTrinksStatus(h.trinks_ping?.status);
    return {
      title: "Trinks",
      status,
      statusLabel: STATUS_LABEL[status],
      metrics: [
        {
          label: "Latência",
          value:
            typeof h.trinks_ping?.latency_ms === "number"
              ? `${h.trinks_ping.latency_ms}ms`
              : "—",
        },
        {
          label: "Cache",
          value: h.trinks_ping?.cached ? "sim" : "live",
        },
      ],
    };
  })();

  const pg: CardData = (() => {
    const { status } = mapPgStatus(h.postgres);
    return {
      title: "Postgres",
      status,
      statusLabel: STATUS_LABEL[status],
      metrics: [
        { label: "Uptime", value: uptimeLabel(h.postgres?.uptime_seconds) },
        {
          label: "Pool",
          value: h.postgres?.pool
            ? `${h.postgres.pool.idle}/${h.postgres.pool.total} idle, ${h.postgres.pool.waiting} esperando`
            : "indisponível",
        },
      ],
    };
  })();

  return [wa, tess, trinks, pg];
}

// Exports nomeados pra testar internals
export const __internal = {
  uptimeLabel,
  whatsAppHoursRemaining,
  mapWaStatus,
  mapTrinksStatus,
  mapPgStatus,
  safeHostname,
  safeIsoMinute,
};
