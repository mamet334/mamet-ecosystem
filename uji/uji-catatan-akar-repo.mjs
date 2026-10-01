// uji-catatan-akar-repo v1 — model diberi tahu di folder mana ia berdiri (Tahap 5, 2026-09-28)
//
// Kejadian live 28 Sep: model menulis "Keduanya dijalankan dari direktori kerja yang berbeda" lalu
// mengarang perintah `python` untuk menelusuri filesystem mencari berkas yang ALAMATNYA SUDAH IA
// KETAHUI — perintah itu ditolak karena kutipnya tidak ditutup. Perintahnya memang dijalankan dengan
// cwd = akarRepo(), tetapi tidak ada satu pun tempat yang memberitahukan itu kepadanya.

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const P = await import(pathToFileURL(AKAR + '/frontend/src/core/runtime/services/engineer/ProsedurEngineer.js').href + '?v=' + Date.now());

console.log('uji-catatan-akar-repo v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. Isi catatannya ────────────────────────────────────────────────────────────────────────
console.log('\n-- isi catatan --');
const REPO = 'D:\\SLAMET\\other\\mamet os ecosystem';
const c = P.catatanAkarRepo(REPO);

cek(c.includes(REPO), 'menyebut alamat akar repo apa adanya', c);
cek(/direktori kerja/i.test(c), 'menjelaskan bahwa itu direktori kerja perintah');
cek(/MAMET_CMD/.test(c), 'mengaitkannya dengan perintah [MAMET_CMD: …] yang memang dijalankan di sana');
cek(/RELATIF/i.test(c), 'menyuruh memakai alamat relatif');
cek(/JANGAN menelusuri filesystem/i.test(c),
  'melarang menelusuri filesystem — persis jalan memutar yang ditempuh model 28 Sep', c);
cek(/git ls-files/.test(c) && /git grep/.test(c),
  'memberi GANTI cara, bukan sekadar larangan (prosedur langkah 0.4)', c);

// ── 2. Kapan diam ────────────────────────────────────────────────────────────────────────────
// Di web/Mametlite tidak ada Electron, dan di aplikasi terpasang akar bisa belum dipilih.
// Catatan yang menyebut akar kosong lebih buruk daripada tidak ada catatan.
console.log('\n-- kapan diam --');
for (const kosong of ['', '   ', null, undefined, 0, false]) {
  cek(P.catatanAkarRepo(kosong) === '', `akar kosong (${JSON.stringify(kosong)}) → catatan kosong`);
}

// ── 3. TERPASANG di jalur kirim ──────────────────────────────────────────────────────────────
// Fungsi benar tapi tidak dipanggil = model tetap menebak. Dua uji minggu ini lulus karena itu.
console.log('\n-- terpasang di ConversationEngine --');
const CE = readFileSync(AKAR + '/frontend/src/components/workbench/ConversationEngine.jsx', 'utf8');

cek(/import \{[^}]*catatanAkarRepo[^}]*\} from '\.\.\/\.\.\/core\/runtime\/services\/engineer\/ProsedurEngineer\.js'/.test(CE),
  'catatanAkarRepo diimpor komponen');
cek(/const catatanAkar = catatanAkarRepo\(akarRepoSekarang\)/.test(CE), 'dipanggil di handleSend');
cek(/engineer\?\.akarRepo\?\.\(\)/.test(CE), 'akarnya dibaca dari proses utama, bukan ditebak layar');

// Harus ikut ke history yang DIKIRIM.
// Daftar sisipan bertambah seiring waktu (1 Okt: `catatanPeta` masuk di antaranya). Yang dijaga di
// sini adalah catatan AKAR ikut di dalamnya — bukan urutan persis seluruh anggotanya, karena asersi
// yang memaku daftar utuh akan merah tiap kali ada sisipan baru yang sah.
const iSisipan = CE.indexOf('const sisipan = [catatanAkar,');
cek(iSisipan > 0, 'catatan akar repo digabung ke sisipan', (CE.match(/const sisipan = [^\n]*/g) || []));
cek(/const sisipan = \[catatanAkar,[^\]]*ringkasanTemuan\]/.test(CE), 'ringkasan temuan tetap ikut di sisipan yang sama');
const iHistory = CE.indexOf('const historyKirim = sisipan.length');
cek(iHistory > iSisipan, 'sisipan dipakai menyusun historyKirim');
cek(/history: historyKirim/.test(CE), 'historyKirim itu yang benar-benar dikirim ke server');

// Hanya untuk Engineer — Assistant tidak punya akar repo dan tidak butuh catatan ini.
const iAkar = CE.indexOf('const akarRepoSekarang = isEngineerWorkspace');
cek(iAkar > 0, 'hanya disisipkan di workspace Engineer');

// Dibaca ULANG tiap kiriman: Owner bisa berganti repo lewat tombol "Pilih repo", dan catatan
// sekali-di-awal akan hilang begitu "Bersihkan konteks" menggeser batas jendela.
const blokKirim = CE.slice(CE.indexOf('const handleSend'), CE.indexOf('history: historyKirim'));
cek(blokKirim.includes('akarRepo?.()'), 'dibaca di dalam handleSend (tiap kiriman), bukan sekali saat komponen dimuat');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
