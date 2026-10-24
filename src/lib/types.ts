export type MealSlot = '아침' | '점심' | '저녁' | '간식';

/** 한 가지 음식의 추정 영양값 (1회 섭취량 기준) */
export interface FoodItem {
  name: string;
  portion: string;
  kcal: number;
  carbG: number;
  proteinG: number;
  fatG: number;
  sodiumMg: number;
  sugarG: number;
  confidence: number; // 0~1
}

export interface Meal {
  id: string;
  at: string; // ISO
  slot: MealSlot;
  items: FoodItem[];
  portionScale: number; // 사용자가 조정한 양 (0.5 ~ 2)
  photo?: string; // 작은 썸네일 dataURL
  source: 'ai' | 'demo' | 'manual';
}

export interface ScannedProduct {
  id: string;
  at: string;
  barcode?: string;
  name: string;
  brand?: string;
  image?: string;
  per100g: Partial<Record<'kcal' | 'sugarG' | 'satFatG' | 'sodiumMg' | 'fiberG' | 'proteinG', number>>;
  additives: string[];
  ingredientsText?: string;
  nova?: number;
  source: 'openfoodfacts' | 'label-ai' | 'demo';
}

export interface DayLog {
  date: string; // YYYY-MM-DD
  waterCups: number;
  sleepHours?: number;
  activeMinutes?: number;
}

export interface Settings {
  shareTrends: boolean;
  anonId: string;
  name?: string;
}

export interface Score {
  value: number; // 0~100
  grade: '좋음' | '보통' | '아쉬움' | '주의';
  reasons: { text: string; tone: 'good' | 'bad' | 'neutral' }[];
}
