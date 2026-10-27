// UJI 2026-10-27 — umpan balik 👍/👎 per jawaban (Item 126 Fase 0, Data Flywheel).
//
// North Star = biaya per jawaban BERHASIL; sampai ini tidak ada data apa pun tentang jawaban mana yang berhasil.
// Yang dijaga:
//   - penilaian disambungkan ke cost_ledger lewat traceId: setiap jalur yang memanggil model MENGIRIM traceId
//     (LOOKUP & skill dulu tidak) dan pesan jawaban MENYIMPANNYA;
//   - hanya jawaban model yang selesai & ber-traceId yang bisa dinilai (pesan sistem/lama tidak);
//   - klik lagi = batal (baris dihapus); tidak ada isi percakapan yang dikirim (Gerbang 1);
//   - gagal simpan → nilai dikembalikan & alasan ditampilkan, tidak terlihat tersimpan;
//   - tombol transparan (tanpa latar/bingkai, redup saat diam) sesuai pratinjau yang disetujui Owner.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const U = await import(pathToFileURL(path.join(AKAR, 'frontend/src/core/runtime/services/umpanBalikJawaban.js')).href);
const baca = (p) => readFileSync(path.join(AKAR, p), 'utf8');

console.log('uji-umpan-balik-jawaban v2');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 500)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. Logika tombol ────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. logika --');
cek(U.nilaiBerikutnya(0, 1) === 1 && U.nilaiBerikutnya(0, -1) === -1, 'netral → 👍 / 👎');
cek(U.nilaiBerikutnya(1, 1) === 0 && U.nilaiBerikutnya(-1, -1) === 0, 'klik tombol yang sama lagi → batal (0)');
cek(U.nilaiBerikutnya(1, -1) === -1 && U.nilaiBerikutnya(-1, 1) === 1, 'pindah 👍 ↔ 👎 cukup sekali klik');
const jawaban = { role: 'model', content: 'x', traceId: 'abc-123', isStreaming: false };
cek(U.bolehDinilai(jawaban), 'jawaban model selesai + traceId → boleh dinilai');
cek(!U.bolehDinilai({ ...jawaban, isStreaming: true }), 'masih mengalir → belum');
cek(!U.bolehDinilai({ ...jawaban, isPatchResult: true }), 'pesan sistem (hasil patch / konteks dibersihkan) → tidak');
cek(!U.bolehDinilai({ ...jawaban, role: 'user' }), 'pesan pengguna → tidak');
cek(!U.bolehDinilai({ role: 'model', content: 'jawaban lama' }) && !U.bolehDinilai({ ...jawaban, traceId: '' }), 'tanpa traceId (jawaban lama) → tidak');

// ── 2. Penyimpanan (Supabase tiruan) ────────────────────────────────────────────────────────
console.log('\n-- 2. penyimpanan --');
function tiruan({ userId = 'u-1', galat = null } = {}) {
  const log = [];
  const sb = {
    auth: { getSession: async () => ({ data: { session: userId ? { user: { id: userId } } : null } }) },
    from: (tabel) => {
      const rantai = {
        upsert: async (baris, opsi) => { log.push({ tabel, op: 'upsert', baris, opsi }); return { error: galat }; },
        delete: () => {
          const saring = [];
          const d = { eq: (k, v) => { saring.push([k, v]); return saring.length === 2 ? (log.push({ tabel, op: 'delete', saring }), Promise.resolve({ error: galat })) : d; } };
          return d;
        },
      };
      return rantai;
    },
  };
  return { sb, log };
}
{
  const { sb, log } = tiruan();
  const h = await U.simpanUmpanBalik(sb, { traceId: 'abc-123', nilai: 1, workspace: 'ws-assistant' });
  const b = log[0]?.baris || {};
  cek(h.ok && log[0]?.tabel === 'umpan_balik_jawaban' && log[0].op === 'upsert', '👍 → upsert ke umpan_balik_jawaban', log);
  cek(b.user_id === 'u-1' && b.trace_id === 'abc-123' && b.nilai === 1 && b.workspace === 'ws-assistant', 'baris: user dari sesi, traceId, nilai, workspace', b);
  cek(log[0]?.opsi?.onConflict === 'user_id,trace_id', 'satu penilaian per jawaban per pengguna (onConflict user_id,trace_id)');
  cek(Object.keys(b).sort().join(',') === 'nilai,trace_id,updated_at,user_id,workspace', 'TIDAK ada isi percakapan yang dikirim (Gerbang 1)', Object.keys(b));
}
{
  const { sb, log } = tiruan();
  const h = await U.simpanUmpanBalik(sb, { traceId: 'abc-123', nilai: 0 });
  cek(h.ok && log[0]?.op === 'delete' && JSON.stringify(log[0].saring) === JSON.stringify([['user_id', 'u-1'], ['trace_id', 'abc-123']]),
    'batal (0) → hapus baris milik sendiri untuk traceId itu', log);
}
{
  const { sb, log } = tiruan();
  cek((await U.simpanUmpanBalik(sb, { traceId: 'x', nilai: 5 })).ok === false && log.length === 0, 'nilai di luar {1,0,-1} ditolak sebelum ke database');
  cek((await U.simpanUmpanBalik(sb, { traceId: '', nilai: 1 })).ok === false && log.length === 0, 'tanpa traceId ditolak');
  const tanpaSesi = tiruan({ userId: null });
  cek((await U.simpanUmpanBalik(tanpaSesi.sb, { traceId: 'x', nilai: 1 })).alasan === 'belum masuk' && tanpaSesi.log.length === 0, 'belum masuk → ditolak, tak menulis');
  const rusak = tiruan({ galat: { message: 'permission denied' } });
  const h = await U.simpanUmpanBalik(rusak.sb, { traceId: 'x', nilai: -1 });
  cek(h.ok === false && h.alasan === 'permission denied', 'galat Supabase dikembalikan apa adanya (bukan ditelan)', h);
}

