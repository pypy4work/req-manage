const { getRequestContext } = require('./db-context');
const { getSupabaseAdapter } = require('./db-router');

async function logDbOperation(entry) {
  if (process.env.DB_LOGGING_ENABLED === 'false') return;

  const ctx = getRequestContext();
  const payload = {
    occurred_at: new Date().toISOString(),
    database_type: entry.databaseType,
    operation: entry.operation,
    sql_text: entry.sqlText || null,
    params: entry.params || null,
    affected_rows: typeof entry.affectedRows === 'number' ? entry.affectedRows : null,
    execution_ms: typeof entry.durationMs === 'number' ? entry.durationMs : null,
    user_id: entry.userId || ctx.userId || null,
    endpoint: entry.endpoint || ctx.endpoint || null,
    request_id: entry.requestId || ctx.requestId || null,
    status: entry.status || 'ok',
    error_message: entry.errorMessage || null,
    verification_status: entry.verificationStatus || null,
    verification_details: entry.verificationDetails || null,
    source_service: entry.sourceService || 'netlify-functions',
    is_verification: entry.isVerification ? true : false,
    environment: process.env.CONTEXT || process.env.NODE_ENV || 'unknown'
  };

  const adapter = getSupabaseAdapter();
  if (!adapter) {
    console.warn('[DB-LOG] Supabase adapter unavailable, falling back to console.');
    console.log(payload);
    return;
  }

  const sqlText = `
    INSERT INTO sca.db_logs (
      occurred_at, database_type, operation, sql_text, params, affected_rows,
      execution_ms, user_id, endpoint, request_id, status, error_message,
      verification_status, verification_details, source_service, is_verification, environment
    ) VALUES (
      @OccurredAt, @DatabaseType, @Operation, @SqlText, @Params, @AffectedRows,
      @ExecutionMs, @UserId, @Endpoint, @RequestId, @Status, @ErrorMessage,
      @VerificationStatus, @VerificationDetails, @SourceService, @IsVerification, @Environment
    )
  `;

  try {
    await adapter.query(sqlText, {
      OccurredAt: payload.occurred_at,
      DatabaseType: payload.database_type,
      Operation: payload.operation,
      SqlText: payload.sql_text,
      Params: payload.params,
      AffectedRows: payload.affected_rows,
      ExecutionMs: payload.execution_ms,
      UserId: payload.user_id,
      Endpoint: payload.endpoint,
      RequestId: payload.request_id,
      Status: payload.status,
      ErrorMessage: payload.error_message,
      VerificationStatus: payload.verification_status,
      VerificationDetails: payload.verification_details,
      SourceService: payload.source_service,
      IsVerification: payload.is_verification,
      Environment: payload.environment
    });
  } catch (err) {
    console.error('[DB-LOG] Failed to insert log entry', err.message || err);
  }
}

module.exports = { logDbOperation };
