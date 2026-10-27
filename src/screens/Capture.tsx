import { useMemo, useRef, useState } from 'react';
import { analyzeMeal, analyzeText, resizeImage, shareTrend } from '../lib/api';
import { actions, today, useStore } from '../lib/store';
import { fmt, sumItems } from '../lib/nutrition';
import type { EntryMode, FoodItem, Meal, MealSlot } from '../lib/types';
import { Icon } from '../ui';
import { IS_PREVIEW } from '../lib/target';
import { COMMON_FOODS, parseMealText } from '../lib/foods';
import { mealsOn } from '../lib/insights';

const SLOTS: MealSlot[] = ['아침', '점심', '저녁', '간식'];
const SCALES = [0.5, 0.75, 1, 1.5, 2];
const SLOT_HOUR: Record<MealSlot, string> = { 아침: '08:00', 점심: '12:30', 저녁: '18:30', 간식: '15:30' };
const EXAMPLES = ['김치찌개 한 그릇, 밥 반 공기', '라면 1개랑 김치', '곤드레밥하고 감자전 1장', '아메리카노, 바나나 1개'];

/** 화면에서 고르는 음식 한 줄. qty는 1인분 대비 배수입니다. */
interface Entry { key: string; food: FoodItem; qty: number }
type Origin = 'ai' | 'text' | 'manual';

function guessSlot(time: string): MealSlot {
  const h = Number(time.slice(0, 2));
  if (h >= 5 && h < 10) return '아침';
  if (h >= 11 && h < 15) return '점심';
  if (h >= 17 && h < 22) return '저녁';
  return '간식';
}

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

async function thumbnail(dataUrl: string) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = 120;
  const s = Math.min(img.width, img.height);
  c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 120, 120);
  return c.toDataURL('image/jpeg', 0.7);
}

/** 배수를 실제 값에 반영한 음식 (저장용) */
function bake(e: Entry): FoodItem {
  const q = e.qty;
  if (q === 1) return e.food;
  const r = (v: number) => Math.round(v * q * 10) / 10;
  return {
    ...e.food,
    portion: `${e.food.portion} ×${q}`,
    kcal: r(e.food.kcal), carbG: r(e.food.carbG), proteinG: r(e.food.proteinG),
    fatG: r(e.food.fatG), sodiumMg: r(e.food.sodiumMg), sugarG: r(e.food.sugarG),
  };
}

const qtyLabel = (q: number) => (q === 0.5 ? '반' : q === 1 ? '1인분' : `${q}인분`);

/* ───────── 직접 입력 폼 ───────── */

const NUM_FIELDS: { key: keyof FoodItem; label: string; unit: string; max: number }[] = [
  { key: 'kcal', label: '열량', unit: 'kcal', max: 5000 },
  { key: 'carbG', label: '탄수화물', unit: 'g', max: 1000 },
  { key: 'proteinG', label: '단백질', unit: 'g', max: 500 },
  { key: 'fatG', label: '지방', unit: 'g', max: 500 },
  { key: 'sodiumMg', label: '나트륨', unit: 'mg', max: 20000 },
  { key: 'sugarG', label: '당류', unit: 'g', max: 500 },
];

