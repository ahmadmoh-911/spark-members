import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: '"test"' },
  test: { include: ['tests/unit/**/*.test.js'], environment: 'jsdom' },
});
