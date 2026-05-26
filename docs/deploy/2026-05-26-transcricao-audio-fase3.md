# Deploy Fase 3: Transcrição de áudio via TESS

**Data:** 2026-05-26
**Escopo:** detecção de áudio + mensagem ponte + transcrição via agente TESS + instrução I.9 no prompt Conversa para resumo+confirmação

## Arquitetura

```
Cliente manda áudio no WhatsApp
       ↓
Kapso webhook → backend detecta type=audio + audio.id
       ↓
Backend envia "Recebi seu áudio! Vou escutar 🎧" imediato
       ↓
backend/transcription.js:
  1. Download bytes do áudio via Kapso media endpoint (proxy Meta)
  2. POST /files na TESS (multipart, file=audio.ogg) → file_id
  3. POST /agents/{TESS_TRANSCRIPTION_AGENT_ID}/execute com file_ids=[N] → texto
       ↓
Backend injeta no messageText como "[AUDIO TRANSCRITO]: <texto>"
       ↓
processMessage normal → Conversa responde com resumo + confirmação (instrução I.9)
```

## Pré-requisito CRÍTICO — agente TESS de transcrição

**O agente ainda NÃO existe.** Sem ele, áudio é detectado mas bot manda "Pode mandar por texto?".

### Victor cria o agente assim:

1. Painel TESS → criar novo agente
2. Tipo: Transcrição (Transcription Generator) — usar o melhor modelo PT-BR disponível (testar AssemblyAI, Whisper, Deepgram disponíveis na TESS)
3. Prompt do agente (sugestão):
   ```
   Você é o agente de transcrição do Studio Tirra (salão de beleza premium em São Caetano do Sul/SP).

   Sua única tarefa: transcrever audio em português brasileiro retornando APENAS o texto, sem prefácios tipo "Aqui está a transcrição" nem comentários.

   Contexto: o cliente está falando com a recepção do salão sobre agendamentos, serviços (corte, mechas, visagismo, manicure, etc.) e profissionais (Tiago, André, Erick, Eli, Fefe, Maluzinha, Jackie, Giovanna).

   Use esse contexto pra desambiguar nomes próprios e termos técnicos (mechas, californianas, progressiva, etc.).

   Saída: texto puro transcrito, nada mais.
   ```
4. Salvar e pegar o agent ID
5. SSH no VPS: `nano /opt/influence-labs/infra/.env`
6. Adicionar linha: `TESS_TRANSCRIPTION_AGENT_ID=<id_do_agente>`
7. `docker compose up -d --build backend`

## Pré-requisito de prompt — Conversa v2

Atualizar agente 46589 no painel TESS — adicionar **nova instrução I.9** (entre I.8 e S — STYLE):

Conteúdo em `docs/prompts/tess-conversa-v2.md` linhas 124-156 (procurar `### I.9 — Mensagens vindas de áudio transcrito`).

Resumo da regra:
- Quando mensagem do cliente vier com prefixo `[AUDIO TRANSCRITO]: ...`
- Primeira resposta é resumo do que entendeu + pergunta de confirmação
- NÃO emite tag de booking sem antes confirmar

## Variáveis novas no .env do VPS

```
TESS_TRANSCRIPTION_AGENT_ID=<id_apos_criar_agente>
```

`docker-compose.yml` atualizado pra declarar essa env (`infra/docker-compose.yml`).

## Comportamento esperado (após criar agente)

### Cliente manda áudio "oi quero agendar corte com tiago sábado às 10h"

1. Bot: "Recebi seu áudio! Vou escutar 🎧"
2. (3-8s de processamento de transcrição)
3. Bot: "Deixa eu confirmar o que entendi: corte com o Tiago, sábado de manhã, certo? Se entendi errado me corrige! 😊"
4. Cliente: "isso"
5. Bot: continua fluxo normal de agendamento

### Cliente manda áudio mas TESS_TRANSCRIPTION_AGENT_ID ainda não configurado

1. Bot: "Recebi seu áudio! Vou escutar 🎧"
2. (tenta transcrever, falha com code='transcription_not_configured')
3. Bot: "Ainda não consigo escutar áudios por aqui 😅 Pode me mandar por texto?"

### Cliente manda áudio + texto no mesmo batch

1. Bot: "Recebi seu áudio! Vou escutar 🎧"
2. Após transcrição, messageText = texto_original + `\n[AUDIO TRANSCRITO]: <transcrição>`
3. Conversa trata como uma mensagem só, com resumo cobrindo ambos

## Riscos conhecidos / a testar com áudio real

1. **Endpoint Kapso pra download de mídia** — usei o padrão Meta-proxy `/meta/whatsapp/{ver}/{media_id}` baseado no padrão de envio. Pode precisar ajuste se Kapso usar outro caminho. Log de erro vai mostrar.

2. **Formato do execute do agente TESS de transcrição** — passei `file_ids=[N]` no body. Pode ser que o agente precise referência diferente (ex: file_id no texto da mensagem). Se a primeira transcrição real falhar com erro do TESS, ajustar `executeTranscriptionAgent` em `backend/transcription.js`.

3. **Latência** — pipeline completo (download + upload + execute) pode levar 5-15s. Mensagem ponte "Recebi seu áudio" cobre essa espera.

4. **Custo** — upload TESS + execute agente. Estimativa: ~R$ 0,10 por áudio. Aceitável.

## Deploy

```bash
ssh deploy@72.60.155.118
cd /opt/influence-labs/infra
git pull
# .env atualização opcional (TESS_TRANSCRIPTION_AGENT_ID só quando agente existir)
docker compose up -d --build backend
docker logs --tail 20 backend 2>&1 | grep -iE 'supervisor|tess|listen'
```

## Smoke test em produção

⚠️ Só dá pra testar áudio real via WhatsApp (não dá pra mockar com curl).

Você manda um áudio do seu número (0007) pra recepção do salão dizendo "oi tudo bem". Acompanha:

```bash
docker logs -f backend | grep -iE 'audio|transcricao|transcribe'
```

Esperado:
- `[audio] transcrito <media_id> (N bytes): "<texto>"`  → sucesso
- OU `[audio] transcricao falhou <media_id>: transcription_not_configured <msg>` → agente não criado
- OU outros erros indicam ajuste necessário no `transcription.js` (endpoint, formato)

## Rollback

```bash
cd /opt/influence-labs/infra
git checkout main  # ou commit anterior
docker compose up -d --build backend
```
