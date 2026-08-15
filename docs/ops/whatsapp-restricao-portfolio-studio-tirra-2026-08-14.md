# Caso WhatsApp — Studio Tirrá (14/08/2026, atualizado 15/08/2026)

Registro da restrição generalizada nas contas WhatsApp do portfólio/perfil Studio Tirrá. BM de anúncios segue normal e verificada. Só o WhatsApp daquele portfólio está bloqueado.

**Status 15/08/2026:** o maior bloqueio foi **contornado** (não revertido). O agente TESS 46589 está **ativo** no número novo `+55 11 95502-8331`, WABA Influence Labs. Atendimento real a clientes **ainda não** migrou — recepção humana continua no `+55 11 94831-9426`. Próxima sessão: `docs/handoffs/whatsapp-bm-influence-labs-ativo-2026-08-15.md`.

---

## 1. Versão para compartilhar (comunidade)

Pessoal, preciso de ajuda. Caso WhatsApp Cloud API / Business Manager.

Salão Studio Tirrá. BM verificada há meses, anúncios rodando normal. Só o WhatsApp da conta que morreu — e não é um número, não é BSP, não é app.

Histórico curto: tínhamos API em coexistência (Kapso). App WhatsApp Business do salão continua recebendo mensagem; a API parou de espelhar inbound por volta de 18/06/2026. Meta mostra “shared with a partner”, mas Partners = 0, botão cinza, reconnect #2655121. Kapso confirmou ghost partner depois do Embedded Signup. Case Meta 27264844826545686; Meta mandou pro fórum. Force detach não foi feito.

Foco atual **não** é recuperar o número antigo. Tentamos número novo:
- Instant/já verificado Kapso → falhou
- Vivo Voz Negócio (PABX) → verificação inviável
- Salvy (recebe o código) → mesmo erro via Kapso: `#1675030:019fe3c4-3108-782f-8a3a-7ba21177aa67` (“Erro ao realizar a consulta”)
- Kapso: “Sessions for the user are not allowed because the user is not a confirmed user”
- BM nova no perfil do admin: não puxa a Page do salão; Page nova restrita; não convida users; BM antiga (ads ok) não compartilha a Page
- 72h de cooldown, 2 PCs / IPs / admins → o mesmo #1675030

Hoje (14/08/2026) testamos **sem Kapso**. App antigo “Studio Tirra Bot” (`1491149262343240`): tipo Nenhum, WhatsApp nem aparece em Adicionar produto (só Webhooks). Criamos app novo “IA Atendimento” com caso de uso Conectar no WhatsApp. Layout novo ok. Na etapa 1 (Experimente), ao reivindicar o número de **teste da Meta**, a Qualidade da Conta (antes limpa) passou a mostrar:

- Test WhatsApp Business Account
- WhatsApp Account ID `1795368298430447`
- **Desabilitado Permanente** (14 ago 2026)
- “Desabilitamos Studio Tirrá e suas contas do WhatsApp Business por causa de atividades que não estão em conformidade com a Política Comercial do WhatsApp Business”
- Restrições: não recebe / não responde / não inicia conversa / **não pode ter números adicionados**

No Developers: “Você não pode continuar porque sua conta do WhatsApp Business está restrita… selecione outra conta ou Business Support Home”. Botão de pedir análise abre o Facebook com “Este conteúdo não está disponível no momento”.

**Conclusão:** restrição **generalizada** nas contas WhatsApp deste portfólio/perfil. Qualquer WABA nova aqui — inclusive sandbox da Meta — é desabilitada na hora e fica proibido adicionar número.

IDs úteis:
- Portfolio: `1927873100853482` (Studio Tirrá)
- WABA antiga: `1318541913020004`
- Phone Number ID antigo: `1016003164939443`
- Número antigo: +55 11 94831-9426
- WABA teste (hoje): `1795368298430447`

Alguém já viu WABA sandbox da Meta cair em Permanent Disable junto com “can’t have phone numbers added”, com BM de ads intacta? Caminho real de recurso quando o botão de análise 404?

---

## 2. Relatório intermediário (registro)

