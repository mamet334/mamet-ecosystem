// UJI 2026-09-23 — pemilihan profil verifikasi Engineer: analisis TIDAK boleh diperiksa sebagai patch.
// Live TUGAS-04 08:26: laporan analisis 6.237 huruf diblokir HARD GATE
// "CHECK_P02_VALID_JSON_PATCH_FORMAT: Invalid JSON patch: No JSON object found" — Owner hanya menerima
// "Verification Failed". Sebabnya pola longgar /"\s*:\s*"/ menganggap kutipan kode sebagai patch JSON.
import { readFileSync } from 'node:fs';

const SRC = 'D:/SLAMET/other/mamet os ecosystem/supabase/functions/agent-process/lib/orchestration/handlers/synthesis_handler.ts';
const src = readFileSync(SRC, 'utf8');
console.log('uji-profil-verifikasi v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// Ambil kondisi yang benar-benar dipakai server, lalu jalankan sebagai fungsi.
const blok = src.slice(src.indexOf('const tanpaPagar'), src.indexOf('const effectiveMode'));
cek(blok.length > 0, 'blok pemilihan profil ditemukan di berkas server');
cek(!/\/"\\s\*:\\s\*"\//.test(src), 'pola longgar `"kunci": "nilai"` sudah TIDAK dipakai lagi');

const looksLikeJsonPatch = (responseText, requestMode = 'ENGINEER') => {
  const f = new Function('responseText', 'requestMode', `${blok} return looksLikeJsonPatch;`);
  return f(responseText, requestMode);
};

// ---------- analisis (BUKAN patch) ----------
const analisisLive = `## Analisis detectIntent

Fungsi memakai daftar kata: 'analisis', 'cek', 'lihat'.
Contoh kalimat: "Perbaiki laporan analisis" → MODIFY_CODE.
Potongan kode yang relevan:
    const text = \`\${task.title || ''} \${task.description || ''}\`;
Kesimpulan: pencocokan kata kunci tanpa makna.`;
cek(looksLikeJsonPatch(analisisLive) === false, 'laporan analisis yang mengutip kode → BUKAN patch (kegagalan live 08:26)');
cek(looksLikeJsonPatch('Berkasnya memuat {"title": "x"} sebagai contoh masukan.') === false,
  'contoh JSON di TENGAH kalimat → bukan patch');
cek(looksLikeJsonPatch('Tabel: | masukan | hasil |\n| "a": "b" | ANALYSIS |') === false,
  'tabel yang memuat pola "a": "b" → bukan patch');

// ---------- patch sungguhan tetap dikenali ----------
cek(looksLikeJsonPatch('{"frontend/src/a.js": "isi baru"}') === true, 'JSON patch murni → dikenali');
cek(looksLikeJsonPatch('```json\n{"frontend/src/a.js": {"__mode":"search_replace"}}\n```') === true,
  'patch dibungkus pagar ```json → tetap dikenali');
cek(looksLikeJsonPatch('Berikut patchnya:\n{"files": [{"path":"a.js","newContent":"x"}]}') === true,
  'format lama dengan field "files"/"newContent" → tetap dikenali');
cek(looksLikeJsonPatch('Hasil: {"a.js": {"search_replace": [{"search":"x","replace":"y"}]}}') === true,
  'format cari-ganti dikenali lewat field "search_replace"');

// ---------- mode lain tidak terpengaruh ----------
cek(looksLikeJsonPatch('{"a":"b"}', 'ASSISTANT') === false, 'mode selain ENGINEER tidak pernah dianggap patch');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
