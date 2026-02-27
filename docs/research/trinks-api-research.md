# Pesquisa API Trinks - Studio Tirra

Data da pesquisa: 2026-02-25

## Fontes usadas
- https://www.trinks.com/
- https://ajuda.trinks.com/api-da-trinks
- https://ajuda.trinks.com/duvidas-frequentes-api-trinks
- https://ajuda.trinks.com/webhook-api-trinks-sns
- https://ajuda.trinks.com/status-code-api

## Resumo executivo
- A Trinks possui API (modelo REST) para parceiros/clientes com habilitacao de modulo.
- Autenticacao reportada na base oficial: API Key.
- Limites reportados no FAQ oficial: 60 requisicoes por minuto e 5.000 requisicoes por mes.
- Webhooks via SNS estao documentados para eventos (ex.: agendamento).
- A API nao e "publica aberta" para qualquer conta sem contratacao/habilitacao.

## Endpoints necessarios para este projeto (mapeamento funcional)
Observacao: os nomes abaixo combinam informacao oficial + inferencia de integracao para o Studio Tirra.

1. Disponibilidade por profissional/data
- Objetivo: substituir `check-availability.sql`
- Necessidade funcional: GET de slots livres por data/profissional/duracao
- Resultado esperado no workflow: lista de horarios (`HH:MM`)

2. Criacao de agendamento
- Objetivo: commit final da recepcionista
- Necessidade funcional: POST com cliente, servico, profissional, data/hora, duracao e observacoes

3. Consulta de agendamentos existentes
- Objetivo: confirmacao D-1, lembrete e follow-up
- Necessidade funcional: GET por janela de datas/status

4. Consulta de dados de cliente/historico
- Objetivo: reconhecer recorrentes e alimentar score local
- Necessidade funcional: GET por telefone/identificador + ultimo servico/ultima visita

## Status codes relevantes (documentacao oficial)
- 200: sucesso
- 400: request invalida
- 401: nao autorizado
- 404: recurso nao encontrado
- 409: conflito de agenda/recurso
- 500: erro interno

## Recomendacoes tecnicas para n8n
- Usar cache curto para disponibilidade (TTL 30-120s)
- Usar lock + revalidacao antes de confirmar agendamento
- Implementar retry com backoff para 429/5xx
- Registrar `trace_id` por conversa para auditoria

## Fallbacks caso API nao esteja habilitada no ambiente
1. Integracao oficial via parceiro (ativar modulo de API com suporte Trinks)
2. Sincronizacao semiautomatica via Chatwoot/Gabriel em casos criticos
3. Evitar scraping como estrategia principal (alto risco de manutencao)

## Decisao para fase 4
- Prosseguir com arquitetura HTTP-first para Trinks nos workflows de agenda.
- Manter banco local para: `clients`, `conversation_history`, `proactive_messages`, `metrics` e `client_scores`.

