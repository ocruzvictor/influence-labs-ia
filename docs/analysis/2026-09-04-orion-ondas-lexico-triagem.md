# ONDAS — léxico do chão + triagem (2026-09-04)

**Autor:** Orion (@aios-master)  
**Gatilho:** Victor, após desligar a IA por pedido de ajuda ([relatório 04/09](3048c959-6f6f-47b3-9888-23a9dacdf703) — 24 fios Tess no dia; kill switch **global=false** 11:33 BRT).  
**Decisão de produto:** pausar a fila de crédito/timeout. Primeiro **entender como o cliente fala**; depois **recalibrar a triagem**.  
**Não é story formal.** Sem `@sm`/`@po` não vira AC de epic. Sem paste 46589. Sem Hostinger. last4 only.

Hipótese de Victor (aceita como **hipótese a falsificar**, não como fato): a Tess ainda erra porque a regra de linguagem (SKU, keyword, prompt) foi montada nas **nossas impressões**, não no **jeito real** do WhatsApp desta semana — IA **e** recepção.

---

## Duas ondas (nesta ordem)

```
ONDA 1 — mapa do chão (corpus + catálogo)
    extração  →  léxico  →  casos  →  gap recepção
                    ↓
ONDA 2 — triagem recalibrada
    classificador + keywords + o que entra no contexto
    (prompt 46589 só depois, com gate humano)
```

Crédito (itens 8, 9, 10 do [estacionados](2026-09-03-orion-estacionados.md)) **não avança** até a Onda 1 ter um catálogo auditável. Onda 2 **pode** voltar a cortar custo — mas o objetivo primário é **precisão de leitura**.

### Relação com o dossiê (não substitui)

| Dossiê | O que já cobria | O que estas ondas **adicionam** |
|---|---|---|
| Pedro eixo 2 (intent) | classificador determinístico; persistência parcial | **Léxico empírico** que o regex não vê (`tintura`, `gloss`, `pezinho`, `maquiadora`, funil “vim pelo Studio Tirra”) |
| Pedro eixo 5 | funil **não existe** | Onda 1 mapeia **etapas reais** da fala (agendar → SKU → prof → hora → PIX), ainda sem campo no banco |
| LibForge P-BUDGET | teto live `fa0ec92` | Fora desta onda. Não reabrir caps |
| Item 6 UNCERTAIN→MIN | live | Não reabrir. Onda 2 pode **melhorar o classificador**, não o dump FULL |
| Prompt-engineering-squad | ciclo de prompt com gate Victor | **Onda 2 fase B** — só depois do catálogo. Fase A é código (keywords + intent), não cola |

---

## Onda 1 — mapa do chão

**Janela extraída:** seg 01/09 00:00 BRT → 04/09 ~11:50 BRT (esta semana até o off).  
**Fonte com dentes hoje:** `conversation_history` (inbound passivo + turnos da Tess).  
**Fonte que falta (ainda):** fala da recepção **nesta semana**. Tentativa Kapso 04/09: linha bot `0517` = 100% Tess (`cloud_api`); linha coexistência `9426` parada em **2026-06-20**. Histórico junho documentado em `docs/analysis/floor-corpus-reception-20260904.md` — **não** entra no denominador 629. `history_sync` no webhook continua ignorado. Sem export WhatsApp Business `94831` da semana, o mapa da recepção desta janela segue só o inbound que o bot viu.

### Volume (dedup last4+texto)

| Métrica | Valor |
|---|---:|
| Fios (last4 distintos) | **97** |
| Com resposta da Tess | **90** |
| Inbound só (sem IA) | **7** |
| Falas únicas do cliente | **629** |
| Hit na lista `FILTER_SERVICE_KEYWORDS` | **125** (20%) |
| Falas longas **sem** keyword de SKU | **383** |
| `handoff.human` | 24 |
| `guard.blocked` | 23 |
| `booking.created` | 13 |
| `tess.timeout` | 1 |
| `tess.context_trimmed` | 1 (já no ar do item 7) |

Intent gravado nos turnos `user` processados pelo bot (511 linhas brutas, com duplicata passive): SCHEDULING 85 · UNCERTAIN 33 · PRICING 3 · FAQ 3 · CANCEL 2 · TRIVIAL 2 · **null 383**. A coluna existe; a maior parte desta semana **ainda não classifica**. Isso **confirma** o ponto cego: triagem fraca no dado, não só no prompt.

### O que os clientes desta semana **mais** pedem (fala, não SKU Trinks)

Ordem por ocorrência aproximada nas falas únicas:

1. **Agendar / horário / hoje / amanhã / sábado / sexta** — o núcleo é **encaixe**, não o nome do serviço.
2. **Corte** (75 hits de `cort`) + **masculino** + nomes **André / Erick / Tiago**.
3. **Profissional pelo nome** (71 falas) — Fefe, Erick, André, Tiago — muitas vezes **antes** do SKU.
4. **Cabelo** genérico (29) — ambíguo (corte vs química).
5. **Cancelar / remarcar** (13 / 4).
6. **Preço / valor** (13) — pouco em relação ao volume de agenda.
7. Cauda: escova, barba, manicure, penteado, mecha, maquiagem, pezinho, tintura, gloss, raiz, laser, PIX, endereço.

