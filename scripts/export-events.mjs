// 비공개 저장소에 쌓인 익명 기록을 CSV 하나로 묶습니다. (GitHub Actions에서 실행)
// 사용: node scripts/export-events.mjs out.csv   — BLOB_READ_WRITE_TOKEN 또는 OIDC 자격이 필요
import { list, get } from '@vercel/blob';
import { writeFileSync } from 'node:fs';

const COLS = [
  ['receivedAt', '받은시각'], ['at', '기록시각(시)'], ['type', '종류'], ['slot', '끼니'], ['foods', '음식'],
  ['kcal', '열량kcal'], ['sodiumMg', '나트륨mg'], ['proteinG', '단백질g'], ['hour', '식사시각(시)'],
  ['productName', '제품명'], ['brand', '회사명'], ['score', '성분점수'], ['additives', '첨가물수'],
  ['source', '출처'], ['anonId', '익명번호'],
];
const cell = (v) => {
  if (v === undefined || v === null) return '';
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // 시트 수식 주입 방지
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const label = (r) => ({ ...r, type: r.type === 'meal' ? '식사' : r.type === 'scan' ? '스캔' : r.type });

const rows = [];
let cursor;
do {
  const page = await list({ prefix: 'events/', limit: 1000, cursor });
  for (const b of page.blobs) {
    const got = await get(b.pathname, { access: 'private' });
    if (!got) continue;
    const text = await new Response(got.stream).text();
    try { const r = JSON.parse(text); if (!String(r.anonId || '').startsWith('test-')) rows.push(label(r)); } catch { /* 깨진 기록은 건너뜀 */ }
  }
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);

rows.sort((a, b) => String(a.receivedAt).localeCompare(String(b.receivedAt)));
const csv = [COLS.map((c) => c[1]).join(','), ...rows.map((r) => COLS.map((c) => cell(r[c[0]])).join(','))].join('\n');
writeFileSync(process.argv[2] || 'hankki-events.csv', '﻿' + csv + '\n');
console.log(`기록 ${rows.length}건을 내보냈습니다.`);
