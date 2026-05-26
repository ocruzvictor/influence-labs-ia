# Runbook: Ativação WhatsApp via Meta Cloud API (direto, sem intermediário)

**Quando usar:** Teste alternativo ao Kapso — conectar o número da recepção do Studio Tirra
diretamente na nuvem da Meta (WhatsApp Cloud API), sem BSP intermediário.
**Tempo estimado:** 60-90 min no salão (mais se houver restrição de conta a resolver).
**Branch:** `feature/meta-cloud-direct` (paralela a `main` — Kapso permanece intocado).
**VPS:** `deploy@72.60.155.118` | `/opt/influence-labs/infra`
**App Meta:** ID `1491149262343240` — [developers.facebook.com/apps](https://developers.facebook.com/apps)

---

## ⚠️ Leia antes de sair de casa — 3 avisos que mudam a decisão

1. **A migração para Cloud API desconecta o número do app WhatsApp Business.**
   Hoje o Gabriel atende o dia a dia pelo app. Depois da migração, o número vive 100% na
   API — o app WhatsApp Business **para de funcionar** para esse número. O atendimento
   humano passa a ser via Chatwoot (`chat.studiotirra.com.br`). Confirme com o Tiago que
   isso é aceitável para o teste. *(Procure no painel a opção "Coexistence" — se disponível,
   permite manter o app e a API juntos; caso contrário, vale a regra acima.)*

2. **O histórico de conversas do app não migra.** As conversas antigas ficam no celular,
   não aparecem na API. Oriente o Tiago a fazer backup antes.

3. **Se a restrição for em nível de Business Manager, o Cloud API bate no mesmo muro.**
   O Kapso foi escolhido justamente para contornar aprovação da Meta. Por isso o **Passo 0**
   abaixo é diagnóstico — fazê-lo primeiro pode economizar a viagem técnica.

4. **Esta migração não é um liga/desliga trivial.** Diferente do Kapso (QR code), uma vez
   que o número entra na Cloud API (a partir do Passo 2.5 — excluir a conta no app), voltar
   ao app WhatsApp Business envolve dias e suporte Meta. Victor **e** Tiago precisam estar
   de acordo antes de cruzar o Passo 2.5. É uma decisão com peso operacional.

---

## Parte A — Preparação técnica (feita por nós, ANTES da viagem)

> Esta parte precisa estar 100% concluída antes do Victor ir ao salão. O webhook GET
> tem que estar respondendo no ar, senão a Meta recusa a configuração no Passo 5.

### A1. Código — ✅ FEITO
- Branch `feature/meta-cloud-direct` criada a partir de `main`.
- Endpoint `GET/POST /webhook/meta` adicionado em `backend/server.js` (adaptador Meta,
  reusa o mesmo cérebro `processMessage()` — TESS + Trinks + memória).
- Variáveis `META_*` adicionadas ao `infra/docker-compose.yml`.

### A2. Deploy no VPS

```bash
ssh deploy@72.60.155.118
cd /opt/influence-labs/infra

# Backup do .env
cp .env .env.bak.$(date +%Y%m%d)

# Trazer a branch de teste
git fetch origin
git checkout feature/meta-cloud-direct
git pull origin feature/meta-cloud-direct

# Adicionar variáveis Meta ao .env (valores reais só no Passo 6 — por ora placeholders)
grep -q "META_VERIFY_TOKEN"   .env || echo "META_VERIFY_TOKEN=studio-tirra-verify-2026" >> .env
grep -q "META_ACCESS_TOKEN"   .env || echo "META_ACCESS_TOKEN=" >> .env
grep -q "META_PHONE_NUMBER_ID" .env || echo "META_PHONE_NUMBER_ID=" >> .env
grep -q "META_APP_SECRET"     .env || echo "META_APP_SECRET=" >> .env
grep -q "META_GRAPH_VERSION"  .env || echo "META_GRAPH_VERSION=v21.0" >> .env

# Build e subir o backend
docker compose up -d --build backend
docker compose ps backend
docker logs backend --tail=20
```

### A3. Teste do handshake (CRÍTICO — confirma que a Meta vai aceitar o webhook)

```bash
# De qualquer máquina:
curl -s "https://api.studiotirra.com.br/webhook/meta?hub.mode=subscribe&hub.verify_token=studio-tirra-verify-2026&hub.challenge=teste123"
# → Deve retornar exatamente: teste123

curl -s https://api.studiotirra.com.br/health | python3 -m json.tool
# → Bloco "meta" deve aparecer (verify_token: "set")
```

✅ **Pronto para a viagem quando:** o curl acima retorna `teste123` e `/health` responde 200.

---

## Parte B — No salão (Victor executa)

### Passo 0 — Diagnóstico de restrição (FAZER PRIMEIRO — 10 min)

Antes de mexer em qualquer app de developer, descobrir se há bloqueio:

1. Abrir [business.facebook.com](https://business.facebook.com) logado como o **Tiago**.
2. **Central de Qualidade da Conta** (Account Quality) — verificar se o BM ou alguma
   conta/ativo está restrito, em análise ou penalizado.
3. **Central de Segurança** (Security Center) — verificar verificação do negócio
   (Business Verification) e alertas pendentes.
4. Repetir a checagem no **perfil pessoal do Tiago** (facebook.com → Configurações →
   conta restrita?).

**Decisão:**
- 🟢 Sem restrições visíveis → seguir para o Passo 1.
- 🔴 Restrição encontrada → **pare a parte técnica.** Anote o texto exato do erro,
  abra o appeal/recurso ali mesmo. Tira foto da tela e me manda — isso explica meses
  de bloqueio e vira o caminho a resolver. A viagem técnica não vai vingar até liberar.

### Passo 1 — Acessar o app no Meta for Developers (5 min)

1. [developers.facebook.com/apps](https://developers.facebook.com/apps) logado como Tiago.
2. Abrir o app **ID `1491149262343240`**. Se não aparecer, o app pode estar em outra conta
   — confirmar qual login do Tiago tem acesso.
3. No menu lateral: **WhatsApp → API Setup** (ou "Configuração da API").

### Passo 2 — Adicionar o número real ao WhatsApp Business Account (15 min)

1. Na tela de API Setup há um **número de teste** da Meta — ignore, ele é só para sandbox.
2. Clicar em **"Add phone number"** / "Adicionar número de telefone".
3. Preencher: nome de exibição do negócio (ex: "Studio Tirra"), categoria, e o número
   da recepção.
4. A Meta vai pedir verificação por **SMS ou ligação** — daí a importância de estar no salão
   com o celular do número em mãos.

> ⚠️ **A Meta só registra o número se ele NÃO estiver ativo em nenhum app WhatsApp.**
> Ver Passo 2.5.

### Passo 2.5 — Liberar o número do app WhatsApp Business (no celular do salão)

O número hoje está no **app WhatsApp Business**. Para a Cloud API reivindicá-lo:

1. Fazer backup das conversas (Ajustes → Conversas → Backup) — para não perder histórico.
2. No app WhatsApp Business: **Ajustes → Conta → Excluir minha conta** (ou desinstalar
   após backup). Isso libera o número.
3. Voltar ao Passo 2 e concluir a verificação por OTP.

> Se a Meta acusar "número já em uso", é porque o app ainda não soltou — aguarde alguns
> minutos e tente o OTP de novo.

### Passo 3 — Coletar os IDs (2 min)

Após o número verificado, anotar na tela de API Setup:
- **Phone Number ID** → vai no `.env` como `META_PHONE_NUMBER_ID`
- **WhatsApp Business Account ID (WABA ID)** → usado para subscrever o webhook
- **App Secret** → no app: Configurações → Básico → "Mostrar". Vai no `.env` como `META_APP_SECRET`.
  ⚠️ **Rotacione o App Secret** ("Redefinir" no painel) como parte deste passo — o valor de
  mar/2026 esteve documentado fora do painel da Meta e deve ser tratado como comprometido.
  Nunca cole o valor real em arquivo versionado.

### Passo 4 — Gerar token de acesso permanente (10 min)

O token temporário da tela API Setup expira em 24h. Para produção, gerar token de
System User (não expira):

1. [business.facebook.com](https://business.facebook.com) → **Configurações do negócio →
   Usuários → Usuários do sistema**.
2. Criar (ou reaproveitar) um System User com função de Admin.
3. **Gerar novo token** → selecionar o app `1491149262343240` → marcar as permissões:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Copiar o token gerado → vai no `.env` como `META_ACCESS_TOKEN`.

> O token de mar/2026 do handoff provavelmente está morto ou inválido — **gere um novo,
> não tente reaproveitar.**

### Passo 5 — Configurar o webhook (5 min)

1. No app: **WhatsApp → Configuration → Webhook** → "Edit".
2. Preencher:
   - **Callback URL:** `https://api.studiotirra.com.br/webhook/meta`
   - **Verify token:** `studio-tirra-verify-2026`
3. Clicar **"Verify and Save"**. A Meta faz um GET no endpoint — como já testamos no A3,
   deve passar na hora. Se falhar, ver "Failure modes" no fim.
4. Em **Webhook fields**, clicar **Subscribe** no campo **`messages`**.

### Passo 6 — Atualizar o .env do VPS e reiniciar (5 min)

Com Phone Number ID, token e App Secret em mãos:

```bash
ssh deploy@72.60.155.118
cd /opt/influence-labs/infra
nano .env
# Preencher:
#   META_ACCESS_TOKEN=<token do Passo 4>
#   META_PHONE_NUMBER_ID=<id do Passo 3>
#   META_APP_SECRET=<app secret do Passo 3>
#   META_VERIFY_TOKEN=studio-tirra-verify-2026   (já deve estar)

docker compose up -d backend
docker logs backend --tail=20

# Confirmar que a Meta está configurada:
curl -s https://api.studiotirra.com.br/health | python3 -m json.tool
# → "meta": { "configured": true, "phone_number_id": "set", ... }
```

### Passo 7 — Teste smoke (10 min)

Enviar do seu celular pessoal para o número do Studio Tirra:

```
1. "oi"                    → aguardar resposta do TESS (10-30s na 1ª mensagem)
2. "quero agendar corte"   → TESS pergunta data/profissional
3. confirmar quando propuser → conferir no painel Trinks se criou o agendamento
```

Logs em tempo real:
```bash
docker logs backend -f --tail=50
# Esperado:
# [meta][5511...] message recebida: "oi"
# [meta] send → 200 para 5511...
```

---

## O que Victor precisa levar / ter acesso

- [ ] Login do **Facebook do Tiago** (que tem acesso ao BM e ao app `1491149262343240`)
- [ ] **Celular do número da recepção** em mãos (para receber o OTP de verificação)
- [ ] Senha do app WhatsApp Business / acesso ao celular para excluir a conta (Passo 2.5)
- [ ] Acesso SSH ao VPS (`ssh deploy@72.60.155.118`) — notebook
- [ ] Confirmação do Tiago: tudo bem o número sair do app WhatsApp Business?

---

## Rollback (se o teste falhar ou quiser voltar pro Kapso)

```bash
ssh deploy@72.60.155.118
cd /opt/influence-labs/infra
git checkout main
docker compose up -d --build backend
```

- O endpoint `/webhook/meta` simplesmente deixa de existir; o `/webhook/kapso` volta.
- ⚠️ **Atenção:** se o número já foi migrado para Cloud API, ele **não volta sozinho**
  para o app WhatsApp Business — seria preciso reinstalar o app e re-registrar o número
  (a Meta libera após desativar o número na API). Por isso o teste Meta é uma decisão
  com peso — não é um liga/desliga trivial como o Kapso.

---

## Failure modes — se travar

| Sintoma | Causa provável | Ação |
|---|---|---|
| "Verify and Save" falha no Passo 5 | Endpoint fora do ar ou verify token errado | Rodar de novo o curl do A3; conferir `docker logs backend` |
| "Número já em uso" no Passo 2 | App WhatsApp Business não soltou o número | Confirmar exclusão da conta (Passo 2.5), aguardar 5-10 min |
| Erro de verificação do negócio | Business Verification pendente/restrita | É a "restrição oculta" — resolver via Passo 0 / appeal |
| Conta de anúncio / política de privacidade | Bloqueio de compliance no BM | Mesmo muro de antes — pode exigir suporte Meta |
| Mensagem chega mas bot não responde | `META_ACCESS_TOKEN` inválido ou Phone Number ID errado | `docker logs backend` → procurar `[meta] send → 4xx` |
| Bot responde duplicado | Meta reenviou webhook | Já tratado por dedupe de message ID — se persistir, avisar |

---

## Variáveis de ambiente — referência

| Variável | Origem | Exemplo |
|---|---|---|
| `META_VERIFY_TOKEN` | Definido por nós | `studio-tirra-verify-2026` |
| `META_ACCESS_TOKEN` | Passo 4 (System User token) | `EAAV...` |
| `META_PHONE_NUMBER_ID` | Passo 3 (API Setup) | numérico |
| `META_APP_SECRET` | Passo 3 (App → Básico) | hex 32 chars |
| `META_GRAPH_VERSION` | Default | `v21.0` |
| `TESS_AGENT_ID` | Já configurado | `33200` |
| `TRINKS_ESTABELECIMENTO_ID` | Já configurado | `243868` |
