// UJI 2026-09-23 — mesin uji klaim Engineer (ROADMAP-ENGINEER-MANDIRI Tahap 2).
// Bahan uji: klaim NYATA Engineer tentang detectIntent, termasuk dua yang terbukti MELESET (TUGAS-04).
import { pathToFileURL } from 'node:url';
import { writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const U = await import(pathToFileURL(AKAR + '/frontend/src/core/runtime/services/engineer/UjiKlaim.js').href + '?v=' + Date.now());
console.log('uji-klaim-engineer v2');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 320)}` : ''}`);
  if (!ok) gagal++;
};

const BERKAS = 'frontend/src/core/runtime/services/engineer/IntentClassifier.js';
const jawabanEngineer = `Berikut analisisnya.

<uji_klaim berkas="${BERKAS}" fungsi="detectIntent">
{"title":"Perbaiki laporan analisis"} => MODIFY_CODE
{"title":"Cek kenapa tombol login tidak berfungsi"} => ANALYSIS
{"title":"Tampilkan file config lalu ubah timeout-nya"} => CLARIFICATION
{"title":"Buat laporan review kode"} => CLARIFICATION
</uji_klaim>

Usulan perbaikan: prioritaskan kata kerja pertama.`;

// ---------- penguraian ----------
const { blok, galat } = U.ambilBlokKlaim(jawabanEngineer);
cek(blok.length === 1 && blok[0].kasus.length === 4, 'blok klaim terurai: 1 blok, 4 kasus', { blok: blok.length, kasus: blok[0]?.kasus.length });
cek(blok[0].berkas === BERKAS && blok[0].fungsi === 'detectIntent', 'berkas & fungsi terbaca benar');
cek(galat.length === 0, 'tidak ada galat penguraian untuk blok yang benar', galat);

// alamat berbahaya ditolak
for (const [alamat, sebab] of [
  ['../../../etc/passwd', 'keluar repo'],
  ['C:/Windows/System32/x.js', 'alamat absolut'],
  ['frontend/src/x.txt', 'bukan modul JS'],
  ['supabase/functions/agent-process/index.ts', 'di luar frontend/src'],
]) cek(U.alamatSah(alamat) === null, `alamat ditolak (${sebab}): ${alamat}`);
cek(U.alamatSah(BERKAS) === BERKAS, 'alamat repo yang sah diterima');

const rusak = U.ambilBlokKlaim(`<uji_klaim berkas="../rahasia.js" fungsi="f">{"a":1} => x</uji_klaim>`);
cek(rusak.blok.length === 0 && /tidak diizinkan/.test(rusak.galat[0] || ''), 'blok dengan alamat terlarang tidak dijalankan', rusak.galat);

