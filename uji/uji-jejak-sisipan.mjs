// UJI 2026-10-01 — jejak sisipan: MATA untuk hilangnya peta di kiriman lanjutan.
//
// ── Kenapa ada ──────────────────────────────────────────────────────────────────────────────
// Sisipan Engineer (catatan akar repo, peta repo, ingatan temuan) terbukti hilang di kiriman
// LANJUTAN: riwayat 16.945 huruf di pesan pertama, 2.290 huruf di pesan kedua percakapan yang
// sama — padahal mode tetap ENGINEER. TIGA teori sudah ditumbangkan angka:
//
//   1. anggaran sempit (saya)   → jendela model 1.048.576 token, anggaran ±629.000
//   2. turun ke LOOKUP (saya)   → log [RequestParser] menyebut ENGINEER di kedua kiriman
//   3. jendela konteks (Owner)  → sama dengan (1)
//
// Sisipan disusun di SISI KLIEN dan tidak meninggalkan jejak apa pun di log server. Berkas ini
// bukan perbaikan — ia mata. Menebak keempat kali bukan ketekunan.
//
// ── Yang paling merugikan bukan petanya ─────────────────────────────────────────────────────
// Uji live 1 Okt justru BERHASIL di kiriman yang tanpa peta. Yang merugikan adalah ingatan
// temuan: kesepakatan Owner & Engineer di pesan sebelumnya ikut lenyap, tanpa tanda di layar.

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const J = await import(pathToFileURL(`${AKAR}/frontend/src/core/runtime/services/jejakSisipan.js`).href + '?v=' + Date.now());
const { jejakSisipan } = J;

