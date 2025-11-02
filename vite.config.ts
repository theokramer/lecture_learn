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
  build: {
    // Production optimizations
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false, // Disable source maps in production for security
    rollupOptions: {
      output: {
        // Code splitting configuration
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion', 'react-hot-toast'],
          'vendor-editor': [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/extension-bold',
            '@tiptap/extension-code',
            '@tiptap/extension-heading',
            '@tiptap/extension-link',
          ],
          'vendor-pdf': ['pdfjs-dist'],
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
    // Optimize asset handling
    assetsInlineLimit: 4096, // Inline small assets (<4kb)
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'framer-motion',
    ],
  },
})
