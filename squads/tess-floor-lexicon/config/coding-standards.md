# Coding standards — tess-floor-lexicon

Estende o core. Extra:

- **last4 only** — E.164 permitido só em query SQL interna; nunca em artefato, chat, canvas ou commit message.
- **Sem paste 46589** — catálogo e handoff referenciam `docs/prompts/`, não colam conteúdo live.
- **Sem Trinks mutação** — SELECT/read-only; POST/PATCH/PUT é Onda 2+ com gate separado.
- **Kill switch off** — não sugerir religar bot nos artefatos Onda 1.
- **CLI first** — preferir `scripts/salao` / LibForge antes de SQL ad-hoc.
- **Dedup** — falas únicas = last4 + texto normalizado (NFD, lower).
- **Evidência** — todo termo no catálogo cita last4 + trecho literal.
- **Versionamento** — catálogo com semver no filename (`floor-lexicon-catalog-v0.1.0.md`).
- Persona + modelo: nunca Task com modelo puro sem carregar `agents/*.md`.
