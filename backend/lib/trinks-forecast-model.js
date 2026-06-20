const DEFAULTS = {
  monthlyBudget: 10000,
  operationalCap: 8500,
  businessDays: 22,
  consumptionChecksPerDay: 4,
  snapshotDaysPerBusinessDay: 7,
  compatibilityRefreshesPerMonth: 5,
  compatibilityCallsPerRefresh: 13,
  reconcilePagesPerDay: 17,
  extraDateQueriesPerBusinessDay: 10,
  newClientRate: 0.3,
  contingency: 0.15,
};

function scenario(name, dailyClients, mutationsPerClient, config) {
  const mutationCalls = dailyClients * mutationsPerClient * config.businessDays;
  const newClientExtraCalls = dailyClients * config.newClientRate * 2 * config.businessDays;
  const fixed = (config.consumptionChecksPerDay * 30)
    + (config.snapshotDaysPerBusinessDay * config.businessDays)
    + (config.compatibilityCallsPerRefresh * config.compatibilityRefreshesPerMonth)
    + (config.reconcilePagesPerDay * 30)
    + (config.extraDateQueriesPerBusinessDay * config.businessDays);
  const beforeContingency = fixed + mutationCalls + newClientExtraCalls;
  const projected = Math.ceil(beforeContingency * (1 + config.contingency));
  return {
    name,
    daily_clients: Number(dailyClients.toFixed(2)),
    mutations_per_client: mutationsPerClient,
    fixed_requests: Math.ceil(fixed),
    mutation_requests: Math.ceil(mutationCalls),
    new_client_requests: Math.ceil(newClientExtraCalls),
    projected_requests: projected,
    within_operational_cap: projected < config.operationalCap,
    remaining_to_cap: Math.max(0, config.operationalCap - projected),
  };
}

function buildForecast(observed = {}, overrides = {}) {
  const config = { ...DEFAULTS, ...overrides };
  const avgClients = Math.max(1, Number(observed.avgDailyClients || 105));
  const scenarios = [
    scenario('conservador', avgClients * 0.25, 1, config),
    scenario('base', Math.min(avgClients, Number(observed.avgDailyAppointments || 56)), 1.35, config),
    scenario('agressivo', avgClients, 1.5, config),
    scenario('stress', avgClients, 3, config),
  ];
  const gates = {
    baseline_data_available: observed.dataAvailable !== false,
    conservador: scenarios[0].projected_requests < 3000,
    base: scenarios[1].projected_requests < 5000,
    agressivo: scenarios[2].projected_requests < config.operationalCap,
    stress_circuit_breaker_required: scenarios[3].projected_requests >= config.operationalCap,
  };
  return {
    generated_at: new Date().toISOString(),
    assumptions: config,
    observed,
    confidence: observed.dataAvailable === false ? 'insufficient' : 'observed',
    scenarios,
    gates,
    pass: Object.values(gates).every(Boolean),
  };
}

module.exports = { DEFAULTS, buildForecast };
