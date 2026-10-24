import type { FoodItem, Meal, ScannedProduct, Score } from './types';

/** 식품 등의 표시기준 1일 영양성분 기준치 (성인, 2,000kcal 기준) */
export const DAILY_REFERENCE = {
  kcal: 2000,
  carbG: 324,
  proteinG: 55,
  fatG: 54,
  sodiumMg: 2000,
  sugarG: 100,
};

export function mealTotals(meal: Meal) {
  return sumItems(meal.items, meal.portionScale);
}

export function sumItems(items: FoodItem[], scale = 1) {
  const t = { kcal: 0, carbG: 0, proteinG: 0, fatG: 0, sodiumMg: 0, sugarG: 0 };
  for (const i of items) {
    t.kcal += i.kcal * scale;
    t.carbG += i.carbG * scale;
    t.proteinG += i.proteinG * scale;
    t.fatG += i.fatG * scale;
    t.sodiumMg += i.sodiumMg * scale;
    t.sugarG += i.sugarG * scale;
  }
  return t;
}

export function dayTotals(meals: Meal[]) {
  return meals.reduce(
    (acc, m) => {
      const t = mealTotals(m);
      (Object.keys(acc) as (keyof typeof acc)[]).forEach((k) => (acc[k] += t[k]));
      return acc;
    },
    { kcal: 0, carbG: 0, proteinG: 0, fatG: 0, sodiumMg: 0, sugarG: 0 },
  );
}

const fmt = (n: number, d = 0) => n.toLocaleString('ko-KR', { maximumFractionDigits: d });
export { fmt };

/**
 * 영양·첨가물 기준 점수 (0~100).
 * Nutri-Score의 100g당 구간 방식을 단순화했습니다. 질병 예방·개선 효능을 뜻하지 않습니다.
 */
export function scoreProduct(p: ScannedProduct): Score {
  const n = p.per100g;
  const reasons: Score['reasons'] = [];
  let value = 100;

  const band = (v: number | undefined, steps: number[]) => (v == null ? 0 : steps.filter((s) => v > s).length);

  const sugarPts = band(n.sugarG, [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45]);
  const satPts = band(n.satFatG, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const sodiumPts = band(n.sodiumMg, [90, 180, 270, 360, 450, 540, 630, 720, 810, 900]);
  const kcalPts = band(n.kcal, [80, 160, 240, 320, 400, 480, 560, 640, 720, 800]);
  value -= sugarPts * 3 + satPts * 2.5 + sodiumPts * 2.5 + kcalPts * 1.5;

  if (n.sugarG != null) reasons.push(n.sugarG > 22.5 ? { text: `당류가 많은 편 (100g당 ${fmt(n.sugarG, 1)}g)`, tone: 'bad' } : n.sugarG <= 5 ? { text: `당류가 적은 편 (100g당 ${fmt(n.sugarG, 1)}g)`, tone: 'good' } : { text: `당류 100g당 ${fmt(n.sugarG, 1)}g`, tone: 'neutral' });
  if (n.sodiumMg != null) reasons.push(n.sodiumMg > 600 ? { text: `나트륨이 많은 편 (100g당 ${fmt(n.sodiumMg)}mg)`, tone: 'bad' } : n.sodiumMg <= 120 ? { text: `나트륨이 적은 편 (100g당 ${fmt(n.sodiumMg)}mg)`, tone: 'good' } : { text: `나트륨 100g당 ${fmt(n.sodiumMg)}mg`, tone: 'neutral' });
  if (n.satFatG != null && n.satFatG > 5) reasons.push({ text: `포화지방이 많은 편 (100g당 ${fmt(n.satFatG, 1)}g)`, tone: 'bad' });

  const fiberPts = band(n.fiberG, [0.9, 1.9, 2.8, 3.7, 4.7]);
  const proteinPts = band(n.proteinG, [1.6, 3.2, 4.8, 6.4, 8]);
  value += fiberPts * 2 + proteinPts * 1.5;
  if (fiberPts >= 3) reasons.push({ text: '식이섬유가 들어 있음', tone: 'good' });
  if (proteinPts >= 4) reasons.push({ text: '단백질이 들어 있음', tone: 'good' });

  const add = p.additives.length;
  value -= Math.min(add, 8) * 2.5;
  if (add === 0) reasons.push({ text: '확인된 식품첨가물 없음', tone: 'good' });
  else reasons.push({ text: `식품첨가물 ${add}종 확인`, tone: add >= 4 ? 'bad' : 'neutral' });

  if (p.nova === 4) {
    value -= 8;
    reasons.push({ text: '여러 단계 가공을 거친 제품군', tone: 'bad' });
  }

  const known = Object.values(n).filter((v) => v != null).length;
  if (known < 2) reasons.push({ text: '영양 정보가 부족해 점수가 정확하지 않을 수 있음', tone: 'neutral' });

  value = Math.max(0, Math.min(100, Math.round(value)));
  const grade: Score['grade'] = value >= 75 ? '좋음' : value >= 50 ? '보통' : value >= 25 ? '아쉬움' : '주의';
  return { value, grade, reasons };
}

/** 첨가물 원재료명에서 자주 쓰이는 표기 (라벨 판독 보조용) */
export const ADDITIVE_HINTS = [
  '향료', '합성향료', '착색료', '색소', '보존료', '소브산', '안식향산', '아질산나트륨', '아스파탐', '수크랄로스', '아세설팜칼륨',
  '사카린', '감미료', '산도조절제', '유화제', '증점제', '글루탐산나트륨', 'L-글루탐산나트륨', '향미증진제', '카라멜색소', '카라기난',
  '잔탄검', '구아검', '인산염', '폴리인산나트륨', '피로인산나트륨', '변성전분', '이산화티타늄', '산화방지제', 'BHT', 'BHA', '타르색소',
];

export function detectAdditives(ingredients: string): string[] {
  const found = new Set<string>();
  for (const h of ADDITIVE_HINTS) if (ingredients.includes(h)) found.add(h);
  for (const m of ingredients.matchAll(/\bE ?\d{3}[a-z]?\b/gi)) found.add(m[0].replace(' ', '').toUpperCase());
  const list = [...found];
  // '합성향료'를 찾았으면 그 안의 '향료'는 중복으로 세지 않습니다.
  return list.filter((a) => !list.some((b) => b !== a && b.includes(a)));
}
