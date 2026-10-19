// UJI 2026-10-19 — PenyimpanKeadaan: keadaan layar yang hidup di luar layarnya (Item 127 Tahap 1, langkah 1).
//
// Kenapa ada: Tahap 1 memindahkan keadaan chat keluar dari `ConversationEngine.jsx` supaya layar boleh
// dilepas tanpa kehilangan jawaban yang sedang mengalir. Penyimpan ini menggantikan `useState`, `useRef`,
// dan (untuk penyimpanan otomatis) `useEffect` — jadi ia harus berperilaku PERSIS seperti yang digantinya.
// Satu beda kecil di sini menjadi bug di layar paling rapuh aplikasi.
//
// Yang dijaga:
//   1. SAMA DENGAN useState — inisialisasi malas sekali, pengubah fungsi menerima nilai TERBARU,
//      nilai identik tidak memberi tahu siapa pun.
//   2. TERPISAH PER APLIKASI — Assistant, Mametlite, Engineer tidak saling menimpa.
//   3. SELAMAT LEPAS-PASANG — ref yang sama dikembalikan sesudah "layar dipasang ulang".
//   4. PENGAMAT JALAN TANPA LAYAR — digabung per detak, menggantikan dirinya saat didaftar ulang,
//      galatnya tidak mematikan penulisan.
//   5. DILUPAKAN SAAT PENGGUNA BERGANTI — tanpa itu orang berikutnya melihat percakapan orang sebelumnya.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (kode) =>
  kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const { PenyimpanKeadaan } = await import(pathToFileURL(join(AKAR, 'frontend/src/core/runtime/PenyimpanKeadaan.js')).href);
const detak = () => new Promise((r) => queueMicrotask(r));

console.log('uji-penyimpan-keadaan v1');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail) : '')); }
};

// ── 1. Sama dengan useState ─────────────────────────────────────────────────────────────────────
console.log('\n-- 1. semantik useState --');
{
  const p = new PenyimpanKeadaan();
  let dipanggil = 0;
  const awal = () => { dipanggil++; return []; };
  p.siapkan('app:a', 'messages', awal);
  p.siapkan('app:a', 'messages', awal);
  cek(dipanggil === 1, 'inisialisasi malas dijalankan SEKALI walau disiapkan berulang (tiap render)', dipanggil);

  p.tulis('app:a', 'n', 0);
  p.tulis('app:a', 'n', (x) => x + 1);
  p.tulis('app:a', 'n', (x) => x + 1);
  cek(p.baca('app:a', 'n') === 2, 'dua pengubah fungsi berturut-turut sama-sama melihat nilai TERBARU (= 2)', p.baca('app:a', 'n'));

  let pemberitahuan = 0;
  p.langgan('app:a', 'n', () => pemberitahuan++);
  p.tulis('app:a', 'n', 2);
  cek(pemberitahuan === 0, 'nilai identik (Object.is) tidak memberi tahu pelanggan');
  p.tulis('app:a', 'n', 3);
  cek(pemberitahuan === 1, 'nilai berubah memberi tahu pelanggan tepat sekali');

  const lepas = p.langgan('app:a', 'n', () => pemberitahuan += 100);
  lepas();
  p.tulis('app:a', 'n', 4);
  cek(pemberitahuan === 2, 'pelanggan yang sudah melepas tidak diberi tahu lagi', pemberitahuan);

  p.tulis('app:a', 'baru', undefined);
  cek(p.ada('app:a', 'baru'), 'menulis undefined ke nama baru tetap menyimpannya (bukan dianggap "tak berubah")');
}

// ── 2. Terpisah per aplikasi ────────────────────────────────────────────────────────────────────
console.log('\n-- 2. kunci terpisah --');
{
  const p = new PenyimpanKeadaan();
  p.tulis('app:assistant', 'messages', ['A']);
  p.tulis('app:engineer', 'messages', ['E']);
  cek(p.baca('app:assistant', 'messages')[0] === 'A' && p.baca('app:engineer', 'messages')[0] === 'E',
    'Assistant dan Engineer tidak saling menimpa');
  let tertolak = false;
  try { p.tulis(null, 'x', 1); } catch { tertolak = true; }
  cek(tertolak, 'kunci kosong DITOLAK — bukan diam-diam jatuh ke satu kunci bersama');
}

// ── 3. Selamat lepas-pasang ─────────────────────────────────────────────────────────────────────
console.log('\n-- 3. ref & nilai selamat sesudah "layar dipasang ulang" --');
{
  const p = new PenyimpanKeadaan();
  const r1 = p.ref('app:a', 'percakapanSeq', 0);
  r1.current += 3;
  const r2 = p.ref('app:a', 'percakapanSeq', 0); // pemasangan kedua: awal TIDAK boleh menimpa
  cek(r1 === r2 && r2.current === 3, 'ref yang sama dikembalikan, nilainya tidak direset oleh "awal"', r2.current);

  // Penyetel yang dipegang closure lama (callback jawaban) tetap menulis ke tempat yang dibaca layar baru.
  const setelLama = (v) => p.tulis('app:a', 'messages', v);
  p.siapkan('app:a', 'messages', []);
  setelLama((m) => [...m, 'jawaban datang saat layar dilepas']);
  cek(p.baca('app:a', 'messages', []).length === 1, 'penulisan lewat penyetel lama terbaca oleh layar yang dipasang ulang');
}

