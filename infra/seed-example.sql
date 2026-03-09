-- Seed de exemplo para testes locais

INSERT INTO clients (phone, name, last_service, last_visit, visit_count, opted_out)
VALUES
  ('5511999990001', 'Ana Cliente', 'Coloracao', NOW() - INTERVAL '35 days', 4, FALSE),
  ('5511999990002', 'Bruna Cliente', 'Corte feminino', NOW() - INTERVAL '8 days', 8, FALSE),
  ('5511999990003', 'Carlos Cliente', 'Corte + Barba', NOW() - INTERVAL '65 days', 3, FALSE)
ON CONFLICT (phone) DO NOTHING;
