// UJI 2026-10-01 — Engineer tidak boleh PERNAH jatuh ke jalur ringan.
//
// ── Keputusan Owner ─────────────────────────────────────────────────────────────────────────
// *"2. engineer tidak boleh pernah jatuh"*
//
// ── Apa yang hilang kalau ia jatuh ──────────────────────────────────────────────────────────
// `_handleLookup` menyebabkan TIGA kehilangan sekaligus, dan tak satu pun terlihat di layar:
//   1. `history.slice(-3)` — sisipan ada di DEPAN, jadi catatan akar repo & peta repo terbuang.
//      Patokan `_patok` tidak menolong: jalur itu tidak memanggil `pilihPesanKonteks` sama sekali.
//   2. `mode: 'LOOKUP'` dikirim ke server, MENIMPA ENGINEER — seluruh kontrak Engineer hilang,
//      termasuk kapabilitas "membaca kode sumber" yang baru dipasang 1 Okt.
//   3. `getActiveBrainContext('KECIL')` — "LOOKUP selalu tier ringan": model turun kelas.
//
// ── Yang sudah benar sejak awal, dan tidak diklaim sebagai perbaikan ────────────────────────
// `RequestClassifierService` SUDAH menjaganya di hulu: begitu resolvedMode === 'ENGINEER' ia
// langsung mengembalikan type 'ENGINEER' dan tidak pernah mencapai cabang LOOKUP. Jadi penjaga di
// dispatch bukan pengganti itu — ia menutup satu-satunya jalan yang tersisa: `resolvedMode` yang
// MELESET, yaitu ketika `workspaceId` yang dikirim bukan 'ws-engineer'.
//
// Jalan itu nyata: layar menentukan dirinya Engineer dari `osState?.workspaceId`, sedangkan kiriman
// dulu memakai `workspaceManager?.activeWorkspaceId || 'ws-assistant'`. Dua sumber kebenaran untuk
// pertanyaan yang sama, dan yang satu jatuh diam-diam.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const baca = (p) => readFileSync(`${AKAR}/${p}`, 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-engineer-tak-jatuh v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const AS = tanpaKomentar(baca('frontend/src/core/runtime/services/AssistantService.js'));
const CE = tanpaKomentar(baca('frontend/src/components/workbench/ConversationEngine.jsx'));

// ── 1. Penjaga hulu masih utuh ──────────────────────────────────────────────────────────────
// Kalau penjaga di classifier dicabut orang lain kelak, penjaga dispatch saja tidak cukup untuk
// menjelaskan KENAPA — dan sebaliknya. Keduanya dijaga.
console.log('\n-- penjaga di hulu (classifier) --');
{
  const K = await import(pathToFileURL(`${AKAR}/frontend/src/core/runtime/services/RequestClassifierService.js`).href + '?v=' + Date.now())
    .then((m) => m, () => null);
  const Svc = K && (K.RequestClassifierService || K.default);
  if (!Svc) {
    cek(false, 'RequestClassifierService bisa diimpor');
  } else {
    // serviceManager tiruan: yang diuji keputusan klasifikasinya, bukan pemasangan layanannya.
    const c = new Svc({ get: (n) => (n === 'EventBus' ? { emit: () => {} } : null), has: () => false });
    // Pertanyaan faktual pendek: justru jenis yang paling mungkin tergolong LOOKUP.
    for (const tanya of ['apa itu RLS?', 'berapa baris main.cjs?', 'siapa penulis berkas ini?']) {
      const hasil = c.classify(tanya, [], 'ENGINEER');
      cek(hasil?.type === 'ENGINEER', `"${tanya}" di mode ENGINEER → type ENGINEER, bukan LOOKUP`, hasil);
    }
    // Mode lain TIDAK ikut dikunci — pelonggaran ini tidak boleh mematikan jalur ringan Assistant.
    const assistant = c.classify('apa itu RLS?', [], 'ASSISTANT');
    cek(assistant?.type !== 'ENGINEER', 'mode ASSISTANT tidak ikut dipaksa ke ENGINEER', assistant);
  }
}

