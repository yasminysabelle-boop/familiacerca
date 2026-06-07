import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    // Injected at build time into sw.js for runtime cache versioning
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10).replace(/-/g, '')),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // injectManifest: we author src/sw.js; the plugin bundles it with Rollup,
      // injects the Workbox precache manifest, and outputs dist/sw.js.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',

      // Registration is handled manually in main.jsx
      injectRegister: null,

      // We own public/manifest.json — plugin should not touch it
      manifest: false,

      // Don't activate SW in Vite dev server (avoids stale-cache confusion)
      devOptions: { enabled: false },

      injectManifest: {
        // Include all build assets in the Workbox precache manifest
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff2,webp,jpg,jpeg}',
        ],
        // Don't stamp the Firebase messaging SW into the precache
        globIgnores: ['firebase-messaging-sw.js'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  server: { host: true },
})
