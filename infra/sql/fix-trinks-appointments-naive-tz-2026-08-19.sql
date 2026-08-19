-- Reinterpreta dataHoraInicio naive da Trinks como America/Sao_Paulo (-03:00).
-- Rodar no Postgres da VPS DEPOIS de deployar o código; não consome quota Trinks.
-- Idempotente: só atualiza linhas cujo scheduled_at difere do valor corrigido.

UPDATE trinks_appointments AS ta
SET scheduled_at = corrected.corrected_at
FROM (
  SELECT
    trinks_id,
    (
      REPLACE(
        COALESCE(
          NULLIF(BTRIM(raw->>'dataHoraInicio'), ''),
          NULLIF(BTRIM(raw->>'DataHoraInicioDoAgendamento'), '')
        ),
        ' ',
        'T'
      ) || '-03:00'
    )::timestamptz AS corrected_at
  FROM trinks_appointments
  WHERE raw IS NOT NULL
    AND COALESCE(
      NULLIF(BTRIM(raw->>'dataHoraInicio'), ''),
      NULLIF(BTRIM(raw->>'DataHoraInicioDoAgendamento'), '')
    ) IS NOT NULL
    AND COALESCE(
      NULLIF(BTRIM(raw->>'dataHoraInicio'), ''),
      NULLIF(BTRIM(raw->>'DataHoraInicioDoAgendamento'), '')
    ) !~ '[Zz]$'
    AND COALESCE(
      NULLIF(BTRIM(raw->>'dataHoraInicio'), ''),
      NULLIF(BTRIM(raw->>'DataHoraInicioDoAgendamento'), '')
    ) !~ '[+-][0-9]{2}(:?[0-9]{2})?$'
) AS corrected
WHERE ta.trinks_id = corrected.trinks_id
  AND ta.scheduled_at IS DISTINCT FROM corrected.corrected_at;
