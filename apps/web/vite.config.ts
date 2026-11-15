import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo-qullqa.png', 'hongo.png'],
      manifest: {
        name: 'Qullqa',
        short_name: 'Qullqa',
        description: 'Decidir juntos qué sembrar, con datos NASA y observaciones de campo.',
        lang: 'es-PE',
        start_url: '/',
        display: 'standalone',
        background_color: '#f2eee6',
        theme_color: '#b64a31',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  worker: { format: 'es' },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
