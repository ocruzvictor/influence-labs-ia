# Task: curar-fontes — Curar fontes de domínio

```yaml
task:
  id: curar-fontes
  name: "Curar fontes de domínio"
  agent: prompt-briefer
  command: "*curar-fontes"
  version: "0.1.0"
  etapa_workflow: 3
  gaps_fechados: [G14]
```

## Objetivo

Coletar pacote de fontes primárias rastreáveis do domínio do briefing (POPs, treinamentos, conteúdo do cliente) — material que será destilado no prompt na etapa 4.

## Entradas Necessárias

1. **Briefing aprovado** (etapa 1) — escopo e cliente.
2. **Anatomia selecionada** (etapa 2) — define quais tipos de seção precisam de evidência (tom, restrições, exemplos).
3. **Parâmetro** `N_FONTES_MIN` (workflow `parameters`, default 3).

Sem briefing ou anatomia, block.

## Workflow de Execução

### Fase 1: Inventário inicial

Lista fontes primárias do cliente alvo: POPs, manuais, treinamentos, scripts, conversas reais autorizadas. Cada fonte registrada com: `id`, `tipo`, `cliente_origem`, `url_ou_path`, `data_acesso`.

### Fase 2: Verificação de rastreabilidade

Para cada fonte: confirma referência verificável (path no repo, URL, ticket, doc). Fonte sem referência verificável = descartada.

### Fase 3: Verificação de origem cross-cliente

Se uma fonte vem de outro cliente (`cliente_origem != briefing.cliente`): exige **localização explícita** — anotação de qual trecho aplica ao cliente alvo e qual NÃO aplica. Sem localização: descarta.

### Fase 4: Verificação de mínimo

Conta fontes primárias válidas. Se `< N_FONTES_MIN` → 🛑 VETO: marca briefing com flag `fontes_insuficientes` e retorna à etapa 1.

### Fase 5: Empacotar

Salva pacote de fontes (lista estruturada) e anexa ao estado global como `fontes_curadas`.

## Veto Conditions

(espelho da `etapa_3_curar_fontes` do workflow)

- 🔴 **BLOCK se `< N_FONTES_MIN` fontes primárias** → marca briefing `fontes_insuficientes`; retorna à `etapa_1_briefing`. Responsável pelo desbloqueio: Solicitante + `prompt-briefer`.
- 🔴 **BLOCK se fonte de outro cliente usada sem localização explícita** → descarta a fonte; recurar. Responsável: `prompt-briefer`.

## Formato de Saída

```yaml
fontes_curadas:
  - id: F1
    tipo: "POP|treinamento|script|conversa"
    cliente_origem: "{cliente}"
    url_ou_path: "{ref verificável}"
    data_acesso: "{ISO}"
    localizado_para_cliente_alvo: true|false
    nota_localizacao: "{quando cliente_origem != briefing.cliente}"
total_primarias: {N}
atende_N_FONTES_MIN: true
```

## Critério de Conclusão

DONE quando: `total_primarias >= N_FONTES_MIN`, toda fonte tem referência verificável e nenhuma fonte cross-cliente está sem localização. Handoff para `etapa_4_redigir_prompt`.

Teste verificável: pegar qualquer fonte do pacote e abrir pela referência registrada — funciona sem ambiguidade.
