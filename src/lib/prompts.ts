/** 사진 분석 지시문. 서버(api/analyze.ts)와 미리보기 페이지가 같은 문구를 씁니다. */
export const MEAL_PROMPT = `사진 속 음식을 한국 가정식 기준으로 알아보고 1회 섭취량과 영양값을 추정하세요.
반드시 아래 JSON만 출력하세요. 설명 문장, 코드블록 표시는 쓰지 마세요.
{"items":[{"name":"음식 이름","portion":"양 (예: 1공기 210g)","kcal":0,"carbG":0,"proteinG":0,"fatG":0,"sodiumMg":0,"sugarG":0,"confidence":0.0}]}
규칙: 보이는 음식마다 한 항목. 음식이 아니면 {"items":[]}. 건강 효과·질병에 대한 표현은 쓰지 마세요.`;

export const LABEL_PROMPT = `사진은 식품 포장의 원재료명·영양성분표입니다. 보이는 글자만 옮기세요. 없는 값은 null.
반드시 아래 JSON만 출력하세요.
{"name":"제품명","brand":"회사명","ingredientsText":"원재료명 전체","per100g":{"kcal":null,"sugarG":null,"satFatG":null,"sodiumMg":null,"fiberG":null,"proteinG":null}}
영양성분이 1회 제공량 기준으로만 적혀 있으면 표시된 총 내용량으로 100g당 값으로 환산하세요.`;
