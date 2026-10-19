import React, { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Teks polos sebuah simpul hast — isi blok kode persis seperti ditulis model, untuk ditampilkan dan disalin.
const teksSimpul = (n) => (n?.type === 'text' ? n.value : (n?.children || []).map(teksSimpul).join(''));

// Blok kode (Owner 19 Okt: "pikirkan juga kalau yang ditampilkan sebuah code"). Kode dibaca berbeda dari prosa:
//   - baris TIDAK dipatahkan (`whitespace-pre`) — patahan otomatis memalsukan struktur kode; baris panjang digulir
//     mendatar di dalam kotaknya sendiri, kolom chat tidak ikut melebar;
//   - huruf mono 14px, jarak baris 1,6 — lekuk (indent) tetap sejajar;
//   - kepala kotak: nama bahasa (bila model menyebutkannya) + tombol Salin berupa teks (gaya menu teks, tanpa ikon),
//     karena kode memang untuk disalin;
//   - tanpa pewarnaan sintaks: proyek belum punya pustakanya, dan menambah paket butuh izin Owner.
// Selama jawaban masih mengalir, pagar ``` yang belum ditutup tetap dirender sebagai blok kode (perilaku remark).
// Kotak kode — dipakai blok kode di jawaban model DAN keluaran terminal Engineer (yang dulu tampil sebagai teks biasa
// di gelembung, sehingga baris panjang tanpa spasi menjebol tepi gelembung). `tinggiMaks`: keluaran terminal bisa
// ratusan baris — digulir di dalam kotaknya, tidak memanjangkan percakapan.
export function KotakKode({ isi, label, tinggiMaks = false }) {
  // Hasil salin DITAMPILKAN di tombolnya, berhasil atau tidak — tombol yang diam saat gagal membuat Owner mengira
  // kodenya sudah tersalin lalu menempel isi papan klip yang lama.
  const [hasilSalin, setHasilSalin] = useState(null);
  const salin = () => {
    const tampilkan = (h) => { setHasilSalin(h); setTimeout(() => setHasilSalin(null), 2000); };
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(isi))
      .then(() => tampilkan('Tersalin ✓'), (err) => {
        console.warn('[TeksMarkdown] Gagal menyalin kode:', err);
        tampilkan('Gagal — blok & salin manual');
      });
  };
  return (
    <div className="my-3 min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-outline-variant text-on-surface-variant">
        <span className="font-mono text-[12px] truncate">{label}</span>
        <button type="button" onClick={salin} className="shrink-0 text-[12px] tracking-wide hover:underline underline-offset-2" title="Salin kode">
          {hasilSalin || 'Salin'}
        </button>
      </div>
      <pre className={`p-3 overflow-x-auto custom-scrollbar ${tinggiMaks ? 'max-h-[24rem] overflow-y-auto' : ''}`}>
        <code className="block whitespace-pre font-mono text-[14px] leading-[1.6] [tab-size:2]">{isi}</code>
      </pre>
    </div>
  );
}

