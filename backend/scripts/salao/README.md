# CLI `salao/` — workers 0-LLM (LibForge)

Aprovadas: OP002–OP018 + handoff SLA (Tiago, 15 min comercial).

Nenhum script chama Tess. Nenhum muta Trinks. last4 na saída.

```text
# sem banco
node backend/scripts/salao/contexto/classificar_intencao.js --texto "pode cancelar"
node backend/scripts/salao/contexto/medir_orcamento_contexto.js --texto "quero cortar amanhã" --mode scoped
node backend/scripts/salao/contexto/simular_perfil_contexto.js --texto "pode cancelar"
node backend/scripts/salao/contexto/simular_skip_trivial.js --texto "oi"
node backend/scripts/salao/catalogo/consultar_faq_estatica.js --termo endereco
node backend/scripts/salao/agendamento/resolver_id_cancelamento.js --id 123 --futuros '[{"trinks_id":"123"}]'

# com DATABASE_URL (container backend)
node backend/scripts/salao/observabilidade/listar_fios_presos.js --horas 12
node backend/scripts/salao/observabilidade/detectar_ack_sem_outbound.js --minutos 60 --segundos 45
node backend/scripts/salao/observabilidade/correlacionar_last4.js --last4 0007
node backend/scripts/salao/observabilidade/patrulhar_ao_vivo.js --minutos 15
node backend/scripts/salao/observabilidade/verificar_commit.js --last4 0007
node backend/scripts/salao/observabilidade/listar_orfaos.js --minutos 15
node backend/scripts/salao/observabilidade/relatar_slo_eventos.js --minutos 60
node backend/scripts/salao/observabilidade/listar_handoff_sla.js --minutos 720
node backend/scripts/salao/observabilidade/aceitar_handoff.js --last4 6388
node backend/scripts/salao/observabilidade/realertar_handoff_sla.js
node backend/scripts/salao/snapshot/checar_frescura_snapshot.js --max-idade-horas 24
node backend/scripts/salao/catalogo/consultar_preco_servico.js --termo corte --live
node backend/scripts/salao/backlog/triar_backlog_last4.js
node backend/scripts/salao/contexto/agregar_bytes_contexto.js --live --minutos 1440
```
