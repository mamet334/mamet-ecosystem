// UJI 2026-10-01 — kacamata kuda Engineer dilepas: kode sumber jadi evidence yang sah.
//
// ── Kejadian live yang melahirkannya ────────────────────────────────────────────────────────
// Owner bertanya: "Di mana label VERIFIED akhirnya diputuskan? Sebutkan berkas dan nomor barisnya."
//
// Saat itu SEMUA yang dibutuhkan sudah tersedia:
//   · peta repo ADA di prompt — 16.945 huruf, terukur lewat [PROMPT_KOMPOSISI] 12.28.40
//   · perintah git sudah jalan SENDIRI tanpa persetujuan (4.2.5, terbukti live hari itu juga)
//   · jawabannya ada di `hakim_bayangan.ts:212`, dua perintah jauhnya
//
// Model menjawab "tidak ada evidence", SOURCE TRACE [NONE], tanpa menjalankan satu pun pencarian.
//
// Sebabnya bukan model bodoh — model PATUH. Prompt Engineer mengirim, tiap pesan:
//   BLOK 1  "Batasan: … | Tidak boleh menjalankan perintah OS | WAJIB memiliki evidence …"
//   BLOK 5  "Dilarang keras: ✗ Menggunakan pengetahuan di luar evidence yang terdaftar"
// dan "evidence" hanya berarti 8 baris Brain 1 + dokumen RAG. Kode sumber repo — kebenarannya
// sendiri — berada di LUAR daftar itu.
//
// Owner: *"itu lebih mirip memasang kacamata kuda, seperti menyembunyikan kebenaran."*
//
// ── Batas uji ini, disebut apa adanya ───────────────────────────────────────────────────────
// Ini memeriksa TEKS SUMBER, bukan perilaku. Modulnya tidak bisa diimpor Node (tipe di-re-export
// dari types.ts), dan mengubah kode produksi hanya demi uji bukan pertukaran yang baik di sini.
// Jadi yang dijamin uji ini hanya: kalimat kacamata kuda sudah tidak ada, dan penggantinya ada.
// Bahwa model benar-benar MENENGOK hanya bisa dibuktikan live — lihat INDEX §5b.

import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const S = readFileSync(`${AKAR}/supabase/functions/agent-process/lib/verification/universal_contract.ts`, 'utf8').replace(/\r\n/g, '\n');
// Komentar dibuang: berkas ini menjelaskan kalimat lama untuk menerangkan kenapa ia dibuang, dan
// uji yang membaca kutipan itu sebagai "masih dipakai" akan merah palsu (jebakan 28 Sep & 1 Okt).
const KODE = S.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-kacamata-kuda-engineer v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// Blok ENGINEER saja — perubahan ini tidak boleh merembet ke mode lain.
const iEng = KODE.indexOf("if (mode === 'ENGINEER')");
const iLite = KODE.indexOf("} else if (mode === 'LITE')");
cek(iEng > 0 && iLite > iEng, 'blok ENGINEER terbaca');
const ENG = KODE.slice(iEng, iLite);

// ── 1. Kacamata kudanya hilang ──────────────────────────────────────────────────────────────
console.log('\n-- kacamata kuda --');

cek(!/Tidak boleh menjalankan perintah OS/.test(ENG),
  'larangan "menjalankan perintah OS" tidak lagi dikirim ke Engineer', (ENG.match(/.*perintah OS.*/g) || []));
cek(!/Menggunakan pengetahuan di luar evidence yang terdaftar/.test(KODE),
  'larangan "pengetahuan di luar evidence yang terdaftar" dibuang — kalimat itu menutup repo',
  (KODE.match(/.*di luar evidence.*/g) || []));

// ── 2. Penggantinya ada, dan menyebut CARA-nya ──────────────────────────────────────────────
// Larangan yang dicabut tanpa pengganti hanya memindahkan kebingungan: model tahu ia boleh, tapi
// tidak tahu dengan apa.
console.log('\n-- mata yang diberikan --');

