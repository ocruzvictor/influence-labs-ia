const test = require('node:test');
const assert = require('node:assert/strict');
const { buildForecast } = require('../lib/trinks-forecast-model');

test('cenários base passam e stress exige circuit breaker', () => {
  const report = buildForecast({ avgDailyClients: 105, avgDailyAppointments: 56 });
  assert.equal(report.gates.conservador, true);
  assert.equal(report.gates.base, true);
  assert.equal(report.gates.agressivo, true);
  assert.equal(report.gates.stress_circuit_breaker_required, true);
  assert.equal(report.pass, true);
});

test('aumentar páginas de reconcile pode reprovar cenário agressivo', () => {
  const report = buildForecast(
    { avgDailyClients: 105, avgDailyAppointments: 56 },
    { reconcilePagesPerDay: 80 },
  );
  assert.equal(report.gates.agressivo, false);
  assert.equal(report.pass, false);
});
