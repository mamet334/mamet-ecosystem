// PERENDER TEKS MODEL (2026-10-07) — elemen React, bukan string HTML.
//
// Pasangan `lib/markdown.js`: di sana penguraian (menghasilkan data), di sini perenderan. Pemisahan
// itu bukan kerapian — ia yang membuat sifat keamanannya BISA DIUJI tanpa peramban: uji merender
// berkas ini dengan `react-dom/server` dan memeriksa HTML yang benar-benar keluar
// (`uji/uji-uraian-markdown.mjs` bagian 5).
//
// DULU: `App.jsx` membangun string HTML lalu menyuntikkannya dengan `dangerouslySetInnerHTML`, dan
// pelolosannya memakai daftar putih tag:
//
//     .replace(/<(?!div|\/div|img|a|\/a|strong|\/strong|em|\/em|br\/?)([^>]+)>/g, '&lt;$1&gt;')
//
// Alternatif `a` di daftar itu panjangnya SATU HURUF, jadi setiap tag yang namanya mulai dengan "a"
// lolos beserta atributnya — `<audio src=x onerror=…>`, `<animate>`. Di origin ini `localStorage`
// menyimpan kunci OpenRouter pengguna dan sesi Supabase.
//
// SEKARANG: tidak ada string HTML sama sekali, jadi tidak ada daftar putih yang perlu dijaga benar.
// Arahan Owner 7 Okt: *"jangan hanya di tambal. tapi digunakan logikanya dengan semestinya."*
//
// Parser tangan dipertahankan (bukan `react-markdown`) — alasannya tetap seperti catatan lama:
// react-markdown membuat React 19 jatuh.

import React from 'react';
import { uraikanMarkdown } from './markdown';

/** Daftar simpul dari `uraikanMarkdown` → elemen React. Teks diloloskan React, bukan oleh kita. */
export const SimpulKaya = ({ simpul }) => (
  <>
    {simpul.map((s, i) => {
      switch (s.jenis) {
        case 'nalar':
          // Nalar memang DITAMPILKAN di Mametlite (gaya DeepSeek) — jangan disembunyikan.
          return (
            <div
              key={i}
              className="text-xs text-slate-500 italic border-l-2 border-slate-700 pl-3 my-2 py-1"
            >
              <SimpulKaya simpul={s.anak} />
            </div>
          );
        case 'tebal':
          return <strong key={i}>{s.isi}</strong>;
        case 'miring':
          return <em key={i}>{s.isi}</em>;
        case 'tautan':
          // `alamat` sudah lewat `alamatAman()`: hanya http/https/mailto yang sampai ke sini.
          return (
            <a
              key={i}
              href={s.alamat}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              {s.teks}
            </a>
          );
        case 'gambar':
          return (
            <img
              key={i}
              src={s.alamat}
              alt={s.alt}
              className="max-w-xs rounded-lg mt-2 mb-2 shadow-sm"
            />
          );
        case 'baris':
          return <br key={i} />;
        default:
          return <React.Fragment key={i}>{s.isi}</React.Fragment>;
      }
    })}
  </>
);

/** Teks model sebagai elemen React — nol string HTML, jadi nol permukaan suntikan. */
const TeksKaya = ({ teks, className }) => (
  <div className={className}>
    <SimpulKaya simpul={uraikanMarkdown(teks)} />
  </div>
);

export default TeksKaya;
