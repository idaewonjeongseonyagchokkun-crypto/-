import { actions, useStore } from '../lib/store';
import { Icon } from '../ui';

export function Settings({ onClose, toast }: { onClose: () => void; toast: (m: string) => void }) {
  const s = useStore((st) => st.settings);
  const counts = { meals: useStore((st) => st.meals.length), products: useStore((st) => st.products.length) };

  function download() {
    const blob = new Blob([actions.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hankki-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="set-title">
      <div className="sheet-inner">
        <div className="sheet-head">
          <h2 id="set-title">설정과 내 데이터</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기"><Icon.close /></button>
        </div>

        <p className="muted">식사 사진과 기록은 이 휴대폰에만 저장됩니다. 지금까지 식사 {counts.meals}건, 제품 {counts.products}건을 기록했습니다.</p>

        <div className="list" style={{ marginTop: 16 }}>
          <label className="switch">
            <input type="checkbox" checked={s.shareTrends} onChange={(e) => { actions.updateSettings({ shareTrends: e.target.checked }); toast(e.target.checked ? '익명 트렌드 공유를 켰습니다' : '익명 트렌드 공유를 껐습니다'); }} />
            <span>
              <h3>익명 트렌드 공유</h3>
              <span className="small muted">음식 이름, 추정 열량·나트륨·단백질, 식사 시각(시 단위), 스캔한 제품명과 점수만 보냅니다. 사진·이름·위치는 보내지 않습니다. 모인 경향은 아리랑식품의 새 제품을 만드는 데 쓰입니다. 언제든 끌 수 있습니다.</span>
            </span>
          </label>
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 24 }}>
          <button className="btn ghost block" onClick={download}>내 기록 파일로 받기</button>
          <button className="btn ghost block" style={{ borderColor: 'var(--gochu)', color: 'var(--gochu)' }} onClick={() => {
            if (confirm('이 휴대폰의 모든 식사·스캔·생활 기록을 지웁니다. 되돌릴 수 없습니다.')) { actions.resetAll(); toast('모든 기록을 지웠습니다'); onClose(); }
          }}>모든 기록 지우기</button>
        </div>

        <p className="small muted" style={{ marginTop: 28 }}>
          한끼스캔이 보여 주는 열량·영양값은 사진과 공개 데이터로 계산한 추정치이며, 진단이나 치료를 대신하지 않습니다.
          제품 정보 출처: Open Food Facts (ODbL), 제품 표시사항.
        </p>
      </div>
    </div>
  );
}
