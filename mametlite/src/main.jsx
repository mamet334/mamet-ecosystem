import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import BatasGalat from './lib/BatasGalat.jsx'

// `BatasGalat` membungkus SELURUH aplikasi (M2, 2026-10-08). Sampai 8 Okt 2026 Mametlite tidak punya
// satu pun error boundary, jadi satu galat saat render = halaman putih kosong tanpa sepatah kata —
// dan pengguna awam tidak punya jalan keluar. Di dalam `StrictMode` supaya galat di pemasangan ganda
// pengembangan ikut tertangkap di tempat yang sama dengan produksi.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BatasGalat>
      <App />
    </BatasGalat>
  </StrictMode>,
)
