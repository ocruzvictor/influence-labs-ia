# Tess Nightwatch

Squad local 24/7 para o bot WhatsApp Tess 46589. Task-first. Quatro personas — **não** modelos soltos.

| Persona | Arquivo | Motor |
|---|---|---|
| Nox (Supervisor) | `agents/nightwatch-supervisor.md` | Grok 4.6 High |
| Dex-Night (Dev) | `agents/patch-dev.md` | Composer 2.5 Fast |
| Quinn-Watch (Sentinel) | `agents/quality-sentinel.md` | High no veredito, Fast nos testes |
| Mira (Floor Quality) | `agents/floor-quality.md` | High na leitura do fio, Fast nos logs |

Plano que o squad aplica: `docs/ops/plano-correcao-go-live-tess-2026-09-02.md`.

- Infra (Nox/Dex/Quinn): health, leaks, I1/I2 HTTP, patch.
- Negócio (Mira): roteiro, horários reais, fidelidade ao prompt, Trinks usada certo, sugestão de regra. 24/7 como os outros.

## Ligar a patrulha

**Grok Bot (preferido para monitorar):** `docs/ops/grok-bot-nightwatch-setup.md` — 4 agents (Nox, Mira, Quinn, Desk). Dex continua no Cursor.

Local (IDE): `/loop 15m` com prompt: carregar `agents/nightwatch-supervisor.md` e rodar `*patrol-live`. Mira entra no tick (~60 min) via `*audit-floor-quality`.

Não inicia sozinho. Victor cria os agents no grok.com (eu não tenho a conta) e arma o loop se quiser no Cursor.

## Comandos

Prefixo `/nightwatch-*` via `slashPrefix`. Na prática: ativar a persona e usar `*patrol-live`, `*rescue-thread`, `*patch-booking-path`, `*verify-trinks-commit`, `*audit-floor-quality`.

Validar: `node -e` no squad-validator (ver README do AIOS) ou `@squad-creator *validate-squad tess-nightwatch`.
