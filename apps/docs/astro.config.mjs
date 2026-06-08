import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import { satteri } from '@astrojs/markdown-satteri';

export default defineConfig({
  integrations: [tailwind()],
  markdown: {
    processor: satteri(),
  },
});
