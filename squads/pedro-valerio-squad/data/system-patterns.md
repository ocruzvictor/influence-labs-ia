# System Patterns — Catálogo de Padrões de Arquitetura

```yaml
data:
  id: system-patterns
  name: Catálogo de Padrões de Sistema
  agent: pedro-valerio
  version: "1.0.0"
  purpose: "Referência de padrões testados para *arq-structure e tasks correlatas"
```

## Como Usar

Este arquivo é referência opcional carregada por `*arq-structure`. Use para:
- Identificar padrão aplicável ao problema em análise
- Verificar trade-offs antes de adotar
- Padronizar nomenclatura entre projetos

---

## 1. Padrões de Entidade

### 1.1 Entity-Status-History

**Quando usar:** entidade com ciclo de vida importante e auditoria obrigatória
**Estrutura:**
- `entity` — dados atuais
- `entity_status_history` — log de transições (state, changed_at, changed_by, reason)

**Trade-off:** custo de armazenamento extra × rastreabilidade total
**Anti-pattern:** colocar histórico em campos JSON na própria entidade — não-queryável

### 1.2 Soft Delete

**Quando usar:** dado precisa ser "removido" da operação mas mantido para auditoria/legal
**Estrutura:**
- Campo `deleted_at` (datetime nullable)
- Toda query com `WHERE deleted_at IS NULL`

**Trade-off:** queries mais complexas × possibilidade de recuperação
**Veto condition:** se há restrição legal de exclusão definitiva (LGPD direito ao esquecimento), planeje purge job separado

### 1.3 Versionamento de Registro

**Quando usar:** entidade muta no tempo e versões antigas precisam ser consultáveis
**Estrutura:**
- Campo `version` (integer incremental)
- Tabela `entity_versions` com snapshot por versão

**Trade-off:** complexidade × histórico imutável

---

## 2. Padrões de Estado

### 2.1 State Machine Linear

```
new → in_progress → completed → archived
```

**Quando usar:** processo unidirecional sem decisões de bifurcação
**Característica:** simples, mas inflexível para reabrir/reverter

### 2.2 State Machine com Bifurcação

```
new → qualifying → [qualified | disqualified]
qualified → [converted | lost]
```

**Quando usar:** processo com decisão de aceitar/rejeitar
**Característica:** mais expressivo, requer guards explícitos nas transições

### 2.3 State Machine com Loops Controlados

```
draft ↔ review → approved
```

**Quando usar:** ciclos de revisão antes de aprovação
**Veto condition obrigatória:** limite de iterações (ex: max 5 ciclos draft↔review)

---

## 3. Padrões de Relação

### 3.1 1:N Padrão (Foreign Key)

`Lead.id ← Message.lead_id`

**On delete:** quase sempre `cascade` (mensagens órfãs não fazem sentido)

### 3.2 N:N via Join Table

`Lead ↔ Tag` via `lead_tags(lead_id, tag_id, added_at, added_by)`

**Boas práticas:**
- Join table tem metadados próprios (quando, por quem)
- Considere unique constraint em (lead_id, tag_id) para evitar duplicatas

### 3.3 Polimorfismo

`Comment(commentable_type, commentable_id)` — comentário pode ser em Lead, Deal, etc.

**Trade-off:** flexibilidade × foreign key constraint perdida
**Recomendação:** só use se ≥ 3 tipos relacionados. Senão, tabelas separadas são mais seguras.

---

## 4. Padrões de Automação

### 4.1 Outbox Pattern

**Problema:** garantir que evento publicado em sistema externo é consistente com mudança no DB local
**Solução:** escrever evento numa tabela `outbox` na MESMA transação do update; worker lê outbox e publica
**Garantia:** at-least-once delivery

### 4.2 SAGA Pattern

**Problema:** workflow multi-passo com rollback em caso de falha
**Solução:** cada passo tem ação compensatória; falha dispara cadeia de compensação reversa
**Veto condition:** compensação deve ser definida para TODOS os passos, senão SAGA não é completa

### 4.3 Idempotency Key

**Problema:** webhooks/eventos podem chegar duplicados
**Solução:** todo request carrega `idempotency_key`; sistema rejeita se já processado dentro de TTL
**TTL típico:** 24h-7d dependendo do volume

### 4.4 Circuit Breaker

**Problema:** sistema externo down causa cascata de erros
**Solução:** após N falhas consecutivas, "abre o circuito" e rejeita novas chamadas por T segundos
**Estados:** closed (normal) → open (rejeita) → half-open (testando recuperação)

---

## 5. Padrões Anti-Padrão (NUNCA fazer)

### ❌ Anti-padrão 1: Status string livre

```sql
status VARCHAR(50)  -- aceita qualquer string
```

**Por que ruim:** "Qualified", "qualified", "QUALIFIED", "qualificado" — 4 status na prática
**Correção:** ENUM ou tabela de referência com FK

### ❌ Anti-padrão 2: Campo JSON para dados queryáveis

```sql
metadata JSONB  -- contém budget, source, etc.
```

**Por que ruim:** index não cobre, queries lentas, schema implícito
**Correção:** colunas explícitas. JSON só para dados realmente variáveis.

### ❌ Anti-padrão 3: Timestamps sem timezone

```sql
created_at TIMESTAMP  -- sem TZ
```

**Por que ruim:** mudança de horário (DST), comparações ambíguas, bugs em produção global
**Correção:** sempre `TIMESTAMPTZ`, sempre UTC no storage

### ❌ Anti-padrão 4: Boolean em vez de Enum

```sql
is_active BOOLEAN
is_deleted BOOLEAN
is_archived BOOLEAN
-- 8 combinações, só 4 fazem sentido
```

**Por que ruim:** combinações inválidas possíveis
**Correção:** ENUM com estados explícitos

### ❌ Anti-padrão 5: Foreign Key sem ON DELETE definido

**Por que ruim:** default varia entre DBs; pode quebrar referências silenciosamente
**Correção:** sempre explicite `ON DELETE CASCADE | RESTRICT | SET NULL`

---

## 6. Heurísticas de Decisão

| Pergunta | Resposta padrão |
|----------|-----------------|
| Posso usar JSON? | Só se dado realmente é variável. Default: colunas explícitas |
| Devo desnormalizar? | Não, até prova de problema de performance com benchmark |
| Devo criar tabela separada? | Sim se entidade tem ciclo de vida próprio |
| Devo soft-delete? | Sim se há requisito de auditoria ou recuperação |
| Devo versionar? | Sim se versões antigas têm valor de negócio (contratos, propostas) |
