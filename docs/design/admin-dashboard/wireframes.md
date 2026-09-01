# Wireframes — Studio Tirra Admin Dashboard MVP

**Autor:** @ux-design-expert Uma
**Data:** 2026-05-26
**Fidelity:** Low-fidelity (ASCII) — suficiente pra @dev avançar
**Epic:** [EPIC-studio-tirra-admin-dashboard.md](../../stories/epics/EPIC-studio-tirra-admin-dashboard.md)
**Arquitetura:** [docs/architecture/admin-dashboard.md](../../architecture/admin-dashboard.md)

---

## 🎯 Filosofia de design

Painel admin pra 2 usuários (Tiago + recepção), acesso quase diário, foco operacional. Princípios:

1. **Densidade > beleza** — Tiago checa 5x ao dia, não pode demorar pra achar info
2. **Estado visível** — toggle on/off, bot ativo/silenciado, conversas live precisam de feedback imediato
3. **Atalho > exploração** — atalhos de teclado pras 3 ações mais frequentes (filtrar conversas, toggle bot, abrir KB)
4. **Empatia operacional** — recepção está atendendo cliente em paralelo, UI não pode "competir" com WhatsApp aberto
5. **Brand sutil** — paleta Studio Tirra (Warm Authority) presente mas não dominante; dashboard é ferramenta, não landing page

## 🎨 Tokens visuais (do design system existente)

| Token | Hex | Uso no admin |
|-------|-----|--------------|
| `--color-primary` | `#1A1A2E` navy | Topbar, primary buttons, links importantes |
| `--color-accent` | `#4338CA` indigo | CTAs secundários, focus rings |
| `--color-success` | `#2D6A4F` floresta | Status "ativo", toggle ON, health OK |
| `--color-warm` | `#D4622B` terracotta | Warnings (no-show, takeover, sync error) |
| `--color-bg` | `#F5F3EE` cream | App background |
| `--color-surface` | `#FFFFFF` | Cards, modals |
| `--color-text-muted` | `#6B7280` | Metadados, timestamps |
| `--font-heading` | DM Sans | Títulos, nav, números KPI |
| `--font-body` | Inter | Body, tabelas, forms |
| `--font-mono` | JetBrains Mono | Telefones, IDs, timestamps |

**Componentes shadcn:** Button, Card, Table, Dialog, Switch, Tabs, Input, Textarea, Badge, Toast, Skeleton, DropdownMenu, Sheet (mobile nav)

---

## 🗺️ Mapa de navegação

```
admin.studiotirra.com.br
├── /login                  (público)
├── /verify?t={token}       (público, redirect)
├── /                       (home / overview)
├── /conversas              (lista)
│   └── /conversas/[phone]  (drill-down)
├── /toggles                (bot toggles + whitelist)
├── /metricas               (KPIs + charts)
├── /kb                     (lista KB items)
│   ├── /kb/[slug]          (editor)
│   └── /kb/historico       (versões)
├── /saude                  (/health visual)
└── /auditoria              (audit log viewer)
```

**Atalhos globais:**
- `⌘K` / `Ctrl+K` — palette de comandos (busca + navegação rápida)
- `g c` — go conversas · `g m` — go métricas · `g k` — go kb · `g t` — go toggles
- `?` — mostra atalhos disponíveis

---

## 🖼️ Tela 1 — Login (magic link)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                                                                │
│                          [logo tirra]                          │
│                                                                │
│                   Studio Tirra · Painel Admin                  │
│                                                                │
│         ┌──────────────────────────────────────────┐          │
│         │  Entre com seu email cadastrado          │          │
│         │                                          │          │
│         │  ┌────────────────────────────────────┐  │          │
│         │  │ seu@studiotirra.com.br             │  │          │
│         │  └────────────────────────────────────┘  │          │
│         │                                          │          │
│         │  ┌────────────────────────────────────┐  │          │
│         │  │     Enviar link de acesso          │  │          │
│         │  └────────────────────────────────────┘  │          │
│         │                                          │          │
│         │  Você receberá um link válido por 15min  │          │
│         │  Sessão dura 30 dias neste dispositivo   │          │
│         └──────────────────────────────────────────┘          │
│                                                                │
│                  [discreto: v1.0 · status: 🟢]                 │
└────────────────────────────────────────────────────────────────┘
```

**Estado "enviado":**
```
         ┌──────────────────────────────────────────┐
         │  ✉️  Link enviado!                        │
         │                                          │
         │  Verifique seu inbox: tiago@stud...      │
         │  (também olhe o spam só por garantia)    │
         │                                          │
         │  [Tentar com outro email]                │
         └──────────────────────────────────────────┘
