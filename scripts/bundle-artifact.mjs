// dist/를 하나의 HTML로 묶어 claude.ai 공개 미리보기 페이지로 올릴 수 있게 만듭니다.
// 사용: VITE_TARGET=artifact npm run build && node scripts/bundle-artifact.mjs <출력경로>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const out = process.argv[2] || 'dist/hankki-preview.html';
const assets = readdirSync('dist/assets');
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(`dist/assets/${f}`, 'utf8')).join('\n');
const js = assets.filter((f) => f.endsWith('.js')).map((f) => readFileSync(`dist/assets/${f}`, 'utf8')).join('\n');
if (/<\/script/i.test(js)) throw new Error('JS에 </script 문자열이 있어 인라인할 수 없습니다');
const html = `<title>한끼스캔</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=IBM+Plex+Sans+KR:wght@400;500;600&display=swap">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0) + 'KB');
