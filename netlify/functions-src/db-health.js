const { initDbRouter, getRouterState } = require('./db-router');

async function getDbHealth() {
  await initDbRouter();
  const state = getRouterState();
  const supabaseHealth = state.supabaseHealth || {};
  const latency = supabaseHealth.latencyMs || null;
  const lastSuccess = supabaseHealth.lastSuccessfulQueryTime || null;

  return {
    active_database: state.active || 'none',
    connection_status: state.active ? (state.degraded ? 'degraded' : 'ok') : 'down',
    latency_ms: latency,
    last_successful_query_time: lastSuccess
  };
}

module.exports = { getDbHealth };