function FoodEditor({ initial, onDone, onCancel }: { initial?: FoodItem; onDone: (f: FoodItem, keep: boolean) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [portion, setPortion] = useState(initial?.portion ?? '1인분');
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(NUM_FIELDS.map((f) => [f.key, initial && (initial[f.key] as number) > 0 ? String(initial[f.key]) : ''])));
  const [keep, setKeep] = useState(true);
  const [more, setMore] = useState(() => NUM_FIELDS.slice(1).some((f) => vals[f.key]));
  const valid = name.trim().length > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const num = (k: string, max: number) => {
      const n = parseFloat((vals[k] ?? '').replace(/,/g, ''));
      return Number.isFinite(n) && n > 0 ? Math.min(max, n) : 0;
    };
    const f: FoodItem = {
      name: name.trim().slice(0, 30), portion: portion.trim().slice(0, 30) || '1인분',
      kcal: num('kcal', 5000), carbG: num('carbG', 1000), proteinG: num('proteinG', 500),
      fatG: num('fatG', 500), sodiumMg: num('sodiumMg', 20000), sugarG: num('sugarG', 500),
      confidence: 1, custom: true,
    };
    onDone(f, keep);
  }

  return (
    <form className="editor" onSubmit={submit} aria-label="음식 직접 입력">
      <div className="inline">
        <label className="field">
          <span className="small">음식 이름</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 엄마표 잡채" autoFocus maxLength={30} required />
        </label>
        <label className="field" style={{ maxWidth: 130 }}>
          <span className="small">양</span>
          <input value={portion} onChange={(e) => setPortion(e.target.value)} placeholder="1인분" maxLength={30} />
        </label>
      </div>
      <div className="num-grid">
        {(more ? NUM_FIELDS : NUM_FIELDS.slice(0, 1)).map((f) => (
          <label key={f.key} className="field">
            <span className="small">{f.label} <span className="muted">({f.unit})</span></span>
            <input inputMode="decimal" value={vals[f.key]} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value.replace(/[^\d.,]/g, '') })} placeholder={f.key === 'kcal' ? '모르면 비워 두기' : '–'} />
          </label>
        ))}
      </div>
      {!more && <button type="button" className="link-btn small" onClick={() => setMore(true)}>탄수화물·단백질·나트륨도 적기</button>}
      <p className="small muted" style={{ margin: '8px 0 0' }}>포장 제품은 영양성분표의 숫자를 그대로 적으면 가장 정확합니다.</p>
      <label className="check">
        <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
        <span className="small">'내 음식'에 남겨 다음에 한 번에 고르기</span>
      </label>
      <div className="inline" style={{ marginTop: 12 }}>
        <button className="btn" type="submit" disabled={!valid}>{initial ? '고치기' : '더하기'}</button>
        <button className="btn ghost" type="button" onClick={onCancel}>취소</button>
      </div>
    </form>
  );
}

/* ───────── 한끼 기록 시트 ───────── */

export interface CaptureProps {
  onClose: () => void;
  onSaved: (msg: string, day: string) => void;
  /** 고칠 기존 기록 */
  editing?: Meal;
  /** 기록할 날짜 (YYYY-MM-DD) — 지난 날을 보고 있을 때 */
  date?: string;
  mode?: EntryMode;
}