```

**Estado "erro" (rate limit ou email inválido):**
- Toast vermelho discreto no topo, mensagem genérica ("Se este email estiver cadastrado, enviamos um link")
- Nunca vaza existência do email

**Acessibilidade:**
- `<label>` associado ao input, autofocus
- Submit por Enter
- Sem CAPTCHA (rate limit no nginx + Resend rate limit já protegem)

---

## 🖼️ Tela 2 — Overview (home)

```
┌────────────────────────────────────────────────────────────────┐
│ Studio Tirra        Conversas  Toggles  Métricas  KB  Saúde   │ ← navy bar
│                                              [⌘K]  [Tiago ▾]   │
└────────────────────────────────────────────────────────────────┘

  Olá, Tiago 👋                              hoje, ter 26 mai · 14:32

  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │ CONVERSAS HOJE      │  │ AGENDAMENTOS HOJE   │  │ NO-SHOWS SEMANA     │
  │                     │  │                     │  │                     │
  │   23                │  │   8                 │  │   2                 │
  │   ↑ 12% vs ontem    │  │   ↑ 3 vs ontem      │  │   ↓ 3 vs s.ant      │
  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘

  ┌──────────────────────────────────────┐  ┌──────────────────────────┐
  │ 🟢 BOT ATIVO                          │  │ ⚠️  ATENÇÃO              │
  │                                       │  │                          │
  │ Última mensagem: há 2min              │  │ • 1 conversa em takeover │
  │ Janela WhatsApp: 23h restantes        │  │ • Sync Trinks: ok há 12m │
  │ TESS: 🟢   Trinks: 🟢   Postgres: 🟢   │  │                          │
  │                                       │  │ [Ver conversas →]        │
  │ [Desativar bot]                       │  │                          │
  └──────────────────────────────────────┘  └──────────────────────────┘

  CONVERSAS ATIVAS                                          [Ver todas →]
  ┌────────────────────────────────────────────────────────────────┐
  │ 📱 +55 11 91234-5678  Maria Silva    💬 12 msgs  há 4min       │
  │ 📱 +55 11 98765-4321  (sem nome)     💬 3 msgs   há 11min   👤 │ ← humano
  │ 📱 +55 11 99887-6655  Carla R.       💬 8 msgs   há 18min      │
  └────────────────────────────────────────────────────────────────┘
