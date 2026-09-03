# Deploy gate (backend Tess)

- [ ] Fatia de testes do file list PASS
- [ ] Sentinel `*run-quality-gate` PASS
- [ ] P0: Supervisor ACK no nightwatch-log
- [ ] rsync só `backend/` listado; sem `.env`
- [ ] `docker compose up -d --build backend` + restart nginx
- [ ] /health status=ok, trinks_ping=ok, tess agent_id=46589
- [ ] Prompt TESS: só Victor cola