export function Capture({ onClose, onSaved, editing, date, mode }: CaptureProps) {
  const input = useRef<HTMLInputElement>(null);
  const settings = useStore((s) => s.settings);
  const myFoods = useStore((s) => s.myFoods);
  const allMeals = useStore((s) => s.meals);

  const [tab, setTab] = useState<EntryMode>(editing ? 'pick' : mode ?? settings.entryMode ?? 'photo');
  const [photo, setPhoto] = useState<string | null>(editing?.photo ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>(() => (editing?.items ?? []).map((food) => ({ key: actions.newId(), food, qty: 1 })));
  const [origin, setOrigin] = useState<Origin>(editing ? (editing.source === 'demo' ? 'manual' : editing.source) : 'manual');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ key?: string; food?: FoodItem } | null>(null);
  const [scale, setScale] = useState(editing?.portionScale ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [memo, setMemo] = useState(editing?.memo ?? '');

  // 언제 먹었는지 — 지난 날짜도 적을 수 있게
  const startDay = editing ? today(new Date(editing.at)) : date ?? today();
  const startTime = editing ? hhmm(new Date(editing.at)) : startDay === today() ? hhmm(new Date()) : '12:30';
  const [day, setDay] = useState(startDay);
  const [time, setTime] = useState(startTime);
  const [slot, setSlot] = useState<MealSlot>(editing?.slot ?? guessSlot(startTime));
  const [slotTouched, setSlotTouched] = useState(Boolean(editing));

  function changeTime(t: string) {
    setTime(t);
    if (!slotTouched && t) setSlot(guessSlot(t));
  }
  function pickSlot(s: MealSlot) {
    setSlot(s);
    setSlotTouched(true);
    // 지난 날 기록이면 시각도 그 끼니에 맞춰 줍니다.
    if (day !== today() || !editing) setTime((cur) => (guessSlot(cur) === s ? cur : SLOT_HOUR[s]));
  }

  function switchTab(t: EntryMode) {
    setTab(t);
    setError(null);
    if (!editing) actions.updateSettings({ entryMode: t });
  }

  const add = (food: FoodItem, qty = 1) => setEntries((cur) => [...cur, { key: actions.newId(), food, qty }]);

  async function onFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('사진 파일만 올릴 수 있습니다.'); return; }
    setError(null); setNote(null);
    setBusy('음식과 양을 알아보는 중');
    try {
      const data = await resizeImage(file);
      setPhoto(data);
      const r = await analyzeMeal(data);
      if (r.source === 'demo') {
        // 자동 인식을 쓸 수 없으면 예시값 대신 직접 적게 합니다.
        setNote(IS_PREVIEW ? '사진 자동 분석을 허용하지 않아 직접 적는 방식으로 바꿨어요.' : '사진은 남겨 두었어요. 지금은 자동 인식이 연결되지 않아 먹은 음식을 직접 적어 주세요.');
        setTab('write');
      } else if (r.items.length === 0) {
        setError('음식을 찾지 못했습니다. 접시가 다 보이게 다시 찍거나 글로 적어 주세요.');
      } else {
        setEntries((cur) => [...cur, ...r.items.map((food) => ({ key: actions.newId(), food, qty: 1 }))]);
        setOrigin('ai');
      }
    } catch {
      setError('사진을 읽지 못했습니다. 밝은 곳에서 다시 찍어 보세요.');
    } finally {
      setBusy(null);
    }
  }

  async function readText() {
    const t = text.trim();
    if (!t) return;
    setError(null); setNote(null);
    setBusy('적은 음식의 영양을 계산하는 중');
    const ai = await analyzeText(t);
    setBusy(null);
    if (ai && ai.length) {
      setEntries((cur) => [...cur, ...ai.map((food) => ({ key: actions.newId(), food, qty: 1 }))]);
      if (origin !== 'ai') setOrigin('text');
      setText('');
      return;
    }
    // AI를 쓸 수 없을 때: 이 기기에서 목록과 맞춰 읽습니다.
    const parsed = parseMealText(t, myFoods);
    if (!parsed.length) { setError('음식 이름을 찾지 못했습니다. "김치찌개, 밥 반 공기"처럼 쉼표로 나눠 적어 주세요.'); return; }
    setEntries((cur) => [...cur, ...parsed.map(({ food, qty }) => ({ key: actions.newId(), food, qty }))]);
    const unknown = parsed.filter((p) => p.food.custom && !p.food.kcal).length;
    if (unknown) setNote(`목록에 없는 음식 ${unknown}가지는 이름만 넣었어요. '열량 적기'를 눌러 숫자를 채우면 더 정확해집니다.`);
    setText('');
  }

  // 최근 식사를 그대로 다시 기록 (어제 아침과 같을 때)
  const recentMeals = useMemo(() => {
    const seen = new Set<string>();
    const out: Meal[] = [];
    for (const m of allMeals) {
      if (m.source === 'demo' || m.id === editing?.id) continue;
      const k = m.items.map((i) => i.name).join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(m);
      if (out.length >= 4) break;
    }
    return out;
  }, [allMeals, editing?.id]);

  // 자주 먹은 음식 (내 기록 기준) → 내 음식 → 기본 목록
  const frequent = useMemo(() => {
    const count = new Map<string, { food: FoodItem; n: number }>();
    for (const m of allMeals.slice(0, 200)) {
      if (m.source === 'demo') continue;
      for (const i of m.items) {
        const base = i.name;
        const c = count.get(base);
        if (c) c.n++;
        else count.set(base, { food: COMMON_FOODS.find((f) => f.name === base) ?? myFoods.find((f) => f.name === base) ?? { ...i, portion: i.portion.replace(/ ×[\d.]+$/, '') }, n: 1 });
      }
    }
    return [...count.values()].filter((c) => c.n >= 2).sort((a, b) => b.n - a.n).slice(0, 8).map((c) => c.food);
  }, [allMeals, myFoods]);

  const q = query.trim();
  const pool = [...myFoods, ...COMMON_FOODS.filter((f) => !myFoods.some((m) => m.name === f.name))];
  const matches = q ? pool.filter((f) => f.name.includes(q)) : [];

  async function save() {
    if (!entries.length) return;
    const items = entries.map(bake);
    const [y, mo, d] = day.split('-').map(Number);
    const [h, mi] = (time || SLOT_HOUR[slot]).split(':').map(Number);
    const when = new Date(y, mo - 1, d, h, mi);
    const at = (when > new Date() ? new Date() : when).toISOString();
    const thumb = photo ? (photo.length > 30000 ? await thumbnail(photo) : photo) : undefined;
    const meal = { at, slot, items, portionScale: scale, photo: thumb, source: origin, memo: memo.trim().slice(0, 200) || undefined } as Omit<Meal, 'id'>;

    if (editing) {
      actions.updateMeal(editing.id, meal);
      onSaved(`${slot} 기록을 고쳤습니다`, today(new Date(at)));
      return;
    }
    actions.addMeal(meal);
    const s = actions.snapshot().settings;
    if (s.shareTrends) {
      const t = sumItems(items, scale);
      // 메모와 사진은 보내지 않습니다.
      shareTrend(s.anonId, { type: 'meal', slot, foods: items.map((i) => i.name).join('|'), kcal: Math.round(t.kcal), sodiumMg: Math.round(t.sodiumMg), proteinG: Math.round(t.proteinG), hour: new Date(at).getHours(), source: origin });
    }
    // 끼니 도장: 그날 아침·점심·저녁 중 몇 끼를 채웠는지 알려 줍니다.
    const dayMeals = mealsOn(actions.snapshot().meals, today(new Date(at)));
    const stamped = (['아침', '점심', '저녁'] as MealSlot[]).filter((x) => dayMeals.some((m) => m.slot === x)).length;
    onSaved((slot !== '간식' && stamped === 3 ? '세 끼 도장 완성! 오늘도 꼼꼼히 남겼어요' : slot !== '간식' ? `${slot} 도장 쾅 · ${stamped}/3끼` : '간식 기록을 남겼습니다'), today(new Date(at)));
  }

  const items = entries.map(bake);
  const total = sumItems(items, scale);
  const unknownCount = entries.filter((e) => e.food.custom && !e.food.kcal).length;

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="cap-title">
      <div className="sheet-inner">
        <div className="sheet-head">
          <h2 id="cap-title">{editing ? '기록 고치기' : '한끼 기록'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기"><Icon.close /></button>
        </div>
        <input ref={input} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} aria-label="식사 사진 선택" tabIndex={-1} />

        <div className="seg" role="tablist" aria-label="기록 방법">
          {([['photo', '사진', Icon.camera], ['write', '글로 쓰기', Icon.pen], ['pick', '고르기', Icon.list]] as const).map(([id, label, I]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => switchTab(id)}><I />{label}</button>
          ))}
        </div>

        {tab === 'photo' && (
          photo ? (
            <div style={{ position: 'relative' }}>
              <img className="photo" src={photo} alt="찍은 식사 사진" />
              <button className="btn ghost photo-again" onClick={() => input.current?.click()}><Icon.camera />다시 찍기</button>
            </div>
          ) : (
            <button className="empty big-tap" onClick={() => input.current?.click()}>
              <Icon.camera />
              <p style={{ margin: '8px 0 0' }}><b>눌러서 밥상 찍기</b><br /><span className="small">위에서 한 장이면 음식과 양을 알아봐요</span></p>
            </button>
          )
        )}

        {tab === 'write' && (
          <div>
            <label className="field">
              <span className="small muted">먹은 음식을 편하게 적어 주세요. 양도 함께 적으면 더 정확해요.</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); readText(); } }}
                rows={3}
                maxLength={300}
                placeholder="예: 김치찌개 한 그릇, 밥 반 공기, 계란말이"
              />
            </label>
            <div className="chips" style={{ marginTop: 8 }} aria-label="예시 문장">
              {!text && EXAMPLES.map((x) => <button key={x} className="chip small" onClick={() => setText(x)}>{x}</button>)}
            </div>
            <button className="btn block" style={{ marginTop: 12 }} onClick={readText} disabled={!text.trim() || Boolean(busy)}>영양 계산하기</button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button className="link-btn small" onClick={() => setEditor({})}>열량까지 직접 적기</button>
            </div>
          </div>
        )}

        {tab === 'pick' && (
          <div>
            {recentMeals.length > 0 && !editing && (
              <>
                <h3 style={{ margin: '4px 0 8px' }}>최근 식사 그대로</h3>
                <div className="repeat-row">
                  {recentMeals.map((m) => (
                    <button key={m.id} className="repeat" onClick={() => { setEntries(m.items.map((food) => ({ key: actions.newId(), food, qty: 1 }))); setScale(m.portionScale); setOrigin(m.source === 'demo' ? 'manual' : m.source); }}>
                      <span className="small muted">{new Date(m.at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} {m.slot}</span>
                      <span className="ellipsis">{m.items.map((i) => i.name).join(', ')}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <label className="field" style={{ marginTop: 12 }}>
              <span className="sr-only">음식 이름 찾기</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="음식 이름 찾기 (예: 김밥)" />
            </label>
            <div className="chips" role="group" aria-label="음식 고르기" style={{ marginTop: 10 }}>
              {q ? (
                <>
                  {matches.slice(0, 20).map((f) => <button key={f.name} className={`chip${f.custom ? ' mine' : ''}`} onClick={() => { add(f); setQuery(''); }}>+ {f.name}</button>)}
                  <button className="chip dashed" onClick={() => { setEditor({ food: { name: q, portion: '1인분', kcal: 0, carbG: 0, proteinG: 0, fatG: 0, sodiumMg: 0, sugarG: 0, confidence: 1, custom: true } }); setQuery(''); }}>
                    ✎ '{q}' 직접 입력
                  </button>
                </>
              ) : (
                <>
                  {myFoods.length > 0 && <span className="chip-label">내 음식</span>}
                  {myFoods.slice(0, 12).map((f) => <button key={f.name} className="chip mine" onClick={() => add(f)}>+ {f.name}</button>)}
                  {frequent.length > 0 && <span className="chip-label">자주 먹은 것</span>}
                  {frequent.map((f) => <button key={'f' + f.name} className="chip" onClick={() => add(f)}>+ {f.name}</button>)}
                  <span className="chip-label">자주 먹는 음식</span>
                  {COMMON_FOODS.map((f) => <button key={f.name} className="chip" onClick={() => add(f)}>+ {f.name}</button>)}
                  <button className="chip dashed" onClick={() => setEditor({})}>✎ 목록에 없는 음식</button>
                </>
              )}
            </div>
            <p className="small muted">목록의 열량·영양값은 1인분 대략값입니다.</p>
          </div>
        )}

        {note && <div className="notice">{note}</div>}
        {error && <div className="notice bad" role="alert">{error}</div>}

        {busy && (
          <div className="analyzing" aria-live="polite">
            <div className="steam" aria-hidden="true"><span /><span /><span /></div>
            {busy}
          </div>
        )}

        {editor && (
          <FoodEditor
            initial={editor.food}
            onCancel={() => setEditor(null)}
            onDone={(f, keep) => {
              if (keep) actions.saveMyFood(f);
              if (editor.key) setEntries((cur) => cur.map((e) => (e.key === editor.key ? { ...e, food: f } : e)));
              else add(f);
              setEditor(null);
            }}
          />
        )}

        {entries.length > 0 && (
          <>
            <h2>{origin === 'ai' && !editing ? '이렇게 보여요' : '먹은 음식'} <span className="small muted">{entries.length}가지</span></h2>
            <ul className="list">
              {entries.map((e) => {
                const b = bake(e);
                const unknown = e.food.custom && !e.food.kcal;
                return (
                  <li key={e.key} className="food-row">
                    <button className="food-name" onClick={() => setEditor({ key: e.key, food: e.food })} aria-label={`${e.food.name} 영양값 고치기`}>
                      <h3>{e.food.name}</h3>
                      <div className="small muted">
                        {unknown ? <span className="need">열량 적기 ›</span> : <>{e.food.portion} · 단백질 {fmt(b.proteinG * scale)}g · 나트륨 {fmt(b.sodiumMg * scale)}mg</>}
                      </div>
                    </button>
                    <div className="qty" role="group" aria-label={`${e.food.name} 양`}>
                      <button aria-label="양 줄이기" disabled={e.qty <= 0.5} onClick={() => setEntries((cur) => cur.map((x) => (x.key === e.key ? { ...x, qty: Math.max(0.5, x.qty - 0.5) } : x)))}>−</button>
                      <output>{qtyLabel(e.qty)}</output>
                      <button aria-label="양 늘리기" disabled={e.qty >= 5} onClick={() => setEntries((cur) => cur.map((x) => (x.key === e.key ? { ...x, qty: Math.min(5, x.qty + 0.5) } : x)))}>+</button>
                    </div>
                    <span className="kcal">{unknown ? '–' : fmt(b.kcal * scale)}</span>
                    <button className="x-btn" aria-label={`${e.food.name} 빼기`} onClick={() => setEntries((cur) => cur.filter((x) => x.key !== e.key))}><Icon.close /></button>
                  </li>
                );
              })}
            </ul>
            {tab !== 'pick' && (
              <div style={{ marginTop: 10 }}>
                <button className="link-btn small" onClick={() => switchTab('pick')}>+ 음식 더 고르기</button>
              </div>
            )}

            {origin === 'ai' && (
              <>
                <h2>먹은 양</h2>
                <div className="chips" role="group" aria-label="먹은 양">
                  {SCALES.map((s) => (
                    <button key={s} className="chip" aria-pressed={scale === s} onClick={() => setScale(s)}>
                      {s === 1 ? '보이는 만큼' : s < 1 ? `${s === 0.5 ? '절반' : '3/4'}` : `${s}배`}
                    </button>
                  ))}
                </div>
              </>
            )}

            <h2>언제 드셨나요</h2>
            <div className="chips" role="group" aria-label="식사 구분">
              {SLOTS.map((s) => <button key={s} className="chip" aria-pressed={slot === s} onClick={() => pickSlot(s)}>{s}</button>)}
            </div>
            <div className="inline" style={{ marginTop: 10 }}>
              <label className="field">
                <span className="small muted">날짜</span>
                <input type="date" value={day} max={today()} onChange={(e) => e.target.value && setDay(e.target.value)} />
              </label>
              <label className="field">
                <span className="small muted">시각</span>
                <input type="time" value={time} onChange={(e) => changeTime(e.target.value)} />
              </label>
            </div>

            <details className="memo" open={Boolean(memo)}>
              <summary className="small">메모 남기기 (나만 보기)</summary>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} maxLength={200} placeholder="예: 회사 근처 식당, 국물은 반만" />
            </details>

            {unknownCount > 0 && <p className="small muted">열량을 모르는 음식 {unknownCount}가지는 0kcal로 더해집니다.</p>}
            <div style={{ marginTop: 20 }}>
              <button className="btn block" onClick={save} disabled={Boolean(busy)}>{fmt(total.kcal)}kcal로 {editing ? '고치기' : '저장'}</button>
            </div>
          </>
        )}

        {!entries.length && !busy && !editor && tab !== 'photo' && (
          <p className="small muted" style={{ marginTop: 20, textAlign: 'center' }}>
            {tab === 'write' ? '사진이 없어도 괜찮아요. 적은 음식은 이 휴대폰에만 저장됩니다.' : '여러 가지를 골라 한 끼로 저장할 수 있어요.'}
          </p>
        )}
      </div>
    </div>
  );
}
