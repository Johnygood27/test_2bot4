import { defineConfig } from 'vite';
import { resolve } from 'path';
import inject from '@rollup/plugin-inject';

export default defineConfig({
  root: resolve(__dirname, 'src'),
  server: {
    proxy: {
      '/compute': 'http://localhost:3001',
      '/decrypt': 'http://localhost:3001'
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      plugins: [
        inject({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser'
        })
      ]
    }
  },
  optimizeDeps: {
    include: ['@zama-fhe/relayer-sdk/web']
  }
});
