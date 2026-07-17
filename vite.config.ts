import { defineConfig, loadEnv, PluginOption } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import solidPlugin from 'vite-plugin-solid';
import autoprefixer from 'autoprefixer';
import postcssJitProps from 'postcss-jit-props';
import OpenProps from 'open-props';
import { resolve } from 'path';
import { readdirSync } from 'fs';
import path from 'path';


export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendEnv = {
    YOUTUBE_COOKIE: env.YOUTUBE_COOKIE,
    YOUTUBE_PO_TOKEN: env.YOUTUBE_PO_TOKEN,
    YOUTUBE_VISITOR_DATA: env.YOUTUBE_VISITOR_DATA
  };

  return {
  base: env.VITE_BASE_PATH || '/',
  define: {
    Locales: readdirSync(resolve(__dirname, './src/locales')).map(file => file.slice(0, 2)),
    Build: JSON.stringify('v' + require('./package.json').version),
  },
  resolve: {
    alias: {
      '@stores': path.resolve(__dirname, './src/lib/stores'),
      '@modules': path.resolve(__dirname, './src/lib/modules'),
      '@utils': path.resolve(__dirname, './src/lib/utils'),
      '@core': path.resolve(__dirname, './src/core'),
      '@core/*': path.resolve(__dirname, './src/core/*'),
      '@platform': path.resolve(__dirname, './src/platform'),
      '@platform/*': path.resolve(__dirname, './src/platform/*'),
      '@components': path.resolve(__dirname, './src/components'),
      '@features': path.resolve(__dirname, './src/features'),
    },
  },
  plugins: [
    solidPlugin(),
    injectEruda(command === 'serve'),
    apiMiddleware(command === 'serve', backendEnv),
    VitePWA({
      manifest: {
        "short_name": "Loudara",
        "name": "Loudara",
        "description": "Modern music player for web and desktop.",
        "icons": [
          {
            "src": "logo192.png",
            "type": "image/png",
            "sizes": "192x192",
            "purpose": "any maskable"
          },
          {
            "src": "logo512.png",
            "type": "image/png",
            "sizes": "512x512",
            "purpose": "any maskable"
          },
          {
            "src": "monochrome.png",
            "type": "image/png",
            "sizes": "512x512",
            "purpose": "monochrome"
          },
          {
            "src": "logo512.png",
            "type": "image/png",
            "sizes": "44x44",
            "purpose": "any"
          },
          {
            "src": "favicon-32.png",
            "type": "image/png",
            "sizes": "32x32",
            "purpose": "any"
          }
        ],
        "shortcuts": [
          {
            "name": "History",
            "url": "/?collection=history",
            "icons": [
              {
                "src": "memories-fill.png",
                "sizes": "192x192",
              }]
          },
          {
            "name": "Favorites",
            "url": "/?collection=favorites",
            "icons": [
              {
                "src": "heart-fill.png",
                "sizes": "192x192",
              }]
          },
          {
            "name": "Listen Later",
            "url": "/?collection=listenLater",
            "icons": [
              {
                "src": "calendar-schedule-fill.png",
                "sizes": "192x192",
              }]
          }
        ],
        "start_url": "/",
        "display": "standalone",
        "theme_color": "black",
        "background_color": "black",
        "share_target": {
          "action": "/",
          "method": "GET",
          "params": {
            "title": "title",
            "text": "text",
            "url": "url"
          }
        }
      },
      disable: command !== 'build',
      includeAssets: ['*.woff2', 'loudara_banner.webp', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'icon.png']
    })
  ],
  css: {
    postcss: {
      plugins: [
        autoprefixer(),
        postcssJitProps(OpenProps)
      ]
    }
  }
  };
});


const injectEruda = (serve: boolean) => serve ? (<PluginOption>{
  name: 'erudaInjector',
  transformIndexHtml: html => ({
    html,
    tags: [
      {
        tag: 'script',
        attrs: {
          src: '/node_modules/eruda/eruda'
        },
        injectTo: 'body-prepend'
      },
      {
        tag: 'script',
        injectTo: 'body-prepend',
        children: 'eruda.init()'
      }
    ]
  })
}) : [];

const apiMiddleware = (
  serve: boolean,
  backendEnv: Record<string, string | undefined>
): PluginOption => serve ? {
  name: 'api-middleware',
  configureServer(server) {
    const endpoints = ['album', 'artist', 'channel', 'gallery', 'playlist', 'search', 'search-suggestions', 'similar', 'subfeed', 'trending'];
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url || '', 'http://localhost');
      const path = url.pathname.replace(/^\/api\//, '').replace(/^\//, '');

      const sharedStreamMatch = url.pathname.match(/^\/s\/([a-zA-Z0-9_-]{11})$/);
      if (sharedStreamMatch) {
        res.statusCode = 302;
        res.setHeader('Location', `/?s=${sharedStreamMatch[1]}`);
        res.end();
        return;
      }
      
      if (endpoints.includes(path) || req.url?.startsWith('/api/')) {
        const { createLocalAdapter } = await server.ssrLoadModule('./src/backend/localAdapter.ts');
        const adapter = createLocalAdapter(backendEnv);
        return adapter(req, res);
      } else {
        next();
      }
    });
  }
} : [];
