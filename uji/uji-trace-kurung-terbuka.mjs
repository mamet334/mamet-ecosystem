// UJI 2026-09-24 — pemotongan SOURCE TRACE tidak boleh membelah struktur (kurung terbuka).
//
// KEGAGALAN LIVE, DUA PUTARAN BERTURUT-TURUT:
//   01:37:07 dan 01:42:54 — CHECK_P02_VALID_JSON_PATCH_FORMAT FAIL,
//   "Response has 112 chars. Has braces: {=true, }=false" → [HARD GATE] BLOCKED, patch yang BENAR ditolak.
//
// KOREKSI ATAS DUGAAN SAYA SENDIRI: setelah putaran pertama saya menyimpulkan sebabnya "ID di dalam pagar
// kode ```" dan memasang aturan pagar. Putaran kedua GAGAL DENGAN ANGKA YANG SAMA PERSIS. Sebabnya bukan itu:
// PatchGenerator meminta model menulis patch sebagai JSON TELANJANG, TANPA pagar — jadi aturan pagar tidak
// pernah menyentuh kasus ini. Diukur ulang terhadap parser ber-aturan-pagar: sisa 113 huruf, {=3 }=0 —
// cocok dengan log live. Aturan pagar tetap benar untuk kasusnya sendiri, tapi ia BUKAN perbaikan ini.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const AKAR = 'D:/SLAMET/other/mamet os ecosystem/';
const SRC = AKAR + 'supabase/functions/agent-process/lib/coordinator/trace_parser.ts';
const TMP = AKAR + 'frontend/node_modules/.uji-rag/_trace_kurung.mjs';
const { build } = await import(new URL('frontend/node_modules/esbuild/lib/main.js', new URL('../', import.meta.url)).href); // esbuild ada di frontend/node_modules; dirujuk lewat ALAMAT, bukan nama paket, karena berkas uji ini kini di akar repo (di luar frontend/) — lihat uji/README.md
const hasil = await build({ entryPoints: [SRC], bundle: false, write: false, format: 'esm', loader: { '.ts': 'ts' } });
writeFileSync(TMP, hasil.outputFiles[0].text);
const { extractSourceTrace } = await import(pathToFileURL(TMP).href + '?v=' + Date.now());

console.log('uji-trace-kurung-terbuka v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 320)}` : ''}`);
  if (!ok) gagal++;
};
const seimbang = (t) => (t.split('{').length === t.split('}').length) && (t.split('[').length === t.split(']').length);

// Bahan uji = bentuk balasan PatchGenerator yang live: JSON TELANJANG, komentar memuat "[ADR-0017 Fase 7]".
const patchTelanjang = [
  '{',
  '  "files": [',
  '    {',
  '      "path": "frontend/src/core/runtime/services/engineer.js",',
  '      "changes": [',
  '        {',
  '          "search": "  // [ADR-0017 Fase 7] _generatePatch diekstrak ke PatchGenerator.js.",',
  '          "replace": "  // [ADR-0017 Fase 7] _generateFallbackPatch DIHAPUS (T10, 2026-09-22)."',
  '        }',
  '      ]',
  '    }',
  '  ]',
  '}',
].join('\n');

let r = extractSourceTrace(patchTelanjang);
cek(r.sourceTrace === undefined, 'JSON telanjang: tidak ada yang dipotong sebagai trace', r.sourceTrace);
cek(r.replyWithoutTrace === patchTelanjang, 'patch utuh, huruf per huruf');
cek(seimbang(r.replyWithoutTrace), 'kurung seimbang — syarat yang persis gagal live');
cek(JSON.parse(r.replyWithoutTrace).files[0].changes.length === 1, 'hasilnya benar-benar JSON yang bisa diurai');
cek(r.replyWithoutTrace.length > 112, `jauh lebih panjang dari 112 huruf sisa saat gagal (${r.replyWithoutTrace.length})`);

// Patch berpagar (aturan pagar) juga harus tetap selamat.
const patchBerpagar = ['Saya perbaiki.', '', '```json', patchTelanjang, '```', '', '[MAMET_PATCH_READY]'].join('\n');
r = extractSourceTrace(patchBerpagar);
cek(r.sourceTrace === undefined && r.replyWithoutTrace === patchBerpagar, 'patch berpagar juga utuh');

