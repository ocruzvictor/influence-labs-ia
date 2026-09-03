# LLM routing — personas, not raw models

| Persona file | Quando | Product | Cursor Task `model` |
|---|---|---|---|
| agents/nightwatch-supervisor.md | patrulha, triage, rescue, activate | Grok 4.6 High | cursor-grok-4.6-medium |
| agents/patch-dev.md | patch, unit, rsync | Composer 2.5 Fast | composer-2.5-fast |
| agents/quality-sentinel.md | veredito I1/I2 | Grok 4.6 High | cursor-grok-4.6-medium |
| agents/quality-sentinel.md | npm test / SQL | Composer 2.5 Fast | composer-2.5-fast |
| agents/floor-quality.md | leitura do fio, scores, sugestão de regra | Grok 4.6 High | cursor-grok-4.6-medium |
| agents/floor-quality.md | SQL / logs da amostra | Composer 2.5 Fast | composer-2.5-fast |

Regra: o `prompt` do Task carrega o arquivo da persona. O slug só escolhe o motor. Proibido `subagent_type=generalPurpose` com “fix tess” sem persona.
