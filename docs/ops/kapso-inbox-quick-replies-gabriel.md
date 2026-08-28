# Checklist: Inbox Kapso — busca por texto + quick replies (Gabriel / Tiago)

**Número correto:** Inbox do **bot** +55 11 97504-0517 **somente**.

**Nunca usar:** Inbox ou operação no número humano de recepção +55 11 94831-9426.

**Fora de escopo:** Kapso Findings, “Generate in composer” (consome créditos de AI Kapso), `BOT_ACCEPT_ALL`, alterações no backend.

O bot TESS **não interpreta** `/preco`, `/endereco`, `/horario`. São colas para o humano quando assume o thread no Inbox.

---

## Como buscar uma conversa por texto

1. Kapso → projeto do bot **97504-0517** → **Inbox**.
2. Campo de busca: digite **texto da mensagem** (não só telefone). Também funciona nome e telefone.
3. Atalhos de teclado (se disponíveis na UI Kapso):
   - **J** — conversa anterior na lista
   - **K** — próxima conversa
   - **Enter** — abrir conversa selecionada
   - **R** — responder / focar composer (conforme layout Kapso)

---

## Como disparar um quick reply

1. Abrir a conversa no Inbox do **97504-0517**.
2. No composer, digitar o atalho (ex.: `/horario`) e selecionar o quick reply configurado.
3. Revisar o texto colado antes de enviar.
4. Ajustar tom se o cliente pediu algo específico — a cola é base, não script fechado.

---

## Quando **não** usar

| Situação | Motivo |
|---|---|
| Thread ainda no bot (TESS respondendo sozinha) | Quick reply é para **humano** após assumir; não interromper o fluxo automático |
| Qualquer operação no **94831** | Fora do escopo deste checklist; número de recepção humana |
| Precisa inventar preço ou horário | Usar só textos da KB abaixo; se não estiver na KB, escalar para Tiago |
| “Generate in composer” da Kapso | **Não usar** — consome crédito de AI |

---

## Textos dos atalhos (copiar fielmente da KB)

Fonte única: `data/client/kb/faq.md`. Revisar se a KB mudar antes de editar no painel.

### `/horario`

**Fonte:** FAQ #2 — `data/client/kb/faq.md`

```
Abrimos de terca a sexta das 09h as 19h, sabado das 09h as 18h. Domingo e segunda estamos fechados.
```

### `/endereco`

**Fonte:** FAQ #1 — `data/client/kb/faq.md`

```
Estamos na Rua Espirito Santo, 385 - Santo Antonio, Sao Caetano do Sul/SP.
```

### `/preco`

**Fonte:** FAQ #5 + #7 + #8 — `data/client/kb/faq.md` (combo curto, sem inventar outros valores)

```
Sim, o preco muda conforme profissional — temos tabela para Tiago (proprietario) e Equipe.

Corte feminino: Equipe R$ 190 (promo 3a/4a R$ 180). Tiago R$ 250 (promo R$ 240).
Corte masculino: Equipe R$ 90 (promo R$ 85). Tiago R$ 105 (promo R$ 100).
```

### `/cancelar` (opcional)

**Fonte:** FAQ #16 — `data/client/kb/faq.md`

```
Nao cobramos taxa de no-show. Nossa prioridade e confirmar presenca e reorganizar agenda com antecedencia.
```

### `/estacionamento` — **omitir**

Estacionamento está **PENDENTE CONFIRMACAO** em `data/client/kb/salon-info.md`. Não criar quick reply até a KB ser atualizada.

---

## Review de fidelidade (uma linha por atalho)

| Atalho | Fonte KB | Fiel? |
|---|---|---|
| `/horario` | faq.md #2 | [ ] Gabriel/Tiago confirmam |
| `/endereco` | faq.md #1 | [ ] Gabriel/Tiago confirmam |
| `/preco` | faq.md #5+#7+#8 | [ ] Gabriel/Tiago confirmam |
| `/cancelar` | faq.md #16 | [ ] opcional |

---

## Victor faz no painel (AC2 + AC4 — pendente)

Estas etapas **não** são feitas por código; Victor configura no Inbox Kapso do **97504-0517**.

### AC2 — Criar quick replies no painel

Settings / Inbox → Quick replies → criar **pelo menos 3** com os nomes e textos exatos abaixo (copiar/colar):

**Nome:** `/horario`

```
Abrimos de terca a sexta das 09h as 19h, sabado das 09h as 18h. Domingo e segunda estamos fechados.
```

**Nome:** `/endereco`

```
Estamos na Rua Espirito Santo, 385 - Santo Antonio, Sao Caetano do Sul/SP.
```

**Nome:** `/preco`

```
Sim, o preco muda conforme profissional — temos tabela para Tiago (proprietario) e Equipe.

Corte feminino: Equipe R$ 190 (promo 3a/4a R$ 180). Tiago R$ 250 (promo R$ 240).
Corte masculino: Equipe R$ 90 (promo R$ 85). Tiago R$ 105 (promo R$ 100).
```

**Opcional — Nome:** `/cancelar`

```
Nao cobramos taxa de no-show. Nossa prioridade e confirmar presenca e reorganizar agenda com antecedencia.
```

- [ ] Victor: 3+ quick replies criados no painel
- [ ] Victor: testou disparo de cada um numa conversa de treino

### AC4 — Treino busca por texto (Gabriel ou Tiago)

Sessão de treino **sem abrir whitelist**:

1. Gabriel ou Tiago abre Inbox do **97504-0517**.
2. Busca uma frase que **lembra** de ter visto numa conversa recente (ex.: “horário”, “corte”, “agendar”) — **não** só o telefone.
3. Confirma que a conversa correta aparece.

- [ ] Gabriel ou Tiago: achou conversa por **texto** (data: _________)

---

## Referências

- Story: `docs/stories/salon-whatsapp-kapso-inbox-quick-replies.md`
- KB: `data/client/kb/faq.md`, `data/client/kb/salon-info.md`
- Pesquisa: `docs/research/2026-08-28-tess-workspace-id-kapso-findings/` §2.4
