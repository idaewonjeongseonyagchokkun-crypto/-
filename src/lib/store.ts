import { useSyncExternalStore } from 'react';
import type { DayLog, Meal, ScannedProduct, Settings } from './types';

/** 모든 기록은 이 기기(localStorage)에만 저장됩니다. */
interface State {
  meals: Meal[];
  products: ScannedProduct[];
  days: Record<string, DayLog>;
  settings: Settings;
}

const KEY = 'hankki:v1';

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function load(): State {
  const empty: State = { meals: [], products: [], days: {}, settings: { shareTrends: false, anonId: uid() } };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<State>;
    return { ...empty, ...parsed, settings: { ...empty.settings, ...parsed.settings } };
  } catch {
    return empty;
  }
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
    commit({ ...state, meals: [m, ...state.meals].slice(0, 500) });
    return m;
  },
  removeMeal(id: string) {
    commit({ ...state, meals: state.meals.filter((m) => m.id !== id) });
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
    commit({ meals: [], products: [], days: {}, settings: { shareTrends: false, anonId: uid() } });
  },
  snapshot: () => state,
};
