# Registro — chão 8 KB sync TESS (2026-09-04)

**Pedido:** Victor — `colei` v3.2.4 no 46589 → destrava sync 39496.  
**Owner:** Orion  
**Collection:** 39496  
**Script:** `backend/scripts/sync-kb-content-to-tess.cjs` (copiado ao container neste turno)

## Pré-sync

Victor colou prompt **v3.2.4** no dashboard 46589.  
KB local chão 8 (v1.3 sinonimos + FAQ §22 + regras cortesia + fichas gratuitos).  
VPS worktree **não** tinha hunks chão 8 — arquivos enviados do Mac.

Só 4 arquivos. padroes-fala / info-estatica / laser **não** enviados.

## PATCH

```
ok faq-servicos memory=163141
ok fichas-tecnicas-servicos memory=163142
ok regras-comerciais memory=163146
ok sinonimos-servicos memory=163147
done updated=4 skipped=0 failed=0
```

## Checagem pós-PATCH

Memories live: `cortesia no intervalo` presente; FAQ §22 presente; sinonimos com **NÃO** `[HANDOFF_HUMAN]`.

## Não feito

- Publish backend chão 8+9 (código ainda uncommitted vs `a9d5af8`)
- Religar kill switch / smoke `0007`
- Re-PATCH 163144 / 163145 (padroes/info)
