-- Seed de exemplo para testes locais

INSERT INTO clients (phone, name, last_service, last_visit, visit_count, opted_out)
VALUES
  ('5511999990001', 'Ana Cliente', 'Coloracao', NOW() - INTERVAL '35 days', 4, FALSE),
  ('5511999990002', 'Bruna Cliente', 'Corte feminino', NOW() - INTERVAL '8 days', 8, FALSE),
  ('5511999990003', 'Carlos Cliente', 'Corte + Barba', NOW() - INTERVAL '65 days', 3, FALSE)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO appointments (client_id, service, professional, date, time, duration_minutes, status)
SELECT c.id, 'Corte feminino', 'Ana', CURRENT_DATE + INTERVAL '1 day', '14:00', 45, 'confirmed'
FROM clients c
WHERE c.phone = '5511999990001'
  AND NOT EXISTS (
    SELECT 1
    FROM appointments a
    WHERE a.client_id = c.id
      AND a.date = CURRENT_DATE + INTERVAL '1 day'
      AND a.time = '14:00'
  );

INSERT INTO appointments (client_id, service, professional, date, time, duration_minutes, status)
SELECT c.id, 'Manicure', 'Julia', CURRENT_DATE + INTERVAL '1 day', '15:00', 40, 'confirmed'
FROM clients c
WHERE c.phone = '5511999990002'
  AND NOT EXISTS (
    SELECT 1
    FROM appointments a
    WHERE a.client_id = c.id
      AND a.date = CURRENT_DATE + INTERVAL '1 day'
      AND a.time = '15:00'
  );
