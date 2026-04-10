# Target Architectures - Mode 1 vs Mode 2

Data: 2026-03-05

## Objetivo de execucao
- Operar em producao no **Mode 2** (Meta + Chatwoot + n8n) durante 1 mes apos Fase 3 completa.
- Usar aprendizados reais para migrar com seguranca ao **Mode 1** (Meta + backend proprio).

## Mode 2 (alvo imediato)
- Ingress: Meta Cloud API -> webhook n8n (WF-01)
- Orquestracao: n8n (WF-01..WF-06)
- Operacao humana: Chatwoot (WF-05 + workflow de resposta humana)
- Dados: Postgres (`influence_labs_salon`)
- Integracoes: Trinks API, LLM provider

### Vantagens
- Menor risco de rollout
- Observabilidade operacional mais rapida
- Menor tempo de ajuste de prompt/processo

### Riscos
- Mais componentes para operar
- Dependencia de padronizacao de env vars

## Mode 1 (alvo futuro)
- Ingress: Meta Cloud API -> backend proprio
- Orquestracao: servicos/casos de uso em codigo
- Operacao humana: Chatwoot (ou inbox alternativo) via API
- Dados: Postgres
- Integracoes: Trinks API, LLM provider

### Vantagens
- Menos pontos de falha de runtime
- Maior controle de performance e versionamento

### Riscos
- Maior esforco de engenharia
- Maior tempo para maturar retries/observabilidade/hardening

## Gatilho de migracao Mode 2 -> Mode 1
Migrar somente se, apos 30 dias de Fase 3 completa:
1. SLA de resposta estavel em producao
2. Handoff humano com baixa friccao
3. Taxa de erro operacional sob controle
4. Regras de negocio estabilizadas (agendamento/follow-up/reativacao)

## Regra de seguranca
- Nenhuma credencial hardcoded em workflow
- Apenas 80/443 expostos publicamente
- Logs e metricas com trilha de auditoria
