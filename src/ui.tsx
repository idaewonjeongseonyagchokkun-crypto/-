import { useEffect, useState } from 'react';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const Icon = {
  today: () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P}><path d="M3 11h18c0 5-4 8-9 8s-9-3-9-8z" /><path d="M9 21h6" /></svg>),
  scan: () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M8 8v8M11 8v8M14 8v8M17 8v8" /></svg>),
  camera: () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>),
  rhythm: () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P}><path d="M3 12h4l2-6 4 12 2-6h6" /></svg>),
  mountain: () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P}><path d="M2 19l7-11 4 6 3-4 6 9z" /></svg>),
  gear: () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>),
  close: () => (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...P}><path d="M6 6l12 12M18 6L6 18" /></svg>),
};

/**
 * 오늘 먹은 양만큼 차오르는 그릇.
 * ratio는 1일 기준치 대비 비율 (1을 넘으면 그릇이 가득 차고 들기름색 테두리로 바뀝니다).
 */
export function Bowl({ ratio }: { ratio: number }) {
  const r = Math.max(0, Math.min(1, ratio));
  // 그릇 안쪽 높이 0~110px 중 채워지는 높이
  const fillTop = 150 - 110 * r;
  return (
    <svg viewBox="0 0 300 190" role="img" aria-label={`1일 기준 열량의 ${Math.round(ratio * 100)}%`}>
      <defs>
        <clipPath id="bowl-in"><path d="M30 40h240c0 66-54 112-120 112S30 106 30 40z" /></clipPath>
      </defs>
      <path d="M30 40h240c0 66-54 112-120 112S30 106 30 40z" fill="var(--paper)" />
      <g clipPath="url(#bowl-in)">
        <rect x="0" y={fillTop} width="300" height="200" fill="var(--namul)" style={{ transition: 'y .6s ease' }} />
        <path d={`M0 ${fillTop} q37 -8 75 0 t75 0 t75 0 t75 0 v12 h-300z`} fill="var(--namul-deep)" opacity=".35" />
      </g>
      <path d="M30 40h240c0 66-54 112-120 112S30 106 30 40z" fill="none" stroke={ratio > 1 ? 'var(--oil)' : 'var(--ink)'} strokeWidth="3" />
      <path d="M22 40h256" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      <path d="M112 152h76l-6 18h-64z" fill="var(--paper)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? <div className="toast" role="status">{msg}</div> : null;
  return [node, setMsg] as const;
}
