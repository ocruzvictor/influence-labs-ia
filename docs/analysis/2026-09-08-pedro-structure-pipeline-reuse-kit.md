# *structure-pipeline — kit de revisão portátil (Pedro + Lib Forge)

**Comando:** `@pedro-valerio *structure-pipeline`  
**artifact_type:** `process-map`  
**Insumo:** Syncra v1.1.0 + Lib Forge analysis-only + pedido de reuso em outros projetos  
**Não é Pro.** Não clona mente. Não inventa 34 tasks.

---

## Processo: levar os dois kits para outro projeto

| # | Etapa | Checkpoint | Veto | Owner |
|---|-------|------------|------|-------|
| 1 | Copiar pastas `squads/pedro-valerio-squad` e `squads/lib-forge` | Pastas completas (agents/tasks/workflows) | BLOCK se copiar só o `.md` do agente | humano |
| 2 | **Não** copiar `data/tess-domain-addendum.md` (ou deixar unread) | Addendum Tess ausente ou não carregado | BLOCK se o novo projeto não for Tess e o addendum for tratado como SOT | `@pedro-valerio` |
| 3 | Criar `data/<cliente>-domain-addendum.md` se houver domínio | Lentes ON-DEMAND, não no agente | BLOCK se colar Tess I1/Trinks no agente core | `@pedro-valerio` |
| 4 | Rodar `*eng-map` no processo do cliente | Mapa com veto + owner | BLOCK se etapa for “verificar se necessário” | `@pedro-valerio` |
| 5 | `*fingerprint-check` no handoff do mapa | Sweet spot (formato, regras, tom L0 do **cliente**) | BLOCK se tom for “use seu julgamento” | `@pedro-valerio` |
| 6 | Se o mapa revelar trabalho determinístico | Lista de Tarefas D / workers | — | `@pedro-valerio` `*task-d-audit` |
| 7 | Passar PRD + mapa para Lib Forge **analysis-only** | Oportunidades sem `.py` | BLOCK se Forge gerar código sem aprovação | `@lib-forge` |
| 8 | Só então `*forge` / generate | Design aprovado | LF-G001 | `@lib-forge` |

**Trigger:** projeto novo precisa de revisão de processo e/ou extração de scripts.  
**Saída:** mapa Syncra + (opcional) lib de scripts no write root **desse** projeto.

---

## Divisão de trabalho (Martelo)

| Quem | Faz | Não faz |
|------|-----|---------|
| **Pedro** | Processo, estados, veto, migalhas, Tarefas D | Não gera biblioteca Python |
| **Lib Forge** | Oportunidades + scripts a partir de PRD/mapa | Não redesenha processo / veto |
| **Humano** | Assina mapa, aprova design da lib, escolhe write root | Não deixa Tess addendum vazar para outro cliente |

---

## *fingerprint-check — este pacote de handoff

| Check | Resultado |
|-------|-----------|
| 1.1 Formato | PASS — pastas de squad + `data/portability.md` |
| 1.2 Exemplo | PASS — este process-map |
| 2.1 Proibições | PASS — sem fingir Pro; sem Tess como SOT fora Tirra; sem generate sem aprovação |
| 3.1 Tom L0 | PASS condicional — L0 é do **projeto destino**, não do Tirra |
| 5.1 Só esta etapa | PASS — Tess fica addendum, não core |
| 5.4 Herança | PASS — Syncra em `data/syncra-methodology.md`; domínio à parte |

**Veto aberto:** se o próximo projeto não tiver L0 (DNA/ICP), Pedro deve elicitar L0 antes de `*eng-map` — senão migalha longe.

---

## O que NÃO entra neste pipeline

- `*clone-mind`, axioma oficial, 34 tasks Pro  
- Reinstalar `.aiox-core`  
- Ativar Kaizen-v2 hooks no destino sem desenho
