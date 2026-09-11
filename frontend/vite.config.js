import { defineConfig, splitVendorChunkPlugin } from 'vite'
import react from '@vitejs/plugin-react'
import { obfuscator } from 'rollup-obfuscator'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    splitVendorChunkPlugin(),
    // Run obfuscator only on our custom source code to avoid breaking third-party libraries
    obfuscator({
      include: ['src/**/*.js', 'src/**/*.jsx', 'src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'node_modules/**', 
        '**/node_modules/**',
        'src/core/workspace/WidgetRegistry.js',
        'src/core/runtime/Kernel.js', // Critical: Obfuscator breaks static analysis of dynamic imports
        'src/core/runtime/services/documentTextExtractor.js', // import() pdfjs/mammoth + worker ?url (Item 69)
        'src/core/application/AppRegistry.js'
      ],
      compact: true,
      controlFlowFlattening: false,
      deadCodeInjection: false,
      identifierNamesGenerator: 'hexadecimal',
      minify: true,
      sourceMap: false,
      stringArray: true,
      stringArrayThreshold: 0.75
    })
  ],
  server: {
    port: 5173,
    // tools/ ada di root repo, di luar frontend/. ToolRegistryService membundelnya lewat
    // import.meta.glob untuk versi web; tanpa izin ini server dev menolak menyajikannya.
    fs: { allow: ['.', '../tools'] },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 2000 // Raise limit since we use a single vendor chunk
  }
})
