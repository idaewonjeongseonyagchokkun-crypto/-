import { useEffect, useRef, useState } from 'react';
import { analyzeLabel, lookupBarcode, resizeImage, shareTrend } from '../lib/api';
import { actions, useStore } from '../lib/store';
import { scoreProduct } from '../lib/nutrition';
import type { ScannedProduct } from '../lib/types';
import { Icon } from '../ui';

// 일부 브라우저(안드로이드 크롬 등)만 지원하는 바코드 인식 API
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
declare global { interface Window { BarcodeDetector?: new (o: { formats: string[] }) => Detector } }

function ProductResult({ p, onShop }: { p: ScannedProduct; onShop: () => void }) {
  const s = scoreProduct(p);
  return (
    <section aria-label={`${p.name} 분석 결과`} style={{ marginTop: 20 }}>
      <div className="result-head">
        <div className={`stamp g-${s.grade}`} aria-label={`성분 점수 ${s.value}점, ${s.grade}`}>
          <b>{s.value}</b><span>{s.grade}</span>
        </div>
        <div className="grow">
          <h3>{p.name}</h3>
          {p.brand && <div className="small muted">{p.brand}</div>}
          {p.source === 'demo' && <span className="tag">예시 데이터</span>}
        </div>
      </div>
      <ul className="reasons">
        {s.reasons.map((r, i) => <li key={i} className={r.tone}>{r.text}</li>)}
      </ul>
      {p.additives.length > 0 && (
        <>
          <h2>확인된 첨가물</h2>
          <div className="chips">{p.additives.map((a) => <span key={a} className="tag">{a}</span>)}</div>
        </>
      )}
      {p.ingredientsText && (
        <details style={{ marginTop: 16 }}>
          <summary>원재료명 전체 보기</summary>
          <p className="small">{p.ingredientsText}</p>
        </details>
      )}
      {s.value < 50 && (
        <div className="notice" style={{ marginTop: 20 }}>
          비슷한 간식을 고를 때 원산지와 제조 공장을 공개한 정선 간식도 비교해 보세요.{' '}
          <button className="link-btn" onClick={onShop}>정선 간식 보기</button>
        </div>
      )}
      <p className="small muted">점수는 100g당 당류·나트륨·포화지방·열량과 첨가물 수로 계산한 비교용 지표이며, 건강 효과를 뜻하지 않습니다.</p>
    </section>
  );
}

export function Scan({ onShop }: { onShop: () => void }) {
  const history = useStore((s) => s.products);
  const shareOn = useStore((s) => s.settings.shareTrends);
  const anonId = useStore((s) => s.settings.anonId);
  const [current, setCurrent] = useState<ScannedProduct | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const labelInput = useRef<HTMLInputElement>(null);
  const canDetect = typeof window !== 'undefined' && !!window.BarcodeDetector;

  function keep(draft: Omit<ScannedProduct, 'id' | 'at'>) {
    const saved = actions.addProduct(draft);
    setCurrent(saved);
    if (shareOn && draft.source !== 'demo') {
      const s = scoreProduct(saved);
      shareTrend(anonId, { type: 'scan', productName: saved.name, brand: saved.brand ?? '', score: s.value, additives: saved.additives.length, source: saved.source });
    }
  }

  async function byBarcode(raw: string) {
    setError(null);
    setBusy('제품을 찾는 중');
    try {
      const p = await lookupBarcode(raw);
      if (p) keep(p);
      else setError('공개 DB에 없는 바코드입니다. 포장 뒷면의 원재료명·영양성분표를 찍어 주세요.');
    } catch {
      setError('인터넷 연결을 확인하고 다시 시도하세요.');
    } finally {
      setBusy(null);
    }
  }

  async function byLabel(file?: File) {
    if (!file) return;
    setError(null);
    setBusy('표시사항을 읽는 중');
    try {
      keep(await analyzeLabel(await resizeImage(file, 1600, 0.85)));
    } catch {
      setError('글자를 읽지 못했습니다. 표가 화면을 가득 채우게 다시 찍어 보세요.');
    } finally {
      setBusy(null);
    }
  }

  // 실시간 바코드 인식
  useEffect(() => {
    if (!live || !window.BarcodeDetector) return;
    let stream: MediaStream | undefined;
    let stop = false;
    const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        while (!stop) {
          const found = await detector.detect(video.current).catch(() => []);
          if (found[0]) { setLive(false); byBarcode(found[0].rawValue); break; }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setLive(false);
        setError('카메라를 열 수 없습니다. 브라우저 설정에서 카메라 권한을 허용하거나 번호를 직접 입력하세요.');
      }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  return (
    <>
      <header className="top">
        <div>
          <p>장 볼 때 꺼내 보는</p>
          <h1>성분 스캔</h1>
        </div>
      </header>

      {live ? (
        <div className="video-box">
          <video ref={video} playsInline muted aria-label="바코드 카메라 화면" />
          <div className="aim" aria-hidden="true" />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {canDetect && <button className="btn block" onClick={() => setLive(true)}><Icon.scan />바코드 비추기</button>}
          <button className={`btn block${canDetect ? ' ghost' : ''}`} onClick={() => labelInput.current?.click()}><Icon.camera />원재료·영양성분표 찍기</button>
        </div>
      )}
      {live && <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => setLive(false)}>그만 찍기</button>}
      <input ref={labelInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => byLabel(e.target.files?.[0])} aria-label="표시사항 사진 선택" />

      <form className="inline" style={{ marginTop: 16, alignItems: 'end' }} onSubmit={(e) => { e.preventDefault(); if (code) byBarcode(code); }}>
        <label className="field">
          <span className="small muted">바코드 번호로 찾기</span>
          <input inputMode="numeric" pattern="[0-9]*" maxLength={14} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="8801234567890" />
        </label>
        <button className="btn" type="submit" disabled={code.length < 8}>찾기</button>
      </form>

      {busy && <div className="analyzing" aria-live="polite"><div className="steam" aria-hidden="true"><span /><span /><span /></div>{busy}</div>}
      {error && <div className="notice bad" role="alert">{error}</div>}
      {current && !busy && <ProductResult p={current} onShop={onShop} />}

      <h2>최근 스캔</h2>
      {history.length === 0 ? (
        <div className="empty">마트에서 고민되는 제품을 찍으면 여기에 모아 비교할 수 있어요.</div>
      ) : (
        <ul className="list">
          {history.slice(0, 20).map((p) => {
            const s = scoreProduct(p);
            return (
              <li key={p.id}>
                {p.image ? <img className="thumb" src={p.image} alt="" /> : <div className="thumb">{p.name[0]}</div>}
                <button className="grow link-btn" style={{ textAlign: 'left', textDecoration: 'none', color: 'inherit' }} onClick={() => { setCurrent(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <h3 className="ellipsis">{p.name}</h3>
                  <div className="small muted">{new Date(p.at).toLocaleDateString('ko-KR')}</div>
                </button>
                <span className={`kcal g-${s.grade}`}>{s.value}점</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