Funil repetido (dezenas de fios): *"Oi, vim pelo Studio Tirra. Quero agendar"* → depois *"Masculino"* / *"Qual valor?"* / dia. Isso **não** é conversa de recepção livre; é **landing**. A Tess trata como UNCERTAIN/SCHEDULING sem SKU.

### Onde a lista de keywords **não encaixa** (evidência)

Falas que o filtro de catálogo **não pega** (amostra last4):

| last4 | Fala | Por que fura |
|---|---|---|
| 2987 | “maquiadora não é só a Fefe?” / “2h de atendimento?” / “opção que já tem cliente” | Pessoa + duração + ocupação — zero SKU |
| 0330 | “Quem é maquiador aí?” | Cargo, não `maquiagem` |
| 4905 | “valor para **tintura**” / “trabalham com **gloss**?” | Sinónimos fora da lista (`color`/`tonaliz` não cobrem tintura/gloss) |
| 0007 | “aceita pix?” / “endereço” / “horário de funcionamento” | FAQ operacional, não serviço |
| 4501 (hoje) | “arrumar **pezinho** do cabelo” | Coloquial; Tess **timeout** |
| 4749 | “horário na sexta final do dia” / “é masculino” | Dia-parte + gênero, SKU implícito |

Penteado coloquial (item 1b) aparece pouco nesta semana (`penteado` 6, `tesoura` 2, `dia a dia` 1). O ofensor **mais frequente** agora é **encaixe + nome de profissional + palavras que não são SKU**.

### Entregáveis da Onda 1 (DoD)

1. CLI (LibForge / `scripts/salao`) que dumpa a janela em **last4 + role + agent + intent + texto**, sem E.164 no artefato.
2. Catálogo versionado: termo do cliente → intenção (serviço / prof / tempo / FAQ / pagamento / ruído) → SKU ou slot ou handoff.
3. Ranking de serviços **pedidos na fala** vs SKUs Trinks (matriz, não chute).
4. Ranking de **dificuldade**: timeout, guard.blocked, handoff, 2-phase, “já tem cliente”, duração.
5. Inventário honesto do buraco **recepção outbound** (Kapso ou export manual do WhatsApp Business) — sem inventar que o Postgres tem a fala da recepção.
6. Gate Quinn no catálogo (cobertura, last4-only, sem prompt paste).

**Squad:** `tess-floor-lexicon` (Craft). Personas: corpus-miner, floor-lexicographer, Mira (floor-quality, leitura de fio).  
**Não** chama Dex de produto nesta onda, salvo o CLI de extração.

---

## Onda 2 — triagem recalibrada (só depois do catálogo)

Objetivo: a Tess **ler** como o cliente desta semana fala, e **carregar menos lixo** no contexto.

### Fase A — dentes de código (prioridade)

| Corte | Dono | O que muda |
|---|---|---|
| Tabela de sinónimos da Onda 1 no `filterServicesByKeywords` / intent | @architect → @dev | `tintura`, `gloss`, `pezinho`, `maquiadora`, `mão tradicional`, funil “vim pelo Studio Tirra” |
| Classificador: SCHEDULING sem SKU ≠ UNCERTAIN dump | @architect | já é MIN; Onda 2 decide **qual bloco** (só prof? só 1 dia?) |
| O que **não** entra no contexto quando a fala é só encaixe | @architect | reforça P-BUDGET; não aumenta FULL |
| Métrica: msgs até fechar objetivo (proxy: turnos user até `booking.created` / handoff / silêncio) | @data-engineer | não promete 13,5 cr |

### Fase B — linguagem da Tess (prompt)

Só com catálogo da Onda 1 + `@prompt-briefer` / prompt-engineering-squad. **Gate Victor** na aprovação. **Não** cola 46589 nesta sessão.

### Fora da Onda 2

Split 46589, funil CRM, desligar Thinking, replay André 10:30, flip `BOT_ACCEPT_ALL`, religar o bot sem ACK explícito.

---

## Relato da sessão 3048c959 (contexto do off)

Bot **desligado** no painel (`bot_toggles.global=false`, 04/09 11:33 BRT). Health ainda diz OPEN (`BOT_ACCEPT_ALL=true`) — o kill switch **vence**. Zero `assistant` após o off. 24 fios com Tess no dia 04/09; 7 números de prioridade para a recepção (PIX, bookings, timeout pezinho, erro técnico).

---

## Próximo rito

Victor ACK 04/09 ~12:50 BRT: **commit/publish Fase A**. Sem export `94831`. **Não religar.**

1. Gage publica backend (archive só `backend/`). Kill switch permanece off.
2. Fase B aberta em briefing: `docs/analysis/2026-09-04-orion-onda2-fase-b-kickoff.md` — linguagem 46589, **sem cola** até gate no diff.
