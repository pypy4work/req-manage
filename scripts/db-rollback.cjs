const fs = require('fs');
const {
  getClient,
  loadMigrations,
  ensureGovernanceTables,
  getAppliedMigrations,
  markRollback,
  normalizeSql
} = require('./db/_shared.cjs');

(async () => {
  const client = await getClient();
  try {
    await ensureGovernanceTables(client);
    const applied = await getAppliedMigrations(client);
    const latest = [...applied].reverse().find(r => r.status === 'applied');
    if (!latest) {
      console.log('No applied migrations to rollback.');
      return;
    }

    const migrations = loadMigrations();
    const migration = migrations.find(m => m.versionKey === latest.version_key);
    if (!migration || !migration.downPath) {
      console.error(`Missing down migration for ${latest.version_key}.`);
      process.exitCode = 1;
      return;
    }

    const downSql = fs.readFileSync(migration.downPath, 'utf8');
    console.log(`Rolling back ${latest.version_key}...`);
    await client.query('BEGIN');
    try {
      await client.query(normalizeSql(downSql));
      await markRollback(client, latest.version_key);
      await client.query('COMMIT');
      console.log(`Rollback ${latest.version_key} completed.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Rollback failed:`, err.message || err);
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
})();
