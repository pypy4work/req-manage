function createRateLimiter({ windowMs, max, keyGenerator }) {
  const hits = new Map();

  function cleanup(now) {
    for (const [key, value] of hits.entries()) {
      if (now - value.start > windowMs) {
        hits.delete(key);
      }
    }
  }

  return (req, res, next) => {
    const now = Date.now();
    cleanup(now);

    const key = keyGenerator ? keyGenerator(req) : (req.headers['x-forwarded-for'] || req.ip || 'unknown');
    const entry = hits.get(key) || { count: 0, start: now };

    if (now - entry.start > windowMs) {
      entry.count = 0;
      entry.start = now;
    }

    entry.count += 1;
    hits.set(key, entry);

    if (entry.count > max) {
      res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      return;
    }

    next();
  };
}

module.exports = { createRateLimiter };
