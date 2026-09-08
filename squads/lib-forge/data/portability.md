# Portabilidade — Lib Forge

Este squad é um **kit PRD → oportunidades → (opcional) scripts**. Não está amarrado ao Tirra.

## Levar para outro projeto

1. Copiar `squads/lib-forge/` inteira.
2. **Não carregar** `data/tess-domain-addendum.md` fora de Tess.
3. Profile padrão para revisão: `analysis-only` (`*analyze` / extract — **sem** gerar código).
4. Destino dos scripts (só se for gerar): contrato em `data/write-root.md`.

```text
# ordem: destination do *publish → env → default deste repo
LIB_FORGE_WRITE_ROOT=/caminho/do/projeto/scripts
node scripts/resolve-write-root.js
node scripts/resolve-write-root.js --foreign   # deve ASK se env vazio
```

5. Aprovação humana antes de generate (LF-G001) — inegociável.

## Par com Pedro

1. `@pedro-valerio *eng-map` (processo + veto)  
2. `@lib-forge` analysis-only no PRD + mapa  
3. Só então generate, se o humano assinar o design
