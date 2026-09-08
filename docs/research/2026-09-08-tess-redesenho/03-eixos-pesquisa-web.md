# Pesquisa web — eixos ampliados

**Persona:** @analyst (Alex) + tech-search  
**Ferramentas:** WebSearch (EXA_API_KEY ausente — fallback) · docs repo  
**Data:** 2026-09-08  

---

## 1. Digital Employee + Tess Cowork (H8)

### O que a Tess expõe (repo)

`docs/guides/tess-api-reference.md` documenta API **separada** do execute 46589:

| Operação | Uso potencial salão |
|---|---|
| List/create/get/update/delete DE | Entidades com ciclo de vida próprio |
| Invoke / runs / stream | Execução **assíncrona** com histórico |
| Pause / resume / rollback | Governança e reversão |
| Template import/export | Clonar “auditor de commit” entre workspaces |

> Digital Employees ≠ agente 46589 do WhatsApp.

### O que a Tess Cowork promete (web)

Fonte: [tess.im/cowork](https://tess.im/cowork/waitlist)

- Mission Control — visibilidade de agentes, falhas, pendências
- Ciclos de trabalho (~30 min) — agentes “acordam” e agem sem prompt contínuo
- Omnibar — delegação; Tess escolhe agente
- Orçamento por ciclo — alinhado a restrição crédito FDS
- **Governance** (TESS Restrictions) — políticas enterprise

### Fit para Studio Tirra

| Cenário | Fit | Nota |
|---|---|---|
| WhatsApp hot-path 25s | ❌ | Cowork não substitui `callTESS` síncrono |
| Auditor pós-turno (I1 drift) | ✅ | DE invoke + compare ledger |
| Fila recepção Martelo | ✅ | runs + pause/resume |
| Retry idempotente POST | ⚠️ | Precisa bridge Express→DE — **não existe** no FDS |
| Substituir Nightwatch | ❌ | Nightwatch já read-only MCP |

**Hipótese H8:** **parcialmente válida** como **camada assíncrona**, não como substituto do 46589 no fio.

---

## 2. OpenClaw / Mission Control vs Synkra Factory vs Tess Cowork (H12)

### OpenClaw (web + foundation report)

Fontes: [OpenClaw memory docs](https://docs.openclaw.ai/concepts/memory) · [OpenClaw automation/heartbeat](https://docs.openclaw.ai/automation/cron-vs-heartbeat) · `docs/research/influence-labs-foundation-report.md`

| Componente | Função |
|---|---|
| `SOUL.md` | Personalidade, limites, tom |
| `MEMORY.md` + `memory/YYYY-MM-DD.md` | Memória longa + diário |
| Heartbeat (~30 min) | Monitor ambient; scratch doc; **não** cria task record |
| File-based | Tudo auditável em disco |

**Tipo 5–6 (foundation):** multimodelo orquestrado · GAIA-style multi-agent · autohealing · escalação humana.

### Comparativo três camadas

| Dimensão | OpenClaw | Synkra/AIOX Factory | Tess Cowork |
|---|---|---|---|
| Propósito | Office ops, memória, cron | Dev stories, squads, CI mental | DE enterprise, Mission Control |
| Runtime WhatsApp | Via Kapso plugin (Hermes/OpenClaw path) | ❌ não runtime | ❌ DE ≠ 46589 |
| Memória | Arquivos SOUL/MEMORY | Stories, handoffs, MEMORY.md agentes | Workspace Tess |
| Heartbeat | ✅ nativo | ❌ (Nightwatch = patrulha diferente) | ✅ ciclos ~30 min |
| Já no Tirra | Kapso docs citam integração | ✅ squads Pedro/Forge/DR | ✅ API documentada |
| Inventar produto? | ⚠️ se virar runtime booking | ❌ já existe | ⚠️ se Cowork virar hot-path |

**Hipótese H12:** OpenClaw fecha **lacunas de memória/heartbeat/back-office** — **não** I1 no hot-path. Synkra Factory = **governança de redesign**, não runtime. Tess Cowork = **Mission Control + DE** quando houver bridge assíncrona.

**Recomendação analyst:** três camadas **complementares**:
1. Hot-path: Express + código (existente) + Opção A lock
2. Office: OpenClaw **ou** DE Cowork para auditoria/retry
3. Factory: AIOX squads para pesquisa/implementação futura

---

## 3. Hermes — duas hipóteses separadas (H11)

### H11a — Hermes Agent + plugin Kapso (runtime)

Fontes: [Kapso Hermes Agent docs](https://docs.kapso.ai/docs/whatsapp/hermes-agent) · [kapso.com/whatsapp-hermes-agent](https://kapso.com/whatsapp-hermes-agent)

- Plugin: `gokapso/hermes-agent-plugin`
- Hermes gateway recebe webhooks Kapso → `MessageEvent`
- Respostas via Kapso API
- Setup: `hermes kapso setup --funnel-url https://...`
- Kapso também documenta OpenClaw como runtime alternativo

| Prós | Contras |
|---|---|
| OSS gateway; controle total do fluxo | **Substitui** stack Express+46589 — big-bang |
| Plugin maduro Kapso | Reimplementar guards, 2-phase, snapshot |
| Permite cron Hermes | Perde Stories 1–13 investidas |

**Veredicto:** hipótese **válida para greenfield**; para Tirra = **projeto paralelo**, não patch T2.

### H11b — “Hermes” como modelo OSS (Nous Hermes / Llama family)

Não confundir com plugin Kapso. MEMORY cita “modelo OSS” separado.

| Aspecto | Nota |
|---|---|
| Custo | Potencialmente ↓ vs Haiku |
| Acurácia commit | **Não evidenciado** no FDS; tags JSON frágeis |
| Tess suporte | Depende motor Tess cobrir OSS |
| Effort/thinking | Depende provider |

**Veredicto:** só **A/B** após H3/H4 endereçados; trava Haiku+Thinking 01/set permanece para painel.

---

## 4. Squads vs mega-agente (H10) — evidência externa

Fontes: [Saga pattern + multi-agent](https://zylos.ai/research/2026-05-31-saga-pattern-distributed-transactions-multi-agent-ai-workflows/) · [Hotel reservation HLD](https://hld.handbook.academy/curriculum/case-studies/hotel-reservation/)

**Padrão indústria booking 2025–2026:**
- **Não** 2PC entre inventário + pagamento + notificação
- **Saga** com compensação + **hold TTL** antes de commit
- Orquestrador (Temporal-like) guarda estado **fora** do LLM context
- Multi-agente útil quando cada passo é **idempotente** com compensação explícita

**Lição para 46589:** mega-agente mistura passos saga (propor → hold → pagar → confirmar) numa **só boca** — alinhado a falha T1/T2. Squad **só ajuda** se cada agente tiver **estado persistido** e **veto** equivalente ao eixo 4.

---

## 5. Modelos — Haiku 4.5, effort, thinking (H1/H7)

Fontes: [Claude models overview](https://platform.claude.com/docs/en/models/overview) · [Haiku 4.5 extended thinking](https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-extended-thinking.html)

| Modelo | Thinking | Effort param | Latência | Fit booking |
|---|---|---|---|---|
| Haiku 4.5 (atual) | Manual `budget_tokens` | **Não suportado** (400) | Fastest | OK se fluxo tem dentes |
| Sonnet 5 | Adaptive | ✅ high/medium/low | Fast | Melhor raciocínio; ↑ cr |
| Opus 5 | Adaptive | ✅ | Moderate | Overkill salão |

**FDS relevante:**
- Haiku **sem** Thinking = trava 01/set (custo jun/2026 Thinking alto)
- Typo `213h30` = H1 **candidato** mas **não explica** 0 POST com copy perfeita

**Effort selecionável:** indisponível no Haiku 4.5 — exigiria **troca de modelo** no Tess, não knob no agente atual.

**Open source:** só relevante se Tess cobrir motor + tags estáveis; caso contrário **aumenta** risco I1.

### Árvore de decisão modelo

```
H3/H4 resolvido?
  ├─ NÃO → modelo é falso positivo; fix fluxo primeiro
  └─ SIM → A/B mínimo:
        ├─ Haiku + thinking budget fixo (medir cr/turn)
        ├─ Sonnet effort=low (medir I1)
        └─ OSS (só sandbox; não painel)
```

---

## 6. Human AI / Syncra (H9) — síntese

Fonte: `squads/pedro-valerio-squad/data/syncra-methodology.md`

| Conceito | Aplicação salão |
|---|---|
| Martelo | Recepção **assina** POST ou nega — não só `silenced_until` |
| Migalha | Booking thread carrega `{slot?, hold_id?, stage}` — não 31k genérico |
| Entidade nasce-morre | Conversa booking = entidade com status até CONFIRMED/ABANDONED |
| Worker/Agente/Humano | Guards=worker; Tess=agente; recepção=humano com accountability |

**F3×F5:** recepção no fio hoje **quebra** saga — humano entra sem assumir estado da promessa da Tess.

---

## 7. Crédito (restrição transversal)

MEMORY: ~65–79k cr/mês se OPEN repetir FDS; piso ~18 cr/turn MIN.

| Alavanca | Impacto cr | Impacto I1 |
|---|---|---|
| Split FAQ/BOOKING | ↓ prefixo BOOKING | ⚠️ multi-path |
| Thinking/Effort | ↑↑ | ? |
| Hold worker 0 LLM | ~0 | ✅ |
| DE async auditor | +runs | ✅ detecção |
| OpenClaw heartbeat | infra VPS | ❌ hot-path |

**Conclusão:** crédito **não** justifica go-live com I1=0; otimização vem **depois** do commit confiável.

---

## Fontes web citadas

1. https://docs.tess.im/en/api-overview  
2. https://tess.im/cowork/waitlist  
3. https://docs.openclaw.ai/concepts/memory  
4. https://docs.openclaw.ai/automation/cron-vs-heartbeat  
5. https://docs.kapso.ai/docs/whatsapp/hermes-agent  
6. https://platform.claude.com/docs/en/models/overview  
7. https://hld.handbook.academy/curriculum/case-studies/hotel-reservation/  
8. https://zylos.ai/research/2026-05-31-saga-pattern-distributed-transactions-multi-agent-ai-workflows/  

---

*Analyst · tech-search wave 1 · EXA fallback WebSearch · 2026-09-08*
