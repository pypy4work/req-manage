const { getSupabaseConfig, getMssqlConfig } = require('./db-config');

function safeParseUrl(value) {
  if (!value) return { ok: false, error: 'Missing connection string' };
  try {
    const url = new URL(value);
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: err.message || 'Invalid URL' };
  }
}

function validateConnectionString(value) {
  const result = safeParseUrl(value);
  const warnings = [];
  if (!result.ok) {
    return { ok: false, warnings, error: result.error };
  }
  const url = result.url;
  if (!url.username) warnings.push('Connection string missing username.');
  if (!url.password) warnings.push('Connection string missing password.');
  if (!url.hostname) warnings.push('Connection string missing host.');
  if (!url.pathname || url.pathname === '/') warnings.push('Connection string missing database name.');

  const raw = value;
  const atCount = (raw.match(/@/g) || []).length;
  if (atCount > 1) warnings.push('Connection string contains multiple @ symbols. Password may need URL encoding.');
  if (raw.includes(' ')) warnings.push('Connection string contains spaces. URL encoding may be required.');
  if (raw.includes('@') && raw.includes(':') && raw.includes('%40') === false) {
    const passwordSegment = raw.split('://')[1]?.split('@')[0] || '';
    if (passwordSegment.includes('@')) warnings.push('Password contains @ but is not URL-encoded (%40).');
  }

  return { ok: true, warnings, hostname: url.hostname };
}

function validateSupabaseEnv() {
  const errors = [];
  const warnings = [];
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
  const supabaseConfig = getSupabaseConfig();

  if (!supabaseUrl) {
    warnings.push('SUPABASE_URL is missing. Frontend clients should not use direct DB access.');
  } else if (!supabaseUrl.startsWith('https://')) {
    warnings.push('SUPABASE_URL should start with https://');
  }

  if (!supabaseKey) {
    warnings.push('SUPABASE_ANON_KEY is missing. Ensure frontend does not use direct DB access in production.');
  }

  if (!supabaseConfig.connectionString && !supabaseConfig.host) {
    errors.push('Postgres connection details missing. Provide SUPABASE_DB_URL or POSTGRES_URL.');
  }

  const connCheck = validateConnectionString(supabaseConfig.connectionString);
  if (supabaseConfig.connectionString && !connCheck.ok) {
    errors.push(`Invalid Postgres connection string: ${connCheck.error}`);
  }
  warnings.push(...connCheck.warnings || []);

  if (connCheck.hostname && !connCheck.hostname.includes('supabase')) {
    warnings.push('Postgres host does not appear to be a Supabase host. Verify connection string.');
  }

  return {
    errors,
    warnings,
    details: {
      supabaseUrl: supabaseUrl ? '[set]' : '[missing]',
      supabaseAnonKey: supabaseKey ? '[set]' : '[missing]',
      postgresConnectionString: supabaseConfig.connectionString ? '[set]' : '[missing]'
    }
  };
}

function validateMssqlEnv() {
  const config = getMssqlConfig();
  const warnings = [];
  if (!config.server) warnings.push('DB_HOST missing for MSSQL.');
  if (!config.user) warnings.push('DB_USER missing for MSSQL.');
  if (!config.password) warnings.push('DB_PASS missing for MSSQL.');
  return {
    warnings,
    details: {
      mssqlHost: config.server || '[missing]',
      mssqlDatabase: config.database || '[missing]'
    }
  };
}

function validateEnv() {
  const timestamp = new Date().toISOString();
  const supabase = validateSupabaseEnv();
  const mssql = validateMssqlEnv();

  const errors = [...supabase.errors];
  const warnings = [...supabase.warnings, ...mssql.warnings];

  if (process.env.NETLIFY && !process.env.POSTGRES_URL && !process.env.SUPABASE_DB_URL) {
    errors.push('Netlify environment missing POSTGRES_URL or SUPABASE_DB_URL.');
  }

  return {
    ok: errors.length === 0,
    timestamp,
    errors,
    warnings,
    details: {
      supabase: supabase.details,
      mssql: mssql.details,
      netlifyContext: process.env.CONTEXT || 'unknown'
    }
  };
}

module.exports = { validateEnv };
