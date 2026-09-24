// UJI tutupJawabanDataTabel (server, Item 92 Tahap 3) — dibundel esbuild dengan pengganti impor URL Supabase.
const { build } = await import(new URL('frontend/node_modules/esbuild/lib/main.js', new URL('../', import.meta.url)).href); // esbuild ada di frontend/node_modules; dirujuk lewat ALAMAT karena berkas uji ini di akar repo
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
const keluar = 'D:/SLAMET/other/mamet os ecosystem/frontend/node_modules/.uji-rag/_tutup.bundle.mjs';
await build({
  entryPoints: ['D:/SLAMET/other/mamet os ecosystem/supabase/functions/agent-process/lib/data_tabel/data_tabel.ts'],
  bundle: true, format: 'esm', platform: 'node', outfile: keluar, logLevel: 'error',
  plugins: [{ name: 'stub-url', setup(b) { b.onResolve({ filter: /^https:\/\// }, () => ({ path: 'stub', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const createClient = () => ({});' })); } }],
});
const { tutupJawabanDataTabel } = await import(pathToFileURL(keluar).href + '?v=' + Date.now());
fs.unlinkSync(keluar);
let gagal = 0; const cek = (ok, p) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${p}`); if (!ok) gagal++; };

// Kasus Q3 live: model membalik arti + menulis tabel ber-NIP karangan
const modelQ3 = 'Tidak ada satupun pegawai JFT RSUD yang belum pelatihan.\n\n| 1 | A | 198001012005011002 |\n\n[STATUS: VERIFIED]\nSumber: "Data Tabel Rekonsiliasi ASN"';
const ok = tutupJawabanDataTabel(modelQ3, { status: 'ok', judul: '**📊 Hasil hitung sistem: 155 orang** — x', lampiran: '\n---\n**Data Tabel — 155 orang**\n| 1 | B | 197001012000011001 |' });
cek(ok.teks.startsWith('**📊 Hasil hitung sistem: 155 orang**'), 'kalimat hasil kode di baris paling atas');
cek(ok.nipDisamarkan === 1 && !ok.teks.includes('198001012005011002'), 'NIP karangan model disamarkan (1)');
cek(ok.teks.includes('197001012000011001'), 'NIP asli di tabel kode tetap utuh');
cek(ok.teks.includes('[STATUS: VERIFIED]'), 'status ok: label model tidak diubah');

// Kasus Q4 live: perencana gagal, model mengarang tabel & VERIFIED
const modelQ4 = 'Rincian PIM: II 1, III 3, IV 1.\n\n[STATUS: VERIFIED]\nSumber: "Data Tabel Rekonsiliasi ASN"';
const g = tutupJawabanDataTabel(modelQ4, { status: 'gagal', judul: '⚠️ **Data tabel tidak dihitung** — perencana gagal. Angka apa pun di bawah BUKAN hasil hitung sistem.', lampiran: '' });
cek(g.teks.startsWith('⚠️ **Data tabel tidak dihitung**'), 'status gagal: peringatan kode di baris paling atas');
cek(!g.teks.includes('[STATUS: VERIFIED]') && g.teks.includes('[STATUS: HYPOTHESIS - Rekomendasi AI]'), 'status gagal: VERIFIED diturunkan ke HYPOTHESIS');

// Nalar <think> tetap di depan (tampilan nalar tidak rusak)
const n = tutupJawabanDataTabel('<think>pikir</think>\nJawaban 14.', { status: 'ok', judul: 'JUDUL', lampiran: '' });
cek(n.teks.startsWith('<think>pikir</think>') && n.teks.indexOf('JUDUL') > n.teks.indexOf('</think>'), 'kalimat hasil diletakkan SESUDAH blok <think>');
console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