# Relatório intermediário — WhatsApp Business / Studio Tirrá
**Data:** 14/08/2026  
**Assunto:** restrição generalizada nas contas WhatsApp do portfólio/perfil Studio Tirrá  
**Uso:** registro interno e compartilhamento com quem for aprofundar o caso (suporte Meta, BSP, consultoria)

## 1. Conclusão (ler isto primeiro)

O problema **não é um número**, **não é a Kapso**, **não é a Salvy** e **não é o app no Developers**.

É uma **restrição generalizada nas contas WhatsApp** ligadas ao portfólio/perfil Studio Tirrá. Qualquer WhatsApp Business Account nova neste portfólio — inclusive a conta de teste/sandbox da própria Meta — é desabilitada de forma permanente e fica **proibido adicionar número**.

A Business Manager **funciona normalmente para anúncios** e está verificada há meses. Só o produto WhatsApp está morto.

O bot de agendamento do salão já está pronto; o que não liga é o canal WhatsApp.

## 2. O que está em jogo

Objetivo original: atendimento do salão Studio Tirrá via WhatsApp (API).

Foco **atual** não é recuperar o número antigo de recepção. O foco passou a ser entender por que **nenhuma** conta WhatsApp nova consegue nascer neste portfólio.

## 3. Linha do tempo

### Fase A — Número antigo + coexistência (até ~jun/2026)

- Número de recepção: **+55 11 94831-9426**
- WABA: `1318541913020004`
- Phone Number ID: `1016003164939443`
- Business Portfolio: `1927873100853482` (Studio Tirrá)
- BSP: Kapso, em coexistência
- O app WhatsApp Business do salão **continua recebendo** mensagens
- A API **parou de espelhar inbound** por volta de **18/06/2026**

Ghost partner:
- Meta diz que o número está “shared with a partner”
- Na prática: Partners = 0, botão cinza, reconnect **#2655121**
- Kapso confirmou ghost partner depois do Embedded Signup
- Case Meta: **27264844826545686**
- Meta encaminhou o caso ao fórum
- **Force detach não foi feito**

### Fase B — Tentativas de número novo (foco atual)

Não é mais “consertar o número antigo”. Tentamos número novo, várias origens:

| Tentativa | Resultado |
|---|---|
| Número Instant / já verificado na Kapso | Falhou |
| Vivo Voz Negócio (PABX) | Verificação inviável |
| Salvy (recebe o código de verificação) | Mesmo erro via Kapso |
| Cooldown de 72h + 2 PCs / IPs / admins | Mesmo erro |

Erro repetido (Kapso):  
`Erro ao realizar a consulta. (#1675030:019fe3c4-3108-782f-8a3a-7ba21177aa67)`

Mensagem da Kapso:  
“Sessions for the user are not allowed because the user is not a confirmed user”

Paralelo de Business Manager / Page:
- BM nova no perfil do Tiago: **não puxa** a Page do salão
- Page nova: **restrita**
- Não convida users
- BM antiga (anúncios ok): **não compartilha** a Page

### Fase C — Teste de 14/08/2026, sem Kapso

Objetivo: isolar se o bloqueio era da Kapso/Salvy ou da conta Meta.

O que foi feito:
1. App antigo **Studio Tirra Bot** (`1491149262343240`): tipo **Nenhum**. WhatsApp **não aparece** em Adicionar produto. Só Webhooks.
2. App novo **“IA Atendimento”**, caso de uso **Conectar no WhatsApp**. Layout novo ok.
3. Etapa 1 (Experimente): reivindicação do **número de teste da Meta**.

O que aconteceu na hora:
- Qualidade da Conta, que estava limpa, passou a mostrar:
  - Test WhatsApp Business Account
  - WhatsApp Account ID: `1795368298430447`
  - **Desabilitado Permanente** (14 ago 2026)
  - Texto da Meta: *“Desabilitamos Studio Tirrá e suas contas do WhatsApp Business por causa de atividades que não estão em conformidade com a Política Comercial do WhatsApp Business”*
  - Restrições: não pode receber, não pode responder, não pode iniciar conversas, **não pode ter números adicionados à conta**
- No Developers: *“Você não pode continuar porque sua conta do WhatsApp Business está restrita… selecione outra conta ou Business Support Home”*
- Botão Entrar em contato / pedir análise → Facebook: *“Este conteúdo não está disponível no momento”*

