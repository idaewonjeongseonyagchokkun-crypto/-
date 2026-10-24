import { useEffect, useRef, useState } from 'react';
import { analyzeMeal, resizeImage, shareTrend } from '../lib/api';
import { actions } from '../lib/store';
import { fmt, sumItems } from '../lib/nutrition';
import type { FoodItem, MealSlot } from '../lib/types';
import { Icon } from '../ui';
import { IS_PREVIEW } from '../lib/target';

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
  const [source, setSource] = useState<'ai' | 'demo'>('ai');
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
      setItems(r.items);
      setSource(r.source);
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
            {source === 'demo' && <div className="notice">{IS_PREVIEW ? 'Claude 사진 분석을 쓸 수 없어 예시 값을 보여 드립니다. 분석 허용 창이 뜨면 허용을 눌러 주세요.' : 'AI 분석이 아직 연결되지 않아 예시 값을 보여 드립니다. 서버에 API 키를 넣으면 실제 사진을 분석합니다.'}</div>}
            {items.length === 0 ? (
              <div className="notice bad">음식을 찾지 못했습니다. 접시가 다 보이게 다시 찍어 보세요.</div>
            ) : (
              <>
                <h2>이렇게 보여요</h2>
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
