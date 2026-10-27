import { OFF_FIELDS, fromOff } from './off';
import type { FoodItem, ScannedProduct } from './types';
import { detectAdditives } from './nutrition';
import { IS_PREVIEW } from './target';
import { LABEL_PROMPT, MEAL_PROMPT, TEXT_PROMPT } from './prompts';

/** claude.ai 미리보기 페이지가 제공하는 'Claude에게 묻기' 기능 (API 키 불필요, 보는 사람의 Claude 계정 사용) */
type SampleFn = { json: (input: string, opts: { images: Blob[]; modelTier?: string; cache?: boolean }) => Promise<unknown> };
declare global { interface Window { claude?: { use: (name: string) => Promise<unknown> } } }

function dataUrlToBlob(dataUrl: string) {
  const [head, b64] = dataUrl.split(',');
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function askClaudeInPreview(mode: 'meal' | 'label', image: string, hint?: string) {
  const sample = (await window.claude?.use('sample')) as SampleFn | null | undefined;
  if (!sample) throw new Error('sample unavailable');
  const prompt = mode === 'meal' ? MEAL_PROMPT + (hint ? `\n사용자 메모: ${hint}` : '') : LABEL_PROMPT;
  return sample.json(prompt, { images: [dataUrlToBlob(image)], cache: false }) as Promise<any>;
}

/** 사진을 긴 변 1024px JPEG로 줄여 업로드 시간을 짧게 만듭니다. */
export async function resizeImage(file: File, max = 1024, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

async function postAnalyze(mode: 'meal' | 'label', image: string, hint?: string) {
  if (IS_PREVIEW) return askClaudeInPreview(mode, image, hint);
  const res = await fetch(`${import.meta.env.BASE_URL}api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, image, hint }),
  });
  if (!res.ok) throw new Error(`analyze ${res.status}`);
  return res.json();
}

export interface MealAnalysis {
  items: FoodItem[];
  source: 'ai' | 'demo';
}

/** 글로 적은 식단("김치찌개 한 그릇, 밥 반 공기")을 음식별 영양 추정값으로 바꿉니다. 연결이 없으면 null. */
export async function analyzeText(text: string): Promise<FoodItem[] | null> {
  const clean = text.replace(/[<>\r\n]/g, ' ').trim().slice(0, 300);
  if (!clean) return [];
  try {
    let data: any;
    if (IS_PREVIEW) {
      const sample = (await window.claude?.use('sample')) as SampleFn | null | undefined;
      if (!sample) return null;
      data = await sample.json(`${TEXT_PROMPT}\n<식단>${clean}</식단>`, { images: [], cache: false });
    } else {
      const res = await fetch(`${import.meta.env.BASE_URL}api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'text', text: clean }),
      });
      if (!res.ok) return null;
      data = await res.json();
    }
    return Array.isArray(data?.items) ? data.items.slice(0, 12).map(cleanItem) : null;
  } catch {
    return null;
  }
}

export async function analyzeMeal(image: string, hint?: string): Promise<MealAnalysis> {
  try {
    const data = await postAnalyze('meal', image, hint);
    if (Array.isArray(data?.items)) return { items: data.items.map(cleanItem), source: 'ai' };
    throw new Error('no items');
  } catch {
    // AI 서버가 연결되지 않은 미리보기 환경: 화면 흐름을 확인할 수 있도록 예시 추정값을 보여줍니다.
    await new Promise((r) => setTimeout(r, 900));
    return {
      source: 'demo',
      items: [
        { name: '잡곡밥', portion: '1공기 (210g)', kcal: 310, carbG: 68, proteinG: 6, fatG: 1, sodiumMg: 5, sugarG: 0, confidence: 0.6 },
        { name: '된장찌개', portion: '1그릇 (250g)', kcal: 130, carbG: 9, proteinG: 9, fatG: 6, sodiumMg: 1150, sugarG: 2, confidence: 0.5 },
        { name: '고추부각', portion: '한 줌 (20g)', kcal: 105, carbG: 11, proteinG: 1, fatG: 6, sodiumMg: 90, sugarG: 1, confidence: 0.4 },
      ],
    };
  }
}

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function cleanItem(i: Record<string, unknown>): FoodItem {
  return {
    name: String(i.name ?? '음식').slice(0, 40),
    portion: String(i.portion ?? '1인분').slice(0, 40),
    kcal: num(i.kcal),
    carbG: num(i.carbG),
    proteinG: num(i.proteinG),
    fatG: num(i.fatG),
    sodiumMg: num(i.sodiumMg),
    sugarG: num(i.sugarG),
    confidence: Math.min(1, num(i.confidence)),
  };
}

