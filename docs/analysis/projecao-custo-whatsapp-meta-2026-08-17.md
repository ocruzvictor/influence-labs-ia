# Projeção WhatsApp Meta — volume do 94831 e efeito das bolhas

Data: 2026-08-17 · analista via @aios-master  
Fontes: Kapso `GET /platform/v1/whatsapp/messages` (VPS, mesma API key do backend) · supervisor jun/2026 (~50 conv/dia) · rate card Meta BR (jul/2026)

## O que foi medido

| Número | Phone Number ID | Janela na API | Inbound | Outbound | Conversas | Páginas |
|---|---|---|---:|---:|---:|---:|
| Recepção `94831-9426` | `1016003164939443` | 13–20/06/2026 | 1.925 | 2.075 | 402 | 40 (teto — pode haver mais antigo) |
| Bot teste `95502-8331` | `1197799596760252` | 15–17/08/2026 | 48 | 124 | 4 | 3 (completo) |

O 94831 some da API depois de 20/06 (coexistência/PARTNER_REMOVED). Não há histórico Kapso de julho–agosto nesse PNID.

### Outbound por dia — 94831

| Dia | In | Out | Nota |
|---|---:|---:|---|
| 13/06 (sex) | 153 | 185 | Dia “cheio” mais baixo da amostra útil |
| 14/06 (sáb) | 26 | 12 | Quase parado |
| 15/06 (dom) | 62 | 15 | Salão fechado |
| 16/06 (seg) | 638 | 698 | Pico — inclui tráfego de API/teste |
| 17/06 (ter) | 513 | 562 | Pico |
| 18/06 (qua) | 533 | 601 | Pico |
| 19–20/06 | 0 | 1+1 | Canal já morrendo |

Média Ter/Qua/Seg de pico: **~620 outbound/dia**.  
Supervisor (jun): **~50 conversas/dia**.

### Taxa de bolha (medida no smoke 17/08, 95502)

33 inbound / 97 outbound → **2,94 envios do salão por mensagem do cliente**.  
É o padrão I.10 antigo (2–4 bolhas). Colapsar para 1 envio corta ~66% dos sends.

## Premissas de preço Meta (Brasil)

Oficial hoje (Cloud API, jul/2026): texto de sessão (`type=text` dentro da janela 24h) **não é cobrado**. Template marketing **R$ 0,3217**; utility/auth **R$ 0,0350** (utility na janela ainda isento).

Victor antecipa cobrança em **todo envio** quando a API for o canal oficial. Meta anunciou updates de service/utility em **01/08 e 01/10/2026**. Terceiros citam service billable a partir de 01/10. Usamos 3 cenários — o do meio é o planejamento.

| Cenário | O que cobra | Tarifa usada |
|---|---|---:|
| A — oficial hoje | só template fora de janela | R$ 0,00 nos replies de sessão |
| B — planning (todo outbound = utility BR) | cada envio do salão | **R$ 0,0350** |
| C — pior (todo outbound = marketing) | cada envio | R$ 0,3217 |

Dias úteis de salão: Ter–Sáb ≈ **22/mês**.

## Volume mensal projetado (outbound do salão)

| Base | Fórmula | Outbound/mês |
|---|---|---:|
| Supervisor + 1 bolha | 50 conv × 4 replies × 22 | **4.400** |
| Supervisor + 2,94 bolhas (hoje) | 4.400 × 2,94 | **12.900** |
| Pico Kapso 94831 | 620 × 22 | **13.640** |
| Dia 13/06 × 22 | 185 × 22 | **4.070** |

O pico Kapso e o “supervisor × 2,94 bolhas” se encontram. Isso sugere que junho já estava no padrão multi-bolha + volume real de recepção.

## Custo Meta / mês (só envios de sessão)

| Volume | A (hoje) | B utility R$0,035 | C marketing R$0,322 |
|---|---:|---:|---:|
| 4.400 (1 bolha) | 0 | **R$ 154** | R$ 1.415 |
| 12.900 (2,94 bolhas) | 0 | **R$ 452** | R$ 4.150 |
| **Economia 1 bolha** | 0 | **R$ 298** | R$ 2.735 |

Kapso Pro (~US$ 25) e TESS **não entram** nesta conta — já estão no relatório de jun/2026. Aqui é só a tarifa Meta por mensagem entregue.

## Recomendação

1. Código: 1 envio por turno (já implementado nesta leva).  
2. Prompt I.10: parar de pedir 2–4 bolhas (Victor cola).  
3. Planejar caixa no cenário B: **~R$ 150–180/mês** com 1 bolha vs **~R$ 450** se mantiver o ritmo do smoke.  
4. Re-medir 7 dias de recepção no 95502 depois do go-live — a amostra 94831 está truncada e mistura teste.
