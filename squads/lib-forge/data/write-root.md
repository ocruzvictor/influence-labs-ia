# Write root — contrato (SOT)

Todo generate/publish resolve o destino **nesta ordem**. Não pule degrau.

1. Argumento `destination` do `*publish` (humano na hora)
2. Env `LIB_FORGE_WRITE_ROOT`
3. Default **só deste monorepo:** `../victor-libs/`
4. Projeto estrangeiro sem 1 e sem 2 → **ASK**. Não gravar.

Resolver: `scripts/resolve-write-root.js`  
Uso: `node scripts/resolve-write-root.js [destination] [--foreign]`

`analysis-only` não usa write root. LF-G001 continua na frente: sem design assinado, não publica.

`../victor-libs/` nos exemplos é o default **deste** repo, não lei em outro cliente.
