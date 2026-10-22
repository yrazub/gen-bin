import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://yrazub.github.io',
  base: '/gen-bin',
  trailingSlash: 'always',
  output: 'static',
});