// Struktur yang dipotong oleh keyword, bukan oleh ID.
r = extractSourceTrace(['{', '  "a": [', '  Referensi: lihat ADR-0007', '  ]', '}'].join('\n'));
cek(seimbang(r.replyWithoutTrace), 'kata "Referensi" di dalam struktur pun tidak membelah kurung', r);

// ---------- perilaku normal TIDAK berubah ----------
r = extractSourceTrace(['Berikut analisisnya.', '', 'SOURCE TRACE:', '- [ADR-0007] Engineering Metrics'].join('\n'));
cek(/Berikut analisisnya/.test(r.replyWithoutTrace) && !/SOURCE TRACE/.test(r.replyWithoutTrace), 'trace prosa di ekor TETAP dipisah', r.replyWithoutTrace);
cek(/ADR-0007/.test(r.sourceTrace || ''), 'isi trace tetap terambil');
r = extractSourceTrace(['Jawaban biasa.', '- [DOC-0003] dokumen tugas'].join('\n'));
cek(/DOC-0003/.test(r.sourceTrace || ''), 'trace tanpa header tetap dipisah');
r = extractSourceTrace(['Jawaban menyebut [ADR-0012] di tengah kalimat.', '', 'SOURCE TRACE:', '- [ADR-0005] Safety'].join('\n'));
cek(/ADR-0012/.test(r.replyWithoutTrace) && /ADR-0005/.test(r.sourceTrace || ''),
  'kutipan berkurung SEIMBANG di badan jawaban tidak menghalangi pemisahan trace', r);
cek(extractSourceTrace('Halo, apa kabar?').sourceTrace === undefined, 'jawaban tanpa trace tidak berubah');

// Harga yang disadari: prosa dengan kurung tak seimbang menahan trace-nya menempel.
r = extractSourceTrace(['Lihat berkas [penting', '', 'SOURCE TRACE:', '- [ADR-0005] Safety'].join('\n'));
cek(r.sourceTrace === undefined, 'HARGA YANG DISADARI: prosa berkurung tak seimbang menahan trace di badan jawaban (rugi tampilan, bukan rugi fungsi)', r);

// ---------- UJI KENDALI: versi sebelum perbaikan harus MENUNJUKKAN gejalanya ----------
// Revisi dipaku, bukan HEAD.
const REVISI_SEBELUM = 'd548881';
const { execSync } = await import('node:child_process');
const lamaTs = execSync(`git show ${REVISI_SEBELUM}:supabase/functions/agent-process/lib/coordinator/trace_parser.ts`, {
  cwd: AKAR, encoding: 'utf8', maxBuffer: 1 << 20,
});
const TMP_LAMA = TMP.replace('_trace_kurung', '_trace_kurung_lama');
writeFileSync(TMP_LAMA + '.ts', lamaTs);
const bl = await build({ entryPoints: [TMP_LAMA + '.ts'], bundle: false, write: false, format: 'esm', loader: { '.ts': 'ts' } });
writeFileSync(TMP_LAMA, bl.outputFiles[0].text);
const lama = await import(pathToFileURL(TMP_LAMA).href + '?v=' + Date.now());

const rLama = lama.extractSourceTrace(patchTelanjang);
const buka = (rLama.replyWithoutTrace.match(/\{/g) || []).length;
const tutup = (rLama.replyWithoutTrace.match(/\}/g) || []).length;
cek(buka === 3 && tutup === 0, `KENDALI: versi lama menghasilkan {=${buka} }=${tutup} — ANGKA YANG SAMA dengan log live`, rLama.replyWithoutTrace);
cek(Math.abs(rLama.replyWithoutTrace.length - 112) <= 2,
  `KENDALI: sisa ${rLama.replyWithoutTrace.length} huruf ≈ 112 huruf yang dilaporkan live`, rLama.replyWithoutTrace.length);
let lolos = true;
try { JSON.parse(rLama.replyWithoutTrace); } catch { lolos = false; }
cek(!lolos, 'KENDALI: versi lama memang menghasilkan JSON yang tidak bisa diurai — persis sebab CHECK_P02 gagal');
cek(/Berikut analisisnya/.test(lama.extractSourceTrace(['Berikut analisisnya.', '', 'SOURCE TRACE:', '- [ADR-0007] x'].join('\n')).replyWithoutTrace),
  'KENDALI: versi lama sudah benar untuk trace prosa — perilaku itu tidak berubah');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
