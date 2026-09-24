// UJI 2026-09-23 — jendela konteks per percakapan (Tahap 3a).
// Keputusan Owner: pesan lama TETAP TERLIHAT (hanya berhenti dikirim), anggaran mengikuti batas biaya di Settings,
// berlaku di Assistant & Engineer, berdiri sendiri per percakapan.
import { pathToFileURL } from 'node:url';
const AKAR = 'D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/';
const K = await import(pathToFileURL(AKAR + 'KonteksChat.js').href + '?v=' + Date.now());
console.log('uji-konteks-chat v4');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ---------- perkiraan token ----------
cek(K.perkiraanToken('') === 0, 'teks kosong → 0 token');
cek(K.perkiraanToken('a'.repeat(400)) === 100, '400 huruf ≈ 100 token');
cek(K.tokenPesan({ content: 'a'.repeat(400) }) === 104, 'ongkos pembungkus pesan ikut dihitung');

// ---------- anggaran dari batas biaya Owner ----------
// deepseek-v4-pro-0813: $0,96 per 1 juta token masuk; batas harian $1, belum terpakai.
let a = K.anggaranKonteks({ batasHarianUsd: 1, terpakaiHariIniUsd: 0, hargaInput1M: 0.96, batasModel: 1048576 });
cek(a.token === Math.floor((1 * 0.05 / 0.96) * 1e6), 'anggaran = 5% sisa harian dibagi harga token masuk', a);
cek(a.biayaPerkiraanUsd > 0.04 && a.biayaPerkiraanUsd < 0.06, 'biaya per pesan ±5% batas harian ($0,05)', a.biayaPerkiraanUsd);
cek(a.sisaHarianUsd === 1, 'sisa harian dilaporkan apa adanya');

a = K.anggaranKonteks({ batasHarianUsd: 1, terpakaiHariIniUsd: 0.98, hargaInput1M: 0.96, batasModel: 1048576 });
cek(a.token === K.ANGGARAN_MIN && /tipis/.test(a.alasan), 'sisa harian tipis → anggaran minimum, alasannya disebut', a);

a = K.anggaranKonteks({ batasHarianUsd: 100, terpakaiHariIniUsd: 0, hargaInput1M: 0.04, batasModel: 100000 });
cek(a.token === 60000 && /jendela model/.test(a.alasan), 'anggaran besar dibatasi 60% jendela model', a);

a = K.anggaranKonteks({});
cek(a.token === K.ANGGARAN_BAWAAN && /belum diketahui/.test(a.alasan), 'tanpa data harga/batas → anggaran bawaan 60k', a);

// ---------- pemilihan pesan ----------
const pesan = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'model' : 'user', content: `pesan ${i} ` + 'x'.repeat(4000) })); // ±1004 token/pesan
let p = K.pilihPesanKonteks(pesan, { anggaranToken: 12000, sisakanUntukJawaban: 2000 });
cek(p.dikirim.length === 9, 'ambil dari yang TERBARU mundur sampai anggaran habis', { dikirim: p.dikirim.length, token: p.tokenTerpakai });
cek(p.dikirim[p.dikirim.length - 1] === pesan[29], 'pesan terakhir selalu ikut');
cek(p.dilewati === 21 && p.penuh === true, 'pesan lama dihitung sebagai dilewati, bukan hilang', p);

p = K.pilihPesanKonteks(pesan.slice(0, 3), { anggaranToken: 200000 });
cek(p.dikirim.length === 3 && p.penuh === false, 'percakapan pendek → seluruhnya dikirim');

p = K.pilihPesanKonteks(pesan, { anggaranToken: 3000, sisakanUntukJawaban: 2000 });
cek(p.dikirim.length === 1, 'anggaran sangat kecil → minimal satu pesan terbaru tetap dikirim (tidak pernah kosong)', p);

// "Bersihkan konteks": pesan lama TIDAK dikirim, tapi masih ada di daftar
p = K.pilihPesanKonteks(pesan, { anggaranToken: 200000, mulaiDari: 25 });
cek(p.dikirim.length === 5, 'mulaiDari → hanya pesan sesudah batas yang dikirim', p.dikirim.length);
cek(pesan.length === 30, 'daftar pesan aslinya TIDAK diubah (tetap terlihat di layar)');

// ---------- meteran ----------
const m = K.meteranKonteks({ tokenTerpakai: 723800, anggaranToken: 1000000, dilewati: 4, biayaPerkiraanUsd: 0.67, sisaHarianUsd: 1, alasan: 'dari batas biaya harian' });
cek(m.teks === '723,8k / 1,0jt (72%)', 'bentuk meteran seperti contoh Owner', m.teks);
cek(m.warna === 'hampir', '72% → warna peringatan');
cek(K.meteranKonteks({ tokenTerpakai: 10, anggaranToken: 60000 }).warna === 'aman', 'konteks lapang → aman');
cek(K.meteranKonteks({ tokenTerpakai: 59000, anggaranToken: 60000 }).warna === 'penuh', 'hampir habis → penuh');
cek(/tetap terlihat/.test(m.rincian), 'rincian menegaskan pesan lama tetap terlihat');
cek(/sisa harian \$1\.00/.test(m.rincian), 'rincian menyebut sisa anggaran harian', m.rincian);