console.log('uji-jejak-sisipan v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. Diam di tempat yang bukan urusannya ──────────────────────────────────────────────────
// Assistant & Mametlite tidak punya sisipan. Baris log di sana hanya sampah konsol yang membuat
// jejak yang BENAR-BENAR dicari jadi sulit ditemukan.
console.log('\n-- diam bila bukan Engineer --');
cek(jejakSisipan({ engineer: false, catatanAkar: 'x' }) === '', 'bukan Engineer → tidak mencatat apa pun');
cek(jejakSisipan() === '', 'tanpa argumen → tidak meledak, tidak mencatat');

// ── 2. Keadaan sehat ────────────────────────────────────────────────────────────────────────
console.log('\n-- keadaan sehat --');
{
  const t = jejakSisipan({
    engineer: true, akarRepo: 'D:/repo', petaMentah: 'p'.repeat(15493),
    catatanAkar: 'a'.repeat(1180), catatanPeta: 'q'.repeat(15742), ringkasanTemuan: 't'.repeat(300),
    mulaiDari: 0, jumlahPesan: 4,
  });
  cek(t.startsWith('[Sisipan]'), 'berawalan penanda yang mudah dicari di konsol', t);
  cek(/akarRepo=ADA/.test(t), 'menyebut akar repo ada');
  cek(/petaMentah=15493/.test(t), 'menyebut ukuran peta MENTAH dari proses utama');
  cek(/akar=1180 peta=15742 temuan=300/.test(t), 'ukuran tiap sisipan disebut terpisah', t);
  cek(/3 sisipan \/ 17222 huruf/.test(t), 'jumlah & total huruf dihitung', t);
  cek(!/KOSONG/.test(t), 'tidak ada peringatan kosong saat semuanya ada', t);
}

// ── 3. Dua kerusakan yang gejalanya IDENTIK di layar ────────────────────────────────────────
// Inilah alasan `petaMentah` dipisah dari `catatanPeta`. Tanpa pemisahan itu, kedua keadaan di
// bawah menghasilkan baris log yang sama, dan instrumennya tidak menjawab apa-apa.
console.log('\n-- membedakan dua kerusakan --');
{
  // (a) Jembatan IPC gagal: proses utama tidak mengembalikan apa pun.
  const a = jejakSisipan({ engineer: true, akarRepo: 'D:/repo', petaMentah: '', catatanPeta: '', catatanAkar: 'a'.repeat(1180) });
  cek(/petaMentah=0/.test(a) && /peta=0/.test(a), '(a) jembatan kosong → petaMentah=0 DAN peta=0', a);

  // (b) Jembatan baik, penyusun catatannya yang membuang isinya.
  const b = jejakSisipan({ engineer: true, akarRepo: 'D:/repo', petaMentah: 'p'.repeat(15493), catatanPeta: '', catatanAkar: 'a'.repeat(1180) });
  cek(/petaMentah=15493/.test(b) && /peta=0/.test(b), '(b) jembatan berisi tetapi catatan kosong → terbedakan', b);

  cek(a !== b, 'dua kerusakan itu menghasilkan baris yang BERBEDA — itu gunanya instrumen ini');
}

// ── 4. Yang kosong disebut namanya ──────────────────────────────────────────────────────────
// "2 sisipan" saja tidak memberi tahu YANG MANA yang hilang.
console.log('\n-- menyebut yang hilang --');
{
  const t = jejakSisipan({ engineer: true, akarRepo: 'D:/repo', catatanAkar: 'a'.repeat(100), catatanPeta: '', ringkasanTemuan: '' });
  cek(/KOSONG: peta, temuan/.test(t), 'menyebut nama sisipan yang kosong, bukan sekadar jumlahnya', t);
  cek(/1 sisipan/.test(t), 'jumlah sisipan ikut benar', t);
}

// ── 5. Penanda "mulai dari" ikut dicatat ────────────────────────────────────────────────────
// Teori pertama yang harus disingkirkan saat sisipan hilang: Owner pernah menekan "Bersihkan
// konteks"/"Padatkan". Tanpa angka ini kita bertanya lagi ke Owner, padahal jawabannya ada.
console.log('\n-- penanda konteks --');
{
  const t = jejakSisipan({ engineer: true, akarRepo: 'D:/r', catatanAkar: 'a', mulaiDari: 7, jumlahPesan: 12 });
  cek(/mulaiDari=7 dari 12 pesan/.test(t), 'penanda "mulai dari" & jumlah pesan ikut dicatat', t);
}

// ── 6. ISI tidak ikut tercatat ──────────────────────────────────────────────────────────────
// Sisipan memuat alamat repo dan potongan temuan. Mencatat isinya ke konsol = menaruh salinan
// konteks di tempat yang tidak pernah diminta Owner.
console.log('\n-- tidak membocorkan isi --');
{
  const t = jejakSisipan({
    engineer: true, akarRepo: 'D:/rahasia/proyek', petaMentah: 'ISI-PETA-RAHASIA',
    catatanAkar: 'ALAMAT-RAHASIA', catatanPeta: 'DAFTAR-BERKAS', ringkasanTemuan: 'TEMUAN-SENSITIF',
  });
  for (const bocor of ['ISI-PETA-RAHASIA', 'ALAMAT-RAHASIA', 'DAFTAR-BERKAS', 'TEMUAN-SENSITIF', 'D:/rahasia/proyek']) {
    cek(!t.includes(bocor), `isi "${bocor}" TIDAK ikut tercatat`, t);
  }
  cek(/akarRepo=ADA/.test(t), 'tetapi keberadaan akar repo tetap dilaporkan (ADA/KOSONG, bukan alamatnya)', t);
}

// ── 7. Terpasang di jalur kirim ─────────────────────────────────────────────────────────────
// Instrumen yang tidak dipanggil tidak mengukur apa pun — persis nasib konstitusi di Brain 1.
console.log('\n-- terpasang --');
{
  const CE = readFileSync(`${AKAR}/frontend/src/components/workbench/ConversationEngine.jsx`, 'utf8').replace(/\r\n/g, '\n');
  const KODE = CE.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

  cek(/import \{ jejakSisipan \} from '\.\.\/\.\.\/core\/runtime\/services\/jejakSisipan\.js';/.test(KODE), 'diimpor komponen');
  cek(/const jejak = jejakSisipan\(\{/.test(KODE), 'dipanggil di handleSend');
  cek(/if \(jejak\) console\.log\(jejak\);/.test(KODE), 'dicetak hanya bila ada isinya');
  cek(/engineer: isEngineerWorkspace,/.test(KODE), 'memakai penanda Engineer yang sama dengan jalur kirim');
  cek(/petaMentah: peta,/.test(KODE), 'peta MENTAH ikut dilaporkan, bukan hanya catatannya');

  // Dicatat SEBELUM apa pun memotong: pemotongan terjadi jauh di hilir (pilihPesanKonteks di
  // AssistantService), jadi baris ini harus menggambarkan apa yang DISUSUN, bukan yang tersisa.
  const iSisipan = KODE.indexOf('const sisipan = [catatanAkar');
  const iJejak = KODE.indexOf('const jejak = jejakSisipan({');
  const iKirim = KODE.indexOf('await assistantService.processMessage(');
  cek(iSisipan > 0 && iJejak > iSisipan && iKirim > iJejak,
    'urutannya: sisipan disusun → dicatat → baru dikirim', { iSisipan, iJejak, iKirim });
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
