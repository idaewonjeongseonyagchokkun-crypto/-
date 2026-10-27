import type { DayLog, Meal, ScannedProduct } from './types';
import { DAILY_REFERENCE, dayTotals, scoreProduct } from './nutrition';
import { today } from './store';

export interface Insight {
  title: string;
  body: string;
  tone: 'good' | 'watch' | 'info';
}

/** 최근 7일 날짜 (오래된 날 → 오늘) */
export function lastDays(n = 7) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return today(d);
  });
}

export function mealsOn(meals: Meal[], date: string) {
  return meals.filter((m) => today(new Date(m.at)) === date);
}

/** 오늘(또는 오늘 아직 안 적었으면 어제)부터 거꾸로 이어진 기록 일수 */
export function streakDays(meals: Meal[]) {
  const days = new Set(meals.map((m) => today(new Date(m.at))));
  const d = new Date();
  if (!days.has(today(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(today(d)) && n < 366) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/**
 * 기록에서 생활 패턴을 찾아 문장으로 돌려줍니다.
 * 모든 문장은 '기록 사실'만 말하고, 건강 효과나 질병과 연결하지 않습니다.
 */
export function buildInsights(meals: Meal[], days: Record<string, DayLog>, products: ScannedProduct[]): Insight[] {
  const week = lastDays(7);
  const out: Insight[] = [];
  const loggedDays = week.filter((d) => mealsOn(meals, d).length > 0);

  if (loggedDays.length === 0) {
    return [{ title: '첫 한끼를 남겨 보세요', body: '사진을 찍거나 한 줄로 적어 세 끼 이상 남기면 나만의 식사 패턴이 여기에 정리됩니다.', tone: 'info' }];
  }

  // 연속 기록
  const streak = streakDays(meals);
  if (streak >= 2) out.push({ title: `${streak}일 연속 기록 중`, body: '기록이 쌓일수록 패턴 분석이 정확해집니다.', tone: 'good' });

  // 세 끼 도장
  const full = loggedDays.filter((d) => ['아침', '점심', '저녁'].every((x) => mealsOn(meals, d).some((m) => m.slot === x))).length;
  if (full >= 1) out.push({ title: `세 끼 도장 완성 ${full}일`, body: '아침·점심·저녁을 모두 남긴 날입니다. 빠짐없이 적을수록 하루 합계가 실제에 가까워집니다.', tone: 'good' });
  const breakfast = loggedDays.filter((d) => mealsOn(meals, d).some((m) => m.slot === '아침')).length;
  if (loggedDays.length >= 4 && breakfast <= 1) out.push({ title: `아침 기록 ${breakfast}일`, body: `이번 주 기록한 ${loggedDays.length}일 중 아침 기록이 있는 날입니다. 먹었는데 빠뜨렸다면 '글로 적기'로 지난 날짜에도 남길 수 있어요.`, tone: 'info' });

  // 늦은 저녁
  const late = loggedDays.filter((d) => mealsOn(meals, d).some((m) => new Date(m.at).getHours() >= 21)).length;
  if (late >= 2) out.push({ title: `밤 9시 이후 식사 ${late}일`, body: '이번 주 늦은 시간 식사가 있었던 날입니다. 저녁 시간을 앞당길 수 있는 날이 있는지 살펴보세요.', tone: 'watch' });

  // 나트륨
  const salty = loggedDays.filter((d) => dayTotals(mealsOn(meals, d)).sodiumMg > DAILY_REFERENCE.sodiumMg).length;
  if (salty >= 1) out.push({ title: `나트륨 추정치가 기준치를 넘은 날 ${salty}일`, body: `1일 영양성분 기준치 ${DAILY_REFERENCE.sodiumMg.toLocaleString()}mg을 넘은 날입니다. 국물 양을 조절하면 숫자가 바로 달라집니다.`, tone: 'watch' });

  // 단백질 비중
  const totals = loggedDays.map((d) => dayTotals(mealsOn(meals, d)));
  const avgProtein = totals.reduce((a, t) => a + t.proteinG, 0) / totals.length;
  if (avgProtein < DAILY_REFERENCE.proteinG * 0.6) out.push({ title: '단백질 반찬이 적은 편', body: `기록한 날 하루 평균 단백질 추정치는 ${Math.round(avgProtein)}g입니다. 두부·달걀·생선 반찬을 한 가지 더해 보세요.`, tone: 'watch' });
  else out.push({ title: '단백질 반찬을 꾸준히 챙김', body: `기록한 날 하루 평균 단백질 추정치 ${Math.round(avgProtein)}g.`, tone: 'good' });

  // 간식
  const snacks = meals.filter((m) => week.includes(today(new Date(m.at))) && m.slot === '간식').length;
  if (snacks >= 4) out.push({ title: `이번 주 간식 ${snacks}번`, body: '간식을 고를 때 스캔으로 원재료가 짧은 제품을 비교해 보세요.', tone: 'info' });

  // 수면·물
  const sleeps = week.map((d) => days[d]?.sleepHours).filter((v): v is number => v != null);
  if (sleeps.length >= 3) {
    const avg = sleeps.reduce((a, b) => a + b, 0) / sleeps.length;
    out.push({ title: `평균 수면 ${avg.toFixed(1)}시간`, body: `${sleeps.length}일 기록 기준입니다.`, tone: avg >= 7 ? 'good' : 'info' });
  }
  const water = week.map((d) => days[d]?.waterCups ?? 0).filter((v) => v > 0);
  if (water.length >= 3) {
    const avg = water.reduce((a, b) => a + b, 0) / water.length;
    out.push({ title: `물 하루 평균 ${avg.toFixed(1)}잔`, body: '기록한 날 기준입니다.', tone: 'info' });
  }

  // 스캔
  const recent = products.filter((p) => week.includes(today(new Date(p.at))));
  if (recent.length >= 2) {
    const low = recent.filter((p) => scoreProduct(p).value < 50).length;
    out.push({ title: `이번 주 스캔 ${recent.length}개`, body: low ? `그중 ${low}개가 '아쉬움' 이하였습니다. 같은 종류 제품을 한 번 더 비교해 보세요.` : '스캔한 제품이 모두 보통 이상이었습니다.', tone: low ? 'watch' : 'good' });
  }

  return out;
}
