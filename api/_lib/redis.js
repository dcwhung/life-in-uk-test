// ════════════════════════════════════════
// Upstash Redis over its REST API (plain fetch, no npm dependency).
// Env: UPSTASH_REDIS_REST_URL / _TOKEN, or KV_REST_API_URL / _TOKEN (the names the Vercel Marketplace integration
// may inject instead).
// ════════════════════════════════════════
function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Redis env vars are not set');
  return { url, token };
}

// commands: [['INCR', key], ...] → each command's result, in order; throws when Redis or any command fails
async function redisPipeline(commands) {
  const { url, token } = redisConfig();
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const replies = await res.json();
  const failed = replies.find(r => r.error);
  if (failed) throw new Error(`Redis error: ${failed.error}`);
  return replies.map(r => r.result);
}

module.exports = { redisConfig, redisPipeline };
