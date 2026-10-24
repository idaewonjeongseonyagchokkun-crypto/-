/**
 * POST /api/events — 사용자가 '익명 트렌드 공유'에 동의한 경우에만 호출됩니다.
 * 사진·이름·위치는 받지 않습니다. 허용된 필드만 골라 신제품 개발용 데이터로 쌓습니다.
 * 저장 위치: Vercel Blob 비공개 저장소(프로젝트에 연결되어 있으면) 그리고/또는 INSIGHTS_WEBHOOK_URL.
 * 쌓인 기록은 GitHub Actions '신제품 데이터 내보내기'가 CSV로 묶습니다.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';

const HAS_BLOB = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

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

  clean.receivedAt = new Date().toISOString();
  const hook = process.env.INSIGHTS_WEBHOOK_URL;
  if (HAS_BLOB()) {
    const day = (clean.receivedAt as string).slice(0, 10);
    try {
      await put(`events/${day}/${Date.now()}-${randomUUID().slice(0, 8)}.json`, JSON.stringify(clean), {
        access: 'private', contentType: 'application/json', addRandomSuffix: false,
      });
    } catch (e) {
      console.error('blob save failed', e);
    }
  }
  if (hook) {
    try {
      await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clean) });
    } catch (e) {
      console.error('webhook failed', e);
    }
  } else if (!HAS_BLOB()) {
    console.log('trend', JSON.stringify(clean));
  }
  res.statusCode = 204;
  res.end();
}
