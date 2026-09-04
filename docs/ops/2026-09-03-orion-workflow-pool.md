# Workflow — pool Victor até concluir

Orion orquestra. Não é `*qa-loop` de story formal; é a cadeia desta fatia.

```
W1 Quinn gate  →  W2 fixes (se FAIL / CONCERNS com dentes)
               →  W3 ACK Victor ("pode publicar")
               →  W4 Gage publish (allowlist, sem rsync, sem Hostinger)
               →  W5 verify live
```

| Passo | Owner | Stop |
|---|---|---|
| W1 | `@qa` Quinn | Anti-self-review: Orion implementou |
| W2 | Orion / `@dev` | Só o que o gate mandar. Sem voltar UNCERTAIN para FULL |
| W3 | Victor | Sem ACK não há W4 |
| W4 | `@devops` Gage | `AIOX_ACTIVE_AGENT=devops`. Só backend da fatia |
| W5 | Orion | Health + `scoped` + libs. Sem smoke `0007` |

| Passo | Estado | Evidência |
|---|---|---|
| W1 Quinn | **feito** | [Quinn](233e2dd3-398b-4492-a4dc-81a4d82a0668) CONCERNS **86** · `docs/qa/gates/2026-09-03-fatia-pool-victor.yml` |
| W2 fixes | **pulado** | Zero `blocks_publish`. QUAL-01 aceito (não reverter UNCERTAIN→FULL) |
| W3 ACK Victor | **agora** | Precisa “pode publicar” |
| W4 Gage | espera W3 | Plano: `docs/ops/2026-09-03-gage-publish-plan-fatia-pool.md` |
| W5 verify | espera W4 | Sem smoke `0007` |
