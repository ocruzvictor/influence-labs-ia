# Contexto de abertura — nova sessão: ativar WhatsApp do agente (outro perfil / outra BM)

> **Superseded 15/08/2026.** Canal religado. Próxima sessão: `docs/handoffs/whatsapp-bm-influence-labs-ativo-2026-08-15.md`.
>
> Cole isto na **primeira mensagem** da nova sessão. Depois: `@aios-master` (ou `@architect` + `@devops` na execução).
>
> Relatório completo: `docs/ops/whatsapp-restricao-portfolio-studio-tirra-2026-08-14.md`
> Memória: `.claude` project memory `whatsapp-restricao-portfolio-2026-08.md` + `MEMORY.md`

## Objetivo desta sessão

**Plano e execução** para religar o **agente de IA do Studio Tirrá** no WhatsApp, **fora** do portfólio/perfil que está restrito.

Caminhos em aberto (escolher e executar, não só discutir):

1. **Outro perfil Facebook + outra BM** (não reusar o Tiago como dono único, se possível).
2. Número: **atual** `+55 11 94831-9426` **ou** virtuais (**Salvy** / Instant Kapso / outro).
3. Canal: **com Kapso** (Embedded Signup na BM nova) **ou sem Kapso** (Cloud API direto no Developers + webhook `/webhook/meta`).

Sucesso = número **Connected**, inbound chega no backend, bot 46589 responde num teste whitelisted. Recepção humana: app antigo **ou** Chatwoot, conforme o caminho.

## Diagnóstico já fechado — não reabrir

Restrição **generalizada nas contas WhatsApp** do portfólio **Studio Tirrá** (`1927873100853482`). BM de **ads ok**, verificada há meses. Só WhatsApp morto.

Em 14/08/2026, ao reivindicar o **número de teste da Meta** no app **IA Atendimento** (sem Kapso), a Qualidade da Conta (antes limpa) passou a mostrar WABA `1795368298430447` **Desabilitado Permanente**, texto *“Desabilitamos Studio Tirrá e suas contas do WhatsApp Business”* (Política Comercial), regra **can’t have phone numbers added**. Recurso pelo botão oficial → “conteúdo não disponível”.

Isso **não** é bug de Kapso, Salvy, app antigo ou cooldown. Qualquer WABA nova **neste** portfólio nasce morta.

**Neste portfólio NÃO:** reivindicar teste, cadastrar Salvy/Instant, criar mais app/WABA, apagar o WhatsApp do número antigo sem plano de limbo.

## IDs (copiar)

| Item | Valor |
|---|---|
| Portfolio preso | `1927873100853482` (Studio Tirrá) |
| WABA antiga | `1318541913020004` |
| Phone Number ID antigo | `1016003164939443` |
| Número recepção (app ainda recebe) | `+55 11 94831-9426` |
| App antigo (tipo Nenhum, sem produto WhatsApp) | `1491149262343240` Studio Tirra Bot |
| App novo 14/08 | IA Atendimento |
| WABA teste morta | `1795368298430447` |
| Erro Kapso número novo | `#1675030:019fe3c4-3108-782f-8a3a-7ba21177aa67` |
| Erro reconnect antigo | `#2655121` |
| Case Meta | `27264844826545686` |
| Kapso project | `beabf5c5-03f4-4915-9ba0-85e76e118576` |
| Webhook Kapso (prod) | `https://api.studiotirra.com.br/webhook/kapso` |
| Webhook Meta direto | `https://api.studiotirra.com.br/webhook/meta` |

## Números candidatos

- **Atual `94831-9426`:** ainda no WhatsApp Business App. Coexistência/API morta + ghost partner. Migrar para API-só neste portfólio = risco de limbo. Só tentar **depois** de WABA em **outra BM**. Excluir conta no app é irreversível no curto prazo.
- **Salvy:** recebe OTP. Melhor candidato a número novo. Falhou só no portfólio preso.
- **Vivo Voz Negócio:** PABX; SMS externo não chega — evitar.
- **Kapso Instant:** pré-verificado; falhou no portfólio preso; retestar só em BM nova.

## Stack quando o número ligar (não reinventar)

- Bot: TESS **46589** via `callTESS()` em `backend/server.js`.
- Kapso: `POST /webhook/kapso` (produção `main`).
- Meta direto: branch `feature/meta-cloud-direct`, `GET/POST /webhook/meta`. Runbook `docs/ops/meta-cloud-activation-runbook.md`.
- VPS: `ssh deploy@72.60.155.118`, compose em `/opt/influence-labs/infra`. Após rebuild: **reiniciar nginx**.
- Whitelist: `BOT_ACCEPT_ALL=false` até smoke passar.
- MCP Meta DevTools: só webhook em app **já existente**. Não cria WABA nem adiciona número.

## Plano sugerido (a sessão deve executar, não só listar)

1. **Isolar identidade:** perfil Facebook **novo ou terceiro aquecido**, BM **nova**, Page **nova** (não puxar Page do Studio Tirrá nesta BM — já falhou). Verificação de empresa se a Meta pedir.
2. **Smoke WABA limpa:** app Developers com caso de uso WhatsApp **nessa** BM → reivindicar número de **teste da Meta**. Se a Qualidade da Conta **não** desabilitar → o bloqueio era o portfólio antigo. Se desabilitar de novo → o bloqueio **segue a pessoa** (Tiago); precisa de outro admin.
3. **Número de produção:** Salvy (OTP) **ou** Instant Kapso **nessa** BM. Kapso Embedded Signup **ou** API Setup direto.
4. **Número antigo:** só se o passo 2 estiver verde **e** a Meta deixar mover o `94831-9426` sem o portfólio `1927873100853482`. Senão: humano no app antigo, bot no número novo, divulgação depois.
5. **Backend:** Kapso → atualizar `KAPSO_PHONE_NUMBER_ID` + webhook. Sem Kapso → `META_*` + `/webhook/meta` + smoke `oi` whitelisted.

## Orquestração

- `@aios-master` coordena.
- `@architect` se houver escolha Kapso vs Meta direto (já há ADR Kapso Pro; Meta direto é dívida `feature/meta-cloud-direct`).
- `@devops` exclusivo para env/VPS/push.
- `@dev` só se o adapter/env do número novo exigir código.

Branch atual de trabalho legado: `feature/bot-46589-ajustes-resposta` — **não** misturar com esta frente a menos que o smoke do WhatsApp peça.

## Primeira pergunta ao Victor na sessão nova

Qual identidade entra na BM nova: perfil Facebook **novo**, conta de terceiro, ou ainda o Tiago (aceitando o risco de o bloqueio seguir a pessoa)?
