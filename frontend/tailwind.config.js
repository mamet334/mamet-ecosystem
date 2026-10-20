export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Item 127 Tahap 3 (Owner 19 Okt: "samakan warnanya agar sama dengan tema LampLogin"): palet dipasang di
      // SUMBERNYA — 568 pemakaian token di komponen ikut berpindah tanpa disentuh. Palet diambil dari LampLogin.jsx,
      // bukan dikarang. Kontras pasangan utama dijaga uji-palet-lamplogin.
      // Item 128 Tahap A (20 Okt): setiap warna menunjuk VARIABEL CSS, bukan hex tetap — nilainya ada di
      // src/tema/ruangan-kayu.css. Tema lain kelak cukup mengganti nilai variabel itu; komponen tidak disentuh.
      // Bentuk `rgb(var(--…) / <alpha-value>)` menjaga pengubah opasitas yang dipakai di mana-mana (bg-primary/30).
      colors: {
        "background": "rgb(var(--warna-background) / <alpha-value>)",
        "surface": "rgb(var(--warna-surface) / <alpha-value>)",
        "surface-dim": "rgb(var(--warna-surface-dim) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--warna-surface-container-lowest) / <alpha-value>)",
        "surface-container-low": "rgb(var(--warna-surface-container-low) / <alpha-value>)",
        "surface-container": "rgb(var(--warna-surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--warna-surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--warna-surface-container-highest) / <alpha-value>)",
        "surface-variant": "rgb(var(--warna-surface-variant) / <alpha-value>)",
        "surface-bright": "rgb(var(--warna-surface-bright) / <alpha-value>)",
        // Teks utama diredam ke ±13:1 (Owner 19 Okt: palet "kurang nyaman di mata"). Krem #f3e7d3 di latar ini
        // 16,3:1 — terlalu tajam untuk tema gelap: huruf terang di latar hampir hitam tampak berpendar saat dibaca
        // lama. Tetap jauh di atas 4,5:1, dan tetap terpisah jelas dari teks redup on-surface-variant (±10:1).
        "on-surface": "rgb(var(--warna-on-surface) / <alpha-value>)",
        "on-background": "rgb(var(--warna-on-background) / <alpha-value>)",
        // Teks tebal & judul di jawaban model (20 Okt, pratinjau bingkai jawaban yang disetujui Owner): satu langkah
        // lebih terang dari teks biasa supaya tetap menonjol di dalam bingkai hampir hitam.
        "on-surface-strong": "rgb(var(--warna-on-surface-strong) / <alpha-value>)",
        "inverse-surface": "rgb(var(--warna-inverse-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--warna-on-surface-variant) / <alpha-value>)",
        "inverse-on-surface": "rgb(var(--warna-inverse-on-surface) / <alpha-value>)",
        "outline": "rgb(var(--warna-outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--warna-outline-variant) / <alpha-value>)",
        "primary": "rgb(var(--warna-primary) / <alpha-value>)",
        "primary-fixed": "rgb(var(--warna-primary-fixed) / <alpha-value>)",
        "primary-fixed-dim": "rgb(var(--warna-primary-fixed-dim) / <alpha-value>)",
        "surface-tint": "rgb(var(--warna-surface-tint) / <alpha-value>)",
        "primary-container": "rgb(var(--warna-primary-container) / <alpha-value>)",
        "on-primary-container": "rgb(var(--warna-on-primary-container) / <alpha-value>)",
        "on-primary": "rgb(var(--warna-on-primary) / <alpha-value>)",
        "on-primary-fixed": "rgb(var(--warna-on-primary-fixed) / <alpha-value>)",
        "on-primary-fixed-variant": "rgb(var(--warna-on-primary-fixed-variant) / <alpha-value>)",
        "inverse-primary": "rgb(var(--warna-inverse-primary) / <alpha-value>)",
        "secondary": "rgb(var(--warna-secondary) / <alpha-value>)",
        "secondary-fixed": "rgb(var(--warna-secondary-fixed) / <alpha-value>)",
        "secondary-fixed-dim": "rgb(var(--warna-secondary-fixed-dim) / <alpha-value>)",
        "secondary-container": "rgb(var(--warna-secondary-container) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--warna-on-secondary-container) / <alpha-value>)",
        "on-secondary": "rgb(var(--warna-on-secondary) / <alpha-value>)",
        "on-secondary-fixed": "rgb(var(--warna-on-secondary-fixed) / <alpha-value>)",
        "on-secondary-fixed-variant": "rgb(var(--warna-on-secondary-fixed-variant) / <alpha-value>)",
        "tertiary": "rgb(var(--warna-tertiary) / <alpha-value>)",
        "tertiary-fixed": "rgb(var(--warna-tertiary-fixed) / <alpha-value>)",
        "tertiary-fixed-dim": "rgb(var(--warna-tertiary-fixed-dim) / <alpha-value>)",
        "tertiary-container": "rgb(var(--warna-tertiary-container) / <alpha-value>)",
        "on-tertiary-container": "rgb(var(--warna-on-tertiary-container) / <alpha-value>)",
        "on-tertiary": "rgb(var(--warna-on-tertiary) / <alpha-value>)",
        "on-tertiary-fixed": "rgb(var(--warna-on-tertiary-fixed) / <alpha-value>)",
        "on-tertiary-fixed-variant": "rgb(var(--warna-on-tertiary-fixed-variant) / <alpha-value>)",
        "error": "rgb(var(--warna-error) / <alpha-value>)",
        "on-error": "rgb(var(--warna-on-error) / <alpha-value>)",
        "error-container": "rgb(var(--warna-error-container) / <alpha-value>)",
        "on-error-container": "rgb(var(--warna-on-error-container) / <alpha-value>)",
        // Skala slate DITIMPA ke kayu-krem: 615 pemakaian `slate-*` mentah (sistem warna kedua) ikut
        // berpindah ke palet yang sama — dua sistem warna kini menuju satu sumber.
        // 400 & 500 dinaikkan (19 Okt) sejak latar terdalam = dinding LampLogin: titik paling terang dinding (#4d2d17)
        // menjatuhkan slate-500 lama ke 3,35:1. Kini ≥ 4,5:1 di titik itu juga (dijaga uji-latar-ruangan).
        slate: {
          50: "rgb(var(--warna-slate-50) / <alpha-value>)",
          100: "rgb(var(--warna-slate-100) / <alpha-value>)",
          200: "rgb(var(--warna-slate-200) / <alpha-value>)",
          300: "rgb(var(--warna-slate-300) / <alpha-value>)",
          400: "rgb(var(--warna-slate-400) / <alpha-value>)",
          500: "rgb(var(--warna-slate-500) / <alpha-value>)",
          600: "rgb(var(--warna-slate-600) / <alpha-value>)",
          700: "rgb(var(--warna-slate-700) / <alpha-value>)",
          800: "rgb(var(--warna-slate-800) / <alpha-value>)",
          900: "rgb(var(--warna-slate-900) / <alpha-value>)",
          950: "rgb(var(--warna-slate-950) / <alpha-value>)",
        },
      },
      borderRadius: {
        "DEFAULT": "1rem",
        "lg": "2rem",
        "xl": "3rem",
        "full": "9999px"
      },
      spacing: {
        "unit": "4px",
        "margin-desktop": "64px",
        "container-max": "1440px",
        "margin-mobile": "16px",
        "gutter": "24px"
      },
      // Geist dan JetBrains Mono TIDAK lagi diunduh (tautan Google Fonts dicabut 13 Sep 2026),
      // sedangkan Inter disimpan sendiri. Cadangan Geist diarahkan ke Inter supaya judul tetap
      // serumpun dengan sisa antarmuka, bukan jatuh ke huruf bawaan browser (Arial/Segoe UI).
      fontFamily: {
        "display-lg": ["Geist", "Inter", "sans-serif"],
        "label-mono": ["JetBrains Mono", "ui-monospace", "monospace"],
        "body-sm": ["Inter", "sans-serif"],
        "headline-md": ["Geist", "Inter", "sans-serif"],
        "body-base": ["Inter", "sans-serif"]
      },
      fontSize: {
        "label-mono": ["12px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "500"}],
        "body-sm": ["14px", {"lineHeight": "20px", "letterSpacing": "0", "fontWeight": "400"}],
        "headline-md": ["24px", {"lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600"}],
        "body-base": ["16px", {"lineHeight": "24px", "letterSpacing": "0", "fontWeight": "400"}],
        "display-lg": ["48px", {"lineHeight": "56px", "letterSpacing": "-0.02em", "fontWeight": "700"}]
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
