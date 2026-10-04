// UJI 2026-10-04 — komentar yang membuat klaim faktual harus TETAP benar.
//
// ── Kenapa uji ini ada ──────────────────────────────────────────────────────────────────────
// Tiga dari empat temuan Engineer (TMN-0001, 0002, 0003) bukan kode yang salah, melainkan
// KOMENTAR YANG BERBOHONG. Dan dua di antaranya membusuk tanpa ada yang tahu:
//
//   TMN-0001  lahir SUDAH tertutup — komentarnya diperbaiki di commit yang sama yang membuat
//             berkas temuan itu (d677e83), lalu tercatat TERBUKA sepuluh hari.
//   TMN-0002  justru BERTAMBAH salah: komentar berbunyi "tidak ada lagi supabase.from()", lalu
//             `bbfce3a` menambahkan pemanggilan KETIGA tepat di bawahnya. Komentar yang salah
//             tidak menghalangi apa pun, jadi ia menarik pelanggaran baru.
//
// Memeriksa "kalimatnya sudah diganti" tidak menutup kelas ini — kalimat baru pun akan membusuk.
// Yang diperiksa di bawah: apakah klaim di komentar masih COCOK dengan kodenya. Kalau nanti ada
// yang menambah pemanggilan keempat, atau menyambungkan method yang kini yatim, uji ini jatuh dan
// menuntut komentarnya ikut diperbarui — bukan diam-diam dibiarkan menyimpang.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');

