// 한끼스캔 신제품 데이터 시트에 붙여 넣는 Apps Script.
// 시트 → 확장 프로그램 → Apps Script → 이 코드 붙여넣기 → 저장 → 배포(웹 앱, 액세스: 모든 사용자)
// 서버(/api/events)가 고객 동의를 받은 익명 기록만 보냅니다. 사진·이름·위치는 오지 않습니다.
function clean_(v) {
  if (v === undefined || v === null) return '';
  var s = String(v).slice(0, 120);
  // 셀이 수식으로 실행되지 않도록 = + - @ 로 시작하는 글자는 앞에 ' 를 붙입니다.
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function doPost(e) {
  var d = {};
  try { d = JSON.parse(e.postData.contents || '{}'); } catch (err) { return ContentService.createTextOutput('bad json'); }
  if (d.type !== 'meal' && d.type !== 'scan') return ContentService.createTextOutput('ignored');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  sheet.appendRow([
    new Date(), clean_(d.at), d.type === 'meal' ? '식사' : '스캔', clean_(d.slot), clean_(d.foods),
    clean_(d.kcal), clean_(d.sodiumMg), clean_(d.proteinG), clean_(d.hour),
    clean_(d.productName), clean_(d.brand), clean_(d.score), clean_(d.additives), clean_(d.source), clean_(d.anonId)
  ]);
  return ContentService.createTextOutput('ok');
}
