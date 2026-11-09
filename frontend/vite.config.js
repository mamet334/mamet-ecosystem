import { defineConfig, splitVendorChunkPlugin } from 'vite'
import react from '@vitejs/plugin-react'
import { obfuscator } from 'rollup-obfuscator'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    splitVendorChunkPlugin(),
    obfuscator({
      include: ['src/**/*.js', 'src/**/*.jsx', 'src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'node_modules/**', 
        '**/node_modules/**',
        'src/core/workspace/WidgetRegistry.js',
        'src/core/runtime/Kernel.js',
        'src/core/runtime/services/documentTextExtractor.js',
        'src/core/runtime/services/pdfOcrService.js',
        'src/core/runtime/services/bacaExcelAsn.js',
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
    fs: { allow: ['.', '../tools', '../shared', '../uji'] },
    watch: { ignored: ['**/release/**', '**/build/**', '**/dist/**'] },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 2000
  }
})
