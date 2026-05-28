import { getCurrentUser } from "@/lib/session";
import { OverviewPanel } from "@/components/dashboard/overview-panel";

export default async function DashboardHomePage(): Promise<React.ReactElement> {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Início</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#1A1A2E]">
          Olá, {user?.name?.split(" ")[0] ?? "admin"} 👋
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Visão geral do atendimento — conversas, agendamentos e saúde do bot.
        </p>
      </div>

      <OverviewPanel />
    </div>
  );
}
