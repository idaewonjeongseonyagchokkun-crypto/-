import type { FoodItem, ScannedProduct } from './types';
import { detectAdditives } from './nutrition';
import { IS_PREVIEW } from './target';
import { LABEL_PROMPT, MEAL_PROMPT } from './prompts';

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

type ProductDraft = Omit<ScannedProduct, 'id' | 'at'>;

/** 원재료·영양성분표 사진을 AI로 읽습니다. */
export async function analyzeLabel(image: string): Promise<ProductDraft> {
  try {
    const d = await postAnalyze('label', image);
    const ingredients = String(d.ingredientsText ?? '');
    return {
      name: String(d.name || '이름 없는 제품').slice(0, 60),
      brand: d.brand ? String(d.brand).slice(0, 40) : undefined,
      per100g: {
        kcal: d.per100g?.kcal ?? undefined,
        sugarG: d.per100g?.sugarG ?? undefined,
        satFatG: d.per100g?.satFatG ?? undefined,
        sodiumMg: d.per100g?.sodiumMg ?? undefined,
        fiberG: d.per100g?.fiberG ?? undefined,
        proteinG: d.per100g?.proteinG ?? undefined,
      },
      additives: detectAdditives(ingredients),
      ingredientsText: ingredients.slice(0, 1200),
      image,
      source: 'label-ai',
    };
  } catch {
    await new Promise((r) => setTimeout(r, 900));
    const ingredients = '밀가루, 설탕, 팜유, 물엿, 정제소금, 합성향료, 산도조절제, 유화제, 카라멜색소';
    return {
      name: '예시 과자 (데모)',
      per100g: { kcal: 520, sugarG: 24, satFatG: 11, sodiumMg: 480, proteinG: 5 },
      additives: detectAdditives(ingredients),
      ingredientsText: ingredients,
      image,
      source: 'demo',
    };
  }
}

/** Open Food Facts 공개 DB에서 바코드로 제품을 찾습니다. */
export async function lookupBarcode(code: string): Promise<ProductDraft | null> {
  const clean = code.replace(/\D/g, '');
  if (clean.length < 8 || clean.length > 14) return null;
  const fields = 'product_name,product_name_ko,brands,nutriments,additives_tags,nova_group,ingredients_text,ingredients_text_ko,image_front_small_url';
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=${fields}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const n = p.nutriments ?? {};
  const pick = (k: string) => (typeof n[k] === 'number' ? n[k] : undefined);
  const sodiumG = pick('sodium_100g') ?? (pick('salt_100g') != null ? pick('salt_100g')! / 2.5 : undefined);
  return {
    barcode: clean,
    name: p.product_name_ko || p.product_name || `바코드 ${clean}`,
    brand: p.brands,
    image: p.image_front_small_url,
    per100g: {
      kcal: pick('energy-kcal_100g'),
      sugarG: pick('sugars_100g'),
      satFatG: pick('saturated-fat_100g'),
      sodiumMg: sodiumG != null ? Math.round(sodiumG * 1000) : undefined,
      fiberG: pick('fiber_100g'),
      proteinG: pick('proteins_100g'),
    },
    additives: (p.additives_tags ?? []).map((t: string) => t.replace(/^en:/, '').toUpperCase()),
    ingredientsText: p.ingredients_text_ko || p.ingredients_text,
    nova: typeof p.nova_group === 'number' ? p.nova_group : undefined,
    source: 'openfoodfacts',
  };
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
