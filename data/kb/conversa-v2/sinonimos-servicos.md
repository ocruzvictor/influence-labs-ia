# Sinônimos de Serviços — Studio Tirra

**Versão:** v1.2 (2026-09-04 — chão 4: pezinho ≠ pedicure)
**Como o LLM usa:** quando o cliente menciona um termo coloquial ou abreviado, use este dicionário para mapear ao serviço oficial em `fichas-tecnicas-servicos.md` antes de oferecer slot ou preço. Em caso de ambiguidade (ex: "pé" pode ser pedicure ou depilação), pergunte ao cliente qual ele quer. **Exceção obrigatória:** "pezinho" / "pezinho do cabelo" / contorno orelha-pescoço **≠** pedicure e **≠** Cabelo e Barba — é acabamento de corte; não remapeie por "pé".

---

## Cabelos e barba

| Termo do cliente | Serviço oficial (fichas-tecnicas-servicos.md) |
|------------------|-----------------------------------------------|
| cortar / corte / aparar | Corte Masculino · Corte Feminino · Corte Infantil (perguntar quem é) |
| cortar a barba / fazer a barba / aparar a barba / barbear | Barba |
| corte e barba / completo / combo | Cabelo e Barba |
| cabelo + barba / tudo | Cabelo e Barba |
| pezinho / pezinho do cabelo / contorno orelha-pescoço / acabamento do corte | Acabamento de corte — **NÃO** pedicure, **NÃO** Cabelo e Barba. Se snapshot não tiver SKU isolado → `[HANDOFF_HUMAN motivo=orcamento_referencia]` |
| pintar / pintar o cabelo / tintura | Coloração · Retoque de Coloração (perguntar se é só raiz ou completo) |
| camuflagem / camuflar os brancos / pintar só os brancos / cobrir branco / gloss (marca) | Camuflagem de fios brancos — ver regras-comerciais.md. NÃO é SKU Gloss. Mapear ao SKU de coloração do snapshot (Coloração / Tonalização, Retoque de Raiz ou Coloração Global) depois de esclarecer se é só raiz. Tonalizante nos brancos = UM serviço, não combo. |
| platinar / ficar loira / clarear muito | Mechas (FLUXO CONSULTIVO — não dar preço direto) |
| mechas / luzes / californianas / balayage | Mechas (FLUXO CONSULTIVO) |
| ficar liso / alisar / chapar | Progressiva · Cauterização · Botox Capilar (perguntar qual técnica) |
| tratamento / hidratar / hidratação | Hidratação · Cauterização · Botox Capilar (dúvida → faq-servicos.md) |
| escova / fazer escova | Escova (preço **a partir de** o snapshot; sem foto, sem teste) |
| pranchar / chapinha | Escova Modelada · Escova Progressiva |
| penteado / coque / penteado de festa / penteado de noiva | Penteado (FLUXO CONSULTIVO — foto de referência + handoff; não desambiguar preso vs semi preso; profissional = Gi) |
| maquiagem / make / make-up | Maquiagem (FLUXO CONSULTIVO — foto de referência + handoff; profissional = Fefe) |

## Unhas

| Termo do cliente | Serviço oficial |
|------------------|-----------------|
| pé / pés / fazer o pé / cuidar do pé | Pedicure (default) — se cliente for homem, sugerir Pedicure Masculina |
| mão / mãos / fazer a mão / cuidar da mão | Manicure (default) — se homem, Manicure Masculina |
| pé e mão / mão e pé | Manicure e Pedicure (combo) |
| esmaltar / esmalte | Manicure (já inclui esmalte) — se cliente menciona "só esmalte", confirmar |
| alongamento / unha grande / alongar a unha / alongamento de unha | Alongamento (consultar profissional habilitado) |
| limpeza de unha / lixar | Manicure (já inclui) |

## Sobrancelha, cílios e rosto

