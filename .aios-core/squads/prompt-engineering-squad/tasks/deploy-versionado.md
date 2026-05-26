# Task: deploy-versionado — Deployar com registro versionado

```yaml
task:
  id: deploy-versionado
  name: "Deployar com registro versionado"
  agent: prompt-release-manager
  command: "*deploy-versionado"
  version: "0.1.0"
  etapa_workflow: 10
  gaps_fechados: [G1, G2, G3]
```

## Objetivo

Registrar a versão (git + changelog) ANTES do deploy ao destino, reconciliar cópias divergentes, e colar no destino mantendo fonte de verdade única.

## Entradas Necessárias

1. **Prompt versão N** aprovado (verdict `APPROVED` da etapa 9).
2. **`approval_record`** com `motivo_declarado`.
3. **Changelog instanciado** (`templates/changelog-versao-tmpl.md`).
4. **Destino de deploy** identificado (ex: TESS Studio, agente ID).
5. **Lista de cópias conhecidas** do prompt (repo, `.ts`, destino) — para auditoria de divergência.

Sem aprovação ou changelog, block.

## Workflow de Execução

### Fase 1: Auditoria de cópias

Lista todas as cópias do prompt em uso. Diffa cada cópia contra a versão aprovada. Se houver cópia divergente não reconciliada: 🛑 VETO — reconciliar primeiro (ou marca cópia como deprecated com justificativa).

### Fase 2: Commit versionado

Commita no repositório: arquivo do prompt + changelog instanciado. Mensagem de commit referencia `prompt_id`, `prompt_version`, `motivo_declarado` (resumo). Retorna `commit_hash`.

### Fase 3: Deploy ao destino

Cola/aplica o prompt no destino configurado (TESS, API, etc.). Registra `deploy_target`, `deploy_timestamp`.

### Fase 4: Verificação pós-deploy

Confirma que destino reflete a versão registrada. Se divergência detectada após deploy: rollback manual conforme workflow (`rollback.strategy: manual`) — reverte para versão anterior no destino e atualiza changelog.

### Fase 5: Atualizar fonte de verdade única

Marca o repositório como fonte de verdade. Cópias previamente divergentes ficam apontando para o `commit_hash` ou são removidas.

## Veto Conditions

(espelho da `etapa_10_deploy_versionado` do workflow)

- 🔴 **BLOCK se prompt vai a produção sem registro versionado** → deploy abortado; commita primeiro. Responsável: `prompt-release-manager`.
- 🔴 **BLOCK se existe cópia divergente não reconciliada** → deploy abortado; reconcilia cópias primeiro. Responsável: `prompt-release-manager`.

## Formato de Saída

```yaml
deploy_record:
  prompt_id: "{id}"
  prompt_version: "v{N}"
  commit_hash: "{sha}"
  changelog_path: "{path versionado no repo}"
  deploy_target: "{ex: tess.agent_id=44853}"
  deploy_timestamp: "{ISO}"
  copias_auditadas: [{ paths }]
  copias_reconciliadas: [{ paths }]
  status: "DEPLOYED"
```

## Critério de Conclusão

DONE quando: `commit_hash` existe, changelog versionado no repo, deploy aplicado no destino, nenhuma cópia divergente em aberto. Handoff para `PRODUCAO`.

Teste verificável: dado o `prompt_id`, é possível reconstruir qual versão está em produção, quando entrou, e por que — apenas pelo repo.
