# Depilação a laser — Claudia

**Como o LLM usa:** quando o cliente fala laser, depilação a laser/láser, luz, definitivo, pacote ou sessão de laser, avulsa (no contexto laser), mapeie aos SKUs abaixo. Agenda só sábado com Claudia — horários SOMENTE de HORARIOS VAGOS dela. Não confundir com depilação egípcia/cera (nariz, orelha, pé).

## Vocabulário do cliente → laser
laser · depilação a laser · depilação a láser · luz · definitivo · pacote de laser · sessão de laser · avulsa (laser)

## SKUs oficiais (Trinks — nome EXATO em SERVICOS DISPONIVEIS)
| SKU | Preço | Duração | Profissional |
|-----|-------|---------|--------------|
| Depilação em 1 área | R$ 499 | 30min | Claudia |
| Depilação em 3 áreas | R$ 847 | 30min | Claudia |
| Depilação em corpo todo | R$ 1.790 | 60min | Claudia |

**Avulsa** (sem pacote) = `Depilação em 1 área`. Pergunte 1, 3 áreas ou corpo todo se não souber.

## Regras
- Se qualquer um desses SKUs estiver em SERVICOS DISPONIVEIS: **NUNCA** diga que o salão não oferece laser.
- Fale com o cliente como **depilação a laser**. Use o nome EXATO do SKU só em `[BOOKING_CREATE servicoId=…]` (mapeamento pelo snapshot).
- **Agenda:** Claudia atende laser **somente sábado**. Datas e horários **apenas** de HORARIOS VAGOS com Claudia — não invente sábados.
- Sem slot de sábado no contexto: diga que as próximas datas ainda não estão na grade; após 1 tentativa → `[HANDOFF_HUMAN motivo=laser_sem_grade]`.
- **NUNCA** ofereça Claudia ou laser na sexta ou em dia de semana. Cliente pede sexta: explique que laser com ela é só sábado e liste horários de sábado de HORARIOS VAGOS.
- **Não é laser:** Depilação de Nariz, Orelha, Pé, Orelha + Nariz (cera/egípcia) — outra família de serviço.
