async function sendCriticalAlert(payload) {
  const url = process.env.CRITICAL_ALERT_WEBHOOK_URL || process.env.ALERT_WEBHOOK_URL;
  const enriched = {
    ...payload,
    severity: payload?.severity || 'critical',
    timestamp: new Date().toISOString(),
    environment: process.env.CONTEXT || process.env.NODE_ENV || 'unknown'
  };

  if (!url) {
    console.error('[DB-ALERT]', JSON.stringify(enriched));
    return { delivered: false };
  }

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enriched)
    });
    return { delivered: resp.ok };
  } catch (err) {
    console.error('[DB-ALERT] Failed to deliver alert', err.message || err);
    return { delivered: false };
  }
}

module.exports = { sendCriticalAlert };
