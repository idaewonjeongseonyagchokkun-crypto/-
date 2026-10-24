import { actions, today, useStore } from '../lib/store';
import { DAILY_REFERENCE, dayTotals, fmt, mealTotals } from '../lib/nutrition';
import { mealsOn } from '../lib/insights';
import { Bowl, Icon } from '../ui';

export function Today({ onCapture, onSettings }: { onCapture: () => void; onSettings: () => void }) {
  const meals = useStore((s) => s.meals);
  const day = useStore((s) => s.days[today()]);
  const todays = mealsOn(meals, today());
  const t = dayTotals(todays);
  const date = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

  const macros = [
    { label: '탄수화물', v: t.carbG, ref: DAILY_REFERENCE.carbG, unit: 'g' },
    { label: '단백질', v: t.proteinG, ref: DAILY_REFERENCE.proteinG, unit: 'g' },
    { label: '지방', v: t.fatG, ref: DAILY_REFERENCE.fatG, unit: 'g' },
    { label: '나트륨', v: t.sodiumMg, ref: DAILY_REFERENCE.sodiumMg, unit: 'mg', warnOver: true },
  ];

  return (
    <>
      <header className="top">
        <div>
          <p>{date}</p>
          <h1>오늘의 그릇</h1>
        </div>
        <button className="icon-btn" onClick={onSettings} aria-label="설정과 내 데이터"><Icon.gear /></button>
      </header>

      <section className="bowl-wrap" aria-live="polite">
        <Bowl ratio={t.kcal / DAILY_REFERENCE.kcal} />
        <div className="bowl-number">{fmt(t.kcal)}<span className="small muted"> kcal</span></div>
        <div className="bowl-label">1일 기준 {fmt(DAILY_REFERENCE.kcal)}kcal 중 사진으로 추정한 양</div>
      </section>

      <div className="macros">
        {macros.map((m) => {
          const pct = Math.min(100, (m.v / m.ref) * 100);
          return (
            <div key={m.label} className={`macro${m.warnOver && m.v > m.ref ? ' over' : ''}`}>
              <div className="row"><span>{m.label}</span><span className="kcal">{fmt(m.v)}{m.unit}</span></div>
              <div className="bar" role="progressbar" aria-label={m.label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
      </div>

      <h2>오늘 먹은 것</h2>
      {todays.length === 0 ? (
        <div className="empty">
          <p style={{ margin: '0 0 14px' }}>아직 기록이 없어요. 밥상을 위에서 한 장 찍으면 끝입니다.</p>
          <button className="btn" onClick={onCapture}><Icon.camera />한끼 찍기</button>
        </div>
      ) : (
        <ul className="list">
          {todays.map((m) => {
            const mt = mealTotals(m);
            const time = new Date(m.at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
            return (
              <li key={m.id}>
                {m.photo ? <img className="thumb" src={m.photo} alt="" /> : <div className="thumb">{m.slot[0]}</div>}
                <div className="grow">
                  <h3 className="ellipsis">{m.items.map((i) => i.name).join(', ')}</h3>
                  <div className="small muted">{m.slot} · {time}{m.source === 'demo' ? ' · 예시값' : ''}</div>
                </div>
                <span className="kcal">{fmt(mt.kcal)}</span>
                <button className="x-btn" aria-label={`${m.slot} 기록 삭제`} onClick={() => actions.removeMeal(m.id)}><Icon.close /></button>
              </li>
            );
          })}
        </ul>
      )}

      <h2>물</h2>
      <div className="list">
        <div className="stepper">
          <span>오늘 마신 물 <span className="muted small">(1잔 200ml)</span></span>
          <div className="ctrl">
            <button aria-label="물 한 잔 빼기" onClick={() => actions.updateDay(today(), { waterCups: Math.max(0, (day?.waterCups ?? 0) - 1) })}>−</button>
            <output aria-live="polite">{day?.waterCups ?? 0}잔</output>
            <button aria-label="물 한 잔 더하기" onClick={() => actions.updateDay(today(), { waterCups: (day?.waterCups ?? 0) + 1 })}>+</button>
          </div>
        </div>
      </div>

      <p className="small muted" style={{ marginTop: 24 }}>사진으로 계산한 값은 추정치입니다. 정확한 영양 정보는 제품 표시사항을 확인하세요.</p>
    </>
  );
}
