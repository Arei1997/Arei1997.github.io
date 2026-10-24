import { defineConfig } from 'vite';
import { profile } from './src/content.ts';

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default defineConfig({
  // BASE_PATH is only needed when serving from a sub-path, e.g. "/portfolio/".
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    {
      // Fills {{name}}, {{role}} etc. in index.html from src/content.ts so SEO tags stay in sync.
      name: 'profile-meta',
      transformIndexHtml(html) {
        return html.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
          const value = (profile as Record<string, unknown>)[key];
          return typeof value === 'string' ? escapeAttr(value) : match;
        });
      },
    },
    {
      // Private visitor count via GoatCounter — production builds only, so dev reloads aren't counted.
      name: 'goatcounter',
      apply: 'build',
      transformIndexHtml() {
        if (!profile.goatcounter) return;
        return [
          {
            tag: 'script',
            attrs: {
              'data-goatcounter': `https://${profile.goatcounter}.goatcounter.com/count`,
              async: true,
              src: 'https://gc.zgo.at/count.js',
            },
            injectTo: 'head',
          },
        ];
      },
    },
  ],
});
