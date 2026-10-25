/**
 * 아리랑 공구팜 — 익명 이용통계 수집 (Google Sheets)
 *
 * 설치 방법
 * 1. Google Sheets 새 문서를 만들고 [확장 프로그램 > Apps Script] 를 엽니다.
 * 2. 이 코드를 붙여 넣고 저장합니다.
 * 3. [배포 > 새 배포 > 유형: 웹 앱]
 *    - 실행 계정: 나 / 액세스 권한: 모든 사용자
 * 4. 발급된 웹 앱 URL 을 js/config.js 의 analytics.endpoint 에 넣습니다.
 *
 * 수집 항목: 시각, 이벤트명, 공구ID, 구성, 기기 임의ID(aid), 추천 임의ID(ref)
 * 이름·전화번호·주소 등 개인정보는 수집하지 않습니다.
 */
const SHEET_NAME = 'events';
const ALLOWED = ['open', 'deal_view', 'share', 'buy_click', 'interest', 'kakao_channel'];

function doPost(e) {
  try {
    const ev = JSON.parse(e.postData.contents);
    if (ALLOWED.indexOf(ev.n) === -1) return ContentService.createTextOutput('ignored');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) sh.appendRow(['time', 'event', 'deal', 'item', 'option', 'aid', 'ref']);
    sh.appendRow([
      new Date(Number(ev.t) || Date.now()),
      String(ev.n).slice(0, 30),
      String(ev.deal || '').slice(0, 40),
      String(ev.item || '').slice(0, 40),
      String(ev.opt || '').slice(0, 40),
      String(ev.aid || '').slice(0, 16),
      String(ev.ref || '').slice(0, 16),
    ]);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error');
  }
}
