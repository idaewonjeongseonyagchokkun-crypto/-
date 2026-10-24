import { useEffect, useRef, useState } from 'react';
import { analyzeMeal, resizeImage, shareTrend } from '../lib/api';
import { actions } from '../lib/store';
import { fmt, sumItems } from '../lib/nutrition';
import type { FoodItem, MealSlot } from '../lib/types';
import { Icon } from '../ui';
import { IS_PREVIEW } from '../lib/target';
import { COMMON_FOODS } from '../lib/foods';

const SLOTS: MealSlot[] = ['아침', '점심', '저녁', '간식'];
const SCALES = [0.5, 0.75, 1, 1.5, 2];

function guessSlot(d = new Date()): MealSlot {
  const h = d.getHours();
  if (h >= 5 && h < 10) return '아침';
  if (h >= 11 && h < 15) return '점심';
  if (h >= 17 && h < 22) return '저녁';
  return '간식';
}

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

export function Capture({ onClose, onSaved }: { onClose: () => void; onSaved: (msg: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<FoodItem[] | null>(null);
  const [source, setSource] = useState<'ai' | 'manual'>('ai');
  const [query, setQuery] = useState('');
  const [slot, setSlot] = useState<MealSlot>(guessSlot());
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // 시트를 열자마자 카메라가 뜨도록 — 입력 부담 최소화
  useEffect(() => { input.current?.click(); }, []);

  async function onFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('사진 파일만 올릴 수 있습니다.'); return; }
    setError(null);
    setBusy(true);
    setItems(null);
    try {
      const data = await resizeImage(file);
      setPhoto(data);
      const r = await analyzeMeal(data);
      // 자동 인식을 쓸 수 없으면 예시값 대신 사용자가 음식을 고르게 합니다.
      if (r.source === 'demo') { setItems([]); setSource('manual'); }
      else { setItems(r.items); setSource('ai'); }
    } catch {
      setError('사진을 읽지 못했습니다. 밝은 곳에서 다시 찍어 보세요.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!items?.length) return;
    const meal = actions.addMeal({
      at: new Date().toISOString(), slot, items, portionScale: scale,
      photo: photo ? await thumbnail(photo) : undefined, source,
    });
    const s = actions.snapshot().settings;
    if (s.shareTrends && source === 'ai') {
      const t = sumItems(items, scale);
      shareTrend(s.anonId, { type: 'meal', slot, foods: items.map((i) => i.name).join('|'), kcal: Math.round(t.kcal), sodiumMg: Math.round(t.sodiumMg), proteinG: Math.round(t.proteinG), hour: new Date(meal.at).getHours() });
    }
    onSaved(`${slot} 기록을 저장했습니다`);
  }

  const total = items ? sumItems(items, scale) : null;

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="cap-title">
      <div className="sheet-inner">
        <div className="sheet-head">
          <h2 id="cap-title">한끼 찍기</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기"><Icon.close /></button>
        </div>
        <input ref={input} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => onFile(e.target.files?.[0])} aria-label="식사 사진 선택" />

        {photo ? <img className="photo" src={photo} alt="찍은 식사 사진" /> : (
          <button className="empty" style={{ width: '100%' }} onClick={() => input.current?.click()}>
            <Icon.camera />
            <p style={{ margin: '8px 0 0' }}>밥상을 위에서 한 장 찍어 주세요</p>
          </button>
        )}

        {error && <div className="notice bad" role="alert">{error}</div>}

        {busy && (
          <div className="analyzing" aria-live="polite">
            <div className="steam" aria-hidden="true"><span /><span /><span /></div>
            음식과 양을 알아보는 중
          </div>
        )}

        {items && total && (
          <>
            {source === 'manual' && (
              <div className="notice">{IS_PREVIEW ? '사진 자동 분석을 허용하지 않아 직접 고르는 방식으로 바꿨어요. 먹은 음식을 아래에서 골라 주세요.' : '사진은 저장했어요. 먹은 음식을 아래에서 골라 주세요. 자동 인식은 곧 추가됩니다.'}</div>
            )}
            {items.length === 0 && source === 'ai' ? (
              <div className="notice bad">음식을 찾지 못했습니다. 접시가 다 보이게 다시 찍거나 아래에서 직접 골라 주세요.</div>
            ) : items.length === 0 ? null : (
              <>
                <h2>{source === 'ai' ? '이렇게 보여요' : '고른 음식'}</h2>
                <ul className="list">
                  {items.map((it, idx) => (
                    <li key={idx} className="food-row">
                      <div>
                        <h3>{it.name}</h3>
                        <div className="small muted">{it.portion} · 단백질 {fmt(it.proteinG * scale)}g · 나트륨 {fmt(it.sodiumMg * scale)}mg</div>
                      </div>
                      <span className="kcal">{fmt(it.kcal * scale)}kcal</span>
                      <button className="x-btn" aria-label={`${it.name} 빼기`} onClick={() => setItems(items.filter((_, i) => i !== idx))}><Icon.close /></button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h2>{items.length ? '음식 더하기' : '먹은 음식 고르기'}</h2>
            <label className="field">
              <span className="sr-only">음식 이름 찾기</span>
              <input id="food-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="예: 김치찌개, 김밥" />
            </label>
            <div className="chips" role="group" aria-label="자주 먹는 음식" style={{ marginTop: 10 }}>
              {COMMON_FOODS.filter((f) => !query || f.name.includes(query.trim())).map((f) => (
                <button key={f.name} className="chip" onClick={() => { setItems([...(items ?? []), f]); setQuery(''); }}>+ {f.name}</button>
              ))}
              {query.trim() && !COMMON_FOODS.some((f) => f.name.includes(query.trim())) && (
                <span className="small muted">목록에 없는 음식이에요. 비슷한 음식을 골라 주세요.</span>
              )}
            </div>
            <p className="small muted">목록의 열량·영양값은 1인분 대략값입니다.</p>
            {items.length > 0 && (
              <>

                <h2>먹은 양</h2>
                <div className="chips" role="group" aria-label="먹은 양">
                  {SCALES.map((s) => (
                    <button key={s} className="chip" aria-pressed={scale === s} onClick={() => setScale(s)}>
                      {s === 1 ? '보이는 만큼' : s < 1 ? `${s === 0.5 ? '절반' : '3/4'}` : `${s}배`}
                    </button>
                  ))}
                </div>

                <h2>언제 드셨나요</h2>
                <div className="chips" role="group" aria-label="식사 구분">
                  {SLOTS.map((s) => <button key={s} className="chip" aria-pressed={slot === s} onClick={() => setSlot(s)}>{s}</button>)}
                </div>

                <div style={{ marginTop: 28 }}>
                  <button className="btn block" onClick={save}>{fmt(total.kcal)}kcal로 저장</button>
                </div>
              </>
            )}
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <button className="link-btn" onClick={() => input.current?.click()}>다시 찍기</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
