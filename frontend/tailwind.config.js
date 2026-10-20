export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Item 127 Tahap 3 (Owner 19 Okt: "samakan warnanya agar sama dengan tema LampLogin"): NILAI token
      // diganti di sini, di sumbernya — 568 pemakaian token di komponen ikut berpindah tanpa disentuh.
      // Palet diambil dari LampLogin.jsx, bukan dikarang. Kontras pasangan utama dijaga uji-palet-lamplogin.
      colors: {
        "background": "#0b0806",
        "surface": "#0b0806",
        "surface-dim": "#0b0806",
        "surface-container-lowest": "#080605",
        "surface-container-low": "#120c08",
        "surface-container": "#1a120c",
        "surface-container-high": "#24180f",
        "surface-container-highest": "#2f2014",
        "surface-variant": "#2f2014",
        "surface-bright": "#3b2a1c",
        // Teks utama diredam ke ±13:1 (Owner 19 Okt: palet "kurang nyaman di mata"). Krem #f3e7d3 di latar ini
        // 16,3:1 — terlalu tajam untuk tema gelap: huruf terang di latar hampir hitam tampak berpendar saat dibaca
        // lama. Tetap jauh di atas 4,5:1, dan tetap terpisah jelas dari teks redup on-surface-variant (±10:1).
        "on-surface": "#dbd0be",
        "on-background": "#dbd0be",
        // Teks tebal & judul di jawaban model (20 Okt, pratinjau bingkai jawaban yang disetujui Owner): satu langkah
        // lebih terang dari teks biasa supaya tetap menonjol di dalam bingkai hampir hitam.
        "on-surface-strong": "#e8dcc8",
        "inverse-surface": "#f3e7d3",
        "on-surface-variant": "#c9b49a",
        "inverse-on-surface": "#2a1a0d",
        "outline": "#9a7d5c",
        "outline-variant": "#3e2b1b",
        "primary": "#f0ca6d",
        "primary-fixed": "#ffe29a",
        "primary-fixed-dim": "#f0ca6d",
        "surface-tint": "#f0ca6d",
        "primary-container": "#8a4d1c",
        "on-primary-container": "#ffe29a",
        "on-primary": "#1b1105",
        "on-primary-fixed": "#1b1105",
        "on-primary-fixed-variant": "#6e3d18",
        "inverse-primary": "#a95f28",
        "secondary": "#d9c3a2",
        "secondary-fixed": "#f0e2cc",
        "secondary-fixed-dim": "#d9c3a2",
        "secondary-container": "#3b2a1c",
        "on-secondary-container": "#e3cfb3",
        "on-secondary": "#2a1a0d",
        "on-secondary-fixed": "#1a0e08",
        "on-secondary-fixed-variant": "#4d3a28",
        "tertiary": "#d8c6ad",
        "tertiary-fixed": "#f0e2cc",
        "tertiary-fixed-dim": "#d8c6ad",
        "tertiary-container": "#5b4632",
        "on-tertiary-container": "#f3e7d3",
        "on-tertiary": "#2a1a0d",
        "on-tertiary-fixed": "#1a0e08",
        "on-tertiary-fixed-variant": "#4d3a28",
        "error": "#ffb4ab",
        "on-error": "#690005",
        "error-container": "#93000a",
        "on-error-container": "#ffdad6",
        // Skala slate DITIMPA ke kayu-krem: 615 pemakaian `slate-*` mentah (sistem warna kedua) ikut
        // berpindah ke palet yang sama — dua sistem warna kini menuju satu sumber.
        // 400 & 500 dinaikkan (19 Okt) sejak latar terdalam = dinding LampLogin: titik paling terang dinding (#4d2d17)
        // menjatuhkan slate-500 lama ke 3,35:1. Kini ≥ 4,5:1 di titik itu juga (dijaga uji-latar-ruangan).
        slate: {
          50: "#faf5ec",
          100: "#f3e7d3",
          200: "#e6d4b8",
          300: "#d9c3a2",
          400: "#c4a886",
          500: "#b49975",
          600: "#6b533b",
          700: "#4d3a28",
          800: "#33241a",
          900: "#1f150e",
          950: "#120b07",
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
