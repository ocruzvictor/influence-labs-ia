# Handoff — Fechamento sessão Frente A + Frente B (Conversa v3 + Admin Story 1.1)

**Data:** 2026-05-27 (madrugada UTC)
**Resumo executivo:** **2 frentes paralelas fechadas e em produção.** 3 PRs mergeadas em main hoje (#3, #4, #6). Próximo passo: smoke test Frente A no WhatsApp (Victor) + escolher próxima story da Frente B (1.2 a 1.6).

---

## Estado atual

### Frente A — Refinamento UX agente Conversa ✅ **DEPLOYED**

**Pipeline `prompt-engineering-squad` fechado em 1 iteração do loop principal.**

| Item | Estado |
|------|--------|
| Prompt v3.0.2 no TESS painel agente 46589 | ✅ deployado pelo Victor 2026-05-26 |
| KB `sinonimos-servicos.md` uploaded no agente | ✅ |
| Backend splitter tag-aware (`backend/lib/message-splitter.js`) | ✅ no main (PR #6) |
| Backend rebuild + restart no VPS | ✅ confirmado pelo Victor (`docker compose up -d --build backend`) |
| Smoke test WhatsApp real com whitelist | ⏸️ Victor vai fazer agora |

**Score eval:**
- v2 baseline: 0.70 (7/10)
- v3.0.2 final: **1.00 (12/12)** com pior caso observado 0.92 (LLM não-determinismo)
- Threshold: 0.85 ✅ ultrapassado com folga

**Mudanças no prompt (R1-R4 + A1):**
- R1: pergunta sobre preço de UM profissional → responde só esse, não compara
- R2: nunca lista valores comparativos profissional×preço sem solicitação
- R3: diferenciação por qualidade/especialidade, nunca por preço
- R4: separador `<break>` em respostas conversacionais (2-4 bolhas), bloco único em confirmações
- A1: KB `sinonimos-servicos.md` mapeando termos coloquiais ("pé"→pedicure, "mão"→manicure, "ficar liso"→Progressiva, etc.)

**Bonus técnico:**
- `BUBBLE_DELAY_MS` env var no backend (default 1100ms — typing-indicator entre bolhas)
- Splitter defensivo: strip de NUL bytes, tag-protection via placeholder reversível, warn log se LLM emitir `<break>` dentro de tag
- 15 testes unitários (`backend/test/message-splitter.test.js`) via `node:test` nativo, zero deps
- Harness `scripts/test-conversa-v3.mjs` reusável: 12 cenários (10 R/NR + 2 A1)

**Dívida técnica conhecida:**
- **M1 (declarada na story A3):** `sendKapsoSingle` não throwa em erro de bolha individual. Em multi-bubble, se Kapso retorna 500 na bolha 2 de 3, bolhas 1 e 3 são enviadas mesmo assim → cliente vê conversa fragmentada. NÃO é regressão (comportamento herdado), mas amplificado. Follow-up issue se aparecer em prod.

**Artefatos (todos no main após PR #3 + PR #6):**
- `docs/feedback/2026-05-26-waitlist-feedback-structured.md`
- `docs/prompts/briefings/conversa-v3-brief.md` + `conversa-v3-anatomia.md`
- `docs/prompts/tess-conversa-v3.md` (metadata + changelog)
- `docs/prompts/tess-conversa-v3-clean.md` (versão deployada no TESS)
- `data/kb/conversa-v2/sinonimos-servicos.md`
- `docs/qa/prompt-eval/conversa-v3-quality-gate-report.md`
- `docs/qa/prompt-eval/conversa-v3-eval-baseline-v2.md`
- `docs/qa/prompt-eval/conversa-v3-eval-final.md`
- `docs/qa/gates/pr-3-conversa-v3-refactor.md`
- `docs/qa/gates/story-a3-splitter-backend.md`
- `docs/stories/salon-whatsapp-conversa-v3-splitter-backend.md` (Status: Done)
- `scripts/test-conversa-v3.mjs` + `test-conversa-v3-results.json`
- `backend/lib/message-splitter.js` + `backend/test/message-splitter.test.js`
- `backend/server.js` (sendKapsoMessage agora `<break>`-aware)
- `backend/package.json` (script `test`)

---

### Frente B — Painel Admin / Dashboard 🟢 **Story 1.1 DONE em produção**

| Item | Estado |
|------|--------|
| Story 1.1 (Auth + base scaffold) | ✅ MERGED em main (PR #4, commit `52f5408`) |
| Deploy em `https://admin.studiotirra.com.br` | ✅ rodando |
| Login e2e (magic link Resend + sessão 30d) | ✅ validado pelo Victor |
| Cert SSL Let's Encrypt | ✅ expira 2026-08-24 |
| Users seedados | ✅ `tiago.terref@gmail.com`, `victor.cruz@pareto.plus` |
| User recepção | ⏸️ pendente (recepção não mandou email ainda) |
| Patches críticos backportados ao código | ✅ 3 patches incluídos no PR #4 antes do merge |

**Stack confirmada:**
- Next.js 16.2.6 + React 19 + TS strict
- Tailwind v4 + shadcn (components.json)
- JWT (jose) + Resend para magic link
- Postgres pg (compartilha schema com backend)
- Cookie HttpOnly + Secure + SameSite=Lax, 30 dias
- nginx (admin.conf) + docker-compose service

**Stories restantes do Epic (5 stories, ~34 pontos, ~5 semanas em ritmo 1/semana):**

| # | Story | Dep | Pts |
|---|-------|-----|-----|
| 2 | Conversas live (lista + filtros + drill-down + polling 5s) | #1 | 8 |
| 3 | Toggle bot (global + por número + endpoints backend + audit log) | #1 | 5 |
| 4 | Métricas dashboard (4-6 KPIs + queries + gráficos) | #1 | 8 |
| 5 | KB editor (CRUD + versionamento + migração de `data/kb/conversa-v2/*.md` pra tabela) | #1 | 8 |
| 6 | Health visual + audit log viewer | #1, #3 | 5 |

**Stories 2 e 3 podem paralelizar agora** que #1 mergeou.

Epic: `docs/stories/epics/EPIC-studio-tirra-admin-dashboard.md`

---

## Próximos passos por ator

### Victor (humano) — agora

1. **Smoke Frente A no WhatsApp** — manda mensagem de um número da whitelist (`…0007`, `…0330`, `…2495`) pro número do salão:
   - "queria cortar sábado com o Erick" → esperado: 2-4 bolhas separadas com ~1.1s entre elas
   - "qual o valor pra cortar com o Tiago?" → esperado: só o preço do Tiago, sem comparativo
   - "queria fazer o pé sábado" → esperado: pergunta de desambiguação (pedicure vs depilação)
   - Confirmar booking completo → esperado: confirmação estruturada em bolha única + tag `[BOOKING_CREATE]` íntegra
2. **recepção** — mandar email pra ele se cadastrar no admin dashboard (`https://admin.studiotirra.com.br` → ele faz magic link)
3. **Decidir próxima story da Frente B** — recomendação: começar pela #2 (Conversas live) porque é a feature mais visível e desbloqueia operação do dia-a-dia do Tiago

### IA / próxima sessão — pendente decisão Victor

**Se Victor optar por Story 1.2 (Conversas live):**
- Comando entrada: `@aios-master` → `@sm *draft Story 1.2 conversas live`
- Dependência: nenhuma além de #1 (já mergeada)
- Escopo: lista de conversas com paginação, filtros (status human-handled/bot/inativa, range de data), drill-down em timeline, polling 5s, indexação `conversation_history(created_at, phone)`

**Se Victor optar por Story 1.3 (Toggle bot) em paralelo:**
- Comando entrada: `@aios-master` → `@sm *draft Story 1.3 toggle bot`
- Pode rodar paralelo com 1.2 (deps disjuntas)
- Escopo: endpoint POST `/admin/bot/toggle`, audit_log table, UI switch no header do dashboard

**Se aparecer regressão na Frente A em produção:**
- Comando entrada: `@aios-master` → `@analyst *brainstorm regressão observada`
- Re-rodar `scripts/test-conversa-v3.mjs` pra confirmar empiricamente
- Se confirmar: @prompt-writer *corrigir-prompt → re-rodar gate + eval

### Pendências operacionais (Victor faz, fora de código)

- Aplicar migration `001_admin_dashboard.sql` no VPS — necessário ANTES da Story 1.2 (precisa de novas tabelas/views) — *aparentemente já aplicada conforme handoff close-out, confirmar*
- DNS A `admin.studiotirra.com.br` → ✅ já feito (admin no ar)
- Domínio Resend verificado → ✅ já feito
- Cert SSL admin → ✅ expira 2026-08-24
- **Dívida ops:** container certbot morto, renovação automática quebrada — fix antes de ago/2026 (compartilhada com Frente Meta)

---

## Mapa de PRs mergeadas hoje

| PR | Título | Commit | Frente |
|----|--------|--------|--------|
| **#3** | feat(conversa): refactor prompt v3.0.2 (artefatos: prompt, KB, eval) | `7a2e9a5` | A |
| **#4** | feat(admin): Story 1.1 — auth scaffold + dashboard shell | `52f5408` | B |
| **#6** | feat(backend): splitter tag-aware [Story A3] | `dc10a57` | A (código) |

**#5** foi closed-superseded por #6 (base branch deletada após merge de #3).

**Main HEAD:** `dc10a57`

---

## Comando de entrada pra próxima sessão

```
@aios-master
```

Pergunte ao usuário:
1. Smoke Frente A passou? (se SIM → confirmar Done; se NÃO → @analyst diagnose)
2. Qual próxima story da Frente B? (recomendação: #2 Conversas live)
3. Algo emergencial fora dessas frentes?

Carregar este handoff + MEMORY.md atualizado.

---

## Arquivos relevantes para próxima sessão

- Este handoff
- `~/.claude/projects/-Users-victorcruz-influence-labs-ia/memory/MEMORY.md` (atualizado)
- `docs/stories/epics/EPIC-studio-tirra-admin-dashboard.md` (mapa de stories)
- `docs/architecture/admin-dashboard.md` (decisões arquiteturais Frente B)
- `docs/design/admin-dashboard/wireframes.md` (UI mockups)
- `docs/prompts/tess-conversa-v3-clean.md` (prompt deployado, referência)
- `scripts/test-conversa-v3.mjs` (harness re-rodável)

---

*Handoff escrito por Gage (@devops) ao final da sessão 2026-05-26/27. Frente A e Frente B simultaneamente entregues ao main em ~9h de trabalho assistido (pipeline prompt-engineering-squad + admin dashboard Story 1.1 via paralelo).*
