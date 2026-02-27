-- Query template para n8n
-- Parametros esperados:
--   {{DATA}}          -> data alvo (YYYY-MM-DD)
--   {{HORA_INICIO}}   -> hora inicio expediente (HH24:MI)
--   {{HORA_FIM}}      -> hora fim expediente (HH24:MI)
--   {{DURACAO}}       -> duracao em minutos
--   {{PROFISSIONAL}}  -> nome do profissional

WITH professional_schedule AS (
  SELECT generate_series(
    '{{DATA}}'::date + '{{HORA_INICIO}}'::time,
    '{{DATA}}'::date + '{{HORA_FIM}}'::time - ('{{DURACAO}} minutes')::interval,
    interval '30 minutes'
  ) AS slot_start
),
booked_slots AS (
  SELECT
    (date + time) AS booked_start,
    (date + time) + (duration_minutes || ' minutes')::interval AS booked_end
  FROM appointments
  WHERE professional = '{{PROFISSIONAL}}'
    AND date = '{{DATA}}'
    AND status = 'confirmed'
)
SELECT to_char(ps.slot_start, 'HH24:MI') AS available_time
FROM professional_schedule ps
WHERE NOT EXISTS (
  SELECT 1
  FROM booked_slots bs
  WHERE ps.slot_start < bs.booked_end
    AND ps.slot_start + ('{{DURACAO}} minutes')::interval > bs.booked_start
)
ORDER BY ps.slot_start;
