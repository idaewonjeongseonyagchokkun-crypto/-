import { useEffect, useRef, useState } from 'react';
import { analyzeLabel, contributeProduct, lookupBarcode, resizeImage, shareTrend } from '../lib/api';
import { actions, useStore } from '../lib/store';
import { scoreProduct } from '../lib/nutrition';
import type { ScannedProduct } from '../lib/types';
import { IS_PREVIEW } from '../lib/target';
import { Icon } from '../ui';


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
          {p.source === 'openfoodfacts' && <span className="tag">출처: Open Food Facts</span>}
          {p.source === 'shared' && <span className="tag">출처: 이용자 표시사항 등록</span>}
          {p.source === 'label-ai' && <span className="tag">출처: 표시사항 사진</span>}
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

type CamError = string | null;

function cameraMessage(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (!window.isSecureContext) return '카메라는 https 주소에서만 열립니다. hankki-scan.vercel.app 으로 열어 주세요.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return '카메라 권한이 꺼져 있습니다. 주소창 왼쪽 자물쇠(아이폰은 설정 → Safari → 카메라)에서 허용한 뒤 다시 눌러 주세요. 아래 "바코드 사진으로 찾기"도 됩니다.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return '사용할 수 있는 카메라를 찾지 못했습니다. "바코드 사진으로 찾기"를 이용해 주세요.';
  if (name === 'NotReadableError') return '다른 앱이 카메라를 쓰고 있습니다. 카메라 앱을 닫고 다시 시도하세요.';
  return '카메라를 열지 못했습니다. "바코드 사진으로 찾기"나 번호 입력을 이용해 주세요.';
}

