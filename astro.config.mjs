import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  output: 'static',
  integrations: [preact()],
  vite: {
    // Keep paths simple; we’ll publish the built site separately if/when switching
    build: { sourcemap: false },
  },
});