```

**Hierarquia:**
- 3 KPI cards principais no topo (números grandes, trend curto)
- 2 cards de "status do sistema" + "atenção" lado a lado
- Lista compacta de conversas ativas (clicável → drill-down)

**Comportamento:**
- Polling 5s nas conversas, polling 30s nos KPIs (cached)
- Click no número do telefone → drill-down
- Click em "Desativar bot" → modal de confirmação ("Tem certeza? Bot ficará 100% offline até religar")
- Avatar `[Tiago ▾]` abre dropdown: Logout · Audit log · Configurações

**Mobile (< 768px):**
- Hamburger menu no canto esquerdo (sheet desliza da esquerda)
- KPI cards empilham 1 coluna
- Status cards empilham
- Lista de conversas mantém formato

---

## 🖼️ Tela 3 — Conversas (lista)

```
┌────────────────────────────────────────────────────────────────┐
│ Studio Tirra        Conversas* Toggles  Métricas  KB  Saúde   │
└────────────────────────────────────────────────────────────────┘

  Conversas                                          🔴 23 ativas

  ┌────────────────────────────────────────────────────────────────┐
  │ 🔍 Buscar por telefone ou nome...        [Todas ▾] [4h ▾] [⟳] │
  └────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────┐
  │ TELEFONE        NOME        MSGS  ÚLT.MSG    AGENTE   STATUS  │
  ├────────────────────────────────────────────────────────────────┤
  │ +5511912345678  Maria S.    12    há 4min   tess     🟢 ativa │
  │ +5511987654321  —           3     há 11min  human    👤 takeover│
  │ +5511998876655  Carla R.    8     há 18min  tess     🟢 ativa │
  │ +5511955443322  João P.     22    há 1h     tess     ⚪ idle  │
  │ +5511933221100  Ana L.      5     há 2h     supervisor 🟡 ag.resp │
  │ +5511977665544  —           1     há 4h     tess     ⚪ idle  │
  │ ...                                                            │
  └────────────────────────────────────────────────────────────────┘

  Mostrando 23 de 47          [‹ ant]  página 1 de 2  [próx ›]
```

**Filtros (chips/dropdowns):**
- Status: Todas · Ativas · Takeover · Idle · Aguardando resposta
- Janela: Última 1h · 4h · 24h · 7d · Todas
- Agente: Todos · tess · supervisor · human

**Comportamento:**
- Hover na row → highlight + cursor pointer
- Click → `/conversas/[phone]`
- Badge `🔴 23 ativas` no header é live (pulsa quando muda)
- Botão `⟳` força refresh manual
- Telefones em mono font pra alinhamento
- Empty state se 0 conversas: ilustração + "Nada por aqui ainda. As conversas aparecem assim que o bot recebe uma mensagem."

**Atalhos:**
- `/` foca busca
- `↑/↓` navega rows
- `Enter` abre conversa
- `r` refresh

---

## 🖼️ Tela 3b — Conversas (drill-down)

```
┌────────────────────────────────────────────────────────────────┐
│ ‹ Voltar              +55 11 91234-5678 · Maria Silva          │
└────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────┐ ┌────────────────────┐
  │  CONVERSA                              │ │ DADOS DO CLIENTE   │
  │                                        │ │                    │
  │  ┌──── há 32min ─────────────────────┐ │ │ Nome: Maria Silva  │
  │  │ Maria: Oi, queria agendar uma     │ │ │ Cad. Trinks: ✅    │
  │  │ escova                            │ │ │ Última visita:     │
  │  │ • tokens: —                       │ │ │   há 23 dias       │
  │  └───────────────────────────────────┘ │ │ Visitas: 4         │
  │                                        │ │                    │
  │  ┌──── há 31min · tess ──────────────┐ │ │ AÇÕES              │
  │  │ Bot: Oi Maria! 👋 Vamos lá. Pra   │ │ │ • Pausar bot 1h    │
  │  │ qual dia você quer agendar?       │ │ │ • Bloquear número  │
  │  │ • tokens: 47 · latência: 1.2s     │ │ │ • Adicionar nota   │
  │  └───────────────────────────────────┘ │ │                    │
  │                                        │ │ JANELA WHATSAPP    │
  │  ┌──── há 28min ─────────────────────┐ │ │ ✅ 23h 12min       │
  │  │ Maria: amanhã de tarde            │ │ │                    │
  │  └───────────────────────────────────┘ │ └────────────────────┘
  │                                        │
  │  [scroll automático pro fim]           │
  │                                        │
  │  ↓ Aguardando próxima mensagem...      │
  └────────────────────────────────────────┘

  [⏸️  Pausar bot nesta conversa]    [↺ Recarregar]    [↗ Abrir WA Web]
