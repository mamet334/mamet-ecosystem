// UJI 2026-09-23 — keluaran perintah Engineer diakui sebagai sumber label.
// Sebab: live TUGAS-02 & TUGAS-04, jawaban yang seluruhnya dibangun dari isi berkas nyata (lewat perintah yang
// Owner setujui) diturunkan ke HYPOTHESIS dengan alasan "tidak mengutip dokumen".
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const F = await import(pathToFileURL(AKAR + '/frontend/src/core/runtime/services/folderKerjaAlat.js').href + '?v=' + Date.now());

// label_sumber.ts (TypeScript) → JS lewat esbuild: yang diuji berkas server yang asli.
const { build } = await import(new URL('frontend/node_modules/esbuild/lib/main.js', new URL('../', import.meta.url)).href); // esbuild ada di frontend/node_modules; dirujuk lewat ALAMAT, bukan nama paket, karena berkas uji ini kini di akar repo (di luar frontend/) — lihat uji/README.md
const SRC = AKAR + '/supabase/functions/agent-process/lib/verification/label_sumber.ts';
const TMP = AKAR + '/frontend/node_modules/.uji-rag/_label_sumber.mjs';
writeFileSync(TMP, (await build({ entryPoints: [SRC], bundle: false, write: false, format: 'esm', loader: { '.ts': 'ts' } })).outputFiles[0].text);
const L = await import(pathToFileURL(TMP).href + '?v=' + Date.now());

console.log('uji-sumber-terminal v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 320)}` : ''}`);
  if (!ok) gagal++;
};

const PERINTAH = 'git show HEAD:frontend/src/core/runtime/services/engineer/IntentClassifier.js';
const KELUARAN = `export function detectIntent(task) {\n  const analysisKeywords = ['analisis', 'cek', 'lihat'];\n}\n\nKode keluar 0 (0,2 s).`;
const pesanTerminal = `[TERMINAL OUTPUT for: ${PERINTAH}]\n${KELUARAN}`;

// ---------- sumberDariKeluaranTerminal ----------
let s = F.sumberDariKeluaranTerminal([pesanTerminal]);
cek(s.judul.length === 1 && s.judul[0] === PERINTAH, 'perintah menjadi judul sumber', s.judul);
cek(s.isi.length === 1 && s.isi[0].includes('detectIntent'), 'keluarannya menjadi isi sumber');
cek(F.sumberDariKeluaranTerminal(['pertanyaan biasa dari pengguna']).judul.length === 0, 'pesan biasa bukan sumber');
cek(F.sumberDariKeluaranTerminal([`[TERMINAL OUTPUT for: git status]\nDITOLAK OWNER di dialog izin — perintah TIDAK dijalankan.`]).judul.length === 0,
  'perintah yang DITOLAK Owner tidak boleh jadi sumber');
cek(F.sumberDariKeluaranTerminal([`[TERMINAL OUTPUT for: npm install lodash]\nTIDAK DIJALANKAN: mengunduh paket dari internet`]).judul.length === 0,
  'perintah yang tidak dijalankan tidak boleh jadi sumber');

// ---------- pemeriksa label memakai sumber itu ----------
const jawabanBenar = `Fungsi detectIntent memakai daftar kata analisis 'analisis', 'cek', 'lihat'.\n\nSumber: \`${PERINTAH}\`\n[STATUS: VERIFIED]`;
let h = L.periksaLabelSumber(jawabanBenar, s.judul, s.isi);
cek(h.dikoreksi === false, 'VERIFIED BERTAHAN bila Sumber menyebut perintah yang benar-benar dijalankan', h.alasan);

h = L.periksaLabelSumber(jawabanBenar, [], []);
cek(h.dikoreksi === true, 'KENDALI: tanpa sumber terminal, jawaban yang sama diturunkan (gejala lama nyata)', h.alasan);

const jawabanSumberLain = `Menurut analisis saya kodenya rapi.\n\nSumber: "Peta Sistem Mamet OS"\n[STATUS: VERIFIED]`;
h = L.periksaLabelSumber(jawabanSumberLain, s.judul, s.isi);
cek(h.dikoreksi === true, 'menyebut sumber yang TIDAK dijalankan → tetap diturunkan', h.alasan);

const jawabanAngkaKarangan = `Berkas itu memuat 77 baris dan 3,5 persen di antaranya komentar.\n\nSumber: \`${PERINTAH}\`\n[STATUS: VERIFIED]`;
h = L.periksaLabelSumber(jawabanAngkaKarangan, s.judul, s.isi);
cek(h.dikoreksi === true, 'angka yang tidak ada di keluaran → tetap diturunkan (pemeriksaan angka tetap jalan)', h.alasan);

const tanpaLabel = `Fungsi detectIntent memakai daftar kata analisis.\n\nSumber: \`${PERINTAH}\``;
h = L.periksaLabelSumber(tanpaLabel, s.judul, s.isi);
cek(h.dikoreksi === true && /tidak menulis label/.test(h.alasan), 'tanpa label apa pun → HYPOTHESIS ditambahkan seperti biasa', h.alasan);

// ---------- terpasang di jalur server ----------
const sh = readFileSync(AKAR + '/supabase/functions/agent-process/lib/orchestration/handlers/synthesis_handler.ts', 'utf8');
cek(/sumberDariKeluaranTerminal/.test(sh) && /requestMode === 'ENGINEER'/.test(sh), 'synthesis_handler memakai sumber terminal untuk mode ENGINEER');
const uc = readFileSync(AKAR + '/supabase/functions/agent-process/lib/verification/universal_contract.ts', 'utf8');
cek(/LABEL UNTUK KELUARAN PERINTAH ENGINEER/.test(uc), 'kontrak memberi tahu model bahwa perintah boleh jadi Sumber');
cek(/DITOLAK Owner atau tidak dijalankan BUKAN sumber/.test(uc), 'kontrak melarang melabeli VERIFIED atas perintah yang ditolak');
const cb = readFileSync(AKAR + '/supabase/functions/agent-process/lib/orchestration/handlers/context_builder.ts', 'utf8');
cek(/keluaranPerintah:/.test(cb), 'context_builder menyalakan bendera kontrak saat pesan berisi keluaran perintah');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