export function Scan({ onShop }: { onShop: () => void }) {
  const history = useStore((s) => s.products);
  const shareOn = useStore((s) => s.settings.shareTrends);
  const anonId = useStore((s) => s.settings.anonId);
  const [current, setCurrent] = useState<ScannedProduct | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<CamError>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [hint, setHint] = useState('바코드를 가운데 상자에 맞춰 주세요');
  const [torch, setTorch] = useState<null | boolean>(null); // null = 손전등 미지원
  // 못 찾은(또는 이름만 찾은) 바코드 — 표시사항을 찍으면 이 번호로 저장·공유 DB 등록
  const [pending, setPending] = useState<{ code: string; name?: string; brand?: string } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const labelInput = useRef<HTMLInputElement>(null);
  const barcodePhoto = useRef<HTMLInputElement>(null);
  const canCamera = !IS_PREVIEW && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  // 화면을 열면 인식 엔진을 미리 준비해 첫 스캔을 빠르게
  useEffect(() => {
    if (IS_PREVIEW) return;
    const t = setTimeout(() => { import('../lib/barcode').then((m) => m.getDetector()).catch(() => {}); }, 400);
    return () => clearTimeout(t);
  }, []);

  function keep(draft: Omit<ScannedProduct, 'id' | 'at'>) {
    const saved = actions.addProduct(draft);
    setCurrent(saved);
    if (shareOn && draft.source !== 'demo') {
      const s = scoreProduct(saved);
      shareTrend(anonId, { type: 'scan', productName: saved.name, brand: saved.brand ?? '', score: s.value, additives: saved.additives.length, source: saved.source });
    }
  }

  async function byBarcode(raw: string) {
    const { validGtin } = await import('../lib/barcode');
    const clean = raw.replace(/\D/g, '');
    setError(null); setInfo(null); setCurrent(null);
    if (!validGtin(clean)) {
      setError(`${clean} 은(는) 올바른 바코드 번호가 아닙니다. 막대 아래 숫자 8·12·13자리를 다시 확인해 주세요.`);
      return;
    }
    const known = history.find((p) => p.barcode === clean && !p.partial);
    if (known) { setPending(null); setCurrent(known); setInfo('전에 스캔한 제품이라 저장된 결과를 보여 드려요.'); return; }
    setBusy('제품을 찾는 중');
    try {
      const { product } = await lookupBarcode(clean);
      if (product && !product.partial) { setPending(null); keep({ ...product, barcode: clean }); }
      else if (product) {
        setPending({ code: clean, name: product.name, brand: product.brand });
        setInfo(`"${product.name}"${product.brand ? ` (${product.brand})` : ''} 제품입니다. 영양성분 정보가 아직 없어요. 포장 뒷면 원재료명·영양성분표를 찍으면 점수를 낼 수 있어요.`);
      } else {
        setPending({ code: clean });
        setInfo(`바코드 ${clean} 은(는) 아직 등록되지 않은 제품이에요. 포장 뒷면 원재료명·영양성분표를 찍어 주시면 점수를 내고, 다음 사람부터는 바코드만으로 바로 찾을 수 있게 등록됩니다.`);
      }
    } catch (e) {
      setError((e as Error).message === 'invalid' ? '바코드 번호가 올바르지 않습니다.' : '인터넷 연결을 확인하고 다시 시도하세요.');
    } finally {
      setBusy(null);
    }
  }

  async function byBarcodePhoto(file?: File) {
    if (!file) return;
    setError(null); setInfo(null);
    setBusy('사진에서 바코드를 찾는 중');
    try {
      const { detectInFile } = await import('../lib/barcode');
      const found = await detectInFile(file);
      setBusy(null);
      if (found) await byBarcode(found);
      else setError('사진에서 바코드를 찾지 못했습니다. 바코드가 화면 가로를 절반 이상 채우도록, 흔들림 없이 밝은 곳에서 다시 찍어 주세요.');
    } catch {
      setBusy(null);
      setError('바코드 인식 엔진을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도하세요.');
    }
  }

  async function byLabel(file?: File) {
    if (!file) return;
    setError(null); setInfo(null);
    setBusy('표시사항을 읽는 중');
    try {
      const draft = await analyzeLabel(await resizeImage(file, 1600, 0.85));
      const merged = pending ? { ...draft, barcode: pending.code, name: pending.name || draft.name, brand: pending.brand || draft.brand } : draft;
      keep(merged);
      if (pending) contributeProduct(pending.code, merged);
      setPending(null);
    } catch {
      setError('글자를 읽지 못했습니다. 원재료명과 영양성분표가 화면을 가득 채우게, 빛 반사 없이 다시 찍어 보세요.');
    } finally {
      setBusy(null);
    }
  }

  // 실시간 바코드 인식: 가운데 영역을 잘라 빠르게 읽고, 같은 번호가 두 번 나와야 확정
  useEffect(() => {
    if (!live) return;
    let stream: MediaStream | undefined;
    let stop = false;
    const started = Date.now();
    setHint('바코드를 가운데 상자에 맞춰 주세요');
    (async () => {
      try {
        const { getDetector, normalize, validGtin } = await import('../lib/barcode');
        const detectorP = getDetector();
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (stop) return;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps = (track.getCapabilities?.() ?? {}) as Record<string, unknown>;
        if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
          track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {});
        }
        setTorch(caps.torch ? false : null);
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const detector = await detectorP;
        const canvas = document.createElement('canvas');
        const g = canvas.getContext('2d', { willReadFrequently: true })!;
        let last = '';
        let frame = 0;
        while (!stop) {
          if (v.readyState >= 2 && v.videoWidth) {
            // 짝수 번째는 가운데 띠, 홀수 번째는 전체 화면을 읽어 작게·크게 찍힌 경우를 모두 잡습니다.
            const full = frame++ % 2 === 1;
            const sw = full ? v.videoWidth : Math.round(v.videoWidth * 0.8);
            const sh = full ? v.videoHeight : Math.round(v.videoHeight * 0.45);
            const sx = Math.round((v.videoWidth - sw) / 2), sy = Math.round((v.videoHeight - sh) / 2);
            const scale = Math.min(1, 1280 / sw);
            canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
            g.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
            const found = await detector.detect(canvas).catch(() => []);
            const hit = found.map((f) => normalize(f.rawValue, f.format)).find(validGtin);
            if (hit) {
              if (hit === last) {
                navigator.vibrate?.(60);
                stop = true;
                setLive(false);
                byBarcode(hit);
                break;
              }
              last = hit;
              setHint('읽는 중… 잠시 그대로 두세요');
            }
          }
          const secs = (Date.now() - started) / 1000;
          if (secs > 8 && secs < 8.3) setHint('잘 안 읽히면 한 뼘(15cm) 정도 떨어뜨리고, 바코드를 가로로 눕혀 주세요');
          if (secs > 16 && secs < 16.3) setHint('어두우면 손전등을 켜거나 "바코드 사진으로 찾기"를 써 보세요');
          await new Promise((r) => setTimeout(r, 120));
        }
      } catch (e) {
        if (!stop) { setLive(false); setError(cameraMessage(e)); }
      }
    })();
    return () => {
      stop = true;
      trackRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
      setTorch(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  function toggleTorch() {
    const t = trackRef.current;
    if (!t || torch === null) return;
    const next = !torch;
    t.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] }).then(() => setTorch(next)).catch(() => setTorch(null));
  }

  return (
    <>
      <header className="top">
        <div>
          <p>장 볼 때 꺼내 보는</p>
          <h1>성분 스캔</h1>
        </div>
      </header>

      {live ? (
        <>
          <div className="video-box">
            <video ref={video} playsInline muted autoPlay aria-label="바코드 카메라 화면" />
            <div className="aim" aria-hidden="true" />
          </div>
          <p className="small" aria-live="polite" style={{ textAlign: 'center', margin: '8px 0 0' }}>{hint}</p>
          <div style={{ display: 'grid', gridTemplateColumns: torch === null ? '1fr' : '1fr 1fr', gap: 10, marginTop: 10 }}>
            {torch !== null && <button className="btn ghost" aria-pressed={torch} onClick={toggleTorch}>{torch ? '손전등 끄기' : '손전등 켜기'}</button>}
            <button className="btn ghost" onClick={() => setLive(false)}>그만 찍기</button>
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {canCamera && <button className="btn block" onClick={() => { setError(null); setInfo(null); setLive(true); }}><Icon.scan />바코드 비추기</button>}
          {!IS_PREVIEW && <button className="btn ghost block" onClick={() => barcodePhoto.current?.click()}><Icon.camera />바코드 사진으로 찾기</button>}
          <button className={`btn block${pending ? '' : ' ghost'}`} onClick={() => labelInput.current?.click()}><Icon.camera />원재료·영양성분표 찍기</button>
        </div>
      )}
      <input ref={labelInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => { byLabel(e.target.files?.[0]); e.target.value = ''; }} aria-label="표시사항 사진 선택" />
      <input ref={barcodePhoto} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => { byBarcodePhoto(e.target.files?.[0]); e.target.value = ''; }} aria-label="바코드 사진 선택" />

      {IS_PREVIEW ? (
        <p className="small muted" style={{ marginTop: 12 }}>미리보기에서는 바코드 검색이 꺼져 있습니다. 정식 앱(hankki-scan.vercel.app)에서는 바코드로 바로 찾습니다.</p>
      ) : !live && (
      <form className="inline" style={{ marginTop: 16, alignItems: 'end' }} onSubmit={(e) => { e.preventDefault(); if (code) byBarcode(code); }}>
        <label className="field">
          <span className="small muted">바코드 아래 숫자로 찾기</span>
          <input inputMode="numeric" autoComplete="off" maxLength={14} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="8801234567890" />
        </label>
        <button className="btn" type="submit" disabled={code.length < 8}>찾기</button>
      </form>
      )}

      {info && !busy && <div className="notice" role="status">{info}</div>}
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
