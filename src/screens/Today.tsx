import { actions, today, useStore } from '../lib/store';
import { DAILY_REFERENCE, dayTotals, fmt, mealTotals } from '../lib/nutrition';
import { mealsOn, streakDays } from '../lib/insights';
import { Bowl, Icon, type ToastMsg } from '../ui';
import type { EntryMode, Meal, MealSlot } from '../lib/types';

const STAMP_SLOTS: MealSlot[] = ['아침', '점심', '저녁'];

function shiftDay(date: string, by: number) {
  const [y, m, d] = date.split('-').map(Number);
  return today(new Date(y, m - 1, d + by));
}

export function Today({ date, onDate, onCapture, onEdit, onSettings, toast }: {
  date: string;
  onDate: (d: string) => void;
  onCapture: (mode?: EntryMode) => void;
  onEdit: (m: Meal) => void;
  onSettings: () => void;
  toast: (m: ToastMsg) => void;
}) {
  const meals = useStore((s) => s.meals);
  const day = useStore((s) => s.days[date]);
  const isToday = date === today();
  const todays = [...mealsOn(meals, date)].sort((a, b) => a.at.localeCompare(b.at));
  const t = dayTotals(todays);
  const [y, mo, d] = date.split('-').map(Number);
  const label = new Date(y, mo - 1, d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  const streak = streakDays(meals);
  const real = todays.filter((m) => m.source !== 'demo');

  const macros = [
    { label: '탄수화물', v: t.carbG, ref: DAILY_REFERENCE.carbG, unit: 'g' },
    { label: '단백질', v: t.proteinG, ref: DAILY_REFERENCE.proteinG, unit: 'g' },
    { label: '지방', v: t.fatG, ref: DAILY_REFERENCE.fatG, unit: 'g' },
    { label: '나트륨', v: t.sodiumMg, ref: DAILY_REFERENCE.sodiumMg, unit: 'mg', warnOver: true },
  ];

  function remove(m: Meal) {
    const gone = actions.removeMeal(m.id);
    if (gone) toast({ text: `${m.slot} 기록을 지웠습니다`, action: { label: '되돌리기', run: () => actions.restoreMeal(gone) } });
  }

  const cups = day?.waterCups ?? 0;

  return (
    <>
      <header className="top">
        <div>
          <div className="day-nav">
            <button className="icon-btn sm" onClick={() => onDate(shiftDay(date, -1))} aria-label="하루 전"><Icon.left /></button>
            <p aria-live="polite">{label}</p>
            <button className="icon-btn sm" onClick={() => onDate(shiftDay(date, 1))} aria-label="하루 뒤" disabled={isToday}><Icon.right /></button>
          </div>
          <h1>{isToday ? '오늘의 그릇' : `${mo}월 ${d}일의 그릇`}</h1>
        </div>
        <button className="icon-btn" onClick={onSettings} aria-label="설정과 내 데이터"><Icon.gear /></button>
      </header>
      {!isToday && <button className="link-btn small" onClick={() => onDate(today())}>오늘로 돌아가기</button>}

      <section className="bowl-wrap" aria-live="polite">
        <Bowl ratio={t.kcal / DAILY_REFERENCE.kcal} />
        <div className="bowl-number">{fmt(t.kcal)}<span className="small muted"> kcal</span></div>
        <div className="bowl-label">1일 기준 {fmt(DAILY_REFERENCE.kcal)}kcal 중 기록한 양</div>
      </section>

      <div className="stamps" aria-label="끼니 도장">
        {STAMP_SLOTS.map((s) => {
          const done = real.some((m) => m.slot === s);
          return (
            <button key={s} className={`meal-stamp${done ? ' done' : ''}`} onClick={() => !done && onCapture()} aria-label={done ? `${s} 기록함` : `${s} 기록하기`}>
              <b>{s}</b>
              <span>{done ? '쾅' : '+'}</span>
            </button>
          );
        })}
        {isToday && streak >= 2 && <div className="streak" aria-label={`${streak}일 연속 기록`}><b>{streak}</b>일째<br />연속 기록</div>}
      </div>

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

      <h2>{isToday ? '오늘 먹은 것' : '이날 먹은 것'}</h2>
      {todays.length === 0 ? (
        <div className="empty">
          <p style={{ margin: '0 0 14px' }}>{isToday ? '아직 기록이 없어요. 사진 한 장, 또는 한 줄 메모면 충분합니다.' : '이날 기록이 없어요. 기억나는 만큼 적어 두면 리듬 분석에 반영됩니다.'}</p>
          <div className="inline" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            {isToday && <button className="btn" onClick={() => onCapture('photo')}><Icon.camera />한끼 찍기</button>}
            <button className={isToday ? 'btn ghost' : 'btn'} onClick={() => onCapture('write')}><Icon.pen />글로 적기</button>
          </div>
        </div>
      ) : (
        <>
          <ul className="list">
            {todays.map((m) => {
              const mt = mealTotals(m);
              const time = new Date(m.at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
              const how = m.source === 'demo' ? ' · 예시값' : m.source === 'manual' ? ' · 직접 기록' : m.source === 'text' ? ' · 글로 기록' : '';
              return (
                <li key={m.id}>
                  <button className="meal-open" onClick={() => onEdit(m)} aria-label={`${m.slot} 기록 열어서 고치기`}>
                    {m.photo ? <img className="thumb" src={m.photo} alt="" /> : <div className="thumb">{m.slot[0]}</div>}
                    <div className="grow">
                      <h3 className="ellipsis">{m.items.map((i) => i.name).join(', ')}</h3>
                      <div className="small muted">{m.slot} · {time}{how}</div>
                      {m.memo && <div className="small memo-line ellipsis">{m.memo}</div>}
                    </div>
                    <span className="kcal">{fmt(mt.kcal)}</span>
                  </button>
                  <button className="x-btn" aria-label={`${m.slot} 기록 삭제`} onClick={() => remove(m)}><Icon.close /></button>
                </li>
              );
            })}
          </ul>
          <div className="inline" style={{ marginTop: 10 }}>
            {isToday && <button className="btn ghost" style={{ flex: 1 }} onClick={() => onCapture('photo')}><Icon.camera />찍기</button>}
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => onCapture('write')}><Icon.pen />글로 적기</button>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => onCapture('pick')}><Icon.list />고르기</button>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>기록을 누르면 음식·양·시각을 고칠 수 있어요.</p>
        </>
      )}

      <h2>물</h2>
      <div className="list">
        <div className="stepper">
          <span>마신 물 <span className="muted small">(1잔 200ml)</span></span>
          <div className="ctrl">
            <button aria-label="물 한 잔 빼기" onClick={() => actions.updateDay(date, { waterCups: Math.max(0, cups - 1) })}>−</button>
            <output aria-live="polite">{cups}잔</output>
            <button aria-label="물 한 잔 더하기" onClick={() => actions.updateDay(date, { waterCups: Math.min(20, cups + 1) })}>+</button>
          </div>
        </div>
        <div className="cups" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <i key={i} className={i < cups ? 'on' : ''} />)}
          {cups > 8 && <span className="small muted">+{cups - 8}</span>}
        </div>
      </div>

      <p className="small muted" style={{ marginTop: 24 }}>사진·글로 계산한 값은 추정치입니다. 정확한 영양 정보는 제품 표시사항을 확인하세요.</p>
    </>
  );
}