// ── 3. traceId mengalir dari permintaan ke pesan ────────────────────────────────────────────
console.log('\n-- 3. traceId --');
const as = baca('frontend/src/core/runtime/services/AssistantService.js');
cek(/const traceId = crypto\.randomUUID\(\);\s*\n\s*const payload = \{\s*\n\s*message: userMsg,\s*\n\s*mode: 'LOOKUP',[^\n]*\n\s*traceId,/.test(as), 'jalur LOOKUP mengirim traceId (dulu tidak → cost_ledger ber-trace_id kosong)');
cek(/const traceIdLangkah = crypto\.randomUUID\(\);[\s\S]{0,200}traceId: traceIdLangkah,/.test(as), 'jalur skill mengirim traceId per langkah');
const panggilan = [...as.matchAll(/await this\._handleResponseStream\(response, \{[\s\S]*?\}\);/g)].map((m) => m[0]);
cek(panggilan.length === 3 && panggilan.every((p) => /traceId/.test(p)), `ketiga pemanggil _handleResponseStream meneruskan traceId (${panggilan.length})`, panggilan.map((p) => /traceId/.test(p)));
const kirimanOnDone = [...as.matchAll(/onDone\?\.\((cleanContent|finalText), [^;]*?\{[\s\S]*?\}\);/g)].map((m) => m[0]);
cek(kirimanOnDone.length === 2 && kirimanOnDone.every((k) => /traceId/.test(k)), 'jalur JSON & jalur stream membawa traceId di extras onDone', kirimanOnDone.length);
const ce = baca('frontend/src/components/workbench/ConversationEngine.jsx');
cek(/const \{ hasPatch, patchOriginalTask, traceId \} = extras;/.test(ce), 'layar mengambil traceId dari extras onDone');
cek((ce.match(/metadata: jsonMetadata,\s*\n\s*traceId,/g) || []).length === 2 && /hasPatchProposal: hasPatch \|\| false, traceId \}\)/.test(ce),
  'traceId disimpan di pesan jawaban (stream, JSON, dan jawaban terlantar)');

// ── 4. Tombol di layar ──────────────────────────────────────────────────────────────────────
console.log('\n-- 4. tombol --');
const pakai = ce.slice(ce.indexOf('{bolehDinilai(m) && ('), ce.indexOf('{/* Copy Button */}'));
cek(/<TombolUmpanBalik[\s\S]*?nilai=\{m\.umpanBalik \|\| 0\}[\s\S]*?onNilai=\{\(tombol\) => nilaiJawaban\(idx, tombol\)\}/.test(pakai),
  'tombol hanya untuk bolehDinilai(m), nilai dari pesan, klik → nilaiJawaban');
cek(/galat=\{galatUmpanBalik\?\.idx === idx \? galatUmpanBalik\.alasan : null\}/.test(pakai), 'galat hanya di kartu yang gagal');
const blok = baca('frontend/src/components/workbench/TombolUmpanBalik.jsx');
cek(/thumb_up/.test(blok) && /thumb_down/.test(blok) && /aria-pressed=\{dipilih\}/.test(blok), 'ikon thumb_up/thumb_down + aria-pressed');
const kelasTombol = blok.match(/className=\{`p-1\.5 rounded-lg transition-opacity \$\{dipilih \? '([^']*)' : '([^']*)'\}`\}/);
cek(!!kelasTombol && !/\bbg-|\bborder\b|border-/.test(kelasTombol[0]), 'transparan: tombol tanpa latar & tanpa bingkai', kelasTombol?.[0]);
cek(kelasTombol?.[2] === 'text-on-surface-variant opacity-40 hover:opacity-100' && kelasTombol?.[1] === 'text-primary opacity-100',
  'diam redup (opacity-40, warna teks samar) · diarahkan terang · dipilih warna utama tema', kelasTombol?.slice(1));
