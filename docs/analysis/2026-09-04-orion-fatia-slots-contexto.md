# Fatia — horário errado + contexto do pedido (2026-09-04)

Victor: time sentiu melhora desde o OPEN ~17h de 03/set; a dor que resta é **oferecer horário que não existe** e **não ler o pedido no contexto**. Fatura de crédito continua no radar. Melhorar o que o smoke `0007` (Fefe 12h30) mostrou que 1+2 desta manhã não fecharam.

Não é story formal. Sem paste de prompt 46589. Sem split do agente. Sem deploy até ACK. last4 only.

## O que o 17h de ontem era

Publish `b42bb2b` (~16:55 BRT 03/set): `scoped` + skip trivial + outbox. **Não** tinha `durationMin` ligado nem `UNCERTAIN→MIN`. Isso só subiu hoje de manhã (`a08f23b`). Avaliar 0285 / 9800 / 3653 contra o binário da noite, não contra o filtro de duração de hoje.

## Prova (last4)

| last4 | O que o time descreveu | O que o banco mostra | Ofensor |
|---|---|---|---|
| `0285` | (citado com “pentado”) | Depois das 17h: corte com André, oferta **11h30**, confirmação, guard **janela** (“não cabe”). Ping-pong clássico PARK-SLOTS. Sem a palavra penteado neste fio. | Item 1 ainda **desligado** naquela hora |
| `3653` | pentado + corte + Instagram | Único fio pós-OPEN com pentado+vídeo+insta. “Penteado para o dia a dia” → SKU Penteado/Gi; depois “vídeo de rapaz que faz o corte na tesoura / Pelo insta” → Tess pergunta se é **além** do penteado. | Filtro de catálogo trava no lexema `penteado`; não lê “dia a dia” / tesoura |
| `9800` | “essa profissional não faz esse serviço” mas a cliente faz sempre | Tess ofereceu Giovanna 16h30 p/ Design de Sobrancelha e no commit: **“Giovanna não realiza Design de Sobrancelha”**. Matriz `trinks_service_professionals`: Giovanna só em **Descoloração**. Agenda local: **129** agendamentos Giovanna+Design (53 nos últimos 90d, até out/26). Telefone desta cliente **não** está nos agendamentos antigos — olhar “histórico desta cliente” no Postgres não bastava; a par **existe no salão**. | Guard `isCompatible` só lê a matriz, ignora a agenda real |
| `0007` hoje | Fefe 12h30 na ausência 11–13h | `snapshot.stale age_min=935`. Worker de slots: último ciclo **03/set 18:10 BRT**, intervalo 24h. Aviso do item 2 disparou; **refresh só se a data tiver >24h**. 12h30 ainda `available` na snapshot. `durationMin=0` porque histórico tinha “corte” + fala “maquiagem” → 11 SKUs (>3). | Item 2 avisa e não relê; item 1 se desliga com catálogo gordo |

## Corte desta fatia (código local)

| # | Corte | Fora |
|---|---|---|
| **1b** | Catálogo / `durationMin` pela **última fala**. Sem keyword nela, cai no histórico. “Penteado” + dia a dia / tesoura / insta / corte → inclui SKU de corte + linha DISAMBIGUA. Não assume SKU Penteado da Gi. | Mudar prompt 46589 |
| **2b** | Relê grade de **hoje + data pedida** se a snapshot daquela data tem ≥ **45 min** (mesmo limiar do aviso). Inclui hoje nas datas de oferta quando o cliente pediu outro dia — alternativa real, não invenção. Máx. 2 GET Trinks/turno quando está velho. | Relê 10 dias; mudar `TRINKS_RECONCILE_INTERVAL_MIN` no VPS sem ACK |
| **9800** | `isCompatible` verdadeiro se a matriz **ou** agenda local (90d, scheduled/confirmed) tem a par serviço×profissional. `getServicesText` une os nomes observados na agenda à habilitação. | CRM / nota / funil; POST Trinks “para testar” |
| **7** | **Ainda fora do código desta wave.** Teto duro por perfil = Architect (PV-P0-2). Esta fatia **não** crava 13,5 cr: o piso medido no 0007 já é ~17–21 mesmo em MIN. O 7 corta a cauda de 54k, não o piso. | Inventar teto e publicar |

Rollback: revert assembler 1b/2b; `isCompatible` volta a ser só matriz.

## Crédito

Não é o eixo desta fatia. Item 6 (MIN) já está no ar. 1b pode **reduzir** chars (catálogo menor). 2b pode **gastar** 1–2 GET Trinks e +1 dia compacto. Neto na fatura Tess: pequeno. Quem mexe na fatura de verdade continua sendo o 7.

## Rito

`@dev` local + testes → `@qa` gate → ACK Victor → `@devops` allowlist. Sem Hostinger. Sem rsync. Sem smoke André 10:30. Smoke humano: `0007` Fefe (não oferecer 12h30) + não replay 9800 CREATE.
