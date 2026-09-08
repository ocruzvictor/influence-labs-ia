# Lib Forge 🔥

**Transforma PRDs e conversas em bibliotecas de scripts Python organizadas.**

## O que faz

Você fornece um PRD (documento de produto) e opcionalmente uma conversa que dá contexto ao PRD. O lib-forge analisa, projeta e gera uma biblioteca de scripts Python prontos para uso, organizados no repositório `victor-libs/`.

## Agentes

| Agente | Nome | Função |
|--------|------|--------|
| 🔥 Orchestrator | Forge | Coordena o pipeline inteiro |
| 🔍 Tier 1 | Ana | Analisa PRD e conversa, extrai oportunidades |
| 🏗️ Tier 2 | Arco | Projeta estrutura da lib e assinaturas |
| ✍️ Tier 3 | Script | Escreve o código Python |
| ✅ Tier 4 | Val | Valida qualidade antes da entrega |

## Pipeline

```
PRD + Conversa
      ↓
🔍 Ana analisa e extrai oportunidades
      ↓
🏗️ Arco projeta estrutura e funções
      ↓
👤 VOCÊ APROVA o design
      ↓
✍️ Script gera os arquivos .py
      ↓
✅ Val valida qualidade
      ↓
📦 Entrega em victor-libs/
```

**Portátil:** profile `analysis-only` em qualquer projeto. Tess addendum é ON-DEMAND. Write root: `data/write-root.md`.

## Como usar

### Ativar o squad
```
@lib-forge
```

### Pipeline completo
```
*forge docs/meu-prd.md conversations/reuniao.txt
```

### Só analisar (sem gerar código)
```
*analyze docs/meu-prd.md
```

### Ver status do pipeline
```
*status
```

## Estrutura de Saída

```
victor-libs/
  salao/           ← scripts do influence-labs
  vendas/          ← scripts do ecoadventure
  design/          ← scripts do studio-design
  comum/           ← utilitários compartilhados
```

## Adaptação Studio Tirra (2026-09-03)

Portado de `ecoadventure-sdr-wpp/aiox-squads/squads/lib-forge`.

- Domínio deste projeto: **`salao/`** (atendimento Tess 46589 + Trinks).
- Runtime preferido aqui: **Node CommonJS** em `scripts/` ou `backend/scripts/` — o hot-path já é Express.
- Python permanece válido para jobs de texto/docs fora do backend.
- Nesta rodada: profile **analysis-only**. Não gerar código até Victor aprovar a lista (LF-G001).
- SOT de insumos: `docs/analysis/2026-09-03-insumos-ready-tess-atendimento.md`.

## Regras Importantes

1. **Você sempre aprova o design antes de qualquer código ser gerado**
2. Scripts com docstring em português; Node CommonJS neste repo, Python se o job for fora do backend
3. Organizado por domínio de negócio
4. Um script faz uma coisa só
5. Pode copiar pastas do victor-libs para dentro de qualquer projeto

## Versão

`1.0.2` — Write root resolvido (`data/write-root.md` + resolver); default deste repo inalterado  
`1.0.1` — ACTIVATION-NOTICE nos 5 agentes + anatomia de 8 campos nas 7 tasks (2026-09-08)  
`1.0.0` — Gerado via squad-creator do AIOX