Isso fecha o diagnóstico: **sandbox da Meta, sem BSP, no mesmo portfólio = mesma desabilitação**.

## 4. O que funciona vs. o que está bloqueado

**Funciona**
- Business Manager do Studio Tirrá para **anúncios**
- BM verificada há meses
- App WhatsApp Business do salão ainda recebe mensagem no número antigo (coexistência no aparelho)

**Bloqueado**
- Qualquer WABA nova neste portfólio/perfil (produção ou teste da Meta)
- Adicionar número a essas contas WhatsApp
- Embedded Signup / consulta de número via Kapso (`#1675030`)
- Sessão do usuário na Kapso (“not a confirmed user”)
- Produto WhatsApp no app antigo (nem aparece para adicionar)
- Fluxo “Experimente” no app novo, depois da restrição
- Pedido de análise pelo botão oficial (página do Facebook indisponível)

## 5. O que isso **não** é

Não tratar como:
- falha de um número específico
- bug da Kapso
- limite da Salvy
- problema do app Developers
- cooldown de 72h ainda “não cumprido”
- Page/BM de anúncios “quebrada” (não está)

O padrão observado: **toda conta WhatsApp que nasce neste portfólio/perfil é desabilitada e perde o direito de ter número**.

## 6. O que **não** fazer agora

Não gastar mais ciclo em:
1. Tentar de novo o número antigo (não é o foco; force detach não foi feito e não resolve o quadro atual).
2. Comprar/verificar outro número (Kapso Instant, Salvy, Vivo PABX ou qualquer outro) neste mesmo portfólio.
3. Criar mais app / mais WABA / mais sandbox neste perfil para “testar se agora vai”.
4. Esperar outro cooldown de 72h — já foi feito, com 2 PCs, IPs e admins; o erro não mudou.
5. Abrir BM nova no mesmo perfil esperando puxar a Page do salão — já falhou (Page nova restrita; BM antiga não compartilha a Page).

Cada tentativa nova neste portfólio tende a **gerar outra WABA já morta**, não a destravar o canal.

## 7. Próximo passo = recurso

Único caminho útil agora: **recurso / análise da restrição WhatsApp na Meta**, não mais tentativa técnica de número, BSP ou app.

Ponto de atenção: o botão oficial de pedir análise está quebrado (Facebook “conteúdo não disponível”). O recurso precisa entrar por outro canal de Business Support / fórum, levando este relatório e os IDs abaixo.

Pedido objetivo para a Meta:
- Reverter a desabilitação permanente das contas WhatsApp do Studio Tirrá
- Remover a restrição **can’t have phone numbers added**
- Esclarecer se a restrição está no portfólio `1927873100853482`, no perfil/Page, ou em todas as WABAs do negócio
- Diferenciar: BM de ads está saudável; só WhatsApp está restrito

## 8. IDs e erros para copiar no recurso

- Business Portfolio: `1927873100853482` (Studio Tirrá)
- WABA antiga: `1318541913020004`
- Phone Number ID antigo: `1016003164939443`
- Número antigo: +55 11 94831-9426
- App antigo: Studio Tirra Bot `1491149262343240`
- WABA de teste (14/08/2026): `1795368298430447` — Desabilitado Permanente
- Reconnect ghost partner: `#2655121`
- Case Meta: `27264844826545686`
- Erro Kapso: `#1675030:019fe3c4-3108-782f-8a3a-7ba21177aa67`
- Kapso: “Sessions for the user are not allowed because the user is not a confirmed user”

---

**Confiança (14/08):** alta nos fatos acima (todos do contexto confirmado desta data). Não inclui causa da política citada pela Meta — isso a Meta não detalhou.

Fonte: sessão de diagnóstico 14/08/2026 (Developers + Qualidade da Conta).

---

## 9. Atualização 15/08/2026 — canal religado fora do portfólio preso

O diagnóstico da seção 1–8 **permanece**. O que mudou: o agente foi religado em **outra identidade Meta**, sem tocar no portfólio `1927873100853482`.

### 9.1 O que foi feito

