/**
 * POST /api/analyze — 식사 사진 또는 제품 라벨 사진을 Claude로 분석합니다. (Vercel 서버리스 함수)
 * 환경변수: ANTHROPIC_API_KEY (필수), CLAUDE_MODEL (선택, 기본 claude-haiku-5-5)
 * API 키는 서버에만 있고 브라우저로 내려가지 않습니다.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LABEL_PROMPT, MEAL_PROMPT } from '../src/lib/prompts';

type Req = IncomingMessage & { body?: unknown };
type Res = ServerResponse;

const MAX_IMAGE_CHARS = 3_000_000; // 약 2.2MB 이미지
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

function send(res: Res, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req: Req): Promise<unknown> {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_IMAGE_CHARS + 10_000) throw new Error('too_large');
    chunks.push(c as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function extractJson(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no_json');
  return JSON.parse(text.slice(start, end + 1));
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST만 지원합니다.' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return send(res, 503, { error: 'AI 분석이 아직 연결되지 않았습니다.' });

  let body: { mode?: unknown; image?: unknown; hint?: unknown };
  try {
    body = (await readBody(req)) as typeof body;
  } catch {
    return send(res, 413, { error: '사진이 너무 크거나 형식이 올바르지 않습니다.' });
  }

  const mode = body.mode === 'label' ? 'label' : body.mode === 'meal' ? 'meal' : null;
  const image = typeof body.image === 'string' ? body.image : '';
  const m = image.length <= MAX_IMAGE_CHARS ? DATA_URL.exec(image) : null;
  if (!mode || !m) return send(res, 400, { error: 'JPEG·PNG·WEBP 사진만 분석할 수 있습니다.' });

  const hint = typeof body.hint === 'string' ? body.hint.slice(0, 80).replace(/[\r\n]/g, ' ') : '';
  const prompt = mode === 'meal' ? MEAL_PROMPT + (hint ? `\n사용자 메모: ${hint}` : '') : LABEL_PROMPT;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-haiku-5-5',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
    if (!r.ok) {
      console.error('anthropic error', r.status, await r.text().catch(() => ''));
      return send(res, 502, { error: 'AI 분석에 실패했습니다. 잠시 후 다시 시도하세요.' });
    }
    const data = (await r.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    return send(res, 200, extractJson(text));
  } catch (e) {
    console.error('analyze failed', e);
    return send(res, 502, { error: 'AI 분석 결과를 읽지 못했습니다. 다시 찍어 보세요.' });
  }
}
