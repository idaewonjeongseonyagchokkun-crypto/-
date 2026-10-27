import { actions, today, useStore } from '../lib/store';
import { dayTotals, fmt } from '../lib/nutrition';
import { buildInsights, lastDays, mealsOn } from '../lib/insights';

function Stepper({ label, unit, value, step, max, onChange }: { label: string; unit: string; value: number | undefined; step: number; max: number; onChange: (v: number) => void }) {
  const v = value ?? 0;
  return (
    <div className="stepper">
      <span>{label}</span>
      <div className="ctrl">
        <button aria-label={`${label} 줄이기`} onClick={() => onChange(Math.max(0, +(v - step).toFixed(1)))}>−</button>
        <output aria-live="polite">{value == null ? '–' : `${v}${unit}`}</output>
        <button aria-label={`${label} 늘리기`} onClick={() => onChange(Math.min(max, +(v + step).toFixed(1)))}>+</button>
      </div>
    </div>
  );
}

export function Rhythm({ onPickDay }: { onPickDay: (date: string) => void }) {
  const meals = useStore((s) => s.meals);
  const days = useStore((s) => s.days);
  const products = useStore((s) => s.products);
  const week = lastDays(7);
  const kcals = week.map((d) => dayTotals(mealsOn(meals, d)).kcal);
  const max = Math.max(2000, ...kcals);
  const t = today();
  const d = days[t];
  const insights = buildInsights(meals, days, products);

  return (
    <>
      <header className="top">
        <div>
          <p>최근 7일</p>
          <h1>나의 리듬</h1>
        </div>
      </header>

      <div className="week" role="group" aria-label="최근 7일 열량 추정치. 날짜를 누르면 그날 기록을 엽니다">
        {week.map((w, i) => (
          <button key={w} className={`col${w === t ? ' today' : ''}`} onClick={() => onPickDay(w)} aria-label={`${w.slice(5).replace('-', '월 ')}일 ${Math.round(kcals[i])}kcal, 기록 보기`}>
            <span>{kcals[i] ? fmt(kcals[i]) : ''}</span>
            <i style={{ height: `${Math.max(4, (kcals[i] / max) * 90)}px` }} />
            <span>{new Date(w + 'T12:00').toLocaleDateString('ko-KR', { weekday: 'narrow' })}</span>
          </button>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 6 }}>하루 열량 추정치 (kcal) · 막대를 누르면 그날 기록을 보고 빠진 끼니를 더할 수 있어요</p>

      <h2>이번 주 발견한 것</h2>
      <ul className="list">
        {insights.map((ins, i) => (
          <li key={i} className={`insight ${ins.tone}`} style={{ display: 'block' }}>
            <h3>{ins.title}</h3>
            <p>{ins.body}</p>
          </li>
        ))}
      </ul>

      <h2>오늘 생활 기록</h2>
      <div className="list">
        <Stepper label="잠잔 시간" unit="시간" value={d?.sleepHours} step={0.5} max={14} onChange={(v) => actions.updateDay(t, { sleepHours: v })} />
        <div style={{ borderTop: '1px solid var(--line)' }} />
        <Stepper label="움직인 시간" unit="분" value={d?.activeMinutes} step={10} max={300} onChange={(v) => actions.updateDay(t, { activeMinutes: v })} />
        <div style={{ borderTop: '1px solid var(--line)' }} />
        <Stepper label="마신 물" unit="잔" value={d?.waterCups} step={1} max={20} onChange={(v) => actions.updateDay(t, { waterCups: v })} />
      </div>
    </>
  );
}
