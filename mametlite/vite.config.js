import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Header keamanan dibaca dari `vercel.json` — SATU sumber, bukan dua yang bisa menyimpang.
//
// Kenapa ini ada (2026-10-07): CSP yang hanya hidup di Vercel tidak pernah teruji sebelum produksi.
// Kalau ia memblokir sesuatu yang dipakai aplikasi, yang menemukannya adalah pengguna, bukan kita.
// Dengan membacanya di sini, `npm run dev` dan `npm run preview` memakai CSP yang SAMA dengan yang
// nanti terpasang — jadi pelanggaran muncul di konsol kita lebih dulu.
//
// Dibaca saat konfigurasi disusun: `vercel.json` rusak → Vite gagal menyala dengan galat yang
// menyebut berkasnya, bukan diam-diam berjalan tanpa header.
function headerKeamanan() {
  const berkas = new URL('./vercel.json', import.meta.url)
  const { headers } = JSON.parse(readFileSync(berkas, 'utf8'))
  const cocok = headers?.find((h) => h.source === '/(.*)')
  if (!cocok) throw new Error('vercel.json: aturan header untuk "/(.*)" tidak ditemukan')
  return Object.fromEntries(cocok.headers.map((h) => [h.key, h.value]))
}

const HEADER = headerKeamanan()

export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  server: { headers: HEADER },
  preview: { headers: HEADER },
})
