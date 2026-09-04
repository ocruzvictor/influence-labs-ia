# Chão 11 — tetos oferta 60 min + pezinho curto

**Autor:** Aria (@architect) · Orion pre-fill pending Quinn  
**Data:** 2026-09-04  
**Story:** [salon-whatsapp-chao-11-oferta-60min-pezinho-curto.md](../stories/salon-whatsapp-chao-11-oferta-60min-pezinho-curto.md)  
**Smoke:** Victor partial #2/#8 pós `4356489`

## Veredito

**Ready-for-Dex: yes**

## D11.1 — durationMin com catálogo gordo

`resolveOfferDurationMin`: `narrowServicesForOfferDuration` via `filterServicesByKeywords` + gender. Se família narrowed mixed (60+120 corte), usar **min** para filtro de oferta.

## D11.2 — grain esparsa

`inferGrainMinutes`: ignorar diffs >60min ao inferir grain (Ausência entre slots). Evita 14:00 anotado 180min.

## D11.3 — prompt v3.2.5

Pezinho: resposta ≤2 frases. Sem “não é pedicure” default. Ex.14 curto.

## OUT

Reabrir chão 9. Hostinger. Worker 1440.