console.log('uji-komentar-tak-berbohong v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ── TMN-0002: daftar "tidak ada lagi" di ConversationEngine ─────────────────────────────────
console.log('\n-- TMN-0002: komentar vs kenyataan di ConversationEngine --');
{
  const isi = baca('frontend/src/components/workbench/ConversationEngine.jsx');
  const baris = isi.split('\n');

  const daftarTakAda = (isi.match(/\/\/ Tidak ada lagi:.*/) || [''])[0];
  cek(daftarTakAda.length > 0, 'kalimat "Tidak ada lagi" masih ada untuk diperiksa');
  cek(!/supabase\.from/.test(daftarTakAda),
    '`supabase.from()` TIDAK lagi diklaim tiada', daftarTakAda);
  // Yang benar-benar tiada tetap diklaim — kalau tidak, perbaikannya cuma melemahkan kalimatnya.
  cek(/fetch\(\)/.test(daftarTakAda) && /serviceManager\.get\(\)/.test(daftarTakAda),
    'klaim yang MASIH benar (fetch, serviceManager.get) tidak ikut dilunakkan', daftarTakAda);

  // Inti penjaganya: TABEL dan JUMLAH yang didaftar komentar harus cocok dengan kenyataan.
  //
  // Percobaan pertama memakai nomor baris, dan itu salah rancangan: komentar perbaikan itu
  // sendiri langsung menggeser ketiga nomornya. Tabel + jumlah tidak bergeser oleh suntingan
  // di atasnya, tetapi tetap jatuh begitu ada pemanggilan baru — yang memang maunya.
  const didaftar = [...isi.matchAll(/\/\/\s+supabase\.from\('([a-z_]+)'\)\s*(\d+)x/g)]
    .map((m) => ({ tabel: m[1], jumlah: Number(m[2]) }));
  cek(didaftar.length >= 2, `komentar mendaftar tabel & jumlahnya (${didaftar.map((d) => `${d.tabel}:${d.jumlah}`).join(', ')})`, didaftar);

  const nyata = {};
  for (const b of baris) {
    if (/^\s*\/\//.test(b)) continue;
    const m = b.match(/supabase\.from\('([a-z_]+)'\)/);
    if (m) nyata[m[1]] = (nyata[m[1]] || 0) + 1;
  }
  for (const { tabel, jumlah } of didaftar) {
    cek(nyata[tabel] === jumlah,
      `supabase.from('${tabel}') dipanggil ${jumlah}x seperti yang didaftar komentar`, { didaftar: jumlah, nyata: nyata[tabel] });
  }
  const tabelTakTerdaftar = Object.keys(nyata).filter((t) => !didaftar.some((d) => d.tabel === t));
  cek(tabelTakTerdaftar.length === 0,
    'tak ada tabel yang dipanggil tanpa didaftar komentar — tambahan baru WAJIB memperbaruinya', tabelTakTerdaftar);
  cek(!/:\d+\s+supabase\.from/.test(isi),
    'komentarnya TIDAK memakai nomor baris (nomor baris pasti membusuk)');
}

// ── TMN-0003: JSDoc logCommand ──────────────────────────────────────────────────────────────
console.log('\n-- TMN-0003: JSDoc logCommand --');
{
  const isi = baca('frontend/src/core/runtime/services/AuditLogService.js');

  cek(!/nama command \(dari CommandRegistry\)/.test(isi),
    'rujukan "dari CommandRegistry" dibuang dari JSDoc');
  cek(!existsSync(join(AKAR, 'frontend/src/core/runtime/services/CommandRegistry.js')),
    'CommandRegistry.js memang tidak ada — dasar klaim di atas masih sah');
  cek(/YATIM/.test(isi), 'keyatiman method ini dinyatakan terang-terangan, bukan hanya rujukannya yang dibetulkan');

  // Penjaga anti-busuk: begitu ada yang menyambungkan logCommand, komentar "YATIM" jadi bohong.
  // Uji ini jatuh lebih dulu dan menuntut komentarnya diperbarui.
  const semua = [];
  const jelajah = (d) => {
    for (const nama of readdirSync(join(AKAR, d))) {
      const p = `${d}/${nama}`;
      if (statSync(join(AKAR, p)).isDirectory()) jelajah(p);
      else if (/\.(js|jsx)$/.test(nama)) semua.push(p);
    }
  };
  jelajah('frontend/src');

  // Diukur pada KODE tanpa komentar. Percobaan pertama menghitung mentah dan jatuh karena JSDoc
  // perbaikan di atasnya menyebut `logCommand` untuk menjelaskan keyatimannya — jebakan "uji
  // tertipu komentar penjelas sendiri" yang sudah berulang kali menggigit di repo ini.
  const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');
  const pemakai = semua.filter((p) => /\blogCommand\b/.test(tanpaKomentar(baca(p))));
  cek(semua.length > 100, `berkas frontend/src terbaca (${semua.length})`);
  cek(pemakai.length === 1 && pemakai[0].endsWith('AuditLogService.js'),
    'logCommand MASIH yatim — satu-satunya berkas yang menyebutnya adalah rumahnya sendiri', pemakai);

  const kemunculan = (tanpaKomentar(baca('frontend/src/core/runtime/services/AuditLogService.js')).match(/\blogCommand\b/g) || []).length;
  cek(kemunculan === 1,
    `satu kemunculan dalam kode (${kemunculan}) yaitu definisinya — bila jadi 2, ia sudah dipanggil dan komentar "YATIM" wajib diperbarui`);

  // Fungsinya sengaja dibiarkan; penghapusan permanen menunggu Owner.
  cek(/async logCommand\(/.test(isi), 'fungsinya memang masih ada — tidak dihapus tanpa izin Owner');
}

// ── Ketiga temuan tercatat tertutup, dengan sebabnya ────────────────────────────────────────
console.log('\n-- catatan temuan --');
{
  const T = baca('docs/project-memory/temuan-engineer/TEMUAN-ENGINEER.md');
  for (const id of ['TMN-0001', 'TMN-0002', 'TMN-0003', 'TMN-0004']) {
    const judul = (T.match(new RegExp(`^## ${id}.*$`, 'm')) || [''])[0];
    cek(/✅ DITUTUP/.test(judul), `${id} tercatat DITUTUP`, judul);
  }
  cek(!/^## TMN-\d+ — TERBUKA/m.test(T), 'tak ada lagi temuan bertanda TERBUKA');
  // Sebab penutupan TMN-0001 adalah pelajarannya, bukan sekadar statusnya.
  cek(/lahir sudah tertutup/.test(T), 'pelajaran TMN-0001 (lahir sudah tertutup) ikut dicatat');
  cek(/BERTAMBAH salah|bertambah salah/.test(T), 'pelajaran TMN-0002 (sempat bertambah salah) ikut dicatat');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
