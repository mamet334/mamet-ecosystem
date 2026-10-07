// UJI 2026-10-08 — tiga berkas Mametlite yang menyatakan dirinya SALINAN tidak boleh menyimpang diam-diam.
//
// `mametlite/src/lib/` memuat tiga berkas (±1.000 baris) yang headernya menyuruh:
//
//   documentTextExtractor.js:14  "SALINAN dari frontend/src/core/runtime/services/… Ubah keduanya bersamaan."
//   pdfOcrService.js:26          "SALINAN … Ubah keduanya bersamaan."
//   tabelCentang.js:21           "SALINAN … Ubah keduanya bersamaan."
//
// **Tidak ada apa pun yang menegakkan perintah itu** — dan Constitution menuntut satu berkas satu
// tanggung jawab. Penyatuannya adalah perubahan arsitektur dan menunggu keputusan Owner (usul ADR,
// M9 di `ROADMAP-SIAP-PENGGUNA.md`). Sampai itu diputuskan, yang bisa dikerjakan adalah membuat
// penyimpangannya BERSUARA.
//
// ── Aturan yang dipakai, dan kenapa BUKAN "harus identik" ───────────────────────────────────────
//
// Diukur saat uji ini ditulis: ketiganya sudah berbeda. Dua di antaranya hanya di komentar header —
// memang disengaja, karena masing-masing menunjuk ke yang lain. Tetapi `pdfOcrService` benar-benar
// menyimpang: sisi frontend punya `hitungHalamanPdf()` yang Mametlite tidak punya.
//
// Diperiksa sebelum dijadikan kegagalan: `hitungHalamanPdf` hanya dipakai `bacaPdfAsn.js`, yaitu
// jalur tabel ASN yang **khusus Ecosystem**. Mametlite memang tidak membutuhkannya.
//
// Jadi "harus identik" adalah aturan yang SALAH — ia akan merah sejak lahir karena perbedaan yang
// sah, lalu dicabut orang dalam sepekan (pelajaran `uji-catch-diam.mjs:16-21`, dan J3b/J3c di
// roadmap). Aturan yang dipakai:
//
//   GAGAL  — nama yang ADA DI KEDUA SISI tetapi isinya beda. Itu penyimpangan yang sesungguhnya.
//   LAPOR  — nama yang hanya ada di satu sisi. Sah (fitur khusus Ecosystem), tetapi harus TERLIHAT,
//            supaya tidak ada yang menyimpang diam-diam di balik izin ini.
//
// Komentar diabaikan: header keduanya memang berbeda, dan itu bukan logika.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));

const PASANGAN = [
  ['documentTextExtractor.js', 'mametlite/src/lib', 'frontend/src/core/runtime/services'],
  ['pdfOcrService.js', 'mametlite/src/lib', 'frontend/src/core/runtime/services'],
  ['tabelCentang.js', 'mametlite/src/lib', 'frontend/src/core/runtime/services'],
];

console.log('uji-salinan-mametlite v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(
    `${ok ? 'LULUS' : 'GAGAL'}  ${pesan}` +
      (!ok && rinci !== undefined ? `\n       -> ${String(rinci).slice(0, 600)}` : ''),
  );
  if (!ok) gagal++;
};

/**
 * Buang komentar & rapatkan spasi — yang dibandingkan logikanya, bukan tata letaknya.
 *
 * `\r` DIBUANG LEBIH DULU, dan itu bukan kerapian. Salinan Mametlite CRLF, salinan frontend LF
 * (785 berkas repo ini memang masih LF di disk — lihat J3c). Di JavaScript, `.` tidak cocok dengan
 * `\r` karena ia terminator baris, jadi `/\/\/.*$/` **gagal** pada baris CRLF:
 *
 *     "// catatan\r".replace(/\/\/.*$/, '')  →  "// catatan\r"   (tidak terhapus)
 *     "// catatan".replace(/\/\/.*$/, '')    →  ""               (terhapus)
 *
 * Bentuk pertama uji ini memakainya dan melaporkan **8 ekspor menyimpang** pada berkas yang
 * `diff -w` nyatakan hanya beda 4 baris header. Yang salah ujinya, bukan kodenya — dan kegagalannya
 * TERLIHAT seperti temuan sungguhan. Kembaran cermin dari kegagalan 24 September, saat berkas LF
 * membuat cari-ganti `PatchGenerator` cocok nol baris.
 */