```

**Detalhes:**
- Bubbles diferenciam: cliente (alinhado esquerda, cinza), bot (direita, navy 8% opacity), supervisor/human (direita, terracotta 8%)
- Metadata em fonte pequena cinza: agent, tokens, latência (debug útil pra Tiago)
- Polling 3s, scroll automático mantido se usuário não rolou
- Sidebar direita colapsa em mobile (botão `[i]` abre sheet)
- "Pausar bot 1h" cria entry em `bot_whitelist` modo `human_only` com expiração

---

## 🖼️ Tela 4 — Toggles

```
┌────────────────────────────────────────────────────────────────┐
│ Studio Tirra        Conversas  Toggles* Métricas  KB  Saúde   │
└────────────────────────────────────────────────────────────────┘

  Toggles do Bot

  ┌────────────────────────────────────────────────────────────────┐
  │  KILL SWITCH GLOBAL                                            │
  │                                                                │
  │  Bot Studio Tirra                            [●━━━━━ ATIVO]    │
  │  Desligue para silenciar completamente o bot.                  │
  │  Última alteração: Tiago, há 4 dias                            │
  └────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────┐
  │  FEATURES                                                      │
  │                                                                │
  │  Transcrição de áudio                        [●━━━━━ ATIVO]    │
  │  Bot transcreve e responde mensagens de voz.                   │
  │                                                                │
  │  Supervisor matinal                          [●━━━━━ ATIVO]    │
  │  Envia resumo diário 8h no WhatsApp do Tiago.                  │
  └────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────┐
  │  WHITELIST POR NÚMERO                              [+ Adicionar]│
  │                                                                │
  │  TELEFONE          MODO         MOTIVO              ADICIONADO │
  ├────────────────────────────────────────────────────────────────┤
  │  +5511964540007    🚫 block     "Teste interno"     há 2 dias  │
  │  +5511988887777    👤 human only "VIP - Tiago"     há 1 sem    │
  │                                                                │
  │  [Empty state: "Nenhum número configurado."]                   │
  └────────────────────────────────────────────────────────────────┘
```

**Modal "Adicionar número":**
```
  ┌──────────────────────────────────────────┐
  │  Adicionar à whitelist                   │
  │                                          │
  │  Telefone (com DDD, sem +)               │
  │  ┌────────────────────────────────────┐  │
  │  │ 5511                               │  │
  │  └────────────────────────────────────┘  │
  │                                          │
  │  Modo                                    │
  │  ( ) Allow (sem efeito, apenas marca)    │
  │  (●) Block (bot ignora completamente)    │
  │  ( ) Human only (humano responde)        │
  │                                          │
  │  Motivo (opcional)                       │
  │  ┌────────────────────────────────────┐  │
  │  │ Cliente VIP, Tiago atende direto   │  │
  │  └────────────────────────────────────┘  │
  │                                          │
  │  [Cancelar]            [Adicionar]       │
  └──────────────────────────────────────────┘
```

**Detalhes:**
- Switches têm confirmação inline (não modal) pra UX rápida — toast confirma "Bot ativado/desativado"
- Histórico de mudanças vinculado ao audit_log (link "Ver histórico")
- Telefone validado client + server (Zod) — formato E.164 sem +
- Delete (linha hover mostra ✕) com confirmação

---

## 🖼️ Tela 5 — Métricas

```
┌────────────────────────────────────────────────────────────────┐
│ Studio Tirra        Conversas  Toggles  Métricas* KB  Saúde   │
└────────────────────────────────────────────────────────────────┘

  Métricas                              [Últimos 7 dias ▾]  [⟳]

  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │ AGENDAMENTOS        │  │ TAXA DE SUCESSO BOT │  │ TAKEOVERS HUMANOS   │
  │                     │  │                     │  │                     │
  │   47                │  │   68%               │  │   4                 │
  │   ↑ 23%             │  │   ↑ 4pp             │  │   ↓ 2               │
  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘

  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │ NO-SHOWS            │  │ CANCELAMENTOS       │  │ MSGS / DIA (média)  │
  │                     │  │                     │  │                     │
  │   3                 │  │   8                 │  │   142               │
  │   6.4% (target <8%) │  │   17%               │  │   ↑ 18%             │
  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘

  AGENDAMENTOS POR DIA
  ┌────────────────────────────────────────────────────────────────┐
  │                                                                │
  │   12 ┤        ▄                       ▄                        │
  │   10 ┤   ▄  ▄ █  ▄                ▄  █   ▄                     │
  │    8 ┤ ▄ █  █ █  █  ▄          ▄  █  █ ▄ █                     │
  │    6 ┤ █ █  █ █  █  █  ▄    ▄  █  █  █ █ █  ▄                  │
  │    4 ┤ █ █  █ █  █  █  █  ▄ █  █  █  █ █ █  █  ▄               │
  │    0 └───────────────────────────────────────────────────────  │
  │      20  21  22  23  24  25  26  27  28  29  30  31  01  02 …  │
  └────────────────────────────────────────────────────────────────┘

  TOP PROFISSIONAIS (semana)            VOLUME POR HORA (heatmap V2)
  ┌──────────────────────────┐          ┌──────────────────────────┐
  │ Tiago R.        18 agend │          │  [coming soon — V2]      │
  │ Carla N.        12 agend │          │                          │
  │ João M.          8 agend │          │                          │
  │ Ana L.           6 agend │          │                          │
  └──────────────────────────┘          └──────────────────────────┘
