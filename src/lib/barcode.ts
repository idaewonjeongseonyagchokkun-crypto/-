/**
 * 바코드 읽기 — 휴대폰 브라우저마다 기본 지원 여부가 달라(아이폰 사파리는 미지원)
 * 브라우저 기본 기능이 있으면 그것을, 없으면 앱에 내장한 ZXing 엔진(WebAssembly)을 씁니다.
 * 엔진 파일은 앱 서버에서 직접 내려받으므로 외부 CDN이 필요 없습니다.
 */
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

export type Detector = { detect: (src: ImageBitmapSource | HTMLVideoElement | HTMLCanvasElement) => Promise<{ rawValue: string; format: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;
declare global { interface Window { BarcodeDetector?: DetectorCtor & { getSupportedFormats?: () => Promise<string[]> } } }

/** 식품 포장에 쓰이는 1차원 바코드 */
export const FOOD_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf'];

let cached: Promise<Detector> | null = null;

export function getDetector(): Promise<Detector> {
  if (cached) return cached;
  cached = (async () => {
    const Native = window.BarcodeDetector;
    if (Native?.getSupportedFormats) {
      try {
        const supported = await Native.getSupportedFormats();
        if (supported.includes('ean_13')) return new Native({ formats: FOOD_FORMATS.filter((f) => supported.includes(f)) });
      } catch { /* 기본 기능이 깨져 있으면 내장 엔진으로 */ }
    }
    const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
    prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
      fireImmediately: true,
    });
    return new BarcodeDetector({ formats: FOOD_FORMATS as never }) as unknown as Detector;
  })();
  cached.catch(() => { cached = null; });
  return cached;
}

/** EAN-13/EAN-8/UPC-A 마지막 자리(검증 숫자)가 맞는지 확인해 잘못 읽은 번호를 걸러냅니다. */
export function validGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** UPC-E(8자리, 0/1로 시작)를 UPC-A로 펼칩니다. 그 외에는 그대로 둡니다. */
export function normalize(raw: string, format?: string): string {
  const code = raw.replace(/\D/g, '');
  if (format === 'upc_e' && code.length === 8) {
    const [ns, d1, d2, d3, d4, d5, d6, ck] = code.split('');
    let body: string;
    if ('012'.includes(d6)) body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
    else if (d6 === '3') body = `${d1}${d2}${d3}00000${d4}${d5}`;
    else if (d6 === '4') body = `${d1}${d2}${d3}${d4}00000${d5}`;
    else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
    return `${ns}${body}${ck}`;
  }
  return code;
}

/** 사진 한 장에서 바코드 찾기. 작게 찍힌 경우를 위해 원본·확대·회전본을 차례로 시도합니다. */
export async function detectInFile(file: File): Promise<string | null> {
  const detector = await getDetector();
  const bitmap = await createImageBitmap(file);
  const tries: { scale: number; rotate: number }[] = [
    { scale: 1, rotate: 0 }, { scale: 2, rotate: 0 }, { scale: 1, rotate: 90 }, { scale: 0.5, rotate: 0 },
  ];
  for (const t of tries) {
    const maxSide = Math.max(bitmap.width, bitmap.height) * t.scale;
    if (maxSide > 4000 || maxSide < 300) continue;
    const c = document.createElement('canvas');
    const w = Math.round(bitmap.width * t.scale), h = Math.round(bitmap.height * t.scale);
    const rot = t.rotate === 90;
    c.width = rot ? h : w; c.height = rot ? w : h;
    const g = c.getContext('2d')!;
    if (rot) { g.translate(c.width, 0); g.rotate(Math.PI / 2); }
    g.drawImage(bitmap, 0, 0, w, h);
    const found = await detector.detect(c).catch(() => []);
    for (const f of found) {
      const code = normalize(f.rawValue, f.format);
      if (validGtin(code)) return code;
    }
  }
  return null;
}