cek(/MEMBACA KODE SUMBER REPO/.test(ENG), 'membaca kode sumber jadi KAPABILITAS yang disebut');
cek(/MAMET_CMD/.test(ENG), 'disebutkan jalurnya — [MAMET_CMD: …]');
for (const p of ['git grep', 'git show', 'git log', 'git blame', 'git ls-files']) {
  cek(ENG.includes(p), `perintah \`${p}\` disebut namanya`);
}
cek(/tanpa menunggu persetujuan/.test(ENG),
  'disebut bahwa perintah baca jalan sendiri — kalau tidak, model tetap menunggu klik yang tak akan datang', ENG.slice(0, 200));

// ── 3. Kewajiban berbukti DIPERTAHANKAN ─────────────────────────────────────────────────────
// Ini yang paling mudah salah: melonggarkan kacamata kuda bukan berarti melonggarkan kewajiban
// berbukti. Aturan itu mahal diperoleh — ia yang mencegah "model mengarang tindakan" (Item 85 T3).
console.log('\n-- kewajiban berbukti tetap --');

cek(/WAJIB memiliki evidence sebelum menjawab/.test(ENG), 'kewajiban berbukti TIDAK dihapus');
cek(/MENENGOK repo lebih dulu/.test(ENG),
  'dan dijelaskan cara memenuhinya untuk pertanyaan kode', (ENG.match(/.*WAJIB memiliki evidence[^']*/g) || []));
cek(/Mengaku tahu isi kode tanpa menengoknya/.test(KODE),
  'mengaku tahu tanpa menengok tetap DILARANG KERAS');
cek(/tanpa pernah menjalankan satu pun pencarian di repo/.test(KODE),
  'menjawab "tidak ada evidence" tanpa mencari juga dilarang — itu persis kegagalan 1 Okt',
  (KODE.match(/.*tidak ada evidence.*/g) || []));
cek(/kode sumber repo TERMASUK evidence yang sah, asalkan alamat berkas dan nomor barisnya disebut/.test(KODE),
  'kode sumber diakui sebagai evidence, DENGAN syarat ketertelusuran');

// ── 4. Yang menjalankan KODE tetap minta izin ───────────────────────────────────────────────
// Garis yang sama dengan `tanpaPersetujuan()` di proses utama. Kalau prompt dan pelaksana berbeda
// pendapat, model akan mengusulkan yang ditolak atau menahan yang sebenarnya boleh.
console.log('\n-- garis yang sama dengan pelaksana --');

cek(/node -e, python -c, npm\) perlu persetujuan Owner/.test(ENG),
  'perintah yang menjalankan kode disebut butuh izin', (ENG.match(/.*perlu persetujuan.*/g) || []));
cek(/jangan mengaku sudah menjalankannya/.test(ENG),
  'dan dilarang mengaku sudah menjalankannya — pola yang pernah terjadi (Item 85 T3)');

// ── 5. Mode lain tidak ikut berubah ─────────────────────────────────────────────────────────
console.log('\n-- mode lain utuh --');
{
  const LAIN = KODE.slice(iLite);
  cek(/Tidak boleh membaca\/menulis User Memory/.test(LAIN), 'batasan LITE tidak tersentuh');
  cek(/Prioritaskan dokumen evidence yang tersedia sebagai rujukan utama/.test(LAIN), 'jalur Assistant tidak tersentuh');
  cek(/canUseWebSearch: mode !== 'ENGINEER'/.test(KODE), 'web search tetap mati untuk Engineer');
}

// ── 6. Masih benar-benar dirender ke prompt ─────────────────────────────────────────────────
// Kalimat yang tidak dirender tidak mengubah apa pun. Cacat ini pernah terjadi di tempat lain:
// konstitusi dibaca tiap boot lalu hanya dihitung jumlah berkasnya.
console.log('\n-- dirender ke prompt --');

cek(/text \+= `Kapabilitas: \$\{identity\.capabilities\.join\(', '\)\}/.test(KODE), 'kapabilitas dirender ke BLOK 1');
cek(/text \+= `Batasan: \$\{identity\.restrictions\.join\(' \| '\)\}/.test(KODE), 'batasan dirender ke BLOK 1');
cek(/for \(const f of constraint\.forbidden\)/.test(KODE), 'daftar larangan dirender ke BLOK 5');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
