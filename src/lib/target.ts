/**
 * 배포 대상별 차이.
 * - 'artifact': claude.ai 공개 미리보기 페이지. 외부 DB 조회·파일 다운로드가 막혀 있어 해당 기능을 숨기고,
 *   처음 열면 예시 기록을 채워 화면 흐름을 바로 볼 수 있게 합니다.
 * - 그 외(Vercel·GitHub Pages): 모든 기능 사용.
 */
export const IS_PREVIEW = import.meta.env.VITE_TARGET === 'artifact';