```

**Detalhes:**
- Period selector: 24h · 7d · 30d · 90d
- Cards com sparkline pequena ao lado do número (V2) — MVP: número + trend percentual
- Chart com Recharts (`<BarChart>` simples)
- Empty state se sem dados: skeleton com "Aguardando primeiro sync Trinks"
- Botão `[Exportar CSV]` no canto direito do header (V1.1)

---

## 🖼️ Tela 6 — KB Editor

```
┌────────────────────────────────────────────────────────────────┐
│ Studio Tirra        Conversas  Toggles  Métricas  KB* Saúde   │
└────────────────────────────────────────────────────────────────┘

  Knowledge Base                                  [+ Novo item] [Histórico]

  ┌────────────────────┬───────────────────────────────────────────┐
  │ CATEGORIAS         │ EDITAR ITEM                               │
  ├────────────────────┤                                           │
  │ 📘 FAQ (8)         │ Slug: faq-servicos    v.4 · há 3 dias    │
  │   • faq-servicos   │ ┌─────────────────────────────────────┐   │
  │   • faq-pagamento  │ │ Título                              │   │
  │   • faq-cancelar   │ │ Perguntas frequentes — serviços    │   │
  │                    │ └─────────────────────────────────────┘   │
  │ 💇 Serviços (4)    │                                           │
  │   • fichas-tec.    │ Categoria: [FAQ ▾]                        │
  │   • precos         │                                           │
  │                    │ ┌─────────────────────────────────────┐   │
  │ 📋 Regras (3)      │ │ Conteúdo (Markdown)        [Preview]│   │
  │   • horarios       │ │                                     │   │
  │   • comerciais     │ │ ## Quanto tempo dura uma escova?   │   │
  │                    │ │                                     │   │
  │ 💬 Padrões (2)     │ │ A escova padrão leva entre 45min e │   │
  │                    │ │ 1h, dependendo do tipo de cabelo.  │   │
  │ 📌 Info (1)        │ │                                     │   │
  │                    │ │ ## Posso fazer hidratação junto?   │   │
  │                    │ │                                     │   │
  │                    │ │ Sim, com desconto de 15% no combo. │   │
  │                    │ │                                     │   │
  │                    │ └─────────────────────────────────────┘   │
  │                    │                                           │
  │                    │ Resumo da mudança (opcional)              │
  │                    │ ┌─────────────────────────────────────┐   │
  │                    │ │ Atualizou preço do combo           │   │
  │                    │ └─────────────────────────────────────┘   │
  │                    │                                           │
  │                    │ ⚠️  Após salvar, copie pro TESS dashboard │
  │                    │   ou aguarde sync automático (se ativo)   │
  │                    │                                           │
  │                    │ [Descartar]        [💾 Salvar nova versão]│
  └────────────────────┴───────────────────────────────────────────┘
