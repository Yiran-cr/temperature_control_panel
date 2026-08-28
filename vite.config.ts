import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [],
    server: {
      port: 3000,
      open: true,
      proxy: {
        // Vite 代理：把前端 /api/tdengine 请求转发到 TDengine REST API (6041端口)
        // 解决浏览器 CORS 跨域问题
        '/api/tdengine': {
          target: env.VITE_TDENGINE_TARGET || 'http://119.29.100.108:6041',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/tdengine/, ''),
        },
      },
    },
    esbuild: {
      jsx: 'automatic',
    },
  };
});
