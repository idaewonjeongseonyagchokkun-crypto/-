/**
 * POST /api/events — 사용자가 '익명 트렌드 공유'에 동의한 경우에만 호출됩니다.
 * 사진·이름·위치는 받지 않습니다. 허용된 필드만 골라 INSIGHTS_WEBHOOK_URL
 * (예: 구글 시트 Apps Script 웹앱)로 전달해 신제품 개발용 데이터로 쌓습니다.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

type Req = IncomingMessage & { body?: unknown };

const ALLOWED: Record<string, 'string' | 'number' | 'boolean'> = {
  anonId: 'string', type: 'string', at: 'string', slot: 'string', foods: 'string',
  kcal: 'number', sodiumMg: 'number', proteinG: 'number', hour: 'number',
  productName: 'string', brand: 'string', score: 'number', additives: 'number', source: 'string', category: 'string',
};

async function readBody(req: Req): Promise<Record<string, unknown>> {
  if (req.body !== undefined) return (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, unknown>;
  let raw = '';
  for await (const c of req) {
    raw += c;
    if (raw.length > 4000) throw new Error('too_large');
  }
  return JSON.parse(raw);
}

export default async function handler(req: Req, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  let body: Record<string, unknown>;
  try { body = await readBody(req); } catch { res.statusCode = 400; return res.end(); }

  const clean: Record<string, unknown> = {};
  for (const [k, t] of Object.entries(ALLOWED)) {
    const v = body[k];
    if (typeof v === t) clean[k] = typeof v === 'string' ? v.slice(0, 120) : v;
  }
  if (!clean.type) { res.statusCode = 400; return res.end(); }

  const hook = process.env.INSIGHTS_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clean) });
    } catch (e) {
      console.error('webhook failed', e);
    }
  } else {
    console.log('trend', JSON.stringify(clean));
  }
  res.statusCode = 204;
  res.end();
}