| Termo do cliente | Serviço oficial |
|------------------|-----------------|
| sobrancelha / sobrolho / fazer a sobrancelha | Design de Sobrancelha (default) — se cliente quer cor: Tintura de Sobrancelhas (Henna ou Coloração); navalha → Sobrancelha na Navalha |
| sobrancelha com henna / henna na sobrancelha | Tintura de Sobrancelhas (Henna) |
| pintar a sobrancelha | Tintura de Sobrancelhas (Coloração) |
| micropigmentação / nanopigmentação / sobrancelha permanente | Nanopigmentação de Sobrancelha |
| cílios / fazer o cílio / alongar cílio | Lash Lifting (default) — se cliente menciona "tintura", "pintar": Tintura de Cílios; se "volume": Volume de Cílios |
| extensão de cílio / cílio postiço | Volume de Cílios · Cílio Fio a Fio (consultar profissional) |
| lash lifting / curvatura | Lash Lifting |
| limpeza de pele / facial | Limpeza de Pele · Skin Care (faq-servicos.md) |

## Depilação

| Termo do cliente | Serviço oficial |
|------------------|-----------------|
| laser / depilação a laser / luz / definitivo / pacote / sessão | Depilação em 1 área (perguntar 1, 3 ou corpo todo) |
| avulsa (no contexto laser) | Depilação em 1 área |
| depilar o nariz | Depilação de Nariz |
| depilar a orelha | Depilação de Orelha |
| depilar nariz e orelha / fazer o rosto | Depilação Orelha + Nariz |
| depilar o pé / pelo no pé / pelo do pé | Depilação de Pé |
| tirar o pelo / tirar pelos | Depilação (perguntar área: nariz, orelha, pé, etc.) |

## Estética

| Termo do cliente | Serviço oficial |
|------------------|-----------------|
| spa / relaxar o pé / pé cansado | SPA dos Pés · Escalda Pés (perguntar duração / preferência) |
| escalda-pés / escalda pé | Escalda Pés |

## Mudança de visual

| Termo do cliente | Serviço oficial |
|------------------|-----------------|
| mudar o visual / cara nova / não sei o que fazer no cabelo | Visagismo (FLUXO CONSULTIVO — não dar preço direto; perguntar "o que te fez buscar?") |
| renovar / repaginar | Visagismo (FLUXO CONSULTIVO) |
| consultoria de imagem | Visagismo |

---

## Regras de uso (importante)

1. **Em caso de ambiguidade**, pergunte ao cliente — nunca chute. Ex: "Quando você diz 'fazer o pé', você quer dizer pedicure ou depilação?" **"Pezinho" / "pezinho do cabelo" / contorno orelha-pescoço** = acabamento de corte — **NUNCA** pedicure, **NUNCA** Cabelo e Barba; não passar por regra de "pé"→unha.
2. **Termos com fluxo consultivo** (mechas, visagismo, penteado, maquiagem) — aplicar `regras-comerciais.md`. Penteado/maquiagem: pode citar “a partir de” o snapshot; **não** agendar. Mechas: Teste de Mechas, sem preço fechado.
3. **Termos masculinizados** — se contexto / nome do cliente indica masculino e existe variante "Masculina" do serviço (ex: Pedicure Masculina, Manicure Masculina), sugerir a variante.
4. **Termo do cliente não está na lista** — tentar inferir pelo contexto; se não tiver certeza, escalonar com `[HANDOFF_HUMAN motivo=servico_nao_mapeado]` ou perguntar.
5. **Após mapear**, sempre confirmar com o cliente: "Entendi que você quer [serviço oficial]. Confere?" — especialmente quando o cliente usou termo coloquial ou ambíguo.

---

*KB Studio Tirra v3 — sinonimos-servicos.md v1.0. Criado em resposta ao feedback F2 (Tiago, 2026-05-26): "cliente disse 'pé' e o agente não entendeu como pedicure". Consultar junto com `fichas-tecnicas-servicos.md` para preços/durações exatos.*
