// UJI 2026-10-29 — T17: penyimpanan otomatis chat tak lagi melewatkan perubahan yang datang saat penyimpanan sebelumnya
// masih berjalan.
//
// Dulu (ConversationEngine): timer yang berbunyi saat `isSavingRef` menyala langsung `return` tanpa menjadwal ulang — perubahan
// itu baru tersimpan pada perubahan BERIKUTNYA; jawaban terakhir percakapan bisa tak pernah sampai ke tabel `chats`. Tanda
// juga baru dipasang sesudah `await getSession()`, jadi dua penyimpanan bisa berjalan bersamaan.
//
// Bagian 1 menjalankan simpanBerurutan.js ASLI dengan penyimpanan lambat buatan + "pengamat" yang meniru simpanOtomatis
// (membaca keadaan SEKARANG, menyimpan bila kuncinya beda dari yang terakhir tersimpan). Bagian 2 memeriksa sambungannya di
// ConversationEngine.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const { simpanBerurutan } = await import(pathToFileURL(join(AKAR, 'frontend/src/components/workbench/simpanBerurutan.js')).href);

console.log('uji-simpan-berurutan v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

/** Dunia kecil: keadaan pesan, database tiruan, dan pengamat yang meniru simpanOtomatis (tanpa jeda 1 detik). */
function dunia({ lama = 50, gagalPada = new Set() } = {}) {
  const w = { pesan: ['tanya'], db: null, tersimpan: '', jalan: 0, bersamaan: 0, maksBersamaan: 0, panggilan: 0 };
  const sedangRef = { current: false }, tertundaRef = { current: false };
  w.pengamat = () => {
    const kunci = w.pesan.join('|');
    if (kunci === w.tersimpan) return;
    w.panggilan++;
    return simpanBerurutan(sedangRef, tertundaRef, async () => {
      const ke = ++w.jalan;
      w.bersamaan++; w.maksBersamaan = Math.max(w.maksBersamaan, w.bersamaan);
      const salinan = [...w.pesan]; // seperti closure lama: keadaan saat penyimpanan DIMULAI
      await tidur(lama);
      w.bersamaan--;
      if (gagalPada.has(ke)) throw new Error('jaringan putus');
      w.db = salinan;
      w.tersimpan = salinan.join('|');
    }, w.pengamat)?.catch(() => { /* galat penyimpanan dilaporkan pemanggil; di sini cukup tak menghentikan uji */ });
  };
  return w;
}

// ── 1. Perilaku ─────────────────────────────────────────────────────────────────────────────────
let w = dunia();
w.pengamat();                       // simpan pertama mulai (lambat)
await tidur(10);
w.pesan.push('jawaban terakhir');   // jawaban selesai SAAT penyimpanan pertama berjalan
w.pengamat();                       // timer berbunyi — dulu: return, hilang
await tidur(200);
cek(w.db?.join('|') === 'tanya|jawaban terakhir', 'jawaban yang datang selama penyimpanan berjalan tetap tersimpan — tanpa perubahan ketiga', w.db);
cek(w.jalan === 2, `tepat dua penyimpanan (bukan lingkaran): ${w.jalan}`, w.jalan);
cek(w.maksBersamaan === 1, 'tak pernah dua penyimpanan bersamaan', w.maksBersamaan);

w = dunia();
w.pengamat(); await tidur(10);
w.pesan.push('a'); w.pengamat(); await tidur(5);
w.pesan.push('b'); w.pengamat();    // DUA permintaan tertunda → cukup satu penyimpanan lanjutan berisi keadaan terbaru
await tidur(250);
cek(w.db?.join('|') === 'tanya|a|b' && w.jalan === 2, 'beberapa permintaan tertunda → SATU penyimpanan lanjutan dengan keadaan terbaru', { db: w.db, jalan: w.jalan });

w = dunia({ gagalPada: new Set([1]) });
w.pengamat();
await tidur(300);
cek(w.jalan === 1 && w.db === null, 'penyimpanan gagal TANPA perubahan baru tidak dicoba ulang terus-menerus', { jalan: w.jalan });

w = dunia({ gagalPada: new Set([1]) });
w.pengamat(); await tidur(10);
w.pesan.push('x'); w.pengamat();
await tidur(250);
cek(w.jalan === 2 && w.db?.join('|') === 'tanya|x', 'penyimpanan gagal + perubahan baru di tengahnya → perubahan itu tetap disimpan sesudahnya', { jalan: w.jalan, db: w.db });

w = dunia();
w.pengamat(); await tidur(120);
w.pengamat(); await tidur(20);
cek(w.jalan === 1, 'keadaan tak berubah sesudah tersimpan → tak menyimpan lagi', w.jalan);

// ── 2. Sambungan di ConversationEngine ───────────────────────────────────────────────────────────
const CE = readFileSync(join(AKAR, 'frontend/src/components/workbench/ConversationEngine.jsx'), 'utf8');
const kodeSaja = CE.replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
cek(!/if \(isSavingRef\.current\) return;/.test(kodeSaja),'penjaga lama "if (isSavingRef.current) return;" (membuang permintaan) sudah tak ada');
cek(/simpanBerurutan\(isSavingRef, simpanTertundaRef, async \(\) => \{[\s\S]*?getSession\(\)[\s\S]*?saveChatToDB[\s\S]*?lastSavedKeyRef\.current = saveKey;\s*\}, simpanOtomatis\);/.test(CE),
  'timer memanggil simpanBerurutan: tanda dipasang SEBELUM getSession, pengamat simpanOtomatis dijalankan ulang bila tertunda');
cek(/p\.amati\(kunciSesi, 'simpanOtomatis', \['messages', 'currentChatId', 'isLoading', 'initialRestoreDone'\], simpanOtomatis\);/.test(CE),
  'fungsi yang didaftarkan sebagai pengamat = fungsi yang dijalankan ulang');
cek(/const simpanTertundaRef = useRefTersimpan\(kunciSesi, 'simpanTertunda', false\);/.test(CE), 'tanda "tertunda" bertahan saat layar dilepas (useRefTersimpan)');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