function BlokKode({ node }) {
  const kode = node?.children?.find((c) => c.tagName === 'code');
  const kelas = [].concat(kode?.properties?.className || []).join(' ');
  const bahasa = (kelas.match(/language-([\w+#.-]+)/) || [])[1] || '';
  return <KotakKode isi={teksSimpul(kode || node).replace(/\n$/, '')} label={bahasa || 'kode'} />;
}

// Jawaban model ditulis dalam Markdown; dulu ditampilkan sebagai teks polos, jadi Owner membaca `**`, `| … |`, dan
// `|---|` mentah di sela isinya (Item 127, kenyamanan mata, 19 Okt). Komponen ini merendernya: tebal jadi tebal,
// daftar jadi daftar, tabel jadi tabel — susunan meniru gambar rujukan Owner.
//
// Aman tanpa daftar putih buatan sendiri: react-markdown TIDAK pernah menyuntik HTML (tag mentah jadi teks biasa,
// tanpa rehype-raw) dan menolak skema tautan selain http/https/mailto/… (`javascript:` jadi tautan kosong).
// Tautan dibuka di peramban luar oleh setWindowOpenHandler di electron/main.cjs.
//
// Jarak baris 1,75 (leading-7 di 16px): kolom chat sengaja lebar (±134 karakter, keputusan Owner), dan baris
// panjang butuh jarak lebih supaya mata tidak salah pindah baris.
const KOMPONEN = {
  p: ({ node, ...p }) => <p className="my-3 first:mt-0 last:mb-0" {...p} />,
  strong: ({ node, ...p }) => <strong className="font-semibold" {...p} />,
  em: ({ node, ...p }) => <em className="italic" {...p} />,
  a: ({ node, ...p }) => <a className="text-primary underline underline-offset-2 hover:decoration-2" target="_blank" rel="noopener noreferrer" {...p} />,
  ul: ({ node, ...p }) => <ul className="my-3 pl-6 list-disc space-y-1" {...p} />,
  ol: ({ node, ...p }) => <ol className="my-3 pl-6 list-decimal space-y-1" {...p} />,
  li: ({ node, ...p }) => <li className="pl-1" {...p} />,
  h1: ({ node, ...p }) => <h1 className="mt-5 mb-2 first:mt-0 text-[20px] leading-8 font-semibold" {...p} />,
  h2: ({ node, ...p }) => <h2 className="mt-5 mb-2 first:mt-0 text-[18px] leading-7 font-semibold" {...p} />,
  h3: ({ node, ...p }) => <h3 className="mt-4 mb-1.5 first:mt-0 text-[16px] leading-7 font-semibold" {...p} />,
  h4: ({ node, ...p }) => <h4 className="mt-4 mb-1.5 first:mt-0 text-[16px] leading-7 font-semibold opacity-80" {...p} />,
  blockquote: ({ node, ...p }) => <blockquote className="my-3 pl-4 border-l-2 border-outline-variant opacity-80" {...p} />,
  hr: ({ node, ...p }) => <hr className="my-5 border-outline-variant" {...p} />,
  // Kode sebaris = label kecil (seperti gambar rujukan). Kode di dalam blok dirender oleh BlokKode lewat `pre`.
  code: ({ node, className, children, ...p }) => {
    const blok = /language-/.test(className || '') || String(children).includes('\n');
    return blok
      ? <code className={className} {...p}>{children}</code>
      : <code className="px-1.5 py-0.5 rounded-md bg-surface-container-high font-mono text-[14px] text-primary-fixed" {...p}>{children}</code>;
  },
  pre: ({ node }) => <BlokKode node={node} />,
  table: ({ node, ...p }) => (
    <div className="my-3 overflow-x-auto custom-scrollbar">
      <table className="min-w-full border-collapse text-[14px] leading-6" {...p} />
    </div>
  ),
  th: ({ node, ...p }) => <th className="px-3 py-2 text-left font-semibold border-b border-outline align-bottom" {...p} />,
  td: ({ node, ...p }) => <td className="px-3 py-2 border-b border-outline-variant align-top" {...p} />,
};

const PLUGIN = [remarkGfm];

function TeksMarkdown({ teks }) {
  if (!teks) return null;
  return (
    <div className="leading-7 break-words">
      <Markdown remarkPlugins={PLUGIN} components={KOMPONEN}>{teks}</Markdown>
    </div>
  );
}

// DI-MEMO. Saat jawaban mengalir, setiap potongan memanggil setMessages dan SELURUH daftar pesan dirender ulang;
// tanpa memo, Markdown setiap jawaban LAMA ikut diurai ulang tiap token — diukur 19 Okt: ±6,7 ms per jawaban
// panjang, jadi chat 30 jawaban ±200 ms per token (anggaran satu bingkai 16 ms) → jawaban tampak tersendat.
// Prop-nya hanya `teks` (string), jadi jawaban yang teksnya tak berubah dilewati; yang diurai hanya yang mengalir.
export default React.memo(TeksMarkdown);
