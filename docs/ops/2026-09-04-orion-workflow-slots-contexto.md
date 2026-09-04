# Workflow — fatia slots+contexto até concluir

Orion orquestra. Não é `*qa-loop` de story formal.

Victor 2026-09-04 ~10:49 BRT: “orquestra até concluir” + processo completo = **W3 ACK** desta fatia.

Motores (não substituem personas):
- Raciocínio / gate: Quinn / Architect → Grok 4.6 xHigh
- Execução / publish: Gage → Composer 2.5 Fast

```
W1 Quinn gate  →  W2 fixes (só se FAIL / blocks_publish)
               →  W3 ACK Victor (esta sessão)
               →  W4 Gage publish (allowlist, sem rsync, sem Hostinger)
               →  W5 verify live
```

| Passo | Owner | Stop |
|---|---|---|
| W1 | `@qa` Quinn (Grok 4.6 xHigh) | Anti-self-review: Orion implementou |
| W2 | `@dev` Composer 2.5 Fast | Só o que o gate mandar |
| W3 | Victor | Feito nesta mensagem |
| W4 | `@devops` Gage (Composer 2.5 Fast) | `AIOX_ACTIVE_AGENT=devops`. Só allowlist |
| W5 | Orion | Health + libs no container. Sem smoke André 10:30 |

SOT: `docs/analysis/2026-09-04-orion-fatia-slots-contexto.md`
