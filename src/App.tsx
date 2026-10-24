import { useEffect, useState } from 'react';
import { Today } from './screens/Today';
import { Capture } from './screens/Capture';
import { Scan } from './screens/Scan';
import { Rhythm } from './screens/Rhythm';
import { Jeongseon } from './screens/Jeongseon';
import { Settings } from './screens/Settings';
import { Icon, useToast } from './ui';

type Tab = 'today' | 'scan' | 'rhythm' | 'jeongseon';

function initial(): { tab: Tab; focus?: string } {
  const m = location.pathname.match(/^\/p\/([a-z0-9-]+)/);
  if (m) return { tab: 'jeongseon', focus: m[1] };
  if (location.pathname.startsWith('/scan')) return { tab: 'scan' };
  return { tab: 'today' };
}

export function App() {
  const [{ tab, focus }, setNav] = useState(initial);
  const [capture, setCapture] = useState(false);
  const [settings, setSettings] = useState(false);
  const [toastNode, toast] = useToast();

  const go = (t: Tab) => { setNav({ tab: t }); window.scrollTo(0, 0); };

  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setCapture(false); setSettings(false); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  const tabs: { id: Tab; label: string; icon: () => JSX.Element }[] = [
    { id: 'today', label: '오늘', icon: Icon.today },
    { id: 'scan', label: '스캔', icon: Icon.scan },
    { id: 'rhythm', label: '리듬', icon: Icon.rhythm },
    { id: 'jeongseon', label: '정선', icon: Icon.mountain },
  ];

  return (
    <>
      <main className="app">
        {tab === 'today' && <Today onCapture={() => setCapture(true)} onSettings={() => setSettings(true)} />}
        {tab === 'scan' && <Scan onShop={() => go('jeongseon')} />}
        {tab === 'rhythm' && <Rhythm />}
        {tab === 'jeongseon' && <Jeongseon focus={focus} />}
      </main>

      <div className="tabs">
        <nav aria-label="주요 화면">
          {tabs.slice(0, 2).map((t) => (
            <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}><t.icon />{t.label}</button>
          ))}
          <button className="shutter" onClick={() => setCapture(true)} aria-label="한끼 찍기"><Icon.camera /></button>
          {tabs.slice(2).map((t) => (
            <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}><t.icon />{t.label}</button>
          ))}
        </nav>
      </div>

      {capture && <Capture onClose={() => setCapture(false)} onSaved={(m) => { setCapture(false); go('today'); toast(m); }} />}
      {settings && <Settings onClose={() => setSettings(false)} toast={toast} />}
      {toastNode}
    </>
  );
}
