import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** 로컬 개발(npm run dev)에서도 /api/* 서버리스 함수를 그대로 실행합니다. */
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/(analyze|events)(?:\?|$)/);
        if (!match) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.ts`);
          await mod.default(req, res);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

export default defineConfig({
  // GitHub Pages는 /-/ 하위 경로, Vercel은 / 루트에서 서비스합니다.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), localApi()],
  server: { host: true },
});
