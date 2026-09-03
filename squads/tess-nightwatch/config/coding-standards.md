# Coding standards — tess-nightwatch

Estende o core. Extra:

- Não inventar bookingId, preço ou slot.
- Todo caminho de tag BOOKING_* emite evento operacional.
- PII: last4 no log do squad; E.164 só em query, não em canvas/chat público.
- Persona + modelo: nunca Task com modelo puro sem carregar `agents/*.md`.
