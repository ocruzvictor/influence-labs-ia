import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/session";

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
          O painel está sendo construído story por story. A visão geral chega na
          próxima entrega.
        </p>
      </div>

      <Card className="border-[rgba(26,26,46,0.08)] bg-white">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-[#1A1A2E]">
            Em construção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-600">
          <p>
            Esta home receberá KPIs e atividade recente na <strong>Story 1.2</strong>{" "}
            (Conversas) e <strong>Story 1.4</strong> (Métricas).
          </p>
          <p>
            Você já consegue navegar pelo menu — itens marcados como “em breve”
            ainda não têm tela; aparecem só pra dar sensação do produto final.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
