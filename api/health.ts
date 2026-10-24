/**
 * GET /api/health — 서버가 살아 있는지, AI 키가 설정됐는지만 알려 줍니다. 키 값은 절대 내보내지 않습니다.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    ok: true,
    aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.CLAUDE_MODEL || 'claude-haiku-5-5',
    insightsWebhook: Boolean(process.env.INSIGHTS_WEBHOOK_URL),
  }));
}
