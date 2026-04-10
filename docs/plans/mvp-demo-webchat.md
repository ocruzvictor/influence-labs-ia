# Plano de Implementação — MVP Demo Webchat Studio Tirra

**Autor:** @architect (Aria)
**Data:** 2026-03-04
**Status:** Aguardando aprovação
**Executor:** @dev (Dex)

---

## Objetivo

Criar um chat widget web que substitui o WhatsApp como canal de entrada/saída, permitindo demonstrar o agente Studio Tirra ao vivo para o dono do salão (Tiago). O pipeline TESS + Trinks permanece **idêntico** — só muda o canal.

## Arquitetura

```
┌──────────────┐     POST /webhook/demo-chat     ┌─────────────────┐
│  Chat Widget │ ──────────────────────────────▶  │   n8n Cloud     │
│  (HTML/JS)   │ ◀──────────────────────────────  │  WF-DEMO-01     │
└──────────────┘     JSON { response }            └────────┬────────┘
                                                           │
                                              ┌────────────┴────────────┐
                                              │                         │
                                         ┌────▼────┐            ┌──────▼──────┐
                                         │  TESS   │            │  Trinks API │
                                         │  33200  │            │  (agenda)   │
                                         └─────────┘            └─────────────┘
```

## Entregáveis

### 1. WF-DEMO-01 — Workflow n8n (fork do WF-META-01)

**Arquivo:** `n8n-workflows/WF-DEMO-01-webchat.json`

**Mudanças em relação ao WF-META-01:**

| Nó original | Ação | Nó novo |
|---|---|---|
| `Meta Verificação (GET)` | REMOVER | — |
| `Responder hub.challenge` | REMOVER | — |
| `Meta Mensagens (POST)` | SUBSTITUIR | Webhook `POST /demo-chat` com `responseMode: lastNode` |
| `Parse Payload Meta` | SUBSTITUIR | Parse simples: `{ message, session_id, contact_name }` |
| `Enviar Resposta (Meta API)` | SUBSTITUIR | `Respond to Webhook` com `{ response, timestamp }` |

**Nós mantidos SEM alteração (100% reutilizados):**
- `Trinks: Horarios Hoje`
- `Trinks: Profissionais`
- `Montar Contexto Dinamico`
- `TESS (Agente 33200)`
- `Parse Resposta TESS`
- `Tem Booking?`
- `Executar Booking Trinks`
- `Precisa 2a Chamada?`
- `TESS: Apresentar Horarios`
- `Parse Resposta (Slots)`

**Webhook contract:**
```
POST /webhook/demo-chat
Content-Type: application/json

Request:
{
  "message": "Quero agendar um corte",
  "session_id": "uuid-v4",
  "contact_name": "Tiago"
}

Response:
{
  "response": "Texto do agente...",
  "timestamp": "2026-03-04T14:30:00Z"
}
```

**CORS:** n8n cloud webhooks aceitam CORS nativamente quando `responseMode: lastNode`.

**Session/Memória:** Usar campo `root_id` da TESS API mapeando `session_id` → `root_id` para manter contexto de conversa. Armazenar mapeamento em nó Code com variável estática (suficiente para demo).

---

### 2. Chat Widget — Frontend

**Arquivo:** `frontend/demo-chat.html` (página standalone)

**Especificação visual:**
- Header fixo: logo placeholder + "Studio Tirra" + indicador online
- Área de mensagens: bolhas estilo WhatsApp (enviadas à direita, recebidas à esquerda)
- Bolha do agente: fundo `#F5F3EE` (warm beige), borda-radius 12px
- Bolha do usuário: fundo `#1A1A2E` (navy), texto branco
- Input bar: campo de texto + botão enviar (ícone seta, cor terracotta `#D4622B`)
- Typing indicator: 3 dots pulsantes enquanto aguarda resposta
- Auto-scroll para última mensagem
- Mensagem de boas-vindas automática ao abrir
- Responsivo (funciona no celular)

**Especificação técnica:**
- HTML/CSS/JS puro (zero dependências, zero build)
- `session_id` gerado via `crypto.randomUUID()`, persistido em `localStorage`
- Fetch API para POST no webhook n8n
- Tratamento de erro: mensagem "Ops, estou com dificuldade técnica" se timeout/erro
- Timeout: 30s (TESS pode levar 2-5s + Trinks)

**Cores (do design system):**
- Background: `#FFFFFF`
- Header: `#1A1A2E` (navy)
- Accent: `#D4622B` (terracotta)
- Mensagem agente: `#F5F3EE`
- Mensagem usuário: `#1A1A2E`
- Texto: `#1A1A2E` / `#FFFFFF`

**Tipografia:**
- Header: DM Sans 600
- Mensagens: Inter 400
- Input: Inter 400

**Mensagem de boas-vindas (automática):**
> "Olá! Sou a assistente virtual do Studio Tirra. Posso te ajudar com agendamentos, informações sobre nossos serviços ou tirar suas dúvidas. Como posso te ajudar? 😊"

---

### 3. Landing Page — Integração (opcional)

Se Victor preferir, o widget pode ser embeddido como botão flutuante na landing page (`frontend/index.html`) em vez de página separada. Nesse caso:
- Botão flutuante no canto inferior direito (estilo chat bubble)
- Ao clicar, abre modal com o chat
- Pode coexistir com os botões de WhatsApp existentes

**Recomendação:** Página standalone (`demo-chat.html`) para a demo, embed na landing depois.

---

## Cenários de Teste para a Demo

| # | Cenário | Input esperado | Validação |
|---|---|---|---|
| 1 | Saudação | "Oi, boa tarde!" | Agente responde com boas-vindas |
| 2 | Horários disponíveis | "Quais horários tem pra hoje?" | Agente consulta Trinks e lista horários reais |
| 3 | Agendar corte | "Quero corte masculino sábado 10h" | Fluxo de confirmação tripla |
| 4 | Preço mechas | "Quanto custa mechas?" | Fluxo consultivo (teste gratuito) |
| 5 | Localização | "Onde fica o salão?" | Endereço + estacionamento |
| 6 | Fora de horário | "Tem horário domingo?" | Informa que Dom/Seg fechado |

---

## Sequência de Implementação

1. **Criar WF-DEMO-01** — fork do WF-META-01, adaptar trigger/response
2. **Importar no n8n cloud** — `paretogroup.app.n8n.cloud`
3. **Criar demo-chat.html** — widget frontend standalone
4. **Testar e2e** — chat → n8n → TESS + Trinks → resposta
5. **Ajustar** — refinamentos de UX se necessário

---

## Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Trinks API offline/módulo não ativo | Média | Fallback: agente responde pedindo dia desejado |
| TESS latência alta (>5s) | Baixa | Typing indicator no widget |
| CORS bloqueado | Baixa | n8n cloud suporta CORS em webhooks |
| Session perdida | Baixa | localStorage persiste session_id |
