# Base Template — Padrão de Templates Pedro Valério

```yaml
template:
  id: base-template
  name: Base Template — Estrutura Padrão
  agent: pedro-valerio
  version: "1.0.0"
  purpose: "Template-mãe para criação de novos templates via *tmpl-create"
```

## Filosofia

Templates não documentam o que **pode** ser preenchido. Templates documentam o que **deve** ser preenchido, **como** preencher e **o que não fazer**.

Cada campo carrega 4 elementos obrigatórios:
1. **Instrução** — como preencher em 1 linha
2. **Exemplo** — preenchimento realista
3. **Anti-exemplo** — preenchimento errado comum
4. **Validação** — regra de aceitação (quando aplicável)

---

## Estrutura Padrão

```markdown
# Template: {Nome do Artefato}

## Sobre Este Template

**Propósito:** {1 frase sobre o que este artefato representa}
**Quando usar:** {gatilho que demanda este preenchimento}
**Quem preenche:** {papel/cargo}
**Tempo estimado:** {minutos}
**Pré-requisitos:** {lista de informações/acessos necessários antes}

---

## Seção 1: {Nome da Seção}

> {Breve descrição do que esta seção captura — 1 frase}

### Campo 1.1: {Nome do Campo} *

**Tipo:** {texto curto / texto livre / data / seleção / número / boolean / lista}
**Obrigatório:** Sim
**Como preencher:** {instrução em 1 linha}
**Exemplo:** "{exemplo realista — não genérico}"
**Anti-exemplo:** "{erro comum a evitar}"
**Validação:** {regra se aplicável — ex: max 100 chars, formato email, etc.}

\`\`\`
{Espaço para preenchimento}
\`\`\`

### Campo 1.2: {Nome do Campo}

**Tipo:** seleção
**Obrigatório:** Não (default: {valor})
**Opções:** [{opção 1}, {opção 2}, {opção 3}]
**Como preencher:** {qual critério usa para escolher}
**Exemplo:** {opção 2} — porque {contexto}

\`\`\`
{Espaço para preenchimento}
\`\`\`

---

## Seção 2: {Nome}

### Campo 2.1: ...

---

## Exemplo Preenchido Completo

> Use este preenchimento como referência. Os dados são realistas mas anonimizados.

### Seção 1: Identificação
**Campo 1.1:** Lead João Silva — primeira interação 2026-05-15
**Campo 1.2:** ads-meta

### Seção 2: Dados
**Campo 2.1:** R$ 5.000 — orçamento mencionado na 3ª mensagem
...

---

## Checklist de Validação (auto-check pelo preenchedor)

Antes de submeter, confirme:
- [ ] Todos os campos com `*` (obrigatórios) preenchidos
- [ ] Validações inline atendidas (formatos, ranges, listas fechadas)
- [ ] Não há campo preenchido com "TBD", "a definir", "consultar fulano"
- [ ] Exemplo de referência foi consultado em caso de dúvida
- [ ] Inconsistências entre campos foram resolvidas

---

## Após Preenchimento

**Próximo passo:** {ação concreta após template preenchido}
**Validador:** {quem aprova / qual sistema valida}
**Destino:** {onde o artefato vai parar}
```

---

## Convenções de Template

### Marcadores

| Marcador | Significado |
|---------|-------------|
| `*` ao lado do nome | Campo obrigatório |
| `(opcional)` | Campo opcional explicito |
| `> {texto}` | Instrução contextual (não preencher) |
| `{placeholder}` | Espaço a preencher |
| `[opção 1, opção 2]` | Lista fechada de seleção |

### Tipos de Campo

| Tipo | Uso | Validação típica |
|------|-----|------------------|
| texto curto | Nome, título | max 100 chars |
| texto livre | Descrição, observação | max 2000 chars |
| seleção | Categorização | lista fechada |
| data | Timestamps | YYYY-MM-DD |
| número | Valores, scores | min/max range |
| boolean | Sim/Não | true/false |
| lista | Múltiplos valores | separar por vírgula |

### Anti-Padrões em Templates

❌ "Preencher conforme necessário"
✅ "Preencher se valor > R$ 1.000; caso contrário, deixar 'N/A'"

❌ "Descrever o problema"
✅ "Em 1-3 frases, descrever sintoma observado (não causa nem solução)"

❌ Campo texto livre sem limite de caracteres
✅ Campo texto livre com max chars + exemplo de tamanho

❌ Campo "outros" como única opção fora da lista
✅ Lista fechada + processo formal de adicionar nova opção

---

## Uso

Este template-base é referenciado por `*tmpl-create` ao gerar novos templates.
Quando criar um novo template, copie esta estrutura e adapte para o tipo de artefato.
