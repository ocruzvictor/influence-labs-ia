# Task: curadoria-continua — Curadoria contínua da Biblioteca de Anatomias

```yaml
task:
  id: curadoria-continua
  name: "Curadoria contínua da Biblioteca de Anatomias"
  agent: prompt-methodology-curator
  command: "*curadoria-continua"
  version: "0.1.0"
  etapa_workflow: "contínuo"
  gaps_fechados: [G15]
```

> Processo **out-of-band** — roda fora do ciclo de um prompt específico (`continuous_processes.curadoria_metodologia` no workflow). Função: impedir que a biblioteca fossilize no PACER.

## Objetivo

Manter `data/biblioteca-anatomias.md` atualizada: pesquisar avanços em engenharia de prompt, validar contra evidência e catalogar entradas novas/revisadas indexadas por tipo de objetivo.

## Entradas Necessárias

1. **Trigger** — um dos três:
   - Periódico (cadência definida pelo owner).
   - Surgimento de tipo de objetivo novo (sinalizado por `etapa_2_selecionar_anatomia` quando 0 candidatas).
   - Avanço relevante em engenharia de prompt (paper, post, técnica reportada).
2. **Biblioteca atual** — `data/biblioteca-anatomias.md`.
3. **Feedback acumulado de eval** (opcional) — sinaliza anatomias com taxa de FP alta ou score baixo recorrente.

Trigger ausente = task não executa (não há "curadoria por desencargo").

## Workflow de Execução

### Fase 1: Identificar tipo de objetivo alvo

Define qual tipo de objetivo a curadoria desta rodada cobre. Pode ser revisão de entrada existente OU catalogação nova.

### Fase 2: Pesquisar

Coleta fontes externas (papers, posts técnicos, repositórios de referência). Cada fonte registrada com referência verificável.

### Fase 3: Validar candidata

Para anatomia candidata: testa em pelo menos 1 caso real (prompt sintético + cenário de eval). Sem validação empírica, não cataloga.

### Fase 4: Catalogar/Revisar

Edita `data/biblioteca-anatomias.md`:
- **Nova entrada:** nome, tipo de objetivo, seções obrigatórias, exige_few_shot, fontes, exemplo mínimo.
- **Revisão:** bump de versão da anatomia, motivo declarado da mudança, diff resumido.

### Fase 5: Anunciar disponibilidade

Sinaliza ao squad: nova anatomia disponível para `etapa_2_selecionar_anatomia`. Anatomias deprecated marcadas explicitamente.

## Veto Conditions

(espelho do `continuous_processes.curadoria_metodologia`; inclui guard estrutural herdado da etapa 2)

- 🔴 **BLOCK se anatomia catalogada sem validação empírica** → não entra na biblioteca. Responsável: `prompt-methodology-curator`.
- 🔴 **BLOCK se entrada nova sem fonte rastreável** → sem fonte, é invenção. Responsável: `prompt-methodology-curator`.

## Formato de Saída

Diff em `data/biblioteca-anatomias.md` + registro da rodada:

```yaml
curadoria_rodada:
  trigger: "periodico|tipo_novo|avanco_externo"
  data: "{ISO}"
  tipo_de_objetivo_alvo: "{classificação}"
  entradas_afetadas:
    - nome: "{anatomia}"
      acao: "nova|revisada|deprecated"
      versao_anterior: "{ou null}"
      versao_nova: "{ou null}"
      motivo_declarado: "{texto}"
      fontes: [{refs verificáveis}]
      validacao_empirica: "{ref do teste}"
```

## Critério de Conclusão

DONE quando: biblioteca reflete a mudança, toda entrada nova/revisada tem fonte e validação empírica, registro da rodada salvo. Squad pode usar a anatomia atualizada na próxima etapa 2.

Teste verificável: `etapa_2_selecionar_anatomia` consegue, dado um briefing do tipo de objetivo alvo, selecionar a entrada nova/revisada com justificativa rastreável.
