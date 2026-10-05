/**
 * indeksKonstitusi.cjs — memindai berkas konstitusi dan mengembalikan alamat + judulnya.
 *
 * ── Kenapa modul tersendiri, bukan di dalam main.cjs ────────────────────────────────────────
 *
 * Fungsi ini lahir untuk menutup cacat yang lolos BERBULAN-BULAN: daftar 32 jalur konstitusi
 * dipaku di `engineer.js` dan sudah melenceng dari foldernya — `28_PROSEDUR_KERJA_ENGINEER.md`
 * ada di disk tetapi tidak di daftar, justru berkas yang mengatur cara Engineer bekerja.
 *
 * Menaruh penggantinya di dalam `main.cjs` berarti ia hanya bisa diuji lewat teksnya, karena
 * `main.cjs` menyalakan Electron saat diimpor. Perbaikan yang TIDAK BISA DIJALANKAN untuk cacat
 * yang lolos berbulan-bulan adalah perbaikan yang lemah: ia bisa melenceng lagi dengan cara yang
 * sama, dan tak ada yang akan tahu.
 *
 * Di sini ia bisa dijalankan terhadap folder sungguhan — termasuk menegakkan bahwa berkas 28
 * benar-benar ikut, yang dulu justru luput.
 *
 * Pola ini mengikuti `alatFolderJalan.cjs` (`pecahPerintah`, `tanpaPersetujuan`): logika yang
 * perlu dijaga tinggal di modul yang bisa diimpor Node biasa.
 */
const fs = require('fs');
const path = require('path');

/** Berkas di akar repo yang ikut dianggap bagian konstitusi. */
const BERKAS_AKAR = ['INIT.md', 'AGENTS.md'];

/** Nama folder konstitusi di dalam akar repo. */
const FOLDER = 'constitution';

/**
 * Hanya bagian awal berkas yang dibaca untuk mengambil judul.
 *
 * Membaca utuh akan mengulangi persis pemborosan yang sedang ditutup (33 berkas, 168.299 huruf,
 * tiap boot). Tajuk `#` pertama selalu di dekat kepala berkas.
 */
const HURUF_KEPALA = 2000;

/** Dipakai membandingkan judul dengan nama berkas tanpa terganggu tanda baca & huruf besar. */
const rapat = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Judul dari tajuk `#` pertama — dikembalikan HANYA bila ia menambah sesuatu di luar nama berkas.
 *
 * Terukur 5 Okt 2026: cuma 7 dari 33 berkas yang judulnya menambah informasi. Sisanya mengulang
 * nama berkasnya sendiri ("01_VISION.md — 01_VISION.md"), dan mengirimkannya hanya menaikkan
 * biaya tanpa menambah apa pun yang bisa dipakai model.
 *
 * @param {string} alamatPenuh alamat berkas di disk
 * @param {string} relatif alamat relatif terhadap akar repo (untuk mengambil namanya)
 * @returns {string} judul, atau '' bila tidak ada / tidak menambah informasi
 */
function judulBerguna(alamatPenuh, relatif) {
  let judul = '';
  try {
    const kepala = fs.readFileSync(alamatPenuh, 'utf-8').slice(0, HURUF_KEPALA);
    const m = kepala.match(/^#\s+(.+)$/m);
    judul = m ? m[1].replace(/\s+/g, ' ').trim() : '';
  } catch {
    // Berkas tak terbaca: alamatnya saja tetap berguna bagi model.
    return '';
  }
  if (!judul) return '';
  const nama = relatif.split('/').pop().replace(/\.md$/i, '');
  const menambah = !rapat(nama).includes(rapat(judul)) && !rapat(judul).includes(rapat(nama));
  return menambah ? judul.slice(0, 70) : '';
}

/**
 * Pindai konstitusi di bawah satu akar repo.
 *
 * MEMINDAI, bukan memakai daftar. Itu intinya: daftar yang ditulis tangan akan melenceng lagi
 * begitu ada berkas baru, dan kelencengan itu tidak bersuara.
 *
 * @param {string} akar alamat akar repo
 * @returns {Array<{alamat: string, judul: string}>} kosong bila akar tidak sah
 */
function indeksKonstitusi(akar) {
  if (!akar || typeof akar !== 'string') return [];
  const hasil = [];
  const tambah = (relatif) => {
    const penuh = path.join(akar, relatif);
    if (!fs.existsSync(penuh)) return;
    hasil.push({ alamat: relatif, judul: judulBerguna(penuh, relatif) });
  };

  for (const f of BERKAS_AKAR) tambah(f);

  const dir = path.join(akar, FOLDER);
  if (fs.existsSync(dir)) {
    let isi = [];
    try {
      isi = fs.readdirSync(dir);
    } catch {
      return hasil;
    }
    for (const f of isi.filter((x) => x.toLowerCase().endsWith('.md')).sort()) {
      tambah(`${FOLDER}/${f}`);
    }
  }
  return hasil;
}

module.exports = { indeksKonstitusi, judulBerguna, BERKAS_AKAR, FOLDER, HURUF_KEPALA };
