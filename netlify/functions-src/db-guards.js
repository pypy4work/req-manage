const { initDbRouter, getRouterState, isProduction } = require('./db-router');

function requireSupabaseActive() {
  return async (req, res, next) => {
    await initDbRouter();
    const state = getRouterState();
    if (isProduction() && state.active !== 'supabase') {
      return res.status(503).json({ error: 'Supabase is required for this endpoint.' });
    }
    return next();
  };
}

module.exports = { requireSupabaseActive };
