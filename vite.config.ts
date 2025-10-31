import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { join } from 'path'

// Copy PDF.js worker to public directory on build
try {
  const workerSrc = join(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
  const workerDest = join(process.cwd(), 'public/pdfjs/pdf.worker.min.mjs')
  copyFileSync(workerSrc, workerDest)
  console.log('PDF.js worker file copied to public directory')
} catch (error) {
  console.warn('Could not copy PDF.js worker file:', error)
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
})
