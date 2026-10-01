/**
 * samakan-crlf.mjs — kembalikan akhir baris berkas yang diubah menjadi CRLF, seperti hasil checkout git.
 *
 * ── Kenapa ini ada ──────────────────────────────────────────────────────────────────────────
 * Repo ini `core.autocrlf=true` dan TIDAK punya `.gitattributes` (diperiksa 1 Oktober 2026). Artinya
 * git **menyimpan LF** tetapi **meng-checkout CRLF**. Setiap berkas teks di direktori kerja seharusnya
 * ber-CRLF.
 *
 * Alat sunting AI menulis **LF**. Jadi tiap berkas yang disunting keluar dari bentuk checkout-nya, dan
 * git melaporkan seluruh berkas berubah — padahal isinya sama. Lebih buruk: `PatchGenerator` Mamet
 * mencocokkan teks pada salinan kerja yang ber-CRLF, jadi berkas ber-LF membuat cari-ganti **gagal
 * mencocokkan satu pun baris** (uji `uji-patch-crlf.mjs`, kegagalan live 24 September).
 *
 * `sed -i` dan Python `io.open(...)` dengan `newline=''` juga pernah diam-diam mengubah CRLF→LF di
 * empat berkas sekaligus. Skrip ini yang mengembalikannya.
 *
 * ── Kenapa pindah ke sini ───────────────────────────────────────────────────────────────────
 * Sebelumnya ia tinggal di folder sementara sesi, dan **hilang tiap sesi berakhir** — padahal dipakai
 * sebelum SETIAP commit. Ditulis ulang dari ingatan berarti bisa berbeda tiap kali.
 *
 * ── Pemakaian ───────────────────────────────────────────────────────────────────────────────
 *   node scripts/samakan-crlf.mjs            hanya berkas yang berubah/baru (git status)
 *   node scripts/samakan-crlf.mjs --semua    seluruh berkas terlacak (lambat; untuk pemeriksaan)
 *   node scripts/samakan-crlf.mjs --periksa  hanya melaporkan, TIDAK menulis apa pun
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const AKAR = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const arg = process.argv.slice(2);
const SEMUA = arg.includes('--semua');
const PERIKSA_SAJA = arg.includes('--periksa');

/** Berkas yang berubah/baru menurut git. Berkas ter-gitignore tidak ikut — itu memang disengaja. */
function daftarBerkas() {
  if (SEMUA) {
    return execFileSync('git', ['ls-files', '-z'], { cwd: AKAR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\0').filter(Boolean);
  }
  return execFileSync('git', ['status', '--porcelain', '-z'], { cwd: AKAR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter(Boolean)
    .map((baris) => baris.slice(3))      // buang penanda status "XY "
    .filter(Boolean);
}

/**
 * Biner dikenali dari byte NUL — cara yang sama dipakai git sendiri.
 * Berkas biner TIDAK BOLEH disentuh: mengubah 0x0A di dalamnya merusak isinya.
 */
export function tampakBiner(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/**
 * Ubah setiap LF yang BERDIRI SENDIRI menjadi CRLF. CRLF yang sudah ada dibiarkan — tanpa penjagaan
 * ini, berkas campuran akan berakhir dengan `\r\r\n`.
 * @returns {{teks: string, diubah: number}}
 */
export function keCRLF(teks) {
  let diubah = 0;
  const hasil = String(teks).replace(/\r?\n/g, (m) => {
    if (m === '\n') diubah++;
    return '\r\n';
  });
  return { teks: hasil, diubah };
}

function utama() {
  const berkas = daftarBerkas();
  let disamakan = 0;
  let dilewati = 0;

  for (const rel of berkas) {
    const alamat = path.join(AKAR, rel);
    let st;
    try { st = statSync(alamat); } catch { continue; }   // dihapus/di-rename — tidak ada yang ditulis
    if (!st.isFile()) continue;

    const buf = readFileSync(alamat);
    if (tampakBiner(buf)) { dilewati++; continue; }

    const asli = buf.toString('utf8');
    const { teks, diubah } = keCRLF(asli);
    if (!diubah) continue;

    if (!PERIKSA_SAJA) writeFileSync(alamat, teks, 'utf8');
    console.log(`${PERIKSA_SAJA ? 'PERLU CRLF' : 'CRLF dipulihkan'}: ${rel} (${diubah} baris)`);
    disamakan++;
  }

  const kata = PERIKSA_SAJA ? 'perlu disamakan' : 'disamakan dengan hasil checkout';
  console.log(`\n${disamakan} berkas ${kata}.${dilewati ? ` ${dilewati} biner dilewati.` : ''}`);
  // Keluar 1 pada mode --periksa bila ada yang belum CRLF, supaya bisa dipakai sebagai penjaga.
  process.exit(PERIKSA_SAJA && disamakan ? 1 : 0);
}

// Diimpor berkas uji → jangan menyentuh berkas apa pun.
//
// Dicocokkan dengan alamat modul ini SENDIRI, bukan `endsWith('samakan-crlf.mjs')`. Versi pertama
// memakai endsWith dan langsung menulisi berkas saat `uji-samakan-crlf.mjs` mengimpornya — nama berkas
// ujinya juga berakhiran "samakan-crlf.mjs". Untuk skrip yang menulis ulang berkas sumber, penjaga yang
// hampir benar sama saja dengan tidak ada penjaga.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) utama();