1. BM **Influence Labs** (`394791787726671`), perfil Victor, verificação de empresa **aprovada**.
2. Page usada: **Influence Labs** (`188248578771184`) — página já existente. Page nova **não** foi criada. Page do Studio Tirrá **não** foi puxada.
3. Kapso Embedded Signup nessa BM → WABA nova **Influence Labs** `1342161271401600`. Qualidade da Conta: sem problemas (tabela vazia). Sem *Desabilitado Permanente*.
4. Número **Salvy** `+55 11 95502-8331` **Connected** (conexão Dedicated, Kapso managed). Display name ainda em análise → *minor limitations* / tier baixo até a Meta aprovar o nome.
5. Billing: **Kapso credits** (recomendado; não trocar depois).
6. VPS: `KAPSO_PHONE_NUMBER_ID=1197799596760252` + `KAPSO_WEBHOOK_SECRET` do webhook novo. Backend recriado; nginx reiniciado.
7. Webhook: `https://api.studiotirra.com.br/webhook/kapso`, evento **somente** `whatsapp.message.received`.
8. Smoke: `5511964540007` mandou “Oi” → HMAC ok → TESS **46589** respondeu em ~7s → `send → 200` (2 bolhas). Victor confirmou recebimento no WhatsApp.

Isso **prova** que o `#1675030` e a morte das WABAs novas eram do **portfólio Studio Tirrá**, não da Kapso, da Salvy nem do perfil Victor.

### 9.2 IDs novos (copiar)

| Item | Valor |
|---|---|
| BM destino | `394791787726671` Influence Labs |
| WABA nova | `1342161271401600` Influence Labs — Approved |
| Número bot (Salvy) | `+55 11 95502-8331` |
| Phone Number ID | `1197799596760252` |
| Page no signup | `188248578771184` Influence Labs |
| WhatsApp pessoal Victor (não misturar) | `329335672535990` (app Business, Aprovada) |
| Kapso partner na BM (0 ativos à mão) | `554944420326412` |
| Kapso config ID | `b70b8311-8232-41c8-a526-617b1b17b52f` |
| Webhook | `https://api.studiotirra.com.br/webhook/kapso` |
| Recepção humana (app, inalterada) | `+55 11 94831-9426` |

### 9.3 O que NÃO mudou / NÃO fazer ainda

- Portfólio `1927873100853482` continua **morto para WhatsApp**. Não criar WABA, não reivindicar teste da Meta, não cadastrar Salvy/Instant lá.
- Número antigo `94831-9426`: ghost partner + reconnect `#2655121` **intactos**. App do salão continua recebendo. **Não** excluir a conta no app.
- **Não** transicionar atendimento real de clientes para o `95502-8331` até o Tiago validar testes e a Victor conferir se o tempo parado exige ajuste de prompt/KB/fluxo.
- Chatwoot **não** é necessário neste caminho: humano no número da API = **Inbox Kapso**.
- Branch `feature/bot-46589-ajustes-resposta` **não** foi misturada nesta frente.

### 9.4 Operação atual (dual, piloto fechado)

| Número | Função |
|---|---|
| `+55 11 94831-9426` | Recepção humana no WhatsApp Business App (clientes, como hoje) |
| `+55 11 95502-8331` | Bot TESS 46589 + Inbox Kapso. Whitelist: `5511937750330`, `5511964540007`, `5511964542495`. `BOT_ACCEPT_ALL=false` |

### 9.5 Pendências

1. **Identidade do contato** (amanhã com o Tiago): display name pendente, foto, @username, “Influence Labs” vs “Studio Tirrá” no chip do WhatsApp. Ver handoff § identidade.
2. Testes do Tiago no `0330` e revisão do que ficou parado (prompt, KB, Trinks, horários).
3. Templates na WABA nova: lista vazia — sem eles a IA não inicia conversa (422 / 24h).
4. Só depois: divulgação do número novo **ou** tentativa de mover o `94831` para a WABA viva (ainda bloqueado pelo ghost partner).
5. Recurso do portfólio preso (botão oficial 404) — paralelo, não bloqueia o bot.

Tentativa de avisar o Tiago (`5511937750330`) pelo número novo: Meta **422** (fora da janela 24h; WABA sem templates). Ele precisa mandar um texto para `95502-8331` ou a Victor encaminha o resumo.

Fonte: sessão 15/08/2026 (BM Influence Labs + Kapso Embedded Signup + smoke VPS).
