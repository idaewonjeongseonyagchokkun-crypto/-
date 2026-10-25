/*
 * 아리랑 공구팜 설정 파일 — 운영자는 이 파일만 수정하면 됩니다.
 *
 * 1) draft 를 false 로 바꾸기 전에: 가격, 구매 링크(url), 회사 정보를 모두 실제 값으로 채우세요.
 * 2) 구매 링크(url)는 카페24에 등록한 "공동구매 전용 상품" 주소를 넣습니다.
 *    url 이 비어 있으면 구매 버튼은 자동으로 "오픈 준비중"으로 표시됩니다.
 * 3) 비밀번호·API 키·관리자 키는 절대 이 파일에 넣지 마세요. 이 파일은 누구나 볼 수 있습니다.
 * 4) endAt 이 지나면 공구는 자동으로 "마감" 처리됩니다. (실제 마감시각 기준, 가짜 카운트다운 없음)
 */
window.ARIRANG_CONFIG = {
  // true: 상단에 "시안" 안내가 표시됩니다. 실제 오픈 전 반드시 false 로 변경.
  draft: true,

  brand: {
    name: '아리랑 공구팜',
    company: '아리랑식품영농조합법인',
    slogan: '정선 농가가 직접 만든 우리 먹거리, 같이 사면 더 좋아요',
  },

  company: {
    ceo: '',            // 대표자명
    bizNo: '',          // 사업자등록번호
    mailOrderNo: '',    // 통신판매업 신고번호
    phone: '',          // 고객센터 전화
    email: '',          // 문의 이메일
    address: '',        // 사업장 주소
    hours: '평일 09:00 ~ 17:00',
  },

  policy: {
    shipping: '결제 확인 후 영업일 기준 1~3일 내 출고합니다. (택배비 정책은 쇼핑몰 상품페이지 기준)',
    refund: '식품 특성상 단순 변심에 의한 반품은 제한될 수 있으며, 상품 하자·오배송은 수령 후 7일 이내 접수 시 교환/환불해 드립니다.',
  },

  links: {
    shop: '',           // 카페24 쇼핑몰 대표 주소 (예: https://arirang.cafe24.com)
    kakaoChannel: '',   // 카카오톡 채널 주소 (신제품 출시 알림용)
    inquiry: '',        // 문의 링크 (카카오 채널 채팅 등). 없으면 전화/이메일만 표시
    privacy: '',        // 쇼핑몰의 개인정보처리방침 주소
  },

  // 익명 이용통계 수집 (선택). docs/google-apps-script.gs 를 배포한 웹앱 URL 을 넣으면
  // 방문/클릭/공유 통계가 Google Sheets 에 쌓입니다. 비워두면 기기 안에만 저장됩니다.
  analytics: {
    endpoint: '',
  },

  /*
   * 진행 중인 공동구매. 가격은 모두 "예시"이므로 실제 가격으로 수정하세요.
   * regular: 정상가(실제로 판매해 온 가격만 입력 — 부풀린 기준가격 금지)
   * price:   공구가
   * url:     카페24 공구 전용 상품 주소
   */
  deals: [
    {
      id: 'gochu-bugak',
      name: '정선 고추부각',
      emoji: '🌶️',
      colors: ['#c8331e', '#f2a65a'],
      badge: '대표 상품',
      tagline: '바삭하고 매콤한 정선 고추부각',
      desc: '아리랑식품이 직접 만든 고추부각. 묶음으로 담아 함께 나누기 좋아요.',
      endAt: '2026-11-01T23:59:59+09:00',
      options: [
        { label: '2봉', regular: 19800, price: 17800, url: '' },
        { label: '3봉', regular: 29700, price: 25900, url: '' },
        { label: '5봉', regular: 49500, price: 41900, url: '' },
      ],
    },
    {
      id: 'kim-bugak',
      name: '김부각',
      emoji: '🍘',
      colors: ['#2f5d50', '#9bc4a4'],
      badge: '고소한 인기',
      tagline: '고소하게 바삭, 간식과 술안주로',
      desc: '고추부각과 함께 구성하면 한 번에 두 가지 맛을 즐길 수 있어요.',
      endAt: '2026-11-08T23:59:59+09:00',
      options: [
        { label: '2봉', regular: 17800, price: 15900, url: '' },
        { label: '4봉', regular: 35600, price: 30900, url: '' },
      ],
    },
    {
      id: 'deodeok-jeup',
      name: '산더덕즙',
      emoji: '🌿',
      colors: ['#7a4e2d', '#d9b382'],
      badge: '선물 추천',
      tagline: '정선 산더덕을 달여 담은 즙',
      desc: '부모님·지인 선물용 세트와 정기 구매용 박스를 준비했어요.',
      endAt: '2026-11-15T23:59:59+09:00',
      options: [
        { label: '1박스', regular: 39000, price: 35000, url: '' },
        { label: '선물세트(2박스)', regular: 78000, price: 66000, url: '' },
      ],
    },
    {
      id: 'mix-set',
      name: '아리랑 부각 혼합세트',
      emoji: '🎁',
      colors: ['#a4341f', '#e7b04f'],
      badge: '묶음 특가',
      tagline: '고추부각 + 김부각 한 번에',
      desc: '두 가지 부각을 함께 담은 제조사 직판 특별구성.',
      endAt: '2026-11-22T23:59:59+09:00',
      options: [
        { label: '혼합 4봉', regular: 37600, price: 32900, url: '' },
        { label: '혼합 8봉', regular: 75200, price: 62900, url: '' },
      ],
    },
    {
      id: 'family-set',
      name: '대용량 가족세트',
      emoji: '📦',
      colors: ['#5a3a1e', '#e2a24a'],
      badge: '대용량',
      tagline: '온 가족이 넉넉하게',
      desc: '부각과 즙을 넉넉하게 담은 대용량 구성. 함께 구매할 이웃과 나눠도 좋아요.',
      endAt: '2026-11-29T23:59:59+09:00',
      options: [
        { label: '가족세트', regular: 89000, price: 76900, url: '' },
      ],
    },
  ],

  // 출시 준비 중인 신제품. 판매 전에는 "관심 표시"만 받습니다. (품목·표시사항 확인 후 deals 로 이동)
  upcoming: [
    { id: 'cheongbihwan', name: '청비환', emoji: '🟤', desc: '출시 준비 중인 신제품입니다.' },
    { id: 'baedoraji-hwan', name: '배도라지환', emoji: '⚪', desc: '출시 준비 중인 신제품입니다.' },
    { id: 'gwanjeolhwan', name: '관절환', emoji: '🟫', desc: '출시 준비 중인 신제품입니다.' },
  ],
};
