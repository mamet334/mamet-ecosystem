// UJI 2026-10-28 — modul bersama shared/kueri_pencarian.js: satu aturan kueri untuk server & klien (ADR-0021 #6).
//
// Dulu web Tier 3 di klien mengirim pesan Owner mentah-mentah ke Bing/Google News, sementara server (sub-agent
// researcher, 15 Sep) sudah membuktikan kalimat perintah → 0 hasil, kata kunci → 5–8. Aturannya kini satu berkas di
// folder netral, dimuat Deno (server) dan Vite (klien) lewat impor relatif biasa. Yang dijaga:
//   1. aturannya sendiri (contoh uji live 15 Sep tetap sama — dipindah APA ADANYA);
//   2. SATU sumber — tak ada salinan ringkasKueri lain di repo; server & klien sama-sama mengimpornya;
//   3. Deno sungguhan memuat modul server lewat impor relatif itu (bila deno.exe ada di frontend/node_modules);
//   4. Tier 3 klien sungguhan (WebComparisonService dibundel; hanya klien Supabase ditiru): kata kunci dulu, kalimat
//      asli bila kosong, kueri yang dipakai dikembalikan;
//   5. kueri itu tampil satu baris di langkah proses (AssistantService) — ADR-0021 §2.3; Vite mengizinkan ../shared.

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8');
const { ringkasKueri } = await import(pathToFileURL(join(AKAR, 'shared/kueri_pencarian.js')).href);

console.log('uji-kueri-pencarian v2');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. Aturan ──────────────────────────────────────────────────────────────────────────────────
console.log('\n-- aturan --');
cek(ringkasKueri('Cari informasi dan susun laporan tentang 3 perusahaan AI terbesar pada tahun 2026') === '3 perusahaan AI terbesar 2026',
  'contoh uji live 15 Sep: kalimat perintah → "3 perusahaan AI terbesar 2026"', ringkasKueri('Cari informasi dan susun laporan tentang 3 perusahaan AI terbesar pada tahun 2026'));
cek(ringkasKueri('tolong carikan berita "OKU" terbaru?') === 'OKU terbaru', 'kata perintah & tanda baca dibuang, kata isi dipertahankan', ringkasKueri('tolong carikan berita "OKU" terbaru?'));
cek(ringkasKueri('a b c d e f g h i j').split(' ').length === 8, 'paling banyak 8 kata');
cek(ringkasKueri('') === '' && ringkasKueri(undefined) === '' && ringkasKueri('tolong cari berita') === '', 'kosong / semua terbuang → ""');

