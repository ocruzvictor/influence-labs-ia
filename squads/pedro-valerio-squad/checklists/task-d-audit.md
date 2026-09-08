# Checklist: Auditoria de Tarefas "D"

> Identifica e classifica tarefas **burras/burocráticas** (Tipo D) na rotina humana — candidatas a delegação para Worker ou Agente.

**Comando:** `*task-d-audit`  
**Fonte metodológica:** Syncra — docs *Plano de Reestruturação* e *Plano de Transição Sinncra*  
**Referência:** `data/syncra-methodology.md` §7

---

## Definição: Tarefa "D"

Atividade que **não exige julgamento humano** mas consome valor-hora:

- Criar pastas / estrutura de diretórios
- Copiar e colar entre sistemas (Control C + Control V)
- Vincular links em planilhas ou docs
- Renomear arquivos em lote
- Preencher campos deriváveis de outra fonte
- Buscar arquivo em silos dispersos (Google Drive Trap)
- Re-digitar dado que já existe em outro sistema

**Não é Tarefa D:** decisão estratégica, criatividade, assinatura, julgamento ético/estético, negociação.

---

## Quando usar

- Início de *eng-map* ou *structure-pipeline* (fase intake)
- Roadmap de automação antes de *auto-rules*
- Revisão de processo com alto gap de tempo / context switching
- Transição Syncra: "Serial Killer" de burocracia humana

---

## 1. Inventário de microtarefas

| # | Check | PASS | FAIL |
|---|-------|------|------|
| 1.1 | Processo decomposto em átomos (pensar → clicar → executar)? | ☐ | ☐ |
| 1.2 | Cada etapa tem owner nomeado? | ☐ | ☐ |
| 1.3 | Tempo estimado por etapa documentado? | ☐ | ☐ |

---

## 2. Classificação por executor

Para **cada** microtarefa identificada, classificar:

| Tipo | Critério | Destino |
|------|----------|---------|
| **D** | Determinística, zero julgamento | Worker (script) — prioridade extinção humana |
| **D′** | Repetitiva + triagem simples | Agente (IA) |
| **H** | Criatividade, assinatura, accountability | Humano — manter |
| **Hy** | Extração determinística + decisão | Hybrid (Worker + Agent) |

| # | Check | PASS | FAIL |
|---|-------|------|------|
| 2.1 | Tarefas D listadas com frequência (diária/semanal/por entidade)? | ☐ | ☐ |
| 2.2 | Cada D tem executor-alvo proposto (Worker/Agent)? | ☐ | ☐ |
| 2.3 | Tarefas H justificadas (por que não automatizar)? | ☐ | ☐ |

---

## 3. Custo e Redução de Cliques

| # | Check | PASS | FAIL |
|---|-------|------|------|
| 3.1 | Cliques/contagens por ciclo da entidade estimados? | ☐ | ☐ |
| 3.2 | Context switches (troca de aba/sistema) mapeados? | ☐ | ☐ |
| 3.3 | Gap de tempo em handoffs quantificado (min/entidade)? | ☐ | ☐ |
| 3.4 | ROI de automação estimado (horas/semana recuperáveis)? | ☐ | ☐ |

**Referência:** context switching ≈ 30–60 min/dia/profissional (fontes Syncra).

---

## 4. Anti-patterns (Google Drive Trap)

| # | Check | PASS | FAIL |
|---|-------|------|------|
| 4.1 | Entidade nasce e morre em **uma** lista (não pastas paralelas)? | ☐ | ☐ |
| 4.2 | Dados duplicados entre sistemas identificados? | ☐ | ☐ |
| 4.3 | Comunicação operacional fora do sistema (WhatsApp/e-mail) flagrada? | ☐ | ☐ |

**Veto:** processo depende de pasta manual por cliente sem entidade central → BLOCK, redesenhar.

---

## 5. Plano de extinção (Serial Killer)

| # | Check | PASS | FAIL |
|---|-------|------|------|
| 5.1 | Top 5 tarefas D por impacto (freq × tempo) ranqueadas? | ☐ | ☐ |
| 5.2 | Cada top-D tem caminho: Worker / Agent / Forja / manual temporário? | ☐ | ☐ |
| 5.3 | Humano remanescente só em zona de assinatura/criatividade? | ☐ | ☐ |
| 5.4 | Journey Log capturará execução automatizada? | ☐ | ☐ |

---

## 6. Martelo — accountability

| # | Check | PASS | FAIL |
|---|-------|------|------|
| 6.1 | Automação proposta tem humano assinante definido? | ☐ | ☐ |
| 6.2 | Veto conditions para automação rodar errado? | ☐ | ☐ |
| 6.3 | Fallback manual documentado se worker/agent falhar? | ☐ | ☐ |

**Regra:** IA executa, humano assina. Automatizar sem assinante = BLOCK.

---

## Resultado

| Score | Veredito |
|-------|----------|
| 0 FAIL + plano extinção | ✅ PASS — roadmap de automação aprovado |
| 1–3 FAIL | ⚠️ ATENÇÃO — completar inventário antes de *auto-rules* |
| 4+ FAIL ou sem classificação D/H | 🛑 VETO — processo ainda opaco demais para automação |

**Relatório esperado:**

1. Tabela de tarefas D com freq, tempo, executor-alvo
2. Estimativa de horas/semana recuperáveis
3. Top 5 extinções prioritárias
4. Lista de veto conditions para automação

**Sinal de conclusão:** `<promise>COMPLETE</promise>`
