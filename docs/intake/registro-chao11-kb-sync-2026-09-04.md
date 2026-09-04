# Registro — chão 11 KB sync TESS (2026-09-04)

**Pedido:** Victor — `colei` v3.2.5 no 46589 → publish D11.1 + sync FAQ §22.  
**Owner:** Orion  
**Collection:** 39496  
**Script:** `backend/scripts/sync-kb-content-to-tess.cjs`

## Pré-sync

Victor colou prompt **v3.2.5** no dashboard 46589.  
KB local: FAQ §22 one-liner (D11.4). Demais arquivos **intocados**.

Só **1** arquivo: `faq-servicos.md`.

## PATCH

```
ok faq-servicos memory=163141
done updated=1 skipped=0 failed=0
```

## Checagem pós-PATCH

FAQ §22 live: *"Pode passar sem marcar, é de graça no intervalo."*  
Backend live: `8c9c90e` · backup `backend.bak.20260904165231`.  
Prompt dashboard: v3.2.5 (Victor colou).
