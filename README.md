# 한끼스캔

**대표 주소: https://hankki-scan.vercel.app** (AI 사진 분석 포함) · 예비 주소: https://idaewonjeongseonyagchokkun-crypto.github.io/-/

아리랑식품영농조합법인이 만든 모바일 웹앱(PWA)입니다. 세 앱의 성공 구조를 한 화면 흐름으로 묶었습니다.

| 벤치마크 | 배운 점 | 한끼스캔에서 |
|---|---|---|
| Cal AI | 입력 부담을 사진 한 장으로 | 가운데 버튼 → **사진 / 글로 쓰기 / 고르기** 중 선택. 사진은 AI가 음식·양·영양 추정, 글("김치찌개 한 그릇, 밥 반 공기")은 AI가 추정하고 연결이 없으면 기기 안에서 목록과 맞춰 읽음. 목록에 없는 음식은 직접 입력해 '내 음식'으로 저장 |
| Yuka | 장 볼 때마다 쓸 이유 | 바코드(아이폰 포함 모든 휴대폰, 공유 DB → Open Food Facts → 식품안전나라) 또는 원재료·영양성분표 사진 → 0~100 성분 점수 도장, 이유, 첨가물 목록 |
| 필라이즈 | 내 생활과 연결된 정보 | 식사·물·수면·활동 7일 리듬, 기록 사실 기반 패턴 문장 (늦은 저녁, 나트륨 기준치 초과일, 단백질 반찬, 세 끼 도장 등). 끼니 도장·연속 기록일, 지난 날짜 기록·고치기·지우기 되돌리기 |

회사와의 연결: **정선 탭**에서 제품별 원산지·만든 곳을 공개하고, 점수가 낮은 간식을 스캔하면 정선 간식 비교를 제안합니다. 포장 QR을 `https://도메인/p/<제품코드>`로 만들면 해당 제품 카드가 바로 열립니다 (`gochu-bugak`, `eopo-twigak`, `sandeodeok-juice`, `gochugaru`).

신제품 개발 데이터: 사용자가 설정에서 **익명 트렌드 공유**를 켜면 음식 이름·추정 영양값·식사 시각(시 단위)·스캔 제품명과 점수만 `/api/events`로 보내고, Vercel 비공개 저장소(hankki-data)에 쌓입니다. 매주 월요일 Actions '신제품 데이터 내보내기'가 CSV로 묶고, 그 CSV가 구글 드라이브에 날짜별 시트로 올라갑니다. (선택: `INSIGHTS_WEBHOOK_URL`로 다른 곳에도 전달) 사진·메모·이름·위치는 보내지 않습니다. 기록 방법(사진 ai / 글 text / 직접 manual)이 '출처' 열에 남습니다. 기본값은 꺼짐입니다.

## 대표님이 해 주실 일 (보안 규칙상 대신할 수 없는 것만)

| 할 일 | 바로가기 | 하고 나면 |
|---|---|---|
| ① Anthropic API 키 만들기 | [콘솔 키 페이지](https://console.anthropic.com/settings/keys) | 키를 복사해 둡니다 (Claude에게 보내지 마세요) |
| ② GitHub에 비밀값 2개 넣기 (2026-10-25 완료) | [VERCEL_TOKEN 만들기](https://vercel.com/account/tokens) → [GitHub 시크릿 추가](https://github.com/idaewonjeongseonyagchokkun-crypto/-/settings/secrets/actions/new) | 이름 `VERCEL_TOKEN`과 `ANTHROPIC_API_KEY`로 각각 저장. 이후 배포·키 설정은 자동 |
| ③ 미리보기 페이지 공유 (선택) | [한끼스캔 미리보기](https://claude.ai/artifact/8cuUXGLTcSkdPT5kMZfQBV) | 페이지의 공유 메뉴에서 공유 켜기 |
| ④ 국내 바코드 DB 키 (2026-10-25 연결 완료) | [식품안전나라 Open API](https://www.foodsafetykorea.go.kr/api/main.do) | 발급된 인증키를 [GitHub 시크릿](https://github.com/idaewonjeongseonyagchokkun-crypto/-/settings/secrets/actions/new)에 이름 `FOODSAFETY_API_KEY`로 저장하면 자동 연결 (연결 코드는 완성됨) |
| ⑤ 원산지 확인 | [스마트스토어](https://smartstore.naver.com/doll3269) | 고추부각·산더덕즙 표시사항의 원산지를 알려 주세요 |

GitHub Actions가 Vercel 프로젝트(hankki-scan)에 키를 설정해 배포합니다. main에 올릴 때마다 두 주소 모두 자동 갱신됩니다.

## 실행

```bash
npm install
npm run dev          # http://localhost:5173 — API 키가 없으면 예시값으로 화면 흐름을 확인
npm run build
```

## 미리보기 페이지 만들기

```bash
VITE_TARGET=artifact npm run build && node scripts/bundle-artifact.mjs dist/hankki-preview.html
```
외부 DB 조회·다운로드가 막힌 환경용으로 바코드 검색을 숨기고, 처음 열면 예시 기록을 채웁니다. 사진 분석은 API 키 없이 보는 사람의 Claude 계정으로 실행됩니다(게시 시 `capabilities: {sample: {images: true}}`).

## GitHub Pages (서버 없는 무료 배포)

main에 올릴 때마다 Actions가 빌드해 `gh-pages` 브랜치로 올리고, https://idaewonjeongseonyagchokkun-crypto.github.io/-/ 가 자동 갱신됩니다. 서버가 없어 AI 사진 분석은 예시값으로 동작합니다.

## 배포 (Vercel 권장 — AI 분석 포함)

1. [Vercel 가져오기](https://vercel.com/new/import?s=https://github.com/idaewonjeongseonyagchokkun-crypto/-)로 이 저장소를 Import
2. 환경변수 설정
   - `ANTHROPIC_API_KEY` — 사진 분석용 (필수)
   - `CLAUDE_MODEL` — 선택, 기본 `claude-haiku-5-5`
   - `INSIGHTS_WEBHOOK_URL` — 선택, 익명 트렌드 저장 주소
3. Deploy. 카메라는 HTTPS에서만 열리므로 배포 주소로 휴대폰에서 테스트하세요.

## 구조

```
api/analyze.ts     식사·라벨 사진, 글로 쓴 식단 → Claude 분석 (키는 서버에만)
api/events.ts      익명 트렌드 수집 (허용 필드만 통과)
src/lib/           저장소(localStorage), 점수 엔진, 패턴 분석, 제품 카드
src/screens/       오늘 · 스캔 · 한끼 찍기 · 리듬 · 정선 · 설정
```

## 준법 원칙 (수정 시 지킬 것)

- 질병·효능 표현 금지. 점수와 패턴 문장은 '기록 사실'과 '영양 수치'만 말합니다.
- 원산지는 사실대로. 어포튀각은 어포 베트남산. 고춧가루는 국내산(강원 정선).
- `src/lib/products.ts`에서 원산지가 '상세페이지 확인'인 제품은 표시사항을 보고 채워 주세요.
- 레시피·배합비는 앱 어디에도 넣지 않습니다.
- 출원 중인 특허·상표는 앱에 쓰지 않습니다.

## 다음 단계 제안

- 식약처 식품안전나라 바코드 API 연동 (국내 제품 인식률 향상)
- 회원·클라우드 동기화 (휴대폰 교체 시 기록 유지)
- 주간 리포트 알림, 스마트스토어 구매 연동 쿠폰