// ── 2. Penjaga di dispatch ──────────────────────────────────────────────────────────────────
console.log('\n-- penjaga di dispatch --');

cek(/const jalurRinganTerlarang = resolvedMode === 'ENGINEER';/.test(AS),
  'penjaga dinyatakan sekali, dari resolvedMode');

// Keempat jalur ringan harus memakai penjaga yang SAMA. Satu yang terlewat = lubang yang persis
// sama, hanya lewat pintu lain.
for (const [jenis, pola] of [
  ['LOOKUP', /if \(requestType === 'LOOKUP' && !jalurRinganTerlarang\)/],
  ['MEMORY_STORE', /if \(requestType === 'MEMORY_STORE' && !jalurRinganTerlarang\)/],
  ['DOC_CONVERT', /if \(requestType === 'DOC_CONVERT' && !jalurRinganTerlarang\)/],
  ['SKILL', /if \(requestType === 'SKILL' && !jalurRinganTerlarang\)/],
]) {
  cek(pola.test(AS), `jalur ${jenis} dijaga`, (AS.match(new RegExp(`.*requestType === '${jenis}'.*`)) || []));
}

// Tidak ada cabang requestType lain yang lolos tanpa penjaga.
const cabang = AS.match(/if \(requestType === '[A-Z_]+'[^)]*\)/g) || [];
const tanpaPenjaga = cabang.filter((b) => !/jalurRinganTerlarang/.test(b));
cek(tanpaPenjaga.length === 0, 'TIDAK ADA cabang jalur ringan yang terlewat', tanpaPenjaga);

// Jatuhnya ke mana: _handleConversation, jalur penuh. Kalau penjaga hanya "return" tanpa pengganti,
// Engineer akan diam tanpa jawaban.
const iDispatch = AS.indexOf('const jalurRinganTerlarang');
const iConv = AS.indexOf('return this._handleConversation(handlerParams);');
cek(iConv > iDispatch, 'sesudah penjaga, alirannya tetap sampai ke _handleConversation', { iDispatch, iConv });

// ── 3. Sumber kebenaran tunggal ─────────────────────────────────────────────────────────────
// Penjaga di atas bergantung pada resolvedMode yang benar; resolvedMode bergantung pada
// workspaceId yang dikirim. Kalau yang ini bocor, dua penjaga sebelumnya tidak menjaga apa pun.
console.log('\n-- satu sumber kebenaran --');

cek(/workspaceId: isEngineerWorkspace \? 'ws-engineer' :/.test(CE),
  'kiriman memakai penanda yang SAMA dengan yang dipakai layar', (CE.match(/.*workspaceId: .*/g) || []));
cek(/const isEngineerWorkspace = osState\?\.workspaceId === 'ws-engineer';/.test(CE),
  'dan penanda layar itu sendiri tidak berubah');

// resolveMode harus benar-benar mengenali nilai yang dikirim itu.
cek(/workspaceId === 'ws-engineer' \|\| workspaceId === 'ENGINEER'/.test(AS),
  "resolveMode mengenali 'ws-engineer'", (AS.match(/.*ws-engineer.*/g) || []));

// ── 4. Jalur ringan sendiri TIDAK dilumpuhkan ───────────────────────────────────────────────
// Yang diperbaiki hanya siapa yang boleh masuk, bukan isi jalurnya. Assistant tetap punya jalur
// murah — melumpuhkannya akan menaikkan biaya tiap pertanyaan pendek tanpa ada yang meminta.
console.log('\n-- jalur ringan tetap hidup untuk yang lain --');

cek(/getActiveBrainContext\('KECIL'\)/.test(AS), '_handleLookup masih memakai tier ringan');
cek(/history\.slice\(-3\)/.test(AS), '_handleLookup masih memangkas riwayat');
cek(/mode: 'LOOKUP',/.test(AS), "_handleLookup masih mengirim mode 'LOOKUP'");

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
