// UJI 2026-09-24 — tombol "Padatkan" (sisa Tahap 3a).
//
// Beda dengan "Bersihkan": pesan lama diringkas jadi SATU pesan yang TETAP DIKIRIM, lalu batas konteks
// digeser ke pesan ringkasan itu. Yang diuji di sini: pembantu murni di KonteksChat.js, pembantu murni
// di padatkan_endpoint.ts (lewat esbuild, berkas server yang asli), dan pemasangannya di jalur nyata.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const AKAR = 'D:/SLAMET/other/mamet os ecosystem/';
const K = await import(pathToFileURL(AKAR + 'frontend/src/core/runtime/services/KonteksChat.js').href + '?v=' + Date.now());

const SRC = AKAR + 'supabase/functions/agent-process/lib/request/padatkan_endpoint.ts';
const TMP = AKAR + 'frontend/node_modules/.uji-rag/_padatkan_endpoint.mjs';
const { build } = await import(new URL('frontend/node_modules/esbuild/lib/main.js', new URL('../', import.meta.url)).href); // esbuild ada di frontend/node_modules; dirujuk lewat ALAMAT, bukan nama paket, karena berkas uji ini kini di akar repo (di luar frontend/) — lihat uji/README.md
// Yang diuji adalah pembantu MURNI di berkas server yang asli. Tetangganya (adapter, auth, runtime
// context) hanya dipakai di dalam handler dan tidak bisa diimpor di node — jadi diganti rintisan
// kosong saat dibundel. Isi `padatkan_endpoint.ts` sendiri TIDAK disentuh.
const rintisan = {
  name: 'rintisan',
  setup(b) {
    b.onResolve({ filter: /^\.\.?\// }, (args) => (args.kind === 'entry-point' ? undefined : { path: args.path, namespace: 'rintisan' }));
    b.onLoad({ filter: /.*/, namespace: 'rintisan' }, () => ({
      contents: 'export const CapabilityRegistry = {}; export const handleAuth = () => {}; export const createBackgroundTaskTracker = () => {}; export const createRuntimeLogger = () => {};',
      loader: 'js',
    }));
  },
};
const hasil = await build({ entryPoints: [SRC], bundle: true, write: false, format: 'esm', plugins: [rintisan] });
writeFileSync(TMP, hasil.outputFiles[0].text);
const S = await import(pathToFileURL(TMP).href + '?v=' + Date.now());

console.log('uji-padatkan-konteks v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const pesan = (n, isi = 'x'.repeat(200)) => Array.from({ length: n }, (_, i) => ({ role: i % 2 ? 'model' : 'user', content: `p${i} ${isi}` }));

// ---------- pesan mana yang diringkas ----------
let p = K.pesanUntukDipadatkan(pesan(10), 0);
cek(p.length === 10, 'tanpa batas: seluruh percakapan jadi bahan ringkasan', p.length);
p = K.pesanUntukDipadatkan(pesan(10), 6);
cek(p.length === 4 && p[0].content.startsWith('p6'), 'pesan yang sudah dilepas TIDAK ikut diringkas lagi', p.map((x) => x.content.slice(0, 3)));
cek(K.pesanUntukDipadatkan([{ content: '  ' }, { content: 'isi' }], 0).length === 1, 'pesan kosong dibuang dari bahan');
cek(K.pesanUntukDipadatkan(null, 0).length === 0, 'daftar tak sah tidak meledak');
cek(K.pesanUntukDipadatkan(pesan(3), 99).length === 0, 'batas di luar jangkauan tidak menghasilkan bahan palsu');

// ---------- kapan tombolnya boleh ditekan ----------
cek(K.bolehPadatkan(pesan(4), 0) === true, `${K.MIN_PESAN_PADATKAN} pesan → boleh dipadatkan`);
cek(K.bolehPadatkan(pesan(3), 0) === false, 'percakapan terlalu pendek → tidak boleh (panggilan model mubazir)');
cek(K.bolehPadatkan(pesan(10), 8) === false, 'sudah dipadatkan/dibersihkan baru-baru ini → sisanya belum cukup', K.pesanUntukDipadatkan(pesan(10), 8).length);
cek(K.bolehPadatkan([], 0) === false, 'percakapan kosong → tidak boleh');

// ---------- pesan ringkasan ----------
const r = K.bentukPesanRingkasan('- Tugas: TUGAS-02\n- Terbukti: berkas X ada', { jumlahPesan: 12, tokenSebelum: 40000, tokenSesudah: 400 });
cek(r.isRingkasanKonteks === true, 'pesan ringkasan ditandai sebagai hasil mesin');
cek(r.role === 'model', 'ringkasan masuk sebagai pesan model biasa — ikut tersimpan seperti pesan lain');
cek(/TUGAS-02/.test(r.content), 'isi ringkasan dari model dipertahankan apa adanya');
cek(/12 pesan di atas tetap ada di layar dan tetap tersimpan/.test(r.content), 'menegaskan tidak ada yang dihapus');
cek(/40,0k → 400 token/.test(r.content), 'menyebut penghematan yang sebenarnya', r.content.slice(0, 200));
cek(/hemat 99%/.test(r.content), 'persen penghematan dihitung, bukan dijanjikan', r.content.slice(0, 200));
cek(/tulis saja lagi/.test(r.content), 'Owner diberi tahu cara memperbaiki bila ringkasannya kurang');
const r0 = K.bentukPesanRingkasan('isi', {});
cek(/0 token/.test(r0.content) && !/NaN|Infinity/.test(r0.content), 'tanpa angka token pun tidak memunculkan NaN', r0.content.slice(0, 160));

// ---------- ringkasan benar-benar mengecilkan jendela ----------
// Ini inti fiturnya: sesudah dipadatkan, yang dikirim adalah ringkasan + pesan baru, bukan 30 pesan lama.
const percakapan = pesan(30, 'y'.repeat(3000));
const sebelum = K.pilihPesanKonteks(percakapan, { anggaranToken: 200000 });
const sesudahDaftar = [...percakapan, K.bentukPesanRingkasan('ringkasan pendek', { jumlahPesan: 30 })];
const sesudah = K.pilihPesanKonteks(sesudahDaftar, { anggaranToken: 200000, mulaiDari: percakapan.length });
cek(sesudah.dikirim.length === 1 && sesudah.dikirim[0].isRingkasanKonteks === true,
  'sesudah dipadatkan, yang dikirim HANYA pesan ringkasan', sesudah.dikirim.length);
cek(sesudah.tokenTerpakai < sebelum.tokenTerpakai / 10, 'jendela konteks mengecil drastis', { sebelum: sebelum.tokenTerpakai, sesudah: sesudah.tokenTerpakai });
cek(sesudahDaftar.length === 31, 'pesan lama TIDAK dihapus dari daftar — tetap terlihat di layar');
// Jebakan yang diuji sengaja: batas digeser ke panjang daftar SEBELUM ringkasan ditambahkan.
const salah = K.pilihPesanKonteks(sesudahDaftar, { anggaranToken: 200000, mulaiDari: sesudahDaftar.length });
cek(salah.dikirim.length === 0,
  'KENDALI: batas yang digeser SAMPAI MELEWATI ringkasan membuang ringkasannya juga (0 pesan dikirim) — itulah sebabnya indeksnya harus messages.length, bukan messages.length + 1',
  salah.dikirim.length);

// ---------- sisi server: bahan ----------
let b = S.siapkanBahan([{ role: 'user', content: 'a' }, { role: 'model', content: '' }, { role: 'x', content: 'b' }]);
cek(b.length === 2 && b[1].role === 'model', 'peran selain user dinormalkan jadi model; pesan kosong dibuang', b);
b = S.siapkanBahan([{ role: 'user', content: 'LAMA'.repeat(50) }, { role: 'model', content: 'BARU' }], 100);
cek(b.length === 1 && b[0].content === 'BARU', 'bahan kepanjangan dipotong dari yang PALING LAMA', b);
b = S.siapkanBahan([{ role: 'user', content: 'satu-satunya'.repeat(100) }], 10);
cek(b.length === 1, 'pesan terakhir tidak pernah ikut terpotong habis', b.length);
cek(S.siapkanBahan(null).length === 0, 'bahan tak sah tidak meledak');

// ---------- sisi server: prompt & pembersihan ----------
const prompt = S.susunPrompt([{ role: 'user', content: 'halo' }, { role: 'model', content: 'hai' }]);
cek(/\[OWNER\]\nhalo/.test(prompt) && /\[ASISTEN\]\nhai/.test(prompt), 'prompt memberi label siapa berkata apa', prompt);
cek(/2 pesan/.test(prompt), 'prompt menyebut jumlah pesan yang diringkas');
cek(S.bersihkanRingkasan('```markdown\n- isi\n```') === '- isi', 'pagar markdown di sekeliling seluruh jawaban dibuang');
cek(S.bersihkanRingkasan('```\nisi\n```') === 'isi', 'pagar tanpa nama bahasa juga dibuang');
cek(S.bersihkanRingkasan('kode ```js\nx\n``` di tengah').includes('```'), 'pagar DI TENGAH jawaban tidak ikut dirusak');
cek(S.bersihkanRingkasan(null) === '', 'jawaban kosong tidak meledak');

// ---------- terpasang di jalur nyata ----------
const EP = readFileSync(SRC, 'utf8');
cek(/body\?\.action !== 'padatkan'/.test(EP), 'endpoint hanya menangani action "padatkan"');
cek(/handleAuth/.test(EP), 'endpoint memeriksa JWT sendiri (fungsi di-deploy --no-verify-jwt)');
cek(/NO_API_KEY/.test(EP) && /x-byok-openrouter/.test(EP), 'BYOK wajib — panggilan model atas nama pengguna memakai kuncinya sendiri');
// Diperiksa di PEMANGGILAN adapter, bukan di seluruh berkas — komentar yang menjelaskan kenapa
// `maxTokens` tidak dipakai memang menyebut namanya.
const iExec = EP.indexOf('adapter.execute(');
cek(iExec > 0 && !/maxTokens/.test(EP.slice(iExec, EP.indexOf('{ trace_id', iExec))),
  'panggilan adapter tidak mengirim maxTokens — adapter mengunci max_tokens sendiri dan mengabaikannya diam-diam');
cek(/tidak lebih pendek dari percakapannya/.test(EP), 'ringkasan yang tidak memadatkan apa pun ditolak, bukan dipakai');
const IDX = readFileSync(AKAR + 'supabase/functions/agent-process/index.ts', 'utf8');
cek(/handlePadatkanRequest\(req, parsedBody, corsHeaders\)/.test(IDX), 'endpoint tersambung di index.ts');
const iEmbed = IDX.indexOf('const embedResponse');
const iPadat = IDX.indexOf('const padatkanResponse');
const iTry = IDX.indexOf('try {', iEmbed);
cek(iPadat > 0 && iPadat < iTry, 'endpoint dipasang DI LUAR blok try penelan galat (pelajaran Item 46)', { iPadat, iTry });

const AS = readFileSync(AKAR + 'frontend/src/core/runtime/services/AssistantService.js', 'utf8');
cek(/action: 'padatkan'/.test(AS), 'layanan memanggil endpoint padatkan');
cek(/getActiveBrainContext/.test(AS.slice(AS.indexOf('async padatkanKonteks'), AS.indexOf('async padatkanKonteks') + 1600)),
  'kunci diambil dari getActiveBrainContext (getBrainConfig tidak memuat kunci)');
cek(/if \(data\?\.error\) throw new Error/.test(AS), 'galat yang dijawab 200 tetap dilempar, tidak dianggap berhasil');

const CE = readFileSync(AKAR + 'frontend/src/components/workbench/ConversationEngine.jsx', 'utf8');
const iPad = CE.indexOf('const padatkanKonteks');
const blok = CE.slice(iPad, iPad + 2200);
cek(/simpanMulaiDari\(currentChatId, messages\.length\)/.test(blok), 'batas digeser ke INDEKS pesan ringkasan, bukan sesudahnya');
cek(/Konteks tidak diubah/.test(blok), 'gagal memadatkan = tidak mengubah apa pun, dan itu dikatakan');
cek(blok.indexOf('simpanMulaiDari') > blok.indexOf('await assistantService.padatkanKonteks'),
  'batas baru digeser SESUDAH ringkasan berhasil didapat');
cek(/bolehPadatkan\(messages, bacaMulaiDari\(currentChatId\)\)/.test(CE), 'tombol mati bila belum cukup pesan');
cek(/disabled=\{sedangMemadatkan \|\| !bisaPadatkan\}/.test(CE), 'tombol mati selama proses berjalan (tidak bisa ditekan dua kali)');
cek(/Satu panggilan model berbayar/.test(CE), 'biaya disebut di tombolnya, bukan disembunyikan');

// ikon harus ada di subset font, kalau tidak ia tampil sebagai TULISAN (cacat live 23 September)
const daftarIkon = readFileSync(AKAR + 'frontend/src/assets/fonts/daftar-ikon.txt', 'utf8');
const iPanel = CE.indexOf('PADATKAN — meringkas');
for (const ikon of [...CE.slice(iPanel, iPanel + 3000).matchAll(/material-symbols-outlined[^>]*>([a-z_]+)</g)].map((m) => m[1])) {
  cek(new RegExp('^' + ikon + '$', 'm').test(daftarIkon), `ikon "${ikon}" ada di subset font`);
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