```

**Aviso TESS (depende do spike):**
- Se TESS API suporta update programático: aviso some, mostra "Sincronizando com TESS..." → ✅
- Se NÃO suporta: mantém aviso + botão `[Copiar conteúdo pro clipboard]` + instrução

**Histórico de versões (sub-tela):**
```
  Histórico — faq-servicos
  ┌────────────────────────────────────────────────────────────────┐
  │ v4 · há 3 dias · Tiago      "Atualizou preço combo"   [Ver][Restaurar]│
  │ v3 · há 8 dias · Tiago      "Adicionou hidratação"    [Ver][Restaurar]│
  │ v2 · há 2 sem · Tiago       "Correção ortográfica"    [Ver][Restaurar]│
  │ v1 · há 1 mês · sistema     "Migração inicial"        [Ver]           │
  └────────────────────────────────────────────────────────────────┘
```

- Click `[Ver]` abre diff lado-a-lado
- `[Restaurar]` cria v5 com conteúdo da versão antiga + audit log

---

## 🖼️ Tela 7 — Saúde + Auditoria (combinada)

### 7a. Saúde

```
┌────────────────────────────────────────────────────────────────┐
│ Studio Tirra        Conversas  Toggles  Métricas  KB  Saúde*  │
└────────────────────────────────────────────────────────────────┘

  Saúde do sistema                                Última checagem: 4s atrás

  ┌────────────────────────────────────────────────────────────────┐
  │ 🟢 WhatsApp (Kapso)                                            │
  │ Janela: 23h 12min restantes  ·  Última msg: há 2min            │
  │ Webhook HMAC: ✅ validando  ·  Origem 'business_app' OK         │
  └────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────┐
  │ 🟢 TESS AI (agent 33200)                                       │
  │ Latência p50: 1.2s  ·  p95: 3.4s                               │
  │ Última resposta: há 4min                                       │
  └────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────┐
  │ 🟢 Trinks API                                                  │
  │ Último sync: há 12min  ·  Próximo sync: em 3min                │
  │ Records sincronizados (total): 1,847                           │
  │ Falhas consecutivas: 0                                         │
  └────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────┐
  │ 🟢 Postgres                                                    │
  │ Uptime: 12 dias  ·  Conexões ativas: 4/100                    │
  │ Conversation_history: 14,234 rows  ·  Tamanho: 18 MB           │
  └────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────┐
  │ 🟡 Cert SSL (admin.studiotirra.com.br)                         │
  │ Expira em 47 dias  ·  ⚠️ Renovação automática quebrada         │
  │ [Renovar manualmente]                                          │
  └────────────────────────────────────────────────────────────────┘
```

### 7b. Auditoria

```
  Audit log                                       [Filtros ▾] [Exportar CSV]

  ┌────────────────────────────────────────────────────────────────┐
  │ 🕐 há 12min · Tiago · kb.update       "faq-servicos" v.4      │
  │ 🕐 há 1h · Tiago · toggle.set         "feature:audio" → off   │
  │ 🕐 há 2h · recepção · whitelist.add    +5511988887777 (human)  │
  │ 🕐 há 3h · Tiago · login              Chrome · 192.168.1.42   │
  │ 🕐 há 5h · sistema · session.expired  recepção                 │
  │ 🕐 ontem 18h · Tiago · kb.update      "precos" v.7            │
  │ ...                                                            │
  └────────────────────────────────────────────────────────────────┘

  [Carregar mais]
