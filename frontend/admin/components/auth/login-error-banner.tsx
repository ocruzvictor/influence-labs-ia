const MESSAGES: Record<string, string> = {
  expired: "Esse link expirou. Peça um novo abaixo.",
  consumed: "Esse link já foi usado. Peça um novo abaixo.",
  invalid: "Link inválido. Peça um novo abaixo.",
  missing: "Link incompleto. Peça um novo abaixo.",
  inactive: "Sua conta está desativada. Fale com o administrador.",
  server: "Algo deu errado no servidor. Tente novamente em instantes.",
};

export function LoginErrorBanner({ code }: { code: string }): React.ReactElement {
  const message = MESSAGES[code] ?? "Não foi possível autenticar. Tente novamente.";
  return (
    <div
      role="alert"
      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      {message}
    </div>
  );
}
