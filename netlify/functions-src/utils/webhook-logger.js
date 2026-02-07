const fs = require('fs');
const path = require('path');

const safeJsonParse = (text) => {
  try { return JSON.parse(text); } catch { return null; }
};

const resolveWebhookLogPath = () => {
  if (process.env.WEBHOOK_LOG_PATH) return process.env.WEBHOOK_LOG_PATH;
  const isNetlify =
    !!process.env.NETLIFY ||
    !!process.env.NETLIFY_DEV ||
    !!process.env.NETLIFY_LOCAL ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.LAMBDA_TASK_ROOT;
  if (isNetlify) return '/tmp/webhook.json';
  const root = path.resolve(__dirname, '..', '..', '..');
  return path.join(root, 'webhook.json');
};

const appendWebhookLog = async (entry) => {
  const limit = Number(process.env.WEBHOOK_LOG_LIMIT || 50);
  const filePath = resolveWebhookLogPath();
  try {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    let data = [];
    if (fs.existsSync(filePath)) {
      const text = await fs.promises.readFile(filePath, 'utf8');
      const parsed = safeJsonParse(text.trim());
      if (Array.isArray(parsed)) data = parsed;
    }

    data.push({ ...entry, logged_at: new Date().toISOString() });
    if (data.length > limit) data = data.slice(-limit);

    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('Webhook log write failed', err?.message || err);
  }
};

module.exports = { appendWebhookLog, resolveWebhookLogPath };