function normalkan(teks) {
  return teks
    .replace(/\r/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((b) => b.replace(/\/\/.*$/, ''))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Potong berkas jadi blok per `export` tingkat atas.
 *
 * Sengaja sederhana: dari satu baris yang MULAI dengan `export` sampai sebelum baris `export`
 * berikutnya. Tidak mengurai JavaScript, dan tidak perlu — yang dicari perubahan isi, bukan pohon
 * sintaksis. Bila bentuk berkasnya berubah drastis, blok yang tak cocok akan muncul sebagai
 * "hanya di satu sisi" dan tetap terlihat.
 */
function blokEkspor(teks) {
  const baris = teks.split('\n');
  const mulai = [];
  baris.forEach((b, i) => {
    const m = b.match(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/);
    if (m) mulai.push({ nama: m[1], i });
  });
  const peta = new Map();
  mulai.forEach((s, k) => {
    const akhir = k + 1 < mulai.length ? mulai[k + 1].i : baris.length;
    peta.set(s.nama, normalkan(baris.slice(s.i, akhir).join('\n')));
  });
  return peta;
}

let totalBersama = 0;
let totalSepihak = 0;

for (const [nama, dirA, dirB] of PASANGAN) {
  console.log(`\n-- ${nama} --`);

  let a, b;
  try {
    a = readFileSync(`${AKAR}/${dirA}/${nama}`, 'utf8');
    b = readFileSync(`${AKAR}/${dirB}/${nama}`, 'utf8');
  } catch (e) {
    // Berkas hilang BUKAN "tidak ada penyimpangan" — itu penyimpangan terbesar.
    cek(false, `kedua berkas terbaca`, e.message);
    continue;
  }

  // Header yang menyuruh "ubah keduanya bersamaan" harus TETAP ADA. Kalau ia dihapus, pembaca
  // berikutnya tidak akan tahu ada kembarannya, dan uji ini jadi satu-satunya yang tahu.
  cek(/SALINAN/.test(a), `header "SALINAN" masih ada di ${dirA}`);
  cek(/SALINAN/.test(b), `header "SALINAN" masih ada di ${dirB}`);

  const pa = blokEkspor(a);
  const pb = blokEkspor(b);
  cek(pa.size > 0 && pb.size > 0, `ada ekspor yang bisa dibandingkan (${pa.size} vs ${pb.size})`);

  const bersama = [...pa.keys()].filter((k) => pb.has(k));
  const hanyaA = [...pa.keys()].filter((k) => !pb.has(k));
  const hanyaB = [...pb.keys()].filter((k) => !pa.has(k));
  totalBersama += bersama.length;
  totalSepihak += hanyaA.length + hanyaB.length;

  const menyimpang = bersama.filter((k) => pa.get(k) !== pb.get(k));
  cek(
    menyimpang.length === 0,
    `${bersama.length} ekspor bersama isinya SAMA`,
    menyimpang.length
      ? `menyimpang: ${menyimpang.join(', ')}\n          ` +
        menyimpang
          .map((k) => `${k}:\n            mametlite: ${pa.get(k).slice(0, 160)}\n            frontend : ${pb.get(k).slice(0, 160)}`)
          .join('\n          ')
      : undefined,
  );

  // Sepihak = dilaporkan, tidak digagalkan. Tetapi harus tercetak, bukan ditelan.
  if (hanyaA.length) console.log(`       catat: hanya di mametlite → ${hanyaA.join(', ')}`);
  if (hanyaB.length) console.log(`       catat: hanya di frontend  → ${hanyaB.join(', ')}`);
  if (!hanyaA.length && !hanyaB.length) console.log('       catat: tidak ada ekspor sepihak');
}

console.log(`\n-- ringkas --`);
console.log(`ekspor bersama diperiksa: ${totalBersama} · ekspor sepihak (sah, dicatat): ${totalSepihak}`);
cek(totalBersama >= 10, 'jumlah ekspor bersama masuk akal — uji ini tidak diam-diam jadi hampa', totalBersama);

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`}`);
process.exit(gagal === 0 ? 0 : 1);
