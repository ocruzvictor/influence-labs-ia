import { LoginForm } from "@/components/auth/login-form";
import { LoginErrorBanner } from "@/components/auth/login-error-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic"; // honor ?error query param

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps): Promise<React.ReactElement> {
  const { error } = await searchParams;

  return (
    <Card className="w-full max-w-md border-[rgba(26,26,46,0.08)] bg-white shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto text-xs uppercase tracking-[0.12em] text-zinc-500">
          Studio Tirra
        </div>
        <CardTitle className="text-2xl font-semibold text-[#1A1A2E]">
          Painel admin
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <LoginErrorBanner code={error} /> : null}
        <LoginForm />
      </CardContent>
    </Card>
  );
}
