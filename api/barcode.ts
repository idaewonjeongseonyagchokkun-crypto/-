/**
 * GET  /api/barcode?code=8801234567890 — 바코드로 제품 찾기
 *   1) 한끼스캔 공유 DB (사용자들이 표시사항 사진으로 채운 국내 제품)
 *   2) Open Food Facts (세계 공개 식품 DB)
 *   3) 식품안전나라 유통바코드 (FOODSAFETY_API_KEY가 있을 때, 제품명·회사명만)
 * POST /api/barcode {code, product} — 못 찾은 바코드를 표시사항 사진 분석 결과로 공유 DB에 등록
 *   (이미 있으면 덮어쓰지 않음, 허용 필드만 저장, 개인정보 없음)
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { get, put } from '@vercel/blob';
import { OFF_FIELDS, fromOff, type ProductInfo } from '../src/lib/off.js';

type Req = IncomingMessage & { body?: unknown; query?: Record<string, string> };

const HAS_BLOB = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

function send(res: ServerResponse, status: number, body: unknown, cache = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(JSON.stringify(body));
}

export function validGtin(code: string) {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const d = code.split('').map(Number);
  const check = d.pop()!;
  const sum = d.reverse().reduce((s, x, i) => s + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

async function withTimeout<T>(p: (s: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await p(ac.signal); } finally { clearTimeout(t); }
}

async function fromShared(code: string): Promise<ProductInfo | null> {
  if (!HAS_BLOB()) return null;
  try {
    const r = await get(`products/${code}.json`, { access: 'private' });
    if (!r || !r.stream) return null;
    const p = JSON.parse(await new Response(r.stream).text()) as ProductInfo;
    return { ...p, barcode: code, source: 'shared' };
  } catch { return null; }
}

async function fromOpenFoodFacts(code: string): Promise<ProductInfo | null> {
  // 13자리 EAN과 12자리 UPC를 서로 바꿔서도 찾아 봅니다.
  const variants = [code];
  if (code.length === 12) variants.push('0' + code);
  if (code.length === 13 && code.startsWith('0')) variants.push(code.slice(1));
  for (const v of variants) {
    try {
      const r = await withTimeout((signal) => fetch(`https://world.openfoodfacts.org/api/v2/product/${v}.json?fields=${OFF_FIELDS}`, {
        signal, headers: { 'User-Agent': 'HankkiScan/1.0 (doll3261@naver.com)' },
      }), 6000);
      if (!r.ok) continue;
      const d = await r.json() as { status?: number; product?: unknown };
      if (d.status === 1) { const p = fromOff(code, d.product); if (p) return p; }
    } catch { /* 다음 후보 */ }
  }
  return null;
}

async function fromFoodSafety(code: string): Promise<ProductInfo | null> {
  const key = process.env.FOODSAFETY_API_KEY;
  if (!key) return null;
  // 서비스별 항목 이름이 달라 두 서비스(C005 바코드연계제품, I2570 유통바코드)를 모두 시도합니다.
  const services: [string, string][] = [['C005', 'BAR_CD'], ['I2570', 'BRCD_NO']];
  for (const [svc, param] of services) {
    for (const scheme of ['https', 'http']) {
      try {
        const r = await withTimeout((signal) => fetch(`${scheme}://openapi.foodsafetykorea.go.kr/api/${encodeURIComponent(key)}/${svc}/json/1/3/${param}=${code}`, { signal }), 6000);
        if (!r.ok) continue;
        const d = await r.json() as Record<string, { row?: Record<string, string>[] }>;
        const row = d[svc]?.row?.[0];
        const name = row?.PRDLST_NM || row?.PRDT_NM || row?.PRDLST_REPORT_NM;
        if (!name) break;
        return {
          barcode: code, name: name.slice(0, 80), brand: (row?.BSSH_NM || row?.CMPNY_NM)?.slice(0, 40),
          per100g: {}, additives: [], source: 'foodsafety', partial: true,
        };
      } catch { /* 다음 방식 */ }
    }
  }
  return null;
}

async function readBody(req: Req): Promise<Record<string, unknown>> {
  if (req.body !== undefined) return (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, unknown>;
  let raw = '';
  for await (const c of req) { raw += c; if (raw.length > 8000) throw new Error('too_large'); }
  return JSON.parse(raw);
}

const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 10) / 10 : undefined);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

export default async function handler(req: Req, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://x');
  if (req.method === 'GET') {
    const code = (url.searchParams.get('code') || '').replace(/\D/g, '');
    if (!validGtin(code)) return send(res, 400, { error: '바코드 번호가 올바르지 않습니다. 숫자를 다시 확인해 주세요.' });
    const product = (await fromShared(code)) || (await fromOpenFoodFacts(code)) || (await fromFoodSafety(code));
    if (!product) return send(res, 404, { error: 'not_found' }, 'public, max-age=300');
    return send(res, 200, { product }, 'public, max-age=3600');
  }

  if (req.method === 'POST') {
    if (!HAS_BLOB()) return send(res, 503, { error: 'no_store' });
    let b: Record<string, unknown>;
    try { b = await readBody(req); } catch { return send(res, 400, { error: 'bad_body' }); }
    const code = String(b.code || '').replace(/\D/g, '');
    const p = (b.product || {}) as Record<string, unknown>;
    const per = (p.per100g || {}) as Record<string, unknown>;
    const name = str(p.name, 80);
    if (!validGtin(code) || !name) return send(res, 400, { error: 'bad_product' });
    const clean: ProductInfo = {
      name,
      brand: str(p.brand, 40),
      per100g: {
        kcal: num(per.kcal, 900), sugarG: num(per.sugarG, 100), satFatG: num(per.satFatG, 100),
        sodiumMg: num(per.sodiumMg, 40000), fiberG: num(per.fiberG, 100), proteinG: num(per.proteinG, 100),
      },
      additives: Array.isArray(p.additives) ? p.additives.filter((a): a is string => typeof a === 'string').map((a) => a.slice(0, 30)).slice(0, 30) : [],
      ingredientsText: str(p.ingredientsText, 1200),
      source: 'shared',
    };
    if (!Object.values(clean.per100g).some((v) => v != null)) return send(res, 400, { error: 'no_nutrition' });
    try {
      // 먼저 등록된 정보를 지킵니다 (덮어쓰기 금지)
      await put(`products/${code}.json`, JSON.stringify({ ...clean, savedAt: new Date().toISOString() }), {
        access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false,
      });
      return send(res, 201, { ok: true });
    } catch {
      return send(res, 200, { ok: true, existed: true });
    }
  }
  res.statusCode = 405;
  res.end();
}