// ---------- skrip uji & jalannya di proses node NYATA ----------
const skrip = U.susunSkripUji(blok[0], AKAR);
cek(!/Perbaiki laporan analisis/.test(skrip.split('const KASUS')[0]), 'teks model tidak bocor ke bagian kode skrip');
cek(/JSON|const KASUS = \[/.test(skrip), 'argumen ditanam sebagai data JSON, bukan kode');

const alamatSkrip = join(tmpdir(), `uji-klaim-${Date.now()}.mjs`);
writeFileSync(alamatSkrip, skrip, 'utf8');
const r = spawnSync(process.execPath, [alamatSkrip], { encoding: 'utf8', timeout: 20000 });
unlinkSync(alamatSkrip);
const baris = String(r.stdout || '').trim().split('\n').filter(Boolean).pop() || '';
let hasil = null;
try { hasil = JSON.parse(baris); } catch { /* biar cek di bawah yang melapor */ }
cek(!!hasil && Array.isArray(hasil.hasil), 'skrip berjalan & mengeluarkan JSON hasil', baris.slice(0, 200));
cek(hasil?.hasil?.length === 4, 'empat kasus dijalankan', hasil?.hasil);
cek(!/Intent detected|Intent ambiguous/.test(baris), 'log modul yang diuji tidak mencemari JSON hasil');

// ---------- laporan ----------
const laporan = U.susunLaporanKlaim([{ blok: blok[0], hasil }], galat);
cek(/3\/4 terbukti/.test(laporan), 'laporan menghitung 3/4 terbukti — sama dengan hasil pemeriksaan manual saya', laporan?.slice(0, 200));
cek(/1 meleset/.test(laporan), 'jumlah yang meleset disebut');
cek(/Tampilkan file config/.test(laporan) && /MODIFY_CODE/.test(laporan), 'klaim yang meleset ditampilkan beserta hasil sebenarnya');
cek(/TIDAK membatalkan jawaban/.test(laporan), 'laporan menegaskan klaim meleset tidak membatalkan jawaban');
cek(/bukan klaim model/.test(laporan), 'laporan menyebut hasilnya dari kode, bukan dari kata model');

// fungsi yang tidak ada → dilaporkan sebagai tidak bisa diuji, bukan diam
const blokFungsiSalah = { berkas: BERKAS, fungsi: 'tidakAdaFungsiIni', kasus: [{ argumen: [{ title: 'x' }], diklaim: 'ANALYSIS', baris: '{"title":"x"} => ANALYSIS' }] };
const s2 = U.susunSkripUji(blokFungsiSalah, AKAR);
const a2 = join(tmpdir(), `uji-klaim-2-${Date.now()}.mjs`);
writeFileSync(a2, s2, 'utf8');
const r2 = spawnSync(process.execPath, [a2], { encoding: 'utf8', timeout: 20000 });
unlinkSync(a2);
const h2 = JSON.parse(String(r2.stdout).trim().split('\n').filter(Boolean).pop());
cek(/tidak diekspor/.test(h2.galat || ''), 'fungsi yang tidak diekspor → galat jelas, bukan diam', h2);
cek(/tidak bisa diuji/.test(U.susunLaporanKlaim([{ blok: blokFungsiSalah, hasil: h2 }]) || ''), 'laporan menandai blok yang tidak bisa diuji');

// tanpa blok klaim → tidak ada laporan (tidak mengganggu jawaban biasa)
cek(U.ambilBlokKlaim('jawaban biasa tanpa klaim').blok.length === 0, 'jawaban tanpa blok klaim → tidak ada yang dijalankan');
cek(U.susunLaporanKlaim([], []) === null, 'tanpa hasil & tanpa galat → tidak ada laporan yang ditempel');

// ---------- peringatan: klaim perilaku tanpa blok uji ----------
// Live 2026-09-23: aturan 0.2b sudah sampai ke model (terbukti di jejak pemrosesan), model tetap menulis klaim prosa.
const prosaLive = 'Contoh kalimat nyata yang salah:\n- "Analisis perubahan pada file X" => MODIFY_CODE\n- "Cek apakah patch ini aman" => MODIFY_CODE';
const pk = U.peringatanKlaimTakTeruji(prosaLive);
cek(!!pk && /tidak ada satu pun yang dijalankan/.test(pk), 'klaim perilaku dalam prosa tanpa blok uji → diperingatkan', pk?.slice(0, 140));
cek(/2 klaim perilaku/.test(pk || ''), 'jumlah klaim yang belum diuji disebut', pk?.slice(0, 90));
cek(U.peringatanKlaimTakTeruji(jawabanEngineer) === null, 'jawaban yang SUDAH memuat blok uji tidak diperingatkan');
cek(U.peringatanKlaimTakTeruji('Menurut saya kodenya rapi dan tidak ada masalah.') === null, 'jawaban biasa tanpa klaim perilaku tidak diperingatkan');
cek(U.peringatanKlaimTakTeruji('Alurnya: baca berkas -> analisis') === null, 'satu panah biasa tidak dianggap klaim perilaku');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
