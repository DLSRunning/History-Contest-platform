import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

function normalizeBase(rawBase = '/') {
  const trimmed = String(rawBase || '/').trim();
  if (!trimmed || trimmed === '/') return '/';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '');
  return `${withoutTrailingSlash}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const useHttps = String(env.VITE_DEV_HTTPS || '').trim() === '1';
  const base = normalizeBase(env.VITE_PUBLIC_BASE || '/');

  return {
    base,
    plugins: [react(), ...(useHttps ? [mkcert()] : [])],
    server: {
      https: useHttps,
      host: true,
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/contest': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  };
});
