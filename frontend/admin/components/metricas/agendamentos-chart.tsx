"use client";

/**
 * <AgendamentosChart> — bar chart "Agendamentos por dia" (Story 1.6 AC24).
 * Recharts BarChart responsivo. Base scheduled_at (série de v_admin_appointments_daily).
 */

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Point {
  day: string; // YYYY-MM-DD
  created: number;
  cancelled: number;
  no_shows: number;
}

const NAVY = "#1A1A2E";

function shortDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function AgendamentosChart({ data }: { data: Point[] }): React.ReactElement {
  const chartData = data.map((p) => ({ ...p, label: shortDay(p.day) }));
  return (
    <div className="h-64 w-full" aria-label="Gráfico de agendamentos por dia">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(26,26,46,0.08)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} width={32} />
          <Tooltip
            cursor={{ fill: "rgba(26,26,46,0.04)" }}
            contentStyle={{ borderRadius: 8, border: "1px solid rgba(26,26,46,0.12)", fontSize: 12 }}
            labelFormatter={(l) => `Dia ${l}`}
            formatter={(v) => [Number(v ?? 0), "Agendamentos"]}
          />
          <Bar dataKey="created" fill={NAVY} radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
