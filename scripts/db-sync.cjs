const fs = require('fs');
const path = require('path');
const {
  getClient,
  loadMigrations,
  ensureGovernanceTables,
  getAppliedMigrations,
  recordMigration,
  computeLocalSchemaHash,
  normalizeSql
} = require('./db/_shared.cjs');

(async () => {
  const client = await getClient();
  try {
    await ensureGovernanceTables(client);

    const applied = await getAppliedMigrations(client);
    const appliedKeys = new Set(applied.filter(r => r.status === 'applied').map(r => r.version_key));

    const migrations = loadMigrations();
    const pending = migrations.filter(m => !appliedKeys.has(m.versionKey));

    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    const schemaHash = computeLocalSchemaHash();
    for (const migration of pending) {
      const upSql = fs.readFileSync(migration.upPath, 'utf8');
      const start = Date.now();
      console.log(`Applying migration ${migration.versionKey}...`);
      await client.query('BEGIN');
      try {
        await client.query(normalizeSql(upSql));
        const executionMs = Date.now() - start;
        await recordMigration(client, {
          versionKey: migration.versionKey,
          checksum: migration.checksum,
          appliedBy: process.env.DB_MIGRATION_USER || process.env.USER || null,
          executionMs,
          schemaHash,
          notes: 'Applied via db:sync'
        });
        await client.query('COMMIT');
        console.log(`Migration ${migration.versionKey} applied.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Migration ${migration.versionKey} failed:`, err.message || err);
        process.exitCode = 1;
        return;
      }
    }
  } finally {
    await client.end();
  }
})();
