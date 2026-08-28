import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  server: {
    port: 3000,
    open: true,
    // 开发环境前端直连网关（VITE_GATEWAY_BASE_URL），无需代理
  },
  esbuild: {
    jsx: 'automatic',
  },
});