cek(/isi=\{dipilih\}/.test(blok), 'jempol yang dipilih tampil terisi (FILL 1)');
const penangan = ce.slice(ce.indexOf('const nilaiJawaban = async'), ce.indexOf('const handleCopy'));
cek(/if \(!h\.ok\) \{\s*\n\s*ubah\(sebelum\);\s*\n\s*setGalatUmpanBalik/.test(penangan), 'gagal simpan → nilai dikembalikan & alasan ditampilkan');
cek(/Penilaian tidak tersimpan: \{galat\}/.test(blok), 'alasan gagal tampil di bawah kartu');
cek(/thumb_up/.test(baca('frontend/src/assets/fonts/daftar-ikon.txt')) && /thumb_down/.test(baca('frontend/src/assets/fonts/daftar-ikon.txt')), 'thumb_up & thumb_down ada di subset font ikon');

// ── 4b. Penilaian ikut tersimpan di chat (v2) ───────────────────────────────────────────────
// Bukti live 27 Okt: tabel mencatat +1, tetapi pesan yang tersimpan `umpanBalik` null — kunciSimpan hanya melihat
// jumlah pesan & pesan terakhir, jadi 👍 pada pesan lama tidak memicu simpan; chat dibuka ulang → jempol tak terpilih.
console.log('\n-- 4b. tersimpan di chat --');
const PC = await import(pathToFileURL(path.join(AKAR, 'frontend/src/components/workbench/pemulihanChat.js')).href);
const percakapan = [{ role: 'user', content: 'hai' }, { ...jawaban }, { role: 'user', content: 'lagi' }, { role: 'model', content: 'ok', traceId: 't-2' }];
const kunciAwal = PC.kunciSimpan({ chatId: 'c1', messages: percakapan });
const dinilai = percakapan.map((m, i) => (i === 1 ? { ...m, umpanBalik: 1 } : m));
cek(PC.kunciSimpan({ chatId: 'c1', messages: dinilai }) !== kunciAwal, '👍 pada pesan LAMA mengubah kunci simpan → chat disimpan ulang');
const dibalik = percakapan.map((m, i) => (i === 1 ? { ...m, umpanBalik: -1 } : m));
cek(PC.kunciSimpan({ chatId: 'c1', messages: dibalik }) !== PC.kunciSimpan({ chatId: 'c1', messages: dinilai }), '👍 → 👎 juga mengubah kunci');
cek(PC.kunciSimpan({ chatId: 'c1', messages: percakapan.map((m) => ({ ...m, umpanBalik: 0 })) }) === kunciAwal, 'batal (0) = kunci seperti tanpa penilaian');
cek(kunciAwal === 'c1_4_2_model', 'chat tanpa penilaian: bentuk kunci lama tidak berubah', kunciAwal);

// ── 5. Migrasi ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- 5. migrasi --');
// Komentar SQL dibuang dulu: kepala migrasi sendiri menyebut "Tidak ada policy `USING (true)`".
const mig = baca('supabase/migrations/20261027000000_umpan_balik_jawaban.sql').replace(/--[^\n]*/g, '');
const kolom = [...mig.slice(mig.indexOf('create table'), mig.indexOf('\n);')).matchAll(/^\s{2}([a-z_]+)\s+(uuid|text|smallint|timestamptz)/gm)].map((m) => `${m[1]}:${m[2]}`);
cek(kolom.join(',') === 'id:uuid,user_id:uuid,trace_id:text,nilai:smallint,workspace:text,created_at:timestamptz,updated_at:timestamptz', 'kolom tabel — tak ada kolom isi percakapan', kolom);
cek(/check \(nilai in \(-1, 1\)\)/.test(mig) && /unique \(user_id, trace_id\)/.test(mig), 'CHECK nilai ∈ {-1,1} & unik user+trace');
cek(/enable row level security/.test(mig) && (mig.match(/create policy/g) || []).length === 4 && !/using \(true\)/i.test(mig) && (mig.match(/user_id = auth\.uid\(\)/g) || []).length === 5,
  'RLS + 4 kebijakan, semuanya milik sendiri, tak ada USING (true)');
cek(/revoke all on table public\.umpan_balik_jawaban from anon;/.test(mig), 'anon tidak punya hak (temuan T11)');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`}`);
process.exitCode = gagal === 0 ? 0 : 1;
