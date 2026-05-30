import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Stamps a unique build hash into dist/sw.js so every Netlify deploy
// produces a different SW file. Browser detects the change, installs the
// new SW, clears old caches, sends SW_UPDATED, and main.jsx reloads.
function stampSwVersion() {
  return {
    name: 'stamp-sw-version',
    apply: 'build',
    writeBundle() {
      const swPath = resolve('./dist/sw.js')
      if (!existsSync(swPath)) return
      // Use git commit ref if Netlify provides it, otherwise ms timestamp
      const ref = process.env.COMMIT_REF?.slice(0, 8) ?? Date.now().toString(36)
      const stamped = readFileSync(swPath, 'utf8')
        .replace('familiacerca-BUILD', `familiacerca-${ref}`)
      writeFileSync(swPath, stamped)
      console.log(`[stampSwVersion] SW cache version: familiacerca-${ref}`)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stampSwVersion()],
  server: { host: true },
})
