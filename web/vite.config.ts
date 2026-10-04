import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Absolute URLs for search and social previews. They need the public address of the deployed app, so they come from
 * VITE_SITE_URL (for example https://earmark.example) and are left out when it is not set rather than guessed.
 */
function seo(siteUrl: string | undefined): Plugin {
  const origin = siteUrl?.replace(/\/+$/, '');
  return {
    name: 'earmark-seo',
    transformIndexHtml() {
      if (!origin) return [];
      return [
        { tag: 'link', attrs: { rel: 'canonical', href: `${origin}/` }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:url', content: `${origin}/` }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image', content: `${origin}/og-image.png` }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:image', content: `${origin}/og-image.png` }, injectTo: 'head' },
      ];
    },
    generateBundle() {
      const lines = origin ? ['User-agent: *', 'Allow: /', '', `Sitemap: ${origin}/sitemap.xml`] : ['User-agent: *', 'Allow: /'];
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${lines.join('\n')}\n` });
      if (origin) {
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/</loc></url>\n</urlset>\n`,
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), seo(env.VITE_SITE_URL)],
    build: {
      target: 'es2022',
      sourcemap: false,
      reportCompressedSize: true,
      rolldownOptions: {
        output: {
          // Libraries change rarely, so they get their own long-cached files; app code redeploys without refetching them.
          codeSplitting: {
            groups: [
              { name: 'viem', test: /node_modules[/\\](viem|ox|abitype|@noble|@scure)[/\\]/, priority: 30 },
              { name: 'wagmi', test: /node_modules[/\\](wagmi|@wagmi|@tanstack)[/\\]/, priority: 20 },
              { name: 'react', test: /node_modules[/\\](react|react-dom|scheduler)[/\\]/, priority: 10 },
            ],
          },
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
