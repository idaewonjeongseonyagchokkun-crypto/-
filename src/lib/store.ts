import { useSyncExternalStore } from 'react';
import type { DayLog, FoodItem, Meal, ScannedProduct, Settings } from './types';
import { IS_PREVIEW } from './target';

/** 모든 기록은 이 기기(localStorage)에만 저장됩니다. */
interface State {
  meals: Meal[];
  products: ScannedProduct[];
  days: Record<string, DayLog>;
  settings: Settings;
  /** 사용자가 직접 만든 음식 (다음에 한 번에 고를 수 있게) */
  myFoods: FoodItem[];
}

const KEY = 'hankki:v1';

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function load(): State {
  const empty: State = { meals: [], products: [], days: {}, settings: { shareTrends: false, anonId: uid() }, myFoods: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return IS_PREVIEW ? exampleState(empty) : empty;
    const parsed = JSON.parse(raw) as Partial<State>;
    return { ...empty, ...parsed, settings: { ...empty.settings, ...parsed.settings } };
  } catch {
    return IS_PREVIEW ? exampleState(empty) : empty;
  }
}

/** 미리보기 첫 화면용 예시 기록 (모두 '예시값'으로 표시됨) */
function exampleState(base: State): State {
  const at = (daysAgo: number, h: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(h, 10, 0, 0);
    return d.toISOString();
  };
  const f = (name: string, portion: string, kcal: number, carbG: number, proteinG: number, fatG: number, sodiumMg: number) =>
    ({ name, portion, kcal, carbG, proteinG, fatG, sodiumMg, sugarG: 0, confidence: 0.6 });
  const meals: Meal[] = [];
  for (let d = 5; d >= 0; d--) {
    meals.unshift({ id: uid(), at: at(d, 8), slot: '아침', portionScale: 1, source: 'demo', items: [f('현미밥', '1공기 (210g)', 300, 64, 6, 2, 5), f('계란말이', '3조각', 150, 2, 10, 11, 280)] });
    if (d > 0) meals.unshift({ id: uid(), at: at(d, d % 2 ? 21 : 19), slot: '저녁', portionScale: 1, source: 'demo', items: [f('김치찌개', '1그릇 (300g)', 220, 10, 14, 13, 1600), f('잡곡밥', '1공기 (210g)', 310, 68, 6, 1, 5)] });
  }
  const today = new Date();
  const key = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return {
    ...base,
    meals,
    products: [{
      id: uid(), at: new Date().toISOString(), name: '초코 크림 비스킷 (예시)', brand: '예시제과', source: 'demo',
      per100g: { kcal: 510, sugarG: 31, satFatG: 12, sodiumMg: 380, proteinG: 6 },
      additives: ['합성향료', '유화제', '산도조절제', '카라멜색소'], ingredientsText: '밀가루, 설탕, 팜유, 코코아분말, 합성향료, 유화제, 산도조절제, 카라멜색소', nova: 4,
    }],
    days: { [key]: { date: key, waterCups: 4, sleepHours: 6.5 } },
  };
}

/** 최근 식사가 앞에 오도록 (지난 날짜로 적은 기록도 제자리에) */
function sortMeals(meals: Meal[]) {
  return [...meals].sort((a, b) => b.at.localeCompare(a.at));
}

let state: State = load();
const listeners = new Set<() => void>();

function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장 공간이 가득 차면 사진 썸네일부터 비웁니다.
    state = { ...state, meals: state.meals.map((m) => ({ ...m, photo: undefined })) };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 저장 불가 — 메모리에만 유지 */ }
  }
  listeners.forEach((l) => l());
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => select(state),
  );
}

export const today = (d = new Date()) => {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return t.toISOString().slice(0, 10);
};

export const actions = {
  newId: uid,
  addMeal(meal: Omit<Meal, 'id'>) {
    const m = { ...meal, id: uid() };
    commit({ ...state, meals: sortMeals([m, ...state.meals]).slice(0, 800) });
    return m;
  },
  updateMeal(id: string, patch: Omit<Meal, 'id'>) {
    commit({ ...state, meals: sortMeals(state.meals.map((m) => (m.id === id ? { ...patch, id } : m))) });
  },
  /** 지운 기록을 돌려받을 수 있게 지운 식사를 돌려줍니다. */
  removeMeal(id: string) {
    const gone = state.meals.find((m) => m.id === id);
    commit({ ...state, meals: state.meals.filter((m) => m.id !== id) });
    return gone;
  },
  restoreMeal(meal: Meal) {
    if (state.meals.some((m) => m.id === meal.id)) return;
    commit({ ...state, meals: sortMeals([meal, ...state.meals]) });
  },
  /** 직접 입력한 음식을 '내 음식'에 남깁니다. 같은 이름이면 새 값으로 바꿉니다. */
  saveMyFood(f: FoodItem) {
    const item = { ...f, custom: true };
    commit({ ...state, myFoods: [item, ...state.myFoods.filter((x) => x.name !== f.name)].slice(0, 60) });
  },
  removeMyFood(name: string) {
    commit({ ...state, myFoods: state.myFoods.filter((x) => x.name !== name) });
  },
  addProduct(p: Omit<ScannedProduct, 'id' | 'at'>) {
    const item = { ...p, id: uid(), at: new Date().toISOString() };
    commit({ ...state, products: [item, ...state.products.filter((x) => !p.barcode || x.barcode !== p.barcode)].slice(0, 200) });
    return item;
  },
  updateDay(date: string, patch: Partial<DayLog>) {
    const prev = state.days[date] ?? { date, waterCups: 0 };
    commit({ ...state, days: { ...state.days, [date]: { ...prev, ...patch } } });
  },
  updateSettings(patch: Partial<Settings>) {
    commit({ ...state, settings: { ...state.settings, ...patch } });
  },
  exportJson() {
    return JSON.stringify({ ...state, settings: { ...state.settings, anonId: undefined } }, null, 2);
  },
  resetAll() {
    commit({ meals: [], products: [], days: {}, settings: { shareTrends: false, anonId: uid() }, myFoods: [] });
  },
  snapshot: () => state,
};
