# 🎯 AIOX + Claude Code Configuration

**Usuário:** Alan  
**Data:** 2026-03-05  
**Ambiente:** macOS M1 + zsh + Claude Code  
**Uso:** Dev + Architect + Orchestrator (multirole)

---

## 📋 O que foi configurado?

### 1. **Tema Visual**
- **Estilo:** Minimalista Moderno
- **Cor Primária:** #D1FF00 (Amarelo AIOX Brand)
- **Fonte:** Roboto Mono (12pt)
- **Bordas:** Dinâmicas (mudam conforme seu role)

### 2. **Status Line (Barra de Informações)**
Você verá sempre visível:
```
📁 my-project │ 🌍 dev │ 🤖 architect │ 📊 42% │ 🧠 opus 4.6 │ 💰 $2.45 │ ⚙️ 2/4
```

Cada segmento mostra:
- **Projeto:** Nome do repositório atual
- **Environment:** dev/staging/prod (cor dinâmica)
- **Agente Ativo:** qual squad está rodando
- **Contexto:** tokens usados vs total (com aviso em 70%, crítico em 90%)
- **Modelo:** Qual IA (Opus 4.6, Sonnet, etc)
- **Custo:** Acumulado da sessão (aviso acima de $5)
- **Agentes:** Quantos estão ativos

### 3. **Dinâmica por Contexto**
Conforme você muda de role, o visual se adapta:

**👨‍💻 DEV MODE** (verde)
```
Bordas: #10B981 | Prioridade: branch, modelo, custo
```

**🏗️ ARCHITECT MODE** (azul)
```
Bordas: #0EA5E9 | Prioridade: modelo, contexto, custo
```

**🤖 ORCHESTRATOR MODE** (amarelo)
```
Bordas: #D1FF00 | Prioridade: agentes ativos, contexto, custo
```

### 4. **Monitoramento em Tempo Real**
- ✅ Token usage (com barra de progresso)
- ✅ Custo acumulado (com alertas)
- ✅ Status dos agentes (quantos estão rodando)
- ✅ Janela de contexto (quanto você já usou)

### 5. **Alertas Inteligentes**
- 🟡 Aviso quando contexto atinge 70%
- 🔴 Crítico em 90%
- 🟡 Aviso de custo acima de $5
- 🔄 Notificação ao transitar entre agentes

---

## 🚀 Como Instalar

### Passo 1: Instalar dependências
```bash
bash setup-aiox-claude-code.sh
```

### Passo 2: Adicionar ao .zshrc
```bash
cat zshrc-aiox-additions.sh >> ~/.zshrc
source ~/.zshrc
```

### Passo 3: Configurar Claude Code
1. Abra Claude Code
2. Settings → Appearance
3. Importe `aiox-claude-code-config.json`
4. Reinicie

---

## ⌨️ Atalhos Rápidos

### Terminal
```bash
aiox-dev          # Inicia com agente dev
aiox-arch         # Inicia com agente architect
aiox-pm           # Inicia com PM
aiox-analyst      # Inicia com analyst
aiox-status       # Mostra status atual
aiox-cost         # Relatório de custo
aiox-context      # Mostra janela de contexto
aiox-agents       # Lista agentes ativos
switch-env dev    # Muda para dev
switch-env staging # Muda para staging
switch-env prod   # Muda para prod
cc-reload         # Recarrega configuração
```

---

## 📊 Exemplo de uso

### Cenário 1: Desenvolvendo feature
```
switch-role dev
→ Bordas ficam VERDES (#10B981)
→ Status mostra: branch, modelo, custo
```

### Cenário 2: Projetando arquitetura
```
switch-role arch
→ Bordas ficam AZUIS (#0EA5E9)
→ Status mostra: modelo, contexto, custo
```

### Cenário 3: Orquestrando múltiplos agentes
```
switch-role orchestrator
→ Bordas ficam AMARELAS (#D1FF00)
→ Status mostra: agentes ativos, contexto, custo
```

---

## 🎨 Personalização Adicional

### Mudar cores
Edite `aiox-claude-code-config.json`:
```json
"colors": {
  "primary": "#SEU_COR_AQUI"
}
```

### Adicionar mais segmentos na status line
Vá em `status_line.segments` e adicione novo objeto:
```json
{
  "id": "custom_metric",
  "label": "📌",
  "value": "${seu_valor}",
  "color": "primary"
}
```

### Desabilitar alertas
Em `alerts`:
```json
"high_cost": {
  "enabled": false
}
```

---

## ⚡ Performance

- Refresh de status: **500ms** (configurável)
- Cache: **Ativado** (1 segundo TTL)
- Overhead: **<100ms** (conforme necessário)
- Compatível com: **M1 MacBook Air** ✅

---

## 🔗 Integração com AIOX

Projeto estará sempre visível com:
- Nome do repositório
- Branch Git atual
- Environment (dev/staging/prod)
- Agente ativo
- Tokens usados/disponíveis
- Modelo IA em uso
- Custo acumulado
- Agentes ativos

---

## 📞 Suporte

Se precisar ajustar:
1. Edite o arquivo JSON ou YAML
2. Recarregue com `cc-reload`
3. Reinicie Claude Code se necessário

---

## 📝 Notas

- Config criada especificamente para seu workflow multirole
- Bordas dinâmicas se adaptam automaticamente
- Status line atualiza a cada 500ms
- Performance otimizada para M1

**Aproveite! 🚀**
