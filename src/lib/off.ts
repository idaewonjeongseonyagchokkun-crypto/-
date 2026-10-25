/** Open Food Facts 응답을 앱의 제품 형식으로 바꿉니다. (브라우저·서버 공용, DOM 없음) */
export interface ProductInfo {
  barcode?: string;
  name: string;
  brand?: string;
  image?: string;
  per100g: Partial<Record<'kcal' | 'sugarG' | 'satFatG' | 'sodiumMg' | 'fiberG' | 'proteinG', number>>;
  additives: string[];
  ingredientsText?: string;
  nova?: number;
  source: 'openfoodfacts' | 'shared' | 'foodsafety';
  /** 이름만 찾았고 영양성분은 없을 때 true — 표시사항 사진으로 채워야 함 */
  partial?: boolean;
}

export const OFF_FIELDS = 'product_name,product_name_ko,product_name_en,generic_name,brands,nutriments,additives_tags,nova_group,ingredients_text,ingredients_text_ko,image_front_small_url';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromOff(code: string, p: any): ProductInfo | null {
  if (!p) return null;
  const n = p.nutriments ?? {};
  const pick = (k: string) => (typeof n[k] === 'number' && Number.isFinite(n[k]) ? n[k] : typeof n[k] === 'string' && n[k] !== '' && !isNaN(+n[k]) ? +n[k] : undefined);
  const kcal = pick('energy-kcal_100g') ?? (pick('energy_100g') != null ? Math.round(pick('energy_100g')! / 4.184) : undefined);
  const sodiumG = pick('sodium_100g') ?? (pick('salt_100g') != null ? pick('salt_100g')! / 2.5 : undefined);
  const per100g = {
    kcal,
    sugarG: pick('sugars_100g'),
    satFatG: pick('saturated-fat_100g'),
    sodiumMg: sodiumG != null ? Math.round(sodiumG * 1000) : undefined,
    fiberG: pick('fiber_100g'),
    proteinG: pick('proteins_100g'),
  };
  const name = p.product_name_ko || p.product_name || p.product_name_en || p.generic_name;
  const hasNutrition = Object.values(per100g).some((v) => v != null);
  if (!name && !hasNutrition) return null;
  return {
    barcode: code,
    name: String(name || `바코드 ${code}`).slice(0, 80),
    brand: p.brands ? String(p.brands).split(',')[0].trim().slice(0, 40) : undefined,
    image: typeof p.image_front_small_url === 'string' && p.image_front_small_url.startsWith('https://') ? p.image_front_small_url : undefined,
    per100g,
    additives: (Array.isArray(p.additives_tags) ? p.additives_tags : []).map((t: string) => String(t).replace(/^[a-z]{2}:/, '').toUpperCase()).slice(0, 30),
    ingredientsText: String(p.ingredients_text_ko || p.ingredients_text || '').slice(0, 1200) || undefined,
    nova: typeof p.nova_group === 'number' ? p.nova_group : undefined,
    source: 'openfoodfacts',
    partial: !hasNutrition,
  };
}
