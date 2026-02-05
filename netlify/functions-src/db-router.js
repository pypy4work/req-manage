const { getRouterConfig } = require('./db-config');
const { validateEnv } = require('./db-diagnostics');
const supabaseAdapter = require('./db-adapter-postgres');
const mssqlAdapter = require('./db-adapter-mssql');
const mockAdapter = require('./db-adapter-mock');
const { sendCriticalAlert } = require('./db-alerts');

const state = {
  initialized: false,
  active: null,
  activeDialect: 'postgres',
  diagnostics: null,
  supabaseHealth: null,
  mssqlHealth: null,
  degraded: false,
  degradedReason: null,
  misconfiguration: null,
  lastInit: null,
  degradedReadOnly: true
};

let initPromise = null;

function isProduction() {
  return process.env.NODE_ENV === 'production' || process.env.CONTEXT === 'production';
}

async function safePing(adapter, label) {
  try {
    const result = await adapter.ping();
    return { ok: true, label, ...result };
  } catch (err) {
    return { ok: false, label, error: err.message || String(err) };
  }
}

async function initDbRouter(force = false) {
  if (state.initialized && !force) return state;
  if (initPromise && !force) return initPromise;

  initPromise = (async () => {
    state.diagnostics = validateEnv();
    const routerConfig = getRouterConfig();
    state.degradedReadOnly = routerConfig.degradedReadOnly && isProduction();

    if (state.diagnostics?.errors?.length) {
      console.error('[DB-DIAGNOSTICS] Errors:', state.diagnostics.errors);
    }
    if (state.diagnostics?.warnings?.length) {
      console.warn('[DB-DIAGNOSTICS] Warnings:', state.diagnostics.warnings);
    }

    const supabaseHealth = await safePing(supabaseAdapter, 'supabase');
    const mssqlHealth = await safePing(mssqlAdapter, 'mssql');

    state.supabaseHealth = supabaseHealth;
    state.mssqlHealth = mssqlHealth;
    state.misconfiguration = null;

    const prod = isProduction();
    const allowFallback = routerConfig.allowFallback || !prod;
    const allowMock = routerConfig.allowMock || !prod;
    const allowForce = routerConfig.allowForce && (!prod || process.env.DB_ROUTER_ALLOW_FORCE_IN_PROD === 'true');

    let active = null;
    if (supabaseHealth.ok) {
      active = 'supabase';
    } else if (allowFallback && mssqlHealth.ok) {
      active = 'mssql';
    } else if (allowMock) {
      active = 'mock';
    }

    const forced = routerConfig.forceDialect;
    if (forced && allowForce) {
      if (forced === 'postgres' && supabaseHealth.ok) active = 'supabase';
      if (forced === 'mssql' && mssqlHealth.ok) active = 'mssql';
      if (forced === 'mock') active = 'mock';
    } else if (forced && !allowForce && supabaseHealth.ok && forced !== 'postgres') {
      state.misconfiguration = `DB_DIALECT=${forced} overridden to supabase`;
    }

    state.active = active;
    state.activeDialect = active === 'mssql' ? 'mssql' : (active === 'mock' ? 'mock' : 'postgres');
    state.degraded = active !== 'supabase';
    state.degradedReason = null;

    if (!supabaseHealth.ok) {
      state.degradedReason = supabaseHealth.error || 'Supabase connectivity failed';
      await sendCriticalAlert({
        type: 'DB_SUPABASE_UNAVAILABLE',
        message: 'Supabase connectivity test failed during startup.',
        details: supabaseHealth
      });
    }

    if (state.misconfiguration) {
      await sendCriticalAlert({
        type: 'DB_MISCONFIGURATION',
        message: state.misconfiguration,
        details: { diagnostics: state.diagnostics }
      });
    }

    if (state.degraded && prod) {
      await sendCriticalAlert({
        type: 'DB_DEGRADED_MODE',
        message: `Database router in degraded mode (${active || 'none'}).`,
        details: {
          active,
          allowFallback,
          allowMock,
          requireSupabase: routerConfig.requireSupabase,
          diagnostics: state.diagnostics
        }
      });
    }

    state.lastInit = new Date().toISOString();
    state.initialized = true;
    return state;
  })();

  return initPromise;
}

function getActiveAdapter() {
  if (state.active === 'mssql') return mssqlAdapter;
  if (state.active === 'mock') return mockAdapter;
  if (state.active === 'supabase') return supabaseAdapter;
  return null;
}

function getSupabaseAdapter() {
  return supabaseAdapter;
}

function getRouterState() {
  return { ...state };
}

function getDialectSync() {
  return state.activeDialect || 'postgres';
}

module.exports = {
  initDbRouter,
  getActiveAdapter,
  getSupabaseAdapter,
  getRouterState,
  getDialectSync,
  isProduction
};
