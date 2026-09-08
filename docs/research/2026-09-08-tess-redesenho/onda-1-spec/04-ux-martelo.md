# 1.4 UX — superfície Martelo mínima

**Persona:** Uma (@ux-design-expert)  
**Veto:** silenciar o bot ≠ assinar o commit  
**NFR-4:** sem frontend novo na v1. Sem Hostinger.

---

## Usuários

| Quem | Job to be done | Dor T2 |
|---|---|---|
| Cliente WhatsApp | Saber se o horário **é dele** | Ouviu “confirmando”; chegou e não tinha |
| Recepção | Entrar no fio sem destruir o que a Tess começou | F3 mata 2-phase; Denise walk-in |
| Owner / Nightwatch | Ver hold órfão e receipt pending | PILOT mediu volume, não commit |

---

## Princípio

**IA executa; humano assina.** A recepção precisa de **uma decisão binária** sobre um hold existente — não de um segundo chat paralelo sem estado.

---

## v1 — sem tela nova (story 2)

Canal: evento operacional + ação admin já autenticada (mesmo perímetro de `/toggles`).

```
Hold HELD + staff falou no fio
        ↓
Receipt pending (assigned_to nomeado, sla_until)
        ↓
Nightwatch P0: "hold {last4} {hh:mm} prof — assinar|negar"
        ↓
POST interno { receipt_id, action: approved|rejected }
        ↓
approved → COMMITTING (guards + POST)
rejected → hold rejected + copy cliente honesta
```

**Copy cliente enquanto pending (bot calado):** nenhuma mensagem nova da Tess. O estado no sistema **existe** (mantra Pedro). Se o cliente mandar texto, ACK silêncio permanece; hold não some.

**Copy cliente após reject (quando bot puder falar de novo):** “Esse horário não ficou gravado. Quer outro?”

**Copy cliente após approve+2xx:** matriz CONFIRMED (endereço ok).

---

## Wireframe textual (v1.1 futura — não desta spec de implementação)

```
┌─────────────────────────────────────┐
│ Hold · last4 1734 · hoje 13:00      │
│ Prof: {nome} · Serviço: {sku}       │
│ Expira em 2:14                      │
│                                     │
│  [ Assinar — gravar na agenda ]     │
│  [ Negar — liberar horário    ]     │
└─────────────────────────────────────┘
```

Uma tela, dois botões, zero campo livre obrigatório. `assigned_to` vem do login admin.

**Não** desenhar Mission Control / Cowork / OpenClaw aqui.

---

## Anti-padrões UX

| Anti-padrão | Por que |
|---|---|
| “Recepção já foi avisada” sem receipt | Δ-4 — promessa de processo |
| Bot pede “tá certo?” de novo (pré-F5) | Pedido da sexta; não reabrir |
| Endereço no pending | I1 |
| Bot continua falando com staff no fio | F3 permanece |
| Staff fala e o hold some | F3×F5 — é o bug |

---

## Acessibilidade / operação salão

- Ação em < 2 toques no celular da recepção (v1.1).
- v1: alerta Nightwatch que o owner **já** lê — aceitável como MVP de processo, não como UX final.
- last4 only em logs e alertas.

---

## Critério de aceite UX (story 2)

1. Staff no fio + hold ativo → receipt `pending` visível no mesmo canal que o owner já usa.  
2. Approve/reject grava `acted_at` + `assigned_to`.  
3. Cliente **nunca** lê sucesso entre pending e 2xx.  
4. Silêncio do bot ≠ tela vazia no sistema (receipt existe).
