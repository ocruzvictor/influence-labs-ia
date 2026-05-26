# Task: aprovar-versao — Aprovar versão (gate humano)

```yaml
task:
  id: aprovar-versao
  name: "Aprovar versão (gate humano)"
  agent: "Aprovador Humano (não-agente)"
  command: "—"
  version: "0.1.0"
  etapa_workflow: 9
  gaps_fechados: [G5, G13]
```

> Esta task é **gate humano**, não execução de agente. Documenta o procedimento que o Aprovador Humano segue. Aprovação final é decisão humana indelegável; sem ela, processo pausa.

## Objetivo

Registrar verdict da versão + **motivo declarado** da mudança escrito na fonte. Sem motivo declarado, deploy não libera.

## Entradas Necessárias

1. **Prompt versão N** que saiu do loop de calibração com `score_global >= THRESHOLD_EVAL`.
2. **eval_report final** (etapa 6, última iteração).
3. **diagnostico final** (etapa 7, última iteração).
4. **Template** `templates/changelog-versao-tmpl.md`.

Sem qualquer um, o gate não inicia.

## Workflow de Execução

### Fase 1: Revisão pelo Aprovador Humano

Aprovador lê: prompt, eval_report, diagnostico. Forma julgamento sobre se a versão está pronta para produção.

### Fase 2: Decidir verdict

Decisões possíveis:
- **APPROVED** — libera para `etapa_10_deploy_versionado`.
- **REJECTED** — devolve ao writer com motivo declarado de rejeição.
- **REQUEST_CHANGES** — pede ajuste específico; retorna ao writer.

### Fase 3: Escrever motivo declarado

Independente do verdict, escreve **motivo declarado** em `templates/changelog-versao-tmpl.md`:
- O que mudou em relação à versão anterior.
- Por que essa mudança (problema observado, fonte do diagnóstico).
- Risco residual conhecido.

Sem motivo declarado = block. Não há aprovação implícita ("ok, segue").

### Fase 4: Registrar `approval_record`

Salva em estado global:

```yaml
approval_record:
  prompt_version: "v{N}"
  verdict: "APPROVED|REJECTED|REQUEST_CHANGES"
  aprovador: "{nome}"
  data: "{ISO}"
  motivo_declarado: "{texto obrigatório}"
  changelog_path: "templates/changelog-versao-tmpl.md (instanciado)"
```

## Veto Conditions

(espelho da `etapa_9_aprovar_versao` do workflow)

- 🔴 **BLOCK se motivo declarado da versão ausente** → não libera deploy sem changelog de motivo. Responsável pelo desbloqueio: Aprovador Humano.

> `backup: null` no workflow — aprovação final não tem backup automático. Se Aprovador ausente, processo **pausa** (não improvisa).

## Formato de Saída

Instância de `templates/changelog-versao-tmpl.md` preenchida + `approval_record` no estado global (campos acima).

## Critério de Conclusão

DONE quando: `approval_record.verdict` registrado, `motivo_declarado` escrito na fonte, changelog instanciado. Se `APPROVED`, handoff para `etapa_10_deploy_versionado`. Se `REJECTED` ou `REQUEST_CHANGES`, devolve à etapa 8 com a justificativa.

Teste verificável: ler o changelog responde "o que mudou, por quê, qual risco" sem consultar outras fontes.
