# Léxico / intent-null — o que as 383 ainda são (e o que dá pra matar)

> **Orion** · 2026-09-05 · pedido Victor: *entender o residual e ampliar o léxico com o chão de ontem*  
> **Não promete zerar 383.** Sem 9º intent. Sem copiar KB de sinónimos para `sku_id`. Sem smoke `0007` como métrica.

---

## Em uma frase

As **383** não são “o classificador é cego”. São turnos `user` do dump **01–04/09 ~11:50 BRT** cuja **coluna** ficou `null` — a maior parte porque o inbound passivo gravava sem intent, e o resto porque a fala **não tem dente** (áudio, lero, parágrafo sem keyword).

O código da story 3 **já persiste** landing / daypart / nome de profissional / FAQ. O replay local mostrou queda (`would_fill=626`) — **não** fechou o denominador 383.

---

## Os inteiros (não renormalizar)

Fonte: `docs/analysis/2026-09-04-dara-chao-3-intent-replay.md` + Onda 1 `2026-09-04-orion-ondas-lexico-triagem.md`.

| Número | Significado |
|---|---|
| **383 / 511** | Turnos `user` brutos (com duplicata passive) com `intent=null` na janela 01/09 00:00 → 04/09 ~11:50 BRT |
| **629** | Falas únicas (dedup last4+texto) na mesma janela |
| **125 (20%)** | Hit em `FILTER_SERVICE_KEYWORDS` |
| **383** (outro eixo) | Falas **longas sem** keyword de SKU — *é o mesmo tamanho, outro corte* |
| `would_fill=626` | Replay do classificador+persist **preencheria** 626 rows null do dump (grain bruto `--no-dedup`) |
| `replay_null=−243` | Fórmula `383 − would_fill` no dump que **cresceu** depois do baseline. Publicado. Não “corrigir” |
| 8 intents | SCHEDULING · CANCEL · RESCHEDULE · FAQ · PRICING · TRIVIAL · UNCERTAIN · HANDOFF_LIKELY. **Sem 9º.** |

Onda 2 Fase A (live) já cobriu stems: pezinho, tintura, gloss, maquiador, duração, ROLE. Story 3 cobriu persist + MIN sem SKU. **O que falta não é republicar isso.**

---

## O que **deve** continuar null (denylist — não matar)

| Tipo | Exemplo | Por quê |
|---|---|---|
| Áudio / imagem / sticker | `[AUDIO TRANSCRITO]`, mídia | Denylist Aria. Sem texto classificador |
| Lero | “…” / “kk” / emoji só | `isLeroUtterance` |
| Parágrafo sem landing, dia, pro, FAQ, SKU | recado longo, desabafo | Fora das classes. UNCERTAIN no classificador; persist passivo pode continuar vazio se o path não rodar |

Matar *estas* 383 seria mentir a coluna.

---

## O que **ainda pode** entrar no léxico (hipótese Victor — a falsificar)

A Onda 1 **parou em 04/09 ~11:50 BRT** (kill switch). Depois disso o salão **continuou**: PILOT first-5 (04 tarde → 05 ~16h) + recepção no fio + o teu `0007`. Esse chão **não** entrou no catálogo v0.1.0.

Candidatos que a Onda 1 já apontou e a 2ª onda deve recontar no dump novo:

1. **Encaixe sem SKU** — “tem horário hoje?” / “cabe agora?” (núcleo da semana, não nome de serviço).
2. **Cancel / remarca implícitos** — “não vou conseguir” / “pode ser outro dia” sem a palavra cancelar.
3. **Landing residual** — “vim pelo / Studio Tirra / quero agendar” que ainda nasça null (regressão de persist).
4. **Daypart + pro** — “final do dia”, “com o André”, sexta/sábado sem SKU.
5. **FAQ ops** que o info-open agora *responde* mas a coluna pode ainda nascer vazia no path passivo.
6. **Falas do PILOT** que queimaram vaga ou ghostaram: `2185` técnicas/produto (P2.1 já trata claim; léxico = persist FAQ), Daiane `encaixe`, Vinicius “não cabe”.

**Não** reabrir stems já live (tintura / gloss / pezinho / maquiador / masculino).

---

## Plano pra “matar o léxico” (se valer a pena)

Vale a pena **se** o dump 04/09 12:00 BRT → agora tiver um cluster **repetido** (≥ N falas, last4 distintos) que o classificador ainda manda pra null/UNCERTAIN e que muda oferta ou FAQ. Não vale se for só lero + áudio.

1. **Dara (read-only):** dump `conversation_history` 04/09 12:00 BRT → 05/09 agora. last4 only. Grain user bruto e dedup. Contar: null vs 8 intents; top falas sem keyword; overlap com denylist.
2. **Orion/Aria:** se o cluster for dente novo (encaixe, cancel implícito, …) → 2ª onda de classes **reusando** os 8 intents. Sem 9º. Sem `sku_id` de sinónimo.
3. **Dex:** só com teto Aria. Fixture + replay do dump **novo** (não reescrever o 383).
4. **Quinn:** fatia. Sem WhatsApp.

Critério de “lexico fechado”: denylist + classes novas cobrem o que a operação lê. Residual null **honesto** (mídia/lero) permanece.

---

## Relação com o que já está no ar

| Já live | Não é o furo 383 |
|---|---|
| Info-open FAQ/PRICING (`c043a75`) | Boca no WhatsApp. Coluna persist é outro caminho |
| P2.1 claim só com sinal de marcar | Evita queimar vaga; não classifica a cauda histórica |
| Onda 2 stems + story 3 persist | Já no `a9d5af8`+ |

Próximo artefato de medida: Dara dump 04 tarde + 05 (Onda 6 do plano de sessão).