const toNum = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(/[^\d.]/g, '')) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export type ProductDraft = Omit<ScannedProduct, 'id' | 'at'>;

/** 기록에는 작은 미리보기만 남깁니다 (휴대폰 저장 공간 보호) */
async function smallThumb(dataUrl: string, size = 160) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const r = Math.min(1, size / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

/** 원재료·영양성분표 사진을 AI로 읽습니다. */
export async function analyzeLabel(image: string): Promise<ProductDraft> {
  try {
    const d = await postAnalyze('label', image);
    const ingredients = String(d.ingredientsText ?? '');
    return {
      name: String(d.name || '이름 없는 제품').slice(0, 60),
      brand: d.brand ? String(d.brand).slice(0, 40) : undefined,
      per100g: {
        kcal: toNum(d.per100g?.kcal),
        sugarG: toNum(d.per100g?.sugarG),
        satFatG: toNum(d.per100g?.satFatG),
        sodiumMg: toNum(d.per100g?.sodiumMg),
        fiberG: toNum(d.per100g?.fiberG),
        proteinG: toNum(d.per100g?.proteinG),
      },
      additives: detectAdditives(ingredients),
      ingredientsText: ingredients.slice(0, 1200),
      image: await smallThumb(image),
      source: 'label-ai',
    };
  } catch (e) {
    // 정식 앱에서는 가짜 예시를 보여 주지 않고 다시 찍도록 안내합니다.
    if (!IS_PREVIEW) throw e;
    await new Promise((r) => setTimeout(r, 900));
    const ingredients = '밀가루, 설탕, 팜유, 물엿, 정제소금, 합성향료, 산도조절제, 유화제, 카라멜색소';
    return {
      name: '예시 과자 (데모)',
      per100g: { kcal: 520, sugarG: 24, satFatG: 11, sodiumMg: 480, proteinG: 5 },
      additives: detectAdditives(ingredients),
      ingredientsText: ingredients,
      image: await smallThumb(image),
      source: 'demo',
    };
  }
}

/** Open Food Facts 공개 DB에서 바코드로 제품을 찾습니다. */
export type BarcodeResult = { product: ProductDraft | null; via: 'server' | 'direct' };

/** 바코드 조회: 앱 서버(공유 DB·Open Food Facts·식품안전나라) → 서버가 없으면 Open Food Facts 직접 */
export async function lookupBarcode(code: string): Promise<BarcodeResult> {
  const clean = code.replace(/\D/g, '');
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}api/barcode?code=${clean}`);
    const isJson = (r.headers.get('content-type') || '').includes('application/json');
    if (isJson) {
      if (r.status === 404) return { product: null, via: 'server' };
      if (r.status === 400) throw new Error('invalid');
      if (r.ok) {
        const { product } = await r.json() as { product: ProductDraft };
        return { product, via: 'server' };
      }
    }
  } catch (e) {
    if ((e as Error).message === 'invalid') throw e;
  }
  // 예비 주소(GitHub Pages)처럼 서버가 없을 때
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=${OFF_FIELDS}`);
  if (!res.ok) return { product: null, via: 'direct' };
  const data = await res.json();
  const p = data.status === 1 ? fromOff(clean, data.product) : null;
  return { product: p, via: 'direct' };
}

/** 공유 DB에 없던 바코드를 표시사항 분석 결과로 등록합니다. (사진·개인정보는 보내지 않음) */
export function contributeProduct(code: string, p: ProductDraft) {
  if (IS_PREVIEW || p.source !== 'label-ai') return;
  const { name, brand, per100g, additives, ingredientsText } = p;
  fetch(`${import.meta.env.BASE_URL}api/barcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, product: { name, brand, per100g, additives, ingredientsText } }),
    keepalive: true,
  }).catch(() => {});
}

/** 사용자가 동의한 경우에만 익명 트렌드(사진·개인정보 제외)를 보냅니다. */
export function shareTrend(anonId: string, event: Record<string, string | number | boolean>) {
  fetch(`${import.meta.env.BASE_URL}api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anonId, ...event, at: new Date().toISOString().slice(0, 13) }),
    keepalive: true,
  }).catch(() => {});
}
