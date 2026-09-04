# Floor corpus — recepção (Kapso Platform API)

**Autor:** Orion (@aios-master) · extração no VPS via `docker compose exec backend`  
**Pedido:** Victor, 04/09/2026 ~12:16 BRT — puxar outbound da recepção; Kapso se a sessão Postgres não tiver.  
**Fonte:** `GET https://api.kapso.ai/platform/v1/whatsapp/{phone_numbers,messages,conversations}`  
**Auth:** `X-API-Key` no container (não versionada). last4 only. Zero E.164 neste arquivo.  
**Não mistura** no denominador das 629 falas de cliente (`floor-corpus-20260904.md`).

---

## Números Kapso no mesmo customer

| Papel | last4 display | `phone_number_id` | `is_coexistence` | status |
|---|---|---|---|---|
| Bot Tess (Cloud API) | `0517` | `1332022119990766` | false | CONNECTED |
| Recepção WhatsApp Business | `9426` (`94831`) | `1016003164939443` | **true** | CONNECTED |
| Sandbox | — | `597907523413541` | — | sandbox |

O webhook live só persiste staff quando `direction=outbound` **e** `origin !== cloud_api`. `history_sync` é ignorado (`server.js`). Por isso `bot_thread_state.last_staff_outbound_at` na semana = **0**.

---

## Semana 01–04/09/2026 (o que a hipótese pedia)

| Fonte | outbound na janela | origins | last4 distintos | staff-like (`origin ≠ cloud_api`) |
|---|---:|---|---:|---:|
| Bot `0517` | **756** (amostra paginada 8 p.) | 100% `cloud_api` | 96 | **0** |
| Bot `0517` (10 páginas / 1000 msgs, qualquer direção) | 1000 | 100% `cloud_api` | — | **0** |
| Recepção `9426` | **0** | — | 0 | **0** |

Conversas da linha `9426`: `status=active` → **0**. As 10 mais recentes estão `ended`; `last_active_at` mais novo = **2026-06-20** (last4 `0330`).

**Conclusão honesta:** nesta semana a recepção **não** aparece no Kapso Platform API. O máximo que o Kapso entrega agora é histórico **congelado em junho/2026** na linha coexistência, e Tess-only na linha do bot.

Não disparei history-sync (muda estado no Kapso). Export manual do WhatsApp Business `94831` continua o único caminho para a fala **desta** semana.

---

## Cobertura máxima disponível (jun/2026, linha `9426`)

25 páginas × 100 = **2500** mensagens. Todas com timestamp em **2026-06**.

| origin | n |
|---|---:|
| `business_app` | 1313 |
| `cloud_api` | 1187 |

Tipos (mistura inbound+outbound na listagem): text 2126 · reaction 192 · audio 77 · image 54 · sticker 17 · outros <20.

Textos `origin=business_app` (staff no app): **218 last4** distintos nas 25 páginas. Amostra de 80 textos (sem nomes de cliente neste md).

### Léxico da recepção (junho) — o que eles **dizem**, não SKU Trinks

Padrões recorrentes (paráfrase; last4 só como âncora):

| Padrão | Exemplo de chão | last4 âncora | Ask-class Mary |
|---|---|---|---|
| Confirmação curta | “Agendado seu **pé e mão** … amanhã às 17h” | `8885` | `service` (unha) + `time` |
| Química + escova | “Agendada sua **coloração e escova** … sábado às 8h” | `9621` | `service` |
| Laser | “sessão de **depilação a laser** em 3 áreas” | `0361` | `service` |
| Combo masculino | “Seria para **cabelo e barba**?” | `4307` | `service` |
| Preço por dia/pro | corte feminino terça/quarta vs quinta–sábado; Tiago com escova | `1556` | `faq` preço |
| Encaixe / lotação | “Erick já está sem horário”; “sem horário com as **manicures**” | `9320` `8885` | `time` occupancy |
| Oferta de relógio | “10h, 12h e 17h”; “sábado 15h”; “12h30” | `2638` `0954` `1611` | `time` clock |
| Cancelamento humano | “Cancelei o seu”; “Cancelei pra você” | `1404` `6060` | (staff, não cliente) |
| Expediente | terça–sexta 9h–19h; sábado 9h–18h | `6090` | `faq` |
| Cadastro | pede nome / celular / email / nasc / Instagram **antes** de marcar | `8156` | ChannelPattern, não Term |
| Alinhamento | “Progressiva, botox?” | `8156` | `service` |
| Encerramento | “preciso encerrar… respondo amanhã” | `4634` | noise operacional |

**Pé e mão** na boca da recepção = **manicure+pedicure** (unha). Isso **não** autoriza alias `pezinho` → pedicure. Onda 2 mantém a distinção Mira (`1000` / `4501`).

Nada nesta amostra de junho usa `pezinho`, `tintura`, `gloss` ou `maquiador` como vocábulo. Não inventar que a recepção desta semana fala igual.

---

## O que **não** dá para afirmar

1. Que a recepção desta semana (01–04/09) falou X no WhatsApp — Kapso **não tem** essas bolhas.
2. Que `history_sync` no webhook resolveria sozinho — o store da linha `9426` parou em junho; sync sem evidência de ingestão nova.
3. Misturar 1313 `business_app` de junho no denominador 629 da semana.

---

## Próximo dado (gate Victor, não executar aqui)

1. Export ZIP/CSV do WhatsApp Business `94831` da semana, **ou**
2. Confirmar no painel Kapso se a linha coexistência ainda recebe eco `business_app` (webhook da `9426` parece morto desde junho), **ou**
3. History-sync Kapso — só com ACK explícito (escreve no projeto).

_Artefato sem E.164 — apenas last4._