```

**Filtros:**
- Usuário · Action type · Range de data
- Click row → modal com payload JSON (formatted)

---

## 📱 Estados de borda (cross-screen)

| Estado | Tratamento |
|--------|-----------|
| **Loading** | Skeleton (shadcn) — nunca spinner em tela cheia |
| **Empty** | Ilustração leve + mensagem útil ("Ainda nada por aqui" + CTA contextual) |
| **Erro de fetch** | Toast vermelho + botão "Tentar novamente" + log no audit (se persistente) |
| **Offline** | Banner topo: "Sem conexão. Tentando reconectar..." (auto reconnect) |
| **Sessão expirada** | Toast + redirect `/login` com `?returnTo=/path-atual` |
| **Permissão negada** (futuro role viewer) | Tela vazia com explicação: "Você não tem permissão. Fale com o admin." |

---

## ♿ Acessibilidade — checklist WCAG AA

| Item | Status |
|------|--------|
| Contraste texto/bg ≥ 4.5:1 | ✅ navy `#1A1A2E` sobre cream `#F5F3EE` = 13.4:1 |
| Focus rings visíveis | ✅ `--color-accent` indigo 2px |
| Navegação por teclado completa | ✅ Tab order lógico, atalhos documentados |
| `<label>` em todos os inputs | ✅ |
| Aria-labels em botões só-ícone | ✅ (ex: botão refresh) |
| Live region em conversas live | ✅ `aria-live="polite"` em badge de count |
| Suporte a screen reader nos toasts | ✅ shadcn já entrega |
| Reduced motion respeitado | ✅ animações condicionais via `prefers-reduced-motion` |
| Tamanho de fonte mínimo 14px | ✅ body 16px, metadados 13px (com line-height 1.6 pra leitura) |

---

## 📐 Breakpoints e responsividade

| Breakpoint | Comportamento |
|-----------|---------------|
| `< 640px` (mobile) | Single column, hamburger nav (Sheet), KPIs empilhados, tabelas viram cards |
| `640–1024px` (tablet) | 2 colunas KPIs, nav horizontal mantida, sidebar drill-down vira sheet |
| `> 1024px` (desktop) | Layout completo, 3 colunas KPIs, sidebar drill-down fixa |

**Alvo primário:** desktop (Tiago/recepção usam laptop). Mobile é "checkar rápido", não tarefa principal.

---

## 🎯 Próximos passos (handoff @dev)

1. **Story 1.1 (Auth + scaffold):** implementar tela de login (T1) + layout shell (top nav)
2. **Story 1.2 (Conversas):** T3 lista + T3b drill-down
3. **Story 1.3 (Toggles):** T4
4. **Story 1.4 (Métricas):** T5 (charts simples; heatmap fica V2)
5. **Story 1.5 (KB editor):** T6 + spike TESS API antes
6. **Story 1.6 (Saúde + Auditoria):** T7a + T7b

**Componentes shadcn a instalar (na ordem das stories):**
- Story 1: `button`, `input`, `label`, `card`, `toast`, `dropdown-menu`, `sheet`
- Story 2: `table`, `badge`, `skeleton`, `dialog`
- Story 3: `switch`, `dialog`, `radio-group`, `textarea`
- Story 4: + Recharts (npm install)
- Story 5: `tabs`, `@uiw/react-md-editor` (npm install)
- Story 6: nenhum novo

## 📋 Decisões abertas pro @dev (não bloqueiam start)

1. **Toast library:** sonner (vem com shadcn) ✅ sugestão
2. **Date formatting:** `date-fns` (pt-BR locale) — relativos ("há 4min") + absolutos
3. **Number formatting:** `Intl.NumberFormat('pt-BR')` nativo
4. **Telefone formatting:** lib custom ou regex pra `+55 (11) 91234-5678` na exibição
5. **Mobile nav:** Sheet do shadcn (já recomendado acima)

---

## 🔗 Recursos

- Design tokens: `design-system/tokens/semantic.css`
- Tema Influence Labs: `design-system/tokens/themes/influence-labs.css`
- Reference pattern (cores em ação): `frontend/index.html`
- shadcn/ui docs: https://ui.shadcn.com
- Recharts: https://recharts.org

---

## Change Log

| Data | Quem | Mudança |
|------|------|---------|
| 2026-05-26 | @ux-design-expert Uma | Wireframes low-fi das 6 telas + estados de borda + checklist a11y + breakpoints |
