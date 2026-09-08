# Task: tmpl-create — Criação de Template

```yaml
task:
  id: tmpl-create
  name: Criação de Template Estruturado
  agent: pedro-valerio
  command: "*tmpl-create {tipo}"
  version: "1.0.0"
  status: active
  execution_type: agent
  responsible_executor: pedro-valerio
  task_name: tmpl-create
  input: "{tipo} de template"
  output: "template estruturado sem ambiguidade de preenchimento"
  action_items: "Definir seções; campos obrigatórios; exemplo preenchido"
  acceptance_criteria: "Dois preenchimentos por pessoas diferentes produzem estruturas equivalentes"
```

## Objetivo

Criar template estruturado que elimine ambiguidade de preenchimento.
Resultado: dois preenchimentos por pessoas diferentes produzem estruturas equivalentes.

## Entradas Necessárias

1. **Tipo de artefato** que o template representa (briefing, proposta, contrato, etc.)
2. **Casos de uso** do template
3. **Exemplos reais** de preenchimentos anteriores (se houver)

## Workflow de Execução

### Fase 1: Identificar Campos Necessários

A partir dos casos de uso, liste todos os dados que precisam aparecer no artefato.

Para cada campo:
- Nome (claro, sem jargão ambíguo)
- Tipo (texto livre / texto curto / seleção / data / número / lista)
- Obrigatoriedade (sempre / condicional / opcional)

### Fase 2: Definir Estrutura Hierárquica

Agrupe campos em seções lógicas:
- Seção 1: {Identificação/Contexto}
- Seção 2: {Conteúdo principal}
- Seção 3: {Anexos/Referências}

A ordem deve refletir o fluxo natural de preenchimento — não a estrutura do output final.

### Fase 3: Instruções de Preenchimento por Campo

Cada campo tem **inline instruction** breve:
- O que preencher (exemplo)
- O que NÃO preencher (anti-exemplo)
- Limites (caracteres, palavras, formato)

⚠️ Sem inline instruction, dois preenchedores vão produzir resultados diferentes.

### Fase 4: Validações Inline

Onde possível, valide no preenchimento:
- Campo de email: validação de formato
- Campo numérico: validação de range
- Campo de seleção: lista fechada (não permite texto livre)
- Datas: formato consistente (YYYY-MM-DD)

### Fase 5: Exemplo Preenchido Completo

Crie 1 exemplo completo do template preenchido com dados realistas.
**Regra:** se você não consegue preencher seu próprio template com exemplo realista, ele não está bom.

## Formato de Saída

Template em si segue formato base (ver `templates/base-template.md`):

```
# Template: {Tipo}

## Como Usar
{1 parágrafo explicando quando e como preencher}

---

## Seção 1: {Nome da Seção}

### Campo 1: {Nome do Campo} *
**Tipo:** {texto curto / texto livre / seleção / etc.}
**Como preencher:** {instrução em 1 linha}
**Exemplo:** "{exemplo realista}"
**Anti-exemplo:** "{o que NÃO fazer}"
**Validação:** {se aplicável}

```
{campo para preenchimento}
```

### Campo 2: {Nome}
...

---

## Exemplo Preenchido

{Template inteiro preenchido com dados realistas}

---

## Checklist de Validação (preenchedor)
- [ ] Todos os campos obrigatórios (*) preenchidos
- [ ] Validações inline atendidas
- [ ] Exemplo de referência consultado
```

## Critério de Conclusão

DONE quando: template tem seções hierárquicas, todo campo com instrução + exemplo + anti-exemplo, validações inline onde aplicável, 1 exemplo preenchido completo, checklist de validação para o preenchedor.

Teste final: peça para alguém sem contexto preencher. Se precisar de explicações verbais além do que está escrito no template, o template está incompleto.