// ── 4. Pengamat ─────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 4. pengamat jalan tanpa layar --');
{
  const p = new PenyimpanKeadaan();
  let jalan = 0;
  p.amati('app:a', 'simpan', ['messages', 'isLoading'], () => jalan++);
  p.tulis('app:a', 'messages', [1]);
  p.tulis('app:a', 'messages', [1, 2]);
  p.tulis('app:a', 'isLoading', false);
  cek(jalan === 0, 'belum jalan sebelum detak berikutnya (seperti efek sesudah commit)');
  await detak();
  cek(jalan === 1, 'tiga penulisan dalam satu detak = SATU kali jalan', jalan);

  p.tulis('app:a', 'input', 'tidak diamati');
  await detak();
  cek(jalan === 1, 'penulisan ke nama yang tidak diamati tidak menjalankannya', jalan);

  let jalanBaru = 0;
  p.amati('app:a', 'simpan', ['messages'], () => jalanBaru++); // layar dipasang ulang → closure baru
  p.tulis('app:a', 'messages', [9]);
  await detak();
  cek(jalan === 1 && jalanBaru === 1, 'mendaftar ulang id yang sama MENGGANTI (bukan menambah) — tak ada simpan ganda',
    { lama: jalan, baru: jalanBaru });

  const galatAsli = console.error;
  let dicatat = 0;
  console.error = () => { dicatat++; };
  p.amati('app:a', 'rusak', ['messages'], () => { throw new Error('sengaja'); });
  let lolos = true;
  try { p.tulis('app:a', 'messages', [10]); } catch { lolos = false; }
  await detak();
  console.error = galatAsli;
  cek(lolos && p.baca('app:a', 'messages')[0] === 10, 'pengamat yang galat tidak membatalkan penulisan');
  cek(dicatat === 1 && jalanBaru === 2, 'galatnya DICATAT (tidak ditelan) dan pengamat lain tetap jalan', { dicatat, jalanBaru });
}

// ── 5. Dilupakan saat pengguna berganti ─────────────────────────────────────────────────────────
console.log('\n-- 5. lupakanSemua --');
{
  const p = new PenyimpanKeadaan();
  p.tulis('app:a', 'messages', ['rahasia pengguna lama']);
  const r = p.ref('app:a', 'seq', 0); r.current = 7;
  let jalan = 0;
  p.amati('app:a', 'simpan', ['messages'], () => jalan++);
  p.tulis('app:a', 'messages', ['menunggu detak']);  // terjadwal…
  p.lupakanSemua();                                  // …lalu pengguna keluar sebelum detaknya
  await detak();
  cek(jalan === 0, 'pengamat yang terjadwal sebelum logout TIDAK jalan sesudahnya (tak menyimpan atas nama pengguna lama)');
  cek(p.baca('app:a', 'messages', []).length === 0, 'pesan pengguna lama hilang');
  cek(p.ref('app:a', 'seq', 0).current === 0, 'ref pengguna lama hilang');
}

// ── 6. Sambungan ke aplikasi ────────────────────────────────────────────────────────────────────
console.log('\n-- 6. sambungan --');
const app = tanpaKomentar(baca('frontend/src/App.jsx'));
cek(/penyimpanKeadaan\.lupakanSemua\(\)/.test(app), 'App.jsx memanggil lupakanSemua()');
cek(/if\s*\(\s*loading\s*\)\s*return/.test(app), 'App.jsx menunggu pemeriksaan sesi selesai (null saat memuat ≠ keluar)');
cek(/penggunaSebelumnyaRef\.current\s*!==\s*id/.test(app), 'App.jsx membandingkan ID pengguna (penyegaran token tidak menghapus)');
const kernel = tanpaKomentar(baca('frontend/src/core/runtime/Kernel.js'));
cek(/serviceManager\.register\('PenyimpanKeadaan',\s*penyimpanKeadaan\)/.test(kernel), 'Kernel mendaftarkan instance modul yang SAMA (bukan instance baru)');
const hook = tanpaKomentar(baca('frontend/src/core/runtime/hooks/useKeadaanTersimpan.js'));
cek(/useSyncExternalStore\(/.test(hook), 'hook memakai useSyncExternalStore (aman untuk render serentak React 18)');
cek(/const setel = useCallback\(/.test(hook), 'penyetel hook stabil (useCallback) — aman dipakai di dependency efek');
cek(!/from 'react'/.test(tanpaKomentar(baca('frontend/src/core/runtime/PenyimpanKeadaan.js'))),
  'PenyimpanKeadaan.js tidak mengimpor React (tetap bisa diuji dengan node)');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
