import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/*.svg'],
        manifest: {
          name: 'Neon Dash: Space Runner',
          short_name: 'NeonDash',
          description: 'A high-speed neon-themed endless runner in deep space. Evolve your ship and survive the asteroid field!',
          theme_color: '#00f3ff',
          background_color: '#000000',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'icons/icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: 'icons/icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'maskable'
            },
            {
              src: 'icons/icon-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
