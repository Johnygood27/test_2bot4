import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: ['@zama-fhe/relayer-sdk']
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/]
    }
  }
});