// ── 2. Satu sumber ─────────────────────────────────────────────────────────────────────────────
console.log('\n-- satu sumber --');
const definisi = [];
const jelajah = (d) => {
  for (const n of readdirSync(d)) {
    if (['node_modules', '.git', 'dist', 'build', 'release', '.venv', 'graphify-out', '.claude', '.tmp', '_knowledge_archive'].includes(n)) continue;
    const p = join(d, n);
    const s = statSync(p);
    if (s.isDirectory()) jelajah(p);
    else if (/\.(c?js|mjs|jsx|ts|tsx)$/.test(n) && /function ringkasKueri\b|ringkasKueri\s*=\s*\(/.test(readFileSync(p, 'utf8'))) definisi.push(relative(AKAR, p).replace(/\\/g, '/'));
  }
};
for (const d of ['shared', 'frontend', 'supabase', 'mametlite', 'tools', 'backend', 'capability']) if (existsSync(join(AKAR, d))) jelajah(join(AKAR, d));
cek(definisi.length === 1 && definisi[0] === 'shared/kueri_pencarian.js', 'ringkasKueri didefinisikan di SATU tempat: shared/kueri_pencarian.js', definisi);
const PB = baca('supabase/functions/agent-process/lib/web/pencarian_berita.ts');
cek(/import \{ ringkasKueri \} from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\/kueri_pencarian\.js'/.test(PB), 'server (pencarian_berita.ts) mengimpor dari shared/');
const WC = baca('frontend/src/core/runtime/services/WebComparisonService.js');
cek(/import \{ ringkasKueri \} from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\/kueri_pencarian\.js'/.test(WC), 'klien (WebComparisonService.js) mengimpor dari shared/');
cek(existsSync(resolve(AKAR, 'supabase/functions/agent-process/lib/web', '../../../../../shared/kueri_pencarian.js'))
  && existsSync(resolve(AKAR, 'frontend/src/core/runtime/services', '../../../../../shared/kueri_pencarian.js')), 'kedua jalur relatif menunjuk berkas yang ada');

// ── 3. Deno sungguhan ──────────────────────────────────────────────────────────────────────────
console.log('\n-- Deno (server) --');
const deno = join(AKAR, 'frontend/node_modules/deno-bin/bin/deno.exe');
if (!existsSync(deno)) {
  console.log('(bagian Deno dilewati: deno.exe tidak ada di frontend/node_modules)');
} else {
  const r = spawnSync(deno, ['run', '--no-remote', '--no-config', '--no-lock', '--quiet', `--allow-read=${AKAR}`, join(AKAR, 'uji/bantu-deno-kueri.ts'), AKAR.replace(/\\/g, '/')], { encoding: 'utf8', timeout: 60000 });
  let h = null;
  try { h = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { /* dilaporkan di bawah */ }
  cek(h && h.permintaanPertama === '3 perusahaan AI terbesar 2026' && h.permintaanPertama === h.aturanBersama,
    `Deno ${h?.deno || '?'} memuat pencarian_berita.ts → shared/; permintaan pertama ke Bing memakai aturan bersama`, h || (r.stderr || r.stdout).slice(-400));
}

// ── 4. Tier 3 klien sungguhan ──────────────────────────────────────────────────────────────────
console.log('\n-- Tier 3 klien (WebComparisonService) --');
const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const hasil = await esbuild.build({
  entryPoints: [join(AKAR, 'frontend/src/core/runtime/services/WebComparisonService.js')],
  bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
  plugins: [{
    name: 'tiruan',
    setup(b) {
      b.onResolve({ filter: /supabase\.js$/ }, (a) => ({ path: a.path, namespace: 'tiruan' }));
      b.onLoad({ filter: /.*/, namespace: 'tiruan' }, () => ({ contents: 'export const supabase = null;', loader: 'js' }));
    },
  }],
});
const dir = mkdtempSync(join(tmpdir(), 'uji-kueri-'));
writeFileSync(join(dir, 'wc.mjs'), hasil.outputFiles[0].text);
const { WebComparisonService } = await import(pathToFileURL(join(dir, 'wc.mjs')).href);
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* sudah bersih */ } });
async function cari(pesan, jawab) {
  const s = new WebComparisonService({ has: () => false, get: () => null });
  s.isInitialized = true;
  const dikirim = [];
  s.customSearchHandler = async (q) => { dikirim.push(q); return jawab(q); };
  const r = await s.searchWeb(pesan, { autoConfirm: true });
  return { r, dikirim };
}
const PESAN = 'tolong carikan berita terbaru tentang banjir di Baturaja';
let x = await cari(PESAN, () => [{ title: 'Banjir Baturaja', snippet: 's', link: 'https://contoh.id/a' }]);
cek(x.dikirim.length === 1 && x.dikirim[0] === ringkasKueri(PESAN), `kata kunci yang dikirim, bukan pesan mentah: "${x.dikirim[0]}"`, x.dikirim);
cek(x.r.status === 'SUCCESS' && x.r.kueriDicari === ringkasKueri(PESAN), 'kueriDicari dikembalikan pada hasil berhasil', x.r.kueriDicari);
x = await cari(PESAN, (q) => (q === PESAN ? [{ title: 't', snippet: 's', link: 'https://contoh.id/b' }] : []));
cek(x.dikirim.join(' | ') === `${ringkasKueri(PESAN)} | ${PESAN}`, 'kata kunci kosong → kalimat asli dicoba (urutan sama dengan server)', x.dikirim);
cek(x.r.status === 'SUCCESS' && x.r.kueriDicari === PESAN, 'kueriDicari = kueri yang BENAR-BENAR memberi hasil', x.r.kueriDicari);
x = await cari(PESAN, () => []);
cek(x.r.status === 'FAILED' && x.r.kueriDicari === PESAN, 'keduanya kosong → gagal jujur, kueriDicari tetap dilaporkan', x.r);
x = await cari('berita', () => [{ title: 't', snippet: 's', link: 'https://contoh.id/c' }]);
cek(x.dikirim.length === 1 && x.dikirim[0] === 'berita', 'semua kata terbuang → pesan asli dipakai (bukan kueri kosong)', x.dikirim);

// ── 5. Terlihat & izin Vite ────────────────────────────────────────────────────────────────────
console.log('\n-- langkah proses & Vite --');
const AS = baca('frontend/src/core/runtime/services/AssistantService.js').replace(/\r\n/g, '\n');
cek(/if \(retrievalResult\?\.kueriDicari\) \{[\s\S]{0,300}langkahKlien\.push\(`🔍 Dicari \(web\): "\$\{retrievalResult\.kueriDicari\}" → \$\{hasilWeb\}`\)/.test(AS), 'AssistantService menyusun baris "🔍 Dicari (web): …" dari kueriDicari');
cek(/langkahAwal: langkahKlien/.test(AS), 'baris itu diteruskan ke penerima jawaban');
cek(/let processingSteps = \[\.\.\.langkahAwal\];/.test(AS) && /onDone\?\.\(cleanContent, \[\.\.\.langkahAwal, \.\.\.\(jsonData\.processingSteps \|\| \[\]\)\]/.test(AS),
  'baris klien ditaruh di awal langkah pada KEDUA jalur jawaban (aliran & JSON)');
const RO = baca('frontend/src/core/runtime/services/RetrievalOrchestrator.js');
cek(/kueriDicari: tier3Result\.kueriDicari/.test(RO), 'RetrievalOrchestrator meneruskan kueriDicari juga saat web gagal');
cek(/allow: \[[^\]]*'\.\.\/shared'/.test(baca('frontend/vite.config.js')), "vite.config.js: server.fs.allow memuat '../shared'");

// ── 6. Kata waktu: satu aturan untuk klien & server (29 Okt) ──────────────────────────────────
// Dulu dua salinan identik: RetrievalOrchestrator.isTemporalQuery (klien) & RetrievalStrategyService.isTemporalOrRecencyQuery
// (server). Pola LAMA disalin ke sini sebagai pembanding: penyatuan tak boleh mengubah satu jawaban pun.
console.log('\n-- kata waktu (adalahKueriWaktu) --');
const { adalahKueriWaktu } = await import(pathToFileURL(join(AKAR, 'shared/kueri_pencarian.js')).href);
const POLA_LAMA = /\b(terbaru|terkini|hari ini|minggu ini|bulan ini|tahun ini|sekarang|saat ini|berita|update|teranyar|latest|recent|currently|current|today|this week|this month|news)\b/i;
const CONTOH = [
  'berita terbaru hari ini', 'apa kabar?', 'harga beras sekarang', 'Update terkini MotoGP', 'What is the LATEST news today',
  'jelaskan Kepbup OKU 2025', 'updated policy', 'beritahu saya caranya', 'minggu ini ada rapat?', 'tahun ini vs tahun lalu',
  'currently reading', 'recently', 'saat ini juga', 'teranyar', '', 'kode program terbaru', 'pemberitaan media',
];
const beda = CONTOH.filter((t) => adalahKueriWaktu(t) !== POLA_LAMA.test(t));
cek(beda.length === 0, `${CONTOH.length} contoh: hasil sama persis dengan pola lama (perilaku tak berubah)`, beda);
// SETIAP kata pola lama diuji SENDIRIAN dalam kalimat — tanpa ini kata yang hilang dari aturan bersama tak ketahuan
// bila contohnya kebetulan memuat kata waktu lain (mutasi "berita" dihapus sempat lolos, 29 Okt).
const KATA_LAMA = POLA_LAMA.source.match(/\(([^)]+)\)/)[1].split('|');
const kataHilang = KATA_LAMA.filter((k) => !adalahKueriWaktu(`tolong cek ${k} soal Baturaja`));
cek(KATA_LAMA.length === 19 && kataHilang.length === 0, `tiap ${KATA_LAMA.length} kata waktu lama tetap terdeteksi sendirian`, kataHilang);
cek(adalahKueriWaktu('berita terbaru') === true && adalahKueriWaktu('jelaskan Kepbup OKU') === false
  && adalahKueriWaktu(undefined) === false && adalahKueriWaktu(42) === false, 'contoh pokok & masukan bukan teks');
const { RetrievalStrategyService } = await import(pathToFileURL(join(AKAR, 'shared/RetrievalStrategyService.js')).href);
const rss = new RetrievalStrategyService();
cek(CONTOH.every((t) => rss.isTemporalOrRecencyQuery(t) === adalahKueriWaktu(t)), 'server: RetrievalStrategyService.isTemporalOrRecencyQuery = adalahKueriWaktu');
const hasilRO = await esbuild.build({
  entryPoints: [join(AKAR, 'frontend/src/core/runtime/services/RetrievalOrchestrator.js')],
  bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
  plugins: [{
    name: 'tiruan',
    setup(b) {
      b.onResolve({ filter: /supabase\.js$/ }, (a) => ({ path: a.path, namespace: 'tiruan' }));
      b.onLoad({ filter: /.*/, namespace: 'tiruan' }, () => ({ contents: 'export const supabase = null;', loader: 'js' }));
    },
  }],
});
writeFileSync(join(dir, 'ro.mjs'), hasilRO.outputFiles[0].text);
const { RetrievalOrchestrator } = await import(pathToFileURL(join(dir, 'ro.mjs')).href);
const ro = new RetrievalOrchestrator({ has: () => false, get: () => null });
cek(CONTOH.every((t) => ro.isTemporalQuery(t) === adalahKueriWaktu(t)), 'klien: RetrievalOrchestrator.isTemporalQuery = adalahKueriWaktu');
const salinanPola = [];
for (const d of ['frontend/src', 'shared', 'supabase/functions']) {
  const jelajahPola = (folder) => {
    for (const n of readdirSync(folder)) {
      if (n === 'node_modules') continue;
      const p = join(folder, n);
      if (statSync(p).isDirectory()) jelajahPola(p);
      else if (/\.(js|jsx|ts)$/.test(n) && readFileSync(p, 'utf8').includes('teranyar|latest|recent|currently')) salinanPola.push(relative(AKAR, p).replace(/\\/g, '/'));
    }
  };
  jelajahPola(join(AKAR, d));
}
cek(salinanPola.length === 1 && salinanPola[0] === 'shared/kueri_pencarian.js', 'pola kata waktu hanya di shared/kueri_pencarian.js (tak ada salinan)', salinanPola);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
