# Versionamento do prompt TESS 46589

O prompt do agente **não vive só no dashboard TESS**. Cada versão colada precisa existir neste repo para regressão.

| Arquivo | Papel |
|---|---|
| `tess-conversa-v3-clean.md` | **Vivo.** É o bloco que se cola no TESS. Primeira linha = versão. |
| `archive/tess-conversa-46589-v3.1.0-2026-08-18.md` | Snapshot congelado desta versão. |
| `archive/tess-conversa-46589-v3.0-2026-08-17.md` | Snapshot da versão anterior (commit `88dce88`). |
| `CHANGELOG-46589.md` | O que mudou entre versões. |
| `tess-conversa-v3.md` | Histórico v3.0.2 (PACER + `<break>`). **Não colar.** |

## Como colar
1. Abrir `tess-conversa-v3-clean.md`.
2. Copiar o arquivo **inteiro** (incluindo a linha `v3.1.0`).
3. Substituir o campo de instrução do agente 46589. Salvar.

## Como reverter
1. Abrir o snapshot em `archive/` da versão anterior.
2. Colar no TESS no lugar do atual.
3. Se o backend da versão nova for o problema, `git revert` o commit da fatia e redeploy da branch — não misturar prompt velho com guarda nova sem necessidade: o backend novo é compatível com o prompt velho (só fica mais permissivo no modelo).
