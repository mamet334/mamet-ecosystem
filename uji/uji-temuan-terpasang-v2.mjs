// UJI 2026-09-24 — ingatan temuan terpasang (Tahap 3b), v2.
//
// Menggantikan uji-temuan-terpasang.mjs v1, yang LULUS sementara fiturnya tidak bekerja di layar Owner.
// Live 24 September: blok <temuan> muncul, laporannya muncul, tapi tombol "Simpan temuan" TIDAK MUNCUL
// saat Owner melanjutkan percakapan yang sama. Sebabnya `temuanBelumSimpan` adalah useState yang hanya
// diisi ketika pesan TERAKHIR memuat blok <temuan>; begitu ada pesan lain sesudahnya — atau begitu Vite
// memuat ulang halaman — state itu kosong lagi dan temuan yang sah seolah hilang.
// v1 tidak menangkapnya karena hanya memeriksa "tombol ada" dan "tombol hanya muncul bila ada temuan",
// bukan DARI MANA daftarnya berasal.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const AKAR = 'D:/SLAMET/other/mamet os ecosystem/';
const T = await import(pathToFileURL(AKAR + 'frontend/src/core/runtime/services/engineer/IngatanTemuan.js').href + '?v=' + Date.now());
console.log('uji-temuan-terpasang v2');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 320)}` : ''}`);
  if (!ok) gagal++;
};

const CE = readFileSync(AKAR + 'frontend/src/components/workbench/ConversationEngine.jsx', 'utf8');

// ---------- CACAT LIVE: daftar temuan harus DITURUNKAN dari pesan, bukan disimpan sebagai state ----------
cek(!/setTemuanBelumSimpan/.test(CE) && !/\[temuanBelumSimpan, /.test(CE),
  'tidak ada lagi state terpisah temuanBelumSimpan (sumber cacat live: hilang saat percakapan berlanjut / muat ulang)');
const iMemo = CE.indexOf('const temuanBelumSimpan = useMemo');
cek(iMemo > 0, 'temuanBelumSimpan diturunkan dengan useMemo');
const blokMemo = CE.slice(iMemo, iMemo + 900);
cek(/for \(const p of messages\)/.test(blokMemo),
  'SELURUH pesan dipindai, bukan hanya pesan terakhir — inilah perbaikan cacatnya');
cek(/gabungTemuan\(temuanTersimpan, semua\)\.baru/.test(blokMemo),
  'yang dihitung "belum simpan" adalah selisih terhadap catatan yang sudah di repo');
cek(/p\.isTemuan/.test(blokMemo), 'pesan laporan temuan sendiri tidak ikut dipindai (kalau tidak, laporannya jadi temuan)');
cek(/useMemo/.test(CE.split('\n')[0]), 'useMemo diimpor', CE.split('\n')[0]);

// ---------- perilaku yang ditiru dari kode, dijalankan sungguhan ----------
// Meniru percakapan live: blok <temuan> di tengah, lalu beberapa pesan lain sesudahnya.
const blok = `<temuan berkas="frontend/src/core/runtime/services/engineer.js" tingkat="rendah">
RINGKASAN: Komentar baris 1035 menyebut fungsi diekstrak, padahal dihapus
BUKTI: git grep _generateFallbackPatch → hanya 2 komentar, tidak ada definisi
</temuan>`;
const pesanPercakapan = [
  { role: 'user', content: 'periksa komentar basi' },
  { role: 'model', content: `Hasil pemeriksaan.\n\n${blok}` },
  { role: 'model', content: '🔎 **Temuan Engineer**\n\n1 temuan baru', isTemuan: true },
  { role: 'user', content: 'perbaiki ulang komentar itu' },
  { role: 'model', content: 'Baik, ini patchnya.' },
];
// Tiruan useMemo yang sama persis dengan kode.
const hitungBelumSimpan = (messages, tersimpan) => {
  const semua = [];
  for (const p of messages) {
    if (p?.role !== 'model' || p.isTemuan) continue;
    const isi = String(p.content || '');
    if (!isi.includes('<temuan')) continue;
    semua.push(...T.ambilBlokTemuan(isi).temuan);
  }
  if (!semua.length) return [];
  return T.gabungTemuan(tersimpan, semua).baru;
};

let belum = hitungBelumSimpan(pesanPercakapan, []);
cek(belum.length === 1,
  'CACAT LIVE TERTUTUP: temuan tetap terhitung walau blok <temuan> bukan pesan terakhir (percakapan lanjutan)', belum.length);
cek(belum[0].id === 'TMN-0001', 'ID tetap diberi mesin', belum[0]);

// Sesudah disimpan ke repo, tombolnya harus berhenti muncul.
const daftarTersimpan = T.gabungTemuan([], belum).daftar;
const berkas = T.susunBerkasTemuan(daftarTersimpan);
belum = hitungBelumSimpan(pesanPercakapan, T.bacaBerkasTemuan(berkas));
cek(belum.length === 0, 'sesudah tersimpan ke repo, temuannya berhenti dihitung "belum simpan" (tombol hilang sendiri)', belum);

// Muat ulang halaman = pesan dibaca dari database, state React kosong. Harus tetap terhitung.
belum = hitungBelumSimpan(JSON.parse(JSON.stringify(pesanPercakapan)), []);
cek(belum.length === 1, 'sesudah muat ulang (pesan dari database, tanpa state), temuannya tetap terhitung');

// Dua blok di dua pesan berbeda, salah satunya kembar.
const pesanDuaBlok = [...pesanPercakapan, { role: 'model', content: blok }];
belum = hitungBelumSimpan(pesanDuaBlok, []);
cek(belum.length === 1, 'blok kembar dalam satu percakapan hanya dihitung sekali', belum.length);

// ---------- yang v1 sudah periksa, tetap dijaga ----------
const iSimpan = CE.indexOf('const simpanTemuan');
const blokSimpan = CE.slice(iSimpan, iSimpan + 2400);
cek(/const tersimpan = await bacaCatatanTemuan\(\);/.test(blokSimpan), 'berkas dibaca ulang tepat sebelum menulis');
cek(/if \(!ok\) throw new Error/.test(blokSimpan), 'nilai balik fs:writeFile diperiksa (ia mengembalikan false, bukan melempar)');
cek(/tidak ada yang hilang/.test(blokSimpan), 'gagal menulis dilaporkan, temuannya tetap di layar');
cek(/isEngineerWorkspace && temuanBelumSimpan\.length > 0/.test(CE), 'tombol hanya di Engineer dan hanya bila ada yang belum tersimpan');
cek(/onClick=\{simpanTemuan\}/.test(CE), 'tombol memanggil simpanTemuan');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
