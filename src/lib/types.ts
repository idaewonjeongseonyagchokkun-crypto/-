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
  /** 사용자가 직접 입력한 음식 (영양값을 사용자가 적었거나 모름) */
  custom?: boolean;
}

export interface Meal {
  id: string;
  at: string; // ISO
  slot: MealSlot;
  items: FoodItem[];
  portionScale: number; // 사용자가 조정한 양 (0.5 ~ 2)
  photo?: string; // 작은 썸네일 dataURL
  /** ai: 사진 분석, text: 글로 쓴 식단을 AI가 추정, manual: 목록·직접 입력, demo: 예시 */
  source: 'ai' | 'text' | 'demo' | 'manual';
  memo?: string; // 사용자가 적은 메모 (이 기기에만 저장, 공유하지 않음)
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
  source: 'openfoodfacts' | 'shared' | 'foodsafety' | 'label-ai' | 'demo';
  /** 이름만 찾았고 영양성분표는 아직 없음 */
  partial?: boolean;
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
  /** 마지막으로 쓴 기록 방법 (다음에 그 화면부터 엽니다) */
  entryMode?: EntryMode;
}

export type EntryMode = 'photo' | 'write' | 'pick';

export interface Score {
  value: number; // 0~100
  grade: '좋음' | '보통' | '아쉬움' | '주의';
  reasons: { text: string; tone: 'good' | 'bad' | 'neutral' }[];
}