// ---------- batas per percakapan, tidak saling mengganggu ----------
const ls = (() => { const x = new Map(); return { getItem: (k) => x.get(k) ?? null, setItem: (k, v) => x.set(k, v), removeItem: (k) => x.delete(k) }; })();
K.simpanMulaiDari('chat-engineer', 12, ls);
K.simpanMulaiDari('chat-assistant', 3, ls);
cek(K.bacaMulaiDari('chat-engineer', ls) === 12 && K.bacaMulaiDari('chat-assistant', ls) === 3, 'tiap percakapan punya batas konteks sendiri');
cek(K.bacaMulaiDari('chat-lain', ls) === 0, 'percakapan baru mulai dengan konteks bersih');
K.simpanMulaiDari('chat-engineer', 0, ls);
cek(K.bacaMulaiDari('chat-engineer', ls) === 0, 'batas bisa dilepas kembali');

// ---------- terpasang di jalur yang dipakai ----------
const { readFileSync } = await import('node:fs');
const AS = readFileSync('D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/AssistantService.js', 'utf8');
cek(!/history\.slice\(isLiteMode \? -5 : -10\)/.test(AS), 'jalur kirim TIDAK lagi memotong 10 pesan terakhir');
cek(/history: konteks\.dikirim/.test(AS), 'jalur kirim memakai pilihan beranggaran');
cek(/bacaMulaiDari\(chatId\)/.test(AS), 'batas "Bersihkan konteks" per percakapan dipakai saat mengirim');
cek(/bahanAnggaranKonteks/.test(AS) && /daily_budget_cap_usd/.test(AS), 'anggaran diambil dari batas biaya harian di Settings');
const CE = readFileSync('D:/SLAMET/other/mamet os ecosystem/frontend/src/components/workbench/ConversationEngine.jsx', 'utf8');
cek(/chatId: currentChatId/.test(CE), 'layar mengirim id percakapan ke layanan');
cek(/meteranKonteks\(/.test(CE) && /konteksInfo/.test(CE), 'meteran terpasang di layar');
cek(/simpanMulaiDari\(currentChatId, messages\.length\)/.test(CE), 'tombol bersihkan menyimpan batas, bukan menghapus pesan');
cek(/tetap ada di layar dan tetap tersimpan/.test(CE), 'pesan konfirmasi menegaskan tidak ada yang dihapus');

// ---------- cacat yang terlihat live 2026-09-23 (gambar Owner) ----------
// (a) "chatId is not defined": chatId ditambahkan di processMessage tapi tidak diteruskan ke _handleConversation.
cek(/resolvedMode, resolvedAppSource, modelTierOverride, chatId,/.test(AS), 'chatId ikut diteruskan ke handler percakapan');
const iHandle = AS.indexOf('async _handleConversation({');
cek(iHandle > 0 && /chatId = null/.test(AS.slice(iHandle, iHandle + 420)), '_handleConversation menerima chatId (galat "chatId is not defined")');
// (b) meteran tampil "19 / 1 (100%)": anggaranKonteks mengembalikan `token`, meteranKonteks menunggu `anggaranToken`.
cek(/anggaranToken: ang\.token/.test(CE), 'anggaran dipetakan ke nama yang dipakai meteran (bukan 1)');
// (c) ikon tampil sebagai teks "DATA_USAGE": font ikon hanya memuat subset dari daftar-ikon.txt.
const daftarIkon = readFileSync('D:/SLAMET/other/mamet os ecosystem/frontend/src/assets/fonts/daftar-ikon.txt', 'utf8');
const iTombol = CE.indexOf('METERAN JENDELA KONTEKS');
for (const ikon of (CE.slice(iTombol, iTombol + 1600).match(/\{konteksInfo\.dilewati > 0 \? '([a-z_]+)' : '([a-z_]+)'\}/) || []).slice(1)) {
  cek(new RegExp('^' + ikon + '$', 'm').test(daftarIkon), `ikon "${ikon}" ada di subset font (kalau tidak, tampil sebagai teks)`);
}

// ---------- peristiwa Engineer tidak bocor ke chat lain ----------
// Live 22–23 September: 8 baris chat berisi laporan Engineer lahir dengan label ws-assistant/ws-lite, karena
// EventBus global sampai ke tiga instance chat sekaligus.
cek(/const instansiEngineerRef = useRef\(false\)/.test(CE), 'ref penanda instance Engineer ada');
cek(/instansiEngineerRef\.current = osState\?\.workspaceId === 'ws-engineer'/.test(CE),
  'ref mengikuti workspace instance ini, bukan workspace yang sedang tampil');
const jumlahPenjaga = (CE.match(/if \(!instansiEngineerRef\.current\) return;/g) || []).length;
cek(jumlahPenjaga >= 6, `enam langganan peristiwa Engineer dijaga (ditemukan ${jumlahPenjaga})`);
for (const h of ['reasoningReportHandler', 'confirmationHandler', 'patchAppliedHandler', 'persistedHandler', 'fileContentHandler']) {
  const i = CE.indexOf('const ' + h);
  cek(i > 0 && /instansiEngineerRef/.test(CE.slice(i, i + 220)), `penjaga terpasang di ${h}`);
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
