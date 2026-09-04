# Tech stack — tess-floor-lexicon

- **Canal:** WhatsApp Studio Tirra (+55 11 97504-0517), TESS agente 46589
- **Dados:** Postgres `influence_labs_salon` — tabela `conversation_history`, `bot_thread_state`, `bot_operational_events`
- **Keywords ref:** `backend/lib/booking-parser.js` → `FILTER_SERVICE_KEYWORDS`, `filterServicesByKeywords`
- **Intent ref:** `backend/lib/tess-context-intent.js` (leitura only na Onda 1)
- **CLI:** LibForge / `scripts/salao` (Dex publica dump quando pronto)
- **LLM squad:** Grok 4.6 High (catálogo/leitura), Composer 2.5 Fast (extração/contagens)
- **Dependência squads:** `tess-nightwatch` (Mira/floor-quality, Quinn gate), `lib-forge` (CLI patterns)

Estado operacional (04/09/2026): `bot_toggles.global=false` — kill switch vence `BOT_ACCEPT_ALL`.
