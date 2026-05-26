# Task: auto-connect — Integração Entre Sistemas

```yaml
task:
  id: auto-connect
  name: Conexão Entre Sistemas
  agent: pedro-valerio
  command: "*auto-connect {sistema_a} {sistema_b}"
  version: "1.0.0"
```

## Objetivo

Conectar dois sistemas com mapeamento de campos source→target, transformações, e veto conditions de integração.
Resultado: integração determinística, com rastreabilidade e fallback explícito.

## Entradas Necessárias

1. **Sistema A** (source) — schema dos dados que ele expõe
2. **Sistema B** (target) — schema dos dados que ele aceita
3. **Direção da sincronização:** A→B, B→A, ou bidirecional
4. **Frequência:** real-time (webhook), batch (cron), on-demand

## Workflow de Execução

### Fase 1: Mapear Campos Source→Target

Tabela 1:1, 1:N, N:1 entre campos:

| Source (A) | Target (B) | Transformação | Notas |
|-----------|------------|---------------|-------|
| email | contact_email | lowercase + trim | - |
| phone | mobile_number | strip non-digits, +55 prefix se necessário | validação E.164 |
| created_at | imported_at | passthrough | timezone UTC |
| - | source_system | hardcoded='sistema_a' | metadata |

### Fase 2: Identificar Gaps de Mapeamento

- Campos obrigatórios em B que não têm origem em A → como preencher?
- Campos em A sem destino em B → perda intencional ou gap?
- Tipos incompatíveis (ex: string em A, integer em B) → conversão segura?

### Fase 3: Definir Transformações

Para cada transformação não-trivial:
- **Função:** o que faz exatamente?
- **Casos de erro:** o que acontece se input inválido?
- **Idempotência:** mesma entrada → mesma saída?

⚠️ Toda transformação deve ser idempotente. Se não for, justificar.

### Fase 4: Veto Conditions de Integração

- BLOCK se campo obrigatório em B está null após transformação
- BLOCK se registro já foi sincronizado (idempotência)
- BLOCK se sistema target indisponível (com retry policy)
- BLOCK se rate limit do target atingido

### Fase 5: Estratégia de Conflito

Para sincronização bidirecional ou quando target já tem registro:
- **Last-write-wins:** assumir mais recente correto
- **Source-of-truth:** A sempre vence (ou B sempre vence)
- **Merge:** combinar campos não-conflitantes, alertar para conflitos
- **Manual review:** marcar para revisão humana

### Fase 6: Observabilidade

Definir o que registrar:
- Início da sincronização (timestamp + registros pretendidos)
- Sucesso (timestamp + registros confirmados)
- Falha (timestamp + erro + registros impactados)
- Fim (resumo: total, sucesso, falha)

## Formato de Saída

```
## Integração: {Sistema A} → {Sistema B}

**Direção:** A→B (one-way)
**Frequência:** webhook real-time
**Estratégia de Conflito:** source-of-truth (A vence)

### Mapeamento de Campos
| # | Source (A) | Target (B) | Transformação | Obrigatório |
|---|-----------|------------|---------------|-------------|
| 1 | email | contact_email | lowercase + trim | sim |
| 2 | phone | mobile_number | E.164 normalize | sim |
| 3 | - | source_system | hardcoded='A' | sim |

### Transformações Detalhadas
**E.164 normalize:**
- Input: string
- Steps: strip non-digits → prepend '+55' if length=11 → validate length 13-14
- Error: input inválido → log + BLOCK
- Idempotente: SIM

### Veto Conditions
- BLOCK se `contact_email` null pós-transformação
- BLOCK se já existe registro com mesmo `external_id` em B
- BLOCK se target retorna 429 (rate limit) → retry com backoff

### Fallback
- Se BLOCK: registrar em fila de revisão manual
- Notificar owner em < 1h se fila > 10 registros

### Observabilidade
- Log estruturado por execução
- Métricas: success_count, fail_count, latency_p95
- Alerta se fail_rate > 5%
```

## Critério de Conclusão

DONE quando: mapeamento completo com tipos compatíveis, transformações idempotentes documentadas, veto conditions definidas, estratégia de conflito explícita, observabilidade especificada.
