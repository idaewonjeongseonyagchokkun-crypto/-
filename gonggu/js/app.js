(() => {
  'use strict';

  const C = window.ARIRANG_CONFIG;
  const params = new URLSearchParams(location.search);
  const isAdmin = params.get('admin') === '1';

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const won = (n) => Math.round(n).toLocaleString('ko-KR') + '원';
  const pct = (n) => (Math.round(n * 10) / 10).toString() + '%';

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
  };

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  function safeUrl(u) {
    if (!u) return null;
    try {
      const x = new URL(u, location.href);
      return x.protocol === 'https:' || x.protocol === 'http:' ? x : null;
    } catch { return null; }
  }

  /* ---------- anonymous analytics (no personal data) ---------- */
  const aid = (() => {
    let id = store.get('aid', null);
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, '0')).join('');
      store.set('aid', id);
    }
    return id;
  })();
  const ref = (() => {
    const r = (params.get('ref') || '').replace(/[^a-z0-9]/gi, '').slice(0, 12);
    if (r) { try { sessionStorage.setItem('ref', r); } catch { /* noop */ } return r; }
    try { return sessionStorage.getItem('ref') || ''; } catch { return ''; }
  })();

  function track(name, data) {
    const ev = { t: Date.now(), n: name, aid, ref: ref || undefined, ...data };
    const log = store.get('events', []);
    log.push(ev);
    store.set('events', log.slice(-500));
    const ep = safeUrl(C.analytics && C.analytics.endpoint);
    if (ep && navigator.sendBeacon) {
      try { navigator.sendBeacon(ep.href, new Blob([JSON.stringify(ev)], { type: 'text/plain' })); } catch { /* noop */ }
    }
  }

  /* ---------- deal logic ---------- */
  const endMs = (d) => (d.endAt ? new Date(d.endAt).getTime() : null);
  const startMs = (d) => (d.startAt ? new Date(d.startAt).getTime() : null);
  function dealStatus(d, now = Date.now()) {
    if (startMs(d) && now < startMs(d)) return 'upcoming';
    if (endMs(d) && now >= endMs(d)) return 'closed';
    return 'open';
  }
  function fmtRemain(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400);
    const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return (d > 0 ? d + '일 ' : '') + `${hh}:${mm}:${ss}`;
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }
  function buyHref(deal, opt) {
    const u = safeUrl(opt.url);
    if (!u) return null;
    u.searchParams.set('utm_source', 'arirang_gonggu');
    u.searchParams.set('utm_medium', 'webapp');
    u.searchParams.set('utm_campaign', deal.id);
    if (ref) u.searchParams.set('utm_content', ref);
    return u.href;
  }
  function shareUrl(deal) {
    const u = new URL(location.pathname, location.origin);
    u.searchParams.set('deal', deal.id);
    u.searchParams.set('ref', aid);
    return u.href;
  }

  async function share(deal) {
    const end = endMs(deal);
    const text = `[${C.brand.company}] ${deal.name} 공동구매${end ? ' · ' + fmtDate(end) + '까지' : ''} — 같이 사면 더 좋아요!`;
    const url = shareUrl(deal);
    track('share', { deal: deal.id });
    if (navigator.share) {
      try { await navigator.share({ title: C.brand.name, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast('공유 문구와 링크를 복사했어요. 카카오톡에 붙여넣으세요');
    } catch {
      window.prompt('아래 링크를 복사해 공유하세요', `${text}\n${url}`);
    }
  }

  /* ---------- countdown ---------- */
  const countdowns = [];
  let timer = null;
  function tickAll() {
    const now = Date.now();
    for (const c of countdowns) {
      if (!c.el.isConnected) continue;
      const st = dealStatus(c.deal, now);
      if (st === 'open' && c.end) c.el.textContent = '⏱ ' + fmtRemain(c.end - now);
      else if (st === 'closed') { c.el.textContent = '마감'; c.onClose && c.onClose(); c.onClose = null; }
    }
  }
  function startTimer() {
    clearInterval(timer);
    tickAll();
    timer = setInterval(tickAll, 1000);
  }

  /* ---------- components ---------- */
  function dealCard(deal, { highlight = false } = {}) {
    const state = { idx: 0 };
    const status = () => dealStatus(deal);

    const priceBox = h('div');
    const unitNote = h('p', { class: 'unit-note' });
    const stateLine = h('p', { class: 'deal-state' });
    const buyBtn = h('a', { class: 'btn', rel: 'noopener', target: '_blank' }, '공구 참여하기');
    const shareBtn = h('button', { class: 'btn btn-light', type: 'button', onclick: () => share(deal) }, '👫 공유하기');
    const timeEl = h('span', { class: 'deal-time' });

    const chipEls = deal.options.map((opt, i) => h('button', {
      class: 'chip', type: 'button', role: 'radio', 'aria-checked': i === 0 ? 'true' : 'false',
      onclick: () => { state.idx = i; chipEls.forEach((c, j) => c.setAttribute('aria-checked', j === i ? 'true' : 'false')); paint(); },
    }, opt.label));

    function paint() {
      const opt = deal.options[state.idx];
      const off = opt.regular > opt.price ? Math.round((1 - opt.price / opt.regular) * 100) : 0;
      priceBox.replaceChildren(h('div', { class: 'price-row' },
        off ? h('span', { class: 'price-off' }, off + '%') : null,
        h('span', { class: 'price-now' }, won(opt.price)),
        off ? h('span', { class: 'price-was' }, won(opt.regular)) : null));
      unitNote.textContent = '배송비·결제 수수료 등은 쇼핑몰 결제 화면에서 확인할 수 있어요';

      const st = status();
      const href = buyHref(deal, opt);
      buyBtn.classList.remove('btn-light');
      if (st === 'closed') {
        buyBtn.removeAttribute('href'); buyBtn.setAttribute('aria-disabled', 'true'); buyBtn.textContent = '마감된 공구예요';
        stateLine.textContent = '이 공동구매는 마감되었어요. 다음 공구를 기다려 주세요.'; stateLine.className = 'deal-state is-closed';
      } else if (st === 'upcoming') {
        buyBtn.removeAttribute('href'); buyBtn.setAttribute('aria-disabled', 'true'); buyBtn.textContent = fmtDate(startMs(deal)) + ' 오픈';
        stateLine.textContent = ''; stateLine.className = 'deal-state';
      } else if (!href) {
        buyBtn.removeAttribute('href'); buyBtn.setAttribute('aria-disabled', 'true'); buyBtn.textContent = '오픈 준비중';
        stateLine.textContent = '구매 링크 준비 중이에요'; stateLine.className = 'deal-state';
      } else {
        buyBtn.setAttribute('href', href); buyBtn.removeAttribute('aria-disabled'); buyBtn.textContent = '공구 참여하기';
        const end = endMs(deal);
        stateLine.textContent = end ? `${fmtDate(end)} 23:59 마감 · 결제는 안전한 쇼핑몰에서 진행돼요` : '결제는 안전한 쇼핑몰에서 진행돼요';
        stateLine.className = 'deal-state';
      }
    }
    buyBtn.addEventListener('click', () => track('buy_click', { deal: deal.id, opt: deal.options[state.idx].label }));

    const visual = h('div', { class: 'deal-visual' },
      h('span', { class: 'emoji', 'aria-hidden': 'true' }, deal.emoji),
      deal.badge ? h('span', { class: 'deal-badge' }, deal.badge) : null,
      deal.endAt ? timeEl : null);
    visual.style.background = `linear-gradient(135deg, ${deal.colors[0]}, ${deal.colors[1]})`;

    const el = h('article', { class: 'deal' + (highlight ? ' is-highlight' : ''), id: 'deal-' + deal.id },
      visual,
      h('div', { class: 'deal-body' },
        h('h3', { class: 'deal-name' }, deal.name),
        h('p', { class: 'deal-tag' }, deal.tagline),
        h('p', { class: 'deal-desc' }, deal.desc),
        deal.options.length > 1 ? h('div', { class: 'chips', role: 'radiogroup', 'aria-label': deal.name + ' 구성 선택' }, chipEls) : h('div', { class: 'chips' }),
        priceBox, unitNote,
        h('div', { class: 'actions' }, shareBtn, buyBtn),
        stateLine));

    if (deal.endAt) countdowns.push({ el: timeEl, deal, end: endMs(deal), onClose: paint });
    paint();
    return el;
  }

  /* ---------- views ---------- */
  const views = {};

  views.deals = () => {
    const now = Date.now();
    const open = C.deals.filter((d) => dealStatus(d, now) !== 'closed')
      .sort((a, b) => (endMs(a) || Infinity) - (endMs(b) || Infinity));
    const closed = C.deals.filter((d) => dealStatus(d, now) === 'closed');
    const focusId = params.get('deal');
    const root = h('div', null,
      h('section', { class: 'hero' },
        h('h1', { class: 'hero-title' }, '오늘의 한정 공구'),
        h('p', { class: 'hero-sub' }, C.brand.slogan)),
      h('div', { class: 'trust' },
        h('span', null, '🏭 제조사 직접 판매'), h('span', null, '📍 강원 정선'),
        h('span', null, '🔒 카드정보는 쇼핑몰에서만'), h('span', null, '⏱ 실제 마감시각 기준')));

    if (!open.length) root.append(h('div', { class: 'card' }, h('h3', null, '진행 중인 공구가 없어요'), h('p', { class: 'note' }, '곧 새로운 공동구매가 열립니다. 신제품 탭에서 관심 상품을 눌러 주세요.')));
    open.forEach((d, i) => {
      root.append(dealCard(d, { highlight: focusId ? d.id === focusId : i === 0 }));
      track('deal_view', { deal: d.id });
    });

    root.append(h('div', { class: 'card' },
      h('h3', null, '이렇게 참여해요'),
      h('ol', { class: 'steps' },
        h('li', null, '마음에 드는 공구와 구성을 고릅니다'),
        h('li', null, '[공유하기]로 가족·이웃과 함께해요'),
        h('li', null, '[공구 참여하기]로 쇼핑몰에서 안전하게 결제해요'),
        h('li', null, '아리랑식품이 정성껏 포장해 직접 보내드려요'))));

    if (closed.length) {
      root.append(h('h2', { class: 'section-title' }, '마감된 공구'));
      closed.forEach((d) => root.append(dealCard(d)));
    }
    return root;
  };

  views.soon = () => {
    const wish = new Set(store.get('wish', []));
    const root = h('div', null,
      h('section', { class: 'hero' },
        h('h1', { class: 'hero-title' }, '곧 출시되는 신제품'),
        h('p', { class: 'hero-sub' }, '관심 있는 제품을 눌러 주시면 출시 준비에 참고할게요. 개인정보는 받지 않아요.')),
      h('div', { class: 'notice' }, '신제품은 제조·표시사항 확인이 끝난 뒤 판매됩니다. 지금은 구매할 수 없어요.'));

    C.upcoming.forEach((p) => {
      const btn = h('button', { class: 'btn btn-small ' + (wish.has(p.id) ? '' : 'btn-light'), type: 'button', 'aria-pressed': wish.has(p.id) ? 'true' : 'false' },
        wish.has(p.id) ? '✓ 관심 표시됨' : '관심 있어요');
      btn.addEventListener('click', () => {
        if (wish.has(p.id)) { wish.delete(p.id); } else { wish.add(p.id); track('interest', { item: p.id }); toast('관심 상품으로 표시했어요'); }
        store.set('wish', [...wish]);
        const on = wish.has(p.id);
        btn.textContent = on ? '✓ 관심 표시됨' : '관심 있어요';
        btn.classList.toggle('btn-light', !on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      root.append(h('div', { class: 'card soon-card' },
        h('span', { class: 'soon-emoji', 'aria-hidden': 'true' }, p.emoji),
        h('div', { class: 'soon-info' }, h('strong', null, p.name), h('span', null, p.desc)),
        btn));
    });

    const kakao = safeUrl(C.links.kakaoChannel);
    if (kakao) root.append(h('a', { class: 'btn btn-block', href: kakao.href, target: '_blank', rel: 'noopener', onclick: () => track('kakao_channel') }, '💬 카카오톡 채널에서 출시 소식 받기'));
    return root;
  };

  views.guide = () => {
    const c = C.company;
    const rows = [['상호', C.brand.company], ['대표자', c.ceo], ['사업자등록번호', c.bizNo], ['통신판매업', c.mailOrderNo],
      ['고객센터', [c.phone, c.hours].filter(Boolean).join(' · ')], ['이메일', c.email], ['주소', c.address]].filter((r) => r[1]);
    const privacy = safeUrl(C.links.privacy);
    const inquiry = safeUrl(C.links.inquiry);
    return h('div', null,
      h('section', { class: 'hero' }, h('h1', { class: 'hero-title' }, '이용 안내')),
      h('div', { class: 'card' },
        h('details', { open: true }, h('summary', null, '공동구매는 어떻게 진행되나요?'),
          h('p', null, '아리랑식품이 직접 만든 제품만 정해진 기간 동안 특별한 구성과 가격으로 판매해요. 결제와 배송은 아리랑식품 쇼핑몰에서 진행됩니다.')),
        h('details', null, h('summary', null, '친구와 같이 사면 무엇이 달라지나요?'),
          h('p', null, '지금은 공유 링크로 가족·이웃과 함께 구매하는 방식이에요. 구매 완료가 확인되는 실제 2인 공구·추천 혜택은 주문 연동 후 정식으로 열 예정이며, 단순 링크 공유만으로는 혜택이 확정되지 않아요.')),
        h('details', null, h('summary', null, '앱은 어떻게 설치하나요?'),
          h('p', null, '안드로이드 크롬: 상단 [앱 설치] 또는 메뉴의 "홈 화면에 추가". 아이폰 사파리: 공유 버튼 → "홈 화면에 추가". 앱스토어 설치는 필요 없어요.')),
        h('details', null, h('summary', null, '배송은 언제 되나요?'), h('p', null, C.policy.shipping)),
        h('details', null, h('summary', null, '교환·환불은 어떻게 하나요?'), h('p', null, C.policy.refund)),
        h('details', null, h('summary', null, '개인정보는 어떻게 쓰이나요?'),
          h('p', null, '이 앱은 이름·연락처·카드정보를 직접 받지 않아요. 주문 시 필요한 정보는 쇼핑몰에서만 처리됩니다. 앱 개선을 위해 기기 임의 ID 기반의 익명 이용기록(어떤 공구를 봤는지, 공유·구매 버튼을 눌렀는지)만 사용하며, 개인을 식별하지 않아요.'),
          privacy ? h('p', null, h('a', { href: privacy.href, target: '_blank', rel: 'noopener' }, '쇼핑몰 개인정보처리방침 보기')) : null)),
      inquiry ? h('a', { class: 'btn btn-block btn-light', href: inquiry.href, target: '_blank', rel: 'noopener' }, '💬 문의하기') : null,
      rows.length ? h('dl', { class: 'info-list footer' }, rows.map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v)))) : null);
  };

  views.admin = () => {
    const num = (id, label, val, step = 'any') => h('div', { class: 'field' },
      h('label', { for: id }, label), h('input', { id, type: 'number', inputmode: 'decimal', value: val, step, min: '0' }));
    const v = (id) => parseFloat($('#' + id).value) || 0;

    const profitOut = h('div', { class: 'result', 'aria-live': 'polite' });
    const targetOut = h('div', { class: 'result', 'aria-live': 'polite' });
    const calcProfit = () => {
      const price = v('c-price'), cost = v('c-cost'), pack = v('c-pack'), ship = v('c-ship'), fee = v('c-fee'), disc = v('c-disc');
      const net = price - disc;
      const profit = net - cost - pack - ship - net * fee / 100;
      const margin = net > 0 ? profit / net * 100 : 0;
      profitOut.replaceChildren(
        h('div', null, '주문 1건 이익: ', h('b', { class: profit >= 0 ? 'good' : 'bad' }, won(profit))),
        h('div', null, '이익률: ', h('b', null, pct(margin))),
        ...(profit < 0 ? [h('div', { class: 'bad' }, '⚠ 이 가격은 팔수록 손해예요. 가격·구성을 조정하세요.')] : []));
    };
    const calcTarget = () => {
      const target = v('t-target'), aov = v('t-aov'), cvr = v('t-cvr');
      const orders = aov > 0 ? Math.ceil(target / aov) : 0;
      const visits = cvr > 0 ? Math.ceil(orders / (cvr / 100)) : 0;
      targetOut.replaceChildren(
        h('div', null, '필요 주문: ', h('b', null, orders.toLocaleString('ko-KR') + '건'), ` (하루 약 ${Math.ceil(orders / 30).toLocaleString('ko-KR')}건)`),
        h('div', null, '필요 방문: ', h('b', null, visits.toLocaleString('ko-KR') + '회'), ` (하루 약 ${Math.ceil(visits / 30).toLocaleString('ko-KR')}회)`));
    };

    const log = store.get('events', []);
    const agg = {};
    for (const e of log) {
      const k = e.deal || e.item || '-';
      agg[k] = agg[k] || { deal_view: 0, share: 0, buy_click: 0, interest: 0 };
      if (e.n in agg[k]) agg[k][e.n]++;
    }
    const rows = Object.entries(agg).map(([k, a]) => h('tr', null, h('td', null, k), h('td', null, a.deal_view), h('td', null, a.share), h('td', null, a.buy_click), h('td', null, a.interest)));

    const exportBtn = h('button', { class: 'btn btn-light btn-small', type: 'button', onclick: () => {
      const csv = 'time,event,deal,item,opt,aid,ref\n' + log.map((e) => [new Date(e.t).toISOString(), e.n, e.deal || '', e.item || '', e.opt || '', e.aid, e.ref || ''].join(',')).join('\n');
      const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'arirang-events.csv' });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } }, 'CSV 내려받기');

    const root = h('div', null,
      h('section', { class: 'hero' }, h('h1', { class: 'hero-title' }, '운영자 도구'), h('p', { class: 'hero-sub' }, '이 화면은 주소 끝에 ?admin=1 이 있을 때만 보입니다. 비밀 정보는 담겨 있지 않아요.')),
      h('div', { class: 'card' }, h('h3', null, '1. 공구 손익 계산기'),
        h('div', { class: 'grid2' }, num('c-price', '공구가(원)', 17800), num('c-cost', '원가+가공비(원)', 9000)),
        h('div', { class: 'grid2' }, num('c-pack', '포장비(원)', 800), num('c-ship', '택배비 부담(원)', 3000)),
        h('div', { class: 'grid2' }, num('c-fee', '결제수수료(%)', 3.3), num('c-disc', '쿠폰·추가할인(원)', 0)),
        profitOut, h('p', { class: 'note' }, '※ 예시 값입니다. 실제 원가·택배비로 바꿔 계산하세요.')),
      h('div', { class: 'card' }, h('h3', null, '2. 매출 목표 역산 (30일)'),
        num('t-target', '월 목표 매출(원)', 300000000), h('div', { class: 'grid2' }, num('t-aov', '객단가(원)', 30000), num('t-cvr', '구매전환율(%)', 3)),
        targetOut, h('p', { class: 'note' }, '현재 실적이 아닌, 목표를 역산한 가정입니다.')),
      h('div', { class: 'card' }, h('h3', null, '3. 이 기기의 이용 기록'),
        rows.length ? h('table', { class: 'stats' }, h('thead', null, h('tr', null, h('th', null, '공구'), h('th', null, '조회'), h('th', null, '공유'), h('th', null, '구매클릭'), h('th', null, '관심'))), h('tbody', null, rows)) : h('p', { class: 'note' }, '아직 기록이 없어요.'),
        h('p', { class: 'note' }, '모든 방문자의 통계를 모으려면 README의 "통계 수집 켜기"를 따라 하세요.'),
        exportBtn));
    queueMicrotask(() => {
      root.querySelectorAll('.card input').forEach((i) => i.addEventListener('input', () => { calcProfit(); calcTarget(); }));
      calcProfit(); calcTarget();
    });
    return root;
  };

  /* ---------- router ---------- */
  const TABS = [['deals', '🔥', '공구'], ['soon', '🌱', '신제품'], ['guide', 'ℹ️', '안내']];
  if (isAdmin) TABS.push(['admin', '🧮', '운영']);

  function route() {
    const key = (location.hash || '#deals').slice(1);
    const name = views[key] && (key !== 'admin' || isAdmin) ? key : 'deals';
    countdowns.length = 0;
    const app = $('#app');
    app.replaceChildren(views[name]());
    $('#tabbar').replaceChildren(...TABS.map(([k, ico, label]) => h('a', { class: 'tab', href: '#' + k, 'aria-current': k === name ? 'page' : null }, h('span', { class: 'ico', 'aria-hidden': 'true' }, ico), label)));
    startTimer();
    if (name === 'deals' && params.get('deal')) {
      const t = document.getElementById('deal-' + params.get('deal'));
      if (t) t.scrollIntoView({ block: 'start' });
    } else window.scrollTo(0, 0);
  }

  /* ---------- boot ---------- */
  document.title = C.brand.name;
  $('#brand-name').textContent = C.brand.name;
  $('#brand-company').textContent = C.brand.company;
  if (C.draft) $('#draft-banner').hidden = false;
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tickAll(); });
  track('open', { path: location.hash || '#deals' });
  route();

  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredInstall = e; $('#install-btn').hidden = false;
  });
  $('#install-btn').addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice.catch(() => {});
    deferredInstall = null; $('#install-btn').hidden = true;
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
