# Checklist: Fingerprint / Migalhas de Pão

> Valida se o contexto entregue ao próximo executor (humano, agente ou worker) está no **sweet spot** — nem vazio demais, nem pão inteiro.

**Comando:** `*fingerprint-check`  
**Fonte metodológica:** Syncra — docs *Guia de Conceitos* e *Guia Synkra: Ciclo de Vida da Tarefa*  
**Referência:** `data/syncra-methodology.md` §3

---

## Quando usar

- Antes de handoff entre etapas do `*structure-pipeline`
- Antes de acionar agente/worker com prompt ou briefing
- Ao revisar input de `@oalanicolas` (INSUMOS_READY) antes de estruturar
- Quando output de IA veio genérico ou alucinado → auditar migalhas primeiro

---

## 1. Formato do output

| # | Check | PASS | FAIL |
|---|-------|------|------|
| 1.1 | Formato de entrega está explícito? (tipo, dimensão, extensão, schema) | ☐ | ☐ |
| 1.2 | Exemplo concreto ou template referenciado? | ☐ | ☐ |
| 1.3 | Formato é compatível com executor designado (Worker vs Agent)? | ☐ | ☐ |

**Veto:** handoff sem formato definido → BLOCK até especificar.

---

## 2. Regras de conteúdo / legenda

| # | Check | PASS | FAIL |
|---|-------|------|------|
| 2.1 | Proibições explícitas listadas? (o que NÃO pode aparecer) | ☐ | ☐ |
| 2.2 | Termos técnicos / nomenclatura obrigatória definidos? | ☐ | ☐ |
| 2.3 | Regras de negócio rastreáveis (não "conforme necessário")? | ☐ | ☐ |

**Veto:** regra ambígua tipo "ajustar conforme necessário" → BLOCK, substituir por condição booleana.

---

## 3. Tom de voz (DNA L0)

| # | Check | PASS | FAIL |
|---|-------|------|------|
| 3.1 | Tom de voz referencia DNA L0 / Voice DNA da entidade? | ☐ | ☐ |
| 3.2 | Registro (formal/informal) e persona definidos? | ☐ | ☐ |
| 3.3 | Anti-patterns de tom listados (o que evitar)? | ☐ | ☐ |

**Veto:** tom "livre" ou "use seu julgamento" sem âncora no L0 → BLOCK.  
**Veto (projeto estrangeiro):** L0-1…L0-6 de `data/l0-intake.md` vazios → BLOCK `*eng-map`. Neste repo, Tess/Tirra já tem L0 — não refazer.

---

## 4. Regras de marca

| # | Check | PASS | FAIL |
|---|-------|------|------|
| 4.1 | Identidade visual / nomenclatura de marca referenciada? | ☐ | ☐ |
| 4.2 | Paleta, tipografia ou tokens de design citados (se aplicável)? | ☐ | ☐ |
| 4.3 | Marca distinta de outros clientes/DNAs no mesmo projeto? | ☐ | ☐ |

---

## 5. Densidade do contexto (Sweet Spot)

| # | Check | PASS | FAIL |
|---|-------|------|------|
| 5.1 | Input contém **apenas** o necessário para **esta** etapa? | ☐ | ☐ |
| 5.2 | Briefing bruto foi filtrado/tratado (não dump de 20+ páginas)? | ☐ | ☐ |
| 5.3 | Próximo passo explícito após consumir este contexto? | ☐ | ☐ |
| 5.4 | Herança L0→L3 aplicada (não repetir DNA já herdado)? | ☐ | ☐ |

| Diagnóstico | Sintoma | Ação |
|------------|---------|------|
| Migalha longe | Executor inventa caminho | Adicionar checkpoint + input tratado |
| Pão inteiro | Output medíocre/genérico | Filtrar: extrair só campos da etapa |
| Sweet spot | Execução precisa na 1ª tentativa | ✅ Aprovar handoff |

---

## 6. Journey Log

| # | Check | PASS | FAIL |
|---|-------|------|------|
| 6.1 | Handoff será registrado no Journey Log / sistema? | ☐ | ☐ |
| 6.2 | Fingerprints desta etapa identificáveis no log? | ☐ | ☐ |

**Mantra:** *Se não está no sistema, não aconteceu.*

---

## Resultado

| Score | Veredito |
|-------|----------|
| 0 FAIL | ✅ PASS — handoff aprovado |
| 1–2 FAIL | ⚠️ ATENÇÃO — corrigir antes de executar |
| 3+ FAIL | 🛑 VETO — não handoff até migalhas corrigidas |

**Relatório esperado:** tabela PASS/FAIL por seção + lista de migalhas faltantes + recomendação de input tratado.

**Sinal de conclusão:** `<promise>COMPLETE</promise>`
