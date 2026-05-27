/**
 * Magic-link email — simple HTML, no React Email lib to keep MVP lean.
 * Sender + API key come from validated env (lib/env.ts).
 */

import { Resend } from "resend";
import { env } from "../env";

const resend = new Resend(env.RESEND_API_KEY);

export interface SendMagicLinkArgs {
  to: string;
  name: string;
  link: string;
}

export async function sendMagicLinkEmail({ to, name, link }: SendMagicLinkArgs): Promise<void> {
  const subject = "Seu link de acesso ao painel Studio Tirra";
  const html = magicLinkTemplate({ name, link });
  const text =
    `Olá, ${name}!\n\n` +
    `Acesse o painel Studio Tirra clicando no link abaixo (válido por 15 minutos):\n\n` +
    `${link}\n\n` +
    `Se você não solicitou este link, ignore este email.\n\n` +
    `— Studio Tirra`;

  const { error } = await resend.emails.send({
    from: `Studio Tirra <${env.RESEND_FROM_EMAIL}>`,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(`Resend failed: ${error.message ?? JSON.stringify(error)}`);
  }
}

function magicLinkTemplate({ name, link }: { name: string; link: string }): string {
  // Inline styles only — most email clients strip <style> tags
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Studio Tirra · Acesso ao painel</title>
  </head>
  <body style="margin:0;padding:0;background:#F5F3EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EE;padding:48px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background:#FFFFFF;border-radius:8px;overflow:hidden;border:1px solid rgba(26,26,46,0.08);">
            <tr>
              <td style="padding:32px 32px 8px;">
                <div style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#6B7280;">Studio Tirra</div>
                <h1 style="margin:8px 0 0;font-size:24px;font-weight:600;color:#1A1A2E;">Olá, ${escapeHtml(name)} 👋</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px;color:#1A1A1A;line-height:1.6;">
                Clique no botão abaixo pra entrar no painel admin. O link expira em <strong>15 minutos</strong> e só pode ser usado uma vez.
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;" align="center">
                <a href="${link}" style="display:inline-block;background:#1A1A2E;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:15px;">
                  Entrar no painel
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px;color:#6B7280;font-size:13px;line-height:1.5;">
                Se o botão não funcionar, copie e cole este link no navegador:<br />
                <a href="${link}" style="color:#4338CA;word-break:break-all;">${link}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#EDEAE3;color:#6B7280;font-size:12px;line-height:1.5;border-top:1px solid rgba(26,26,46,0.08);">
                Não solicitou este email? Pode ignorar — ninguém entrou na sua conta.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
