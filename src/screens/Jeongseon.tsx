import { useEffect } from 'react';
import { COMPANY, PRODUCTS } from '../lib/products';

/** 제품 포장 QR(/p/<slug>)로 들어오면 해당 제품 카드를 강조합니다. */
export function Jeongseon({ focus }: { focus?: string }) {
  useEffect(() => {
    if (focus) document.getElementById(`p-${focus}`)?.scrollIntoView({ block: 'center' });
  }, [focus]);

  return (
    <>
      <header className="top">
        <div>
          <p>만든 곳이 보이는 먹거리</p>
          <h1>정선에서 온 것</h1>
        </div>
      </header>

      <section className="origin-hero">
        <h2>강원 정선 산자락의 작은 식품 공장</h2>
        <p>{COMPANY.name}은 정선에서 산더덕·산양삼을 직접 기르고, HACCP 인증 공장에서 부각·즙·양념을 만듭니다. 제품마다 원산지와 만든 곳을 그대로 적었습니다.</p>
      </section>

      <h2>제품</h2>
      <ul className="list">
        {PRODUCTS.map((p) => (
          <li key={p.slug} id={`p-${p.slug}`} className={`product-card${focus === p.slug ? ' focus' : ''}`} style={{ display: 'block' }}>
            <span className="tag">{p.category}</span>
            <h3 style={{ marginTop: 8 }}>{p.name}</h3>
            <p className="small muted" style={{ margin: '2px 0 0' }}>{p.oneLine}</p>
            <dl>
              <dt>원산지</dt><dd>{p.origin}</dd>
              <dt>만든 곳</dt><dd>{p.madeAt}</dd>
            </dl>
            <a className="btn ghost" href={p.url} target="_blank" rel="noopener noreferrer">스마트스토어에서 보기</a>
          </li>
        ))}
      </ul>

      <p className="small muted" style={{ marginTop: 20 }}>
        {COMPANY.address} · 문의 <a href={`tel:${COMPANY.phone}`}>{COMPANY.phone}</a>
      </p>
    </>
  );
}
