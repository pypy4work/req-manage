const {
  getClient,
  loadMigrations,
  ensureGovernanceTables,
  getAppliedMigrations,
  computeLocalSchemaHash,
  computeRemoteSchemaHash
} = require('./db/_shared.cjs');

(async () => {
  const client = await getClient();
  try {
    await ensureGovernanceTables(client);
    const applied = await getAppliedMigrations(client);
    const migrations = loadMigrations();
    const appliedKeys = new Set(applied.filter(r => r.status === 'applied').map(r => r.version_key));
    const pending = migrations.filter(m => !appliedKeys.has(m.versionKey));

    console.log(`Applied migrations: ${applied.length}`);
    applied.forEach((m) => {
      console.log(`- ${m.version_key} [${m.status}]`);
    });

    console.log(`Pending migrations: ${pending.length}`);
    pending.forEach((m) => console.log(`- ${m.versionKey}`));

    const localHash = computeLocalSchemaHash();
    const remoteHash = await computeRemoteSchemaHash(client);

    console.log(`Local schema hash: ${localHash || 'n/a'}`);
    console.log(`Remote schema hash: ${remoteHash || 'n/a'}`);

    if (localHash && remoteHash && localHash !== remoteHash) {
      console.log('WARNING: Local schema hash does not match Supabase schema hash.');
    }
  } finally {
    await client.end();
  }
})();
