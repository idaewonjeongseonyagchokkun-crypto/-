/**
 * 아리랑식품영농조합법인 제품 카드.
 * 준법 원칙: 효능·질병 표현 금지 / 원산지는 사실대로 / 배합비·레시피 비공개.
 * origin이 '상세페이지 확인'인 항목은 대표님이 제품 표시사항을 보고 채워 주세요.
 */
export interface CompanyProduct {
  slug: string;
  name: string;
  category: '부각·튀각' | '액상차·즙' | '양념' | '장아찌·젓갈';
  oneLine: string;
  origin: string;
  madeAt: string;
  url: string;
}

const STORE = 'https://smartstore.naver.com/doll3269';
const FACTORY = '강원 정선 HACCP 인증 공장 (아리랑식품영농조합법인)';

export const COMPANY = {
  name: '아리랑식품영농조합법인',
  address: '강원특별자치도 정선군 북평면 오음동길 52',
  phone: '033-591-3260',
  store: STORE,
};

export const PRODUCTS: CompanyProduct[] = [
  { slug: 'gochu-bugak', name: '고추부각', category: '부각·튀각', oneLine: '바삭하게 튀겨 낸 정선 부각 간식', origin: '상세페이지 확인', madeAt: FACTORY, url: STORE },
  { slug: 'eopo-twigak', name: '어포튀각', category: '부각·튀각', oneLine: '얇게 튀긴 어포 간식', origin: '어포: 베트남산 (상세 원산지는 상세페이지 확인)', madeAt: FACTORY, url: STORE },
  { slug: 'sandeodeok-juice', name: '산더덕즙', category: '액상차·즙', oneLine: '파우치로 간편하게 마시는 더덕즙', origin: '상세페이지 확인', madeAt: FACTORY, url: STORE },
  { slug: 'gochugaru', name: '고춧가루 (일반·청양)', category: '양념', oneLine: '정선에서 키우고 빻은 고춧가루', origin: '국내산 (강원 정선)', madeAt: FACTORY, url: STORE },
];
