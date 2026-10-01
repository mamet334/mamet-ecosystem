// UJI 2026-10-02 — Engineer bisa MENAMBAH pengetahuan ke Brain 1, bukan hanya membacanya.
//
// ── Yang diukur lebih dulu, bukan ditebak ───────────────────────────────────────────────────
// `project_memory_entries` — blok yang dikirim ke model dengan judul "BRAIN 1 — STATIC ENGINEERING
// KNOWLEDGE … Source of truth for architecture & rules" — ternyata:
//   · 15 baris, SEMUANYA dibuat 27 Juni 2026, lalu berhenti selamanya;
//   · nol jalur tulis di seluruh repo (hanya dibaca engineer_context.ts, dicadangkan cadanganData.js);
//   · memuat duplikat (ADR-0007 ×2, "Engineer Dashboard" ×2) dan klaim yang sudah salah
//     ("Created EngineerDashboard.jsx" — berkasnya tidak ada).
//
// Akibatnya 3 dari 8 slot yang dibaca Engineer terpakai duplikat/klaim basi, sehingga 2 entri yang
// sahih TIDAK PERNAH sampai ke model. Dibersihkan 2 Okt (dinonaktifkan, bukan dihapus) → 7 entri
// unik, semuanya muat.
//
// Owner: *"engineer belum bisa menulis agar bisa semakin pintar terhadap pengetahuan mamet
// ecosystem, yaitu penulisan untuk project memory entries."*

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const P = await import(pathToFileURL(`${AKAR}/frontend/src/core/runtime/services/engineer/PengetahuanBrain1.js`).href + '?v=' + Date.now());
const { ambilBlokPengetahuan, pengetahuanBaru, barisBrain1, JENIS, JENIS_BAWAAN } = P;

console.log('uji-pengetahuan-brain1 v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. Blok yang benar terbaca ──────────────────────────────────────────────────────────────
console.log('\n-- blok yang benar --');
{
  const jawaban = `Sudah saya periksa.

<pengetahuan jenis="RootCause" judul="rapikanRiwayat memangkas sisipan yang dipatok">
Sisipan ada di depan riwayat, dan aturan "dua terakhir utuh" memperlakukannya sebagai pesan
paling lama. Terbukti: [Riwayat] 5 pesan, 17311 -> 2065 huruf.
</pengetahuan>

Selesai.`;
  const { pengetahuan, dilewati } = ambilBlokPengetahuan(jawaban);
  cek(pengetahuan.length === 1, 'satu blok terbaca', pengetahuan.length);
  cek(pengetahuan[0].jenis === 'RootCause', 'jenis terbaca apa adanya');
  cek(pengetahuan[0].judul === 'rapikanRiwayat memangkas sisipan yang dipatok', 'judul terbaca');
  cek(/17311 -> 2065/.test(pengetahuan[0].isi), 'isinya utuh, termasuk angkanya');
  cek(dilewati.length === 0, 'tidak ada yang dilewati');
}

// ── 2. Prosa TIDAK ditangkap ────────────────────────────────────────────────────────────────
// Prinsip yang sama dengan <temuan> dan <uji_klaim>: lebih baik terlewat dan TERLIHAT terlewat,
// daripada tertangkap salah lalu tersimpan sebagai sumber kebenaran. Tiga kali sistem ini tertipu
// karena menebak maksud dari teks bebas.
console.log('\n-- prosa tidak ditangkap --');
{
  const prosa = 'Pelajaran penting: jangan pernah membuang penanda internal sebelum dikirim ke server.';
  cek(ambilBlokPengetahuan(prosa).pengetahuan.length === 0, 'kalimat yang terdengar seperti pelajaran TIDAK disimpan');
  cek(ambilBlokPengetahuan('').pengetahuan.length === 0, 'teks kosong aman');
  cek(ambilBlokPengetahuan(null).pengetahuan.length === 0, 'null aman');
}

// ── 3. Blok cacat DILEWATI, tetapi DILAPORKAN ───────────────────────────────────────────────
// Membuang diam-diam = pengetahuan yang dimaksudkan model hilang tanpa seorang pun tahu. Itu
// bentuk cacat yang sama dengan yang dikejar 1 Okt (peta hilang tanpa tanda).
console.log('\n-- blok cacat dilaporkan --');
{
  const a = ambilBlokPengetahuan('<pengetahuan jenis="Lesson">tanpa judul</pengetahuan>');
  cek(a.pengetahuan.length === 0 && a.dilewati.length === 1, 'tanpa judul → dilewati');
  cek(/judul/.test(a.dilewati[0].alasan), 'alasannya disebut, bukan diam', a.dilewati);

  const b = ambilBlokPengetahuan('<pengetahuan jenis="Lesson" judul="Ada judul">   </pengetahuan>');
  cek(b.pengetahuan.length === 0 && b.dilewati.length === 1, 'isi kosong → dilewati');
  cek(/kosong/.test(b.dilewati[0].alasan), 'alasannya disebut');
}

// ── 4. Jenis dinormalkan, BUKAN ditolak ─────────────────────────────────────────────────────
// Alasan sama dengan TINGKAT di IngatanTemuan: menolak gara-gara satu atribut salah ketik berarti
// membuang isinya. Dan hanya empat jenis ini yang BENAR-BENAR dibaca engineer_context.ts.
console.log('\n-- jenis dinormalkan --');
{
  const uji = (nilai) => ambilBlokPengetahuan(`<pengetahuan jenis="${nilai}" judul="J">isi</pengetahuan>`).pengetahuan[0].jenis;
  cek(uji('lesson') === 'Lesson', 'huruf kecil dinormalkan');
  cek(uji('ROOTCAUSE') === 'RootCause', 'huruf besar dinormalkan');
  cek(uji('catatan') === JENIS_BAWAAN, `jenis tak dikenal → ${JENIS_BAWAAN}, isinya tidak dibuang`);
  cek(ambilBlokPengetahuan('<pengetahuan judul="J">isi</pengetahuan>').pengetahuan[0].jenis === JENIS_BAWAAN,
    'tanpa atribut jenis pun tetap tersimpan');
  cek(JENIS.join(',') === 'ADRLink,Solution,Lesson,RootCause',
    'keempat jenis PERSIS yang disaring engineer_context.ts', JENIS);
}

// ── 5. Duplikat disaring ────────────────────────────────────────────────────────────────────
// Bukan kerugian teoretis: duplikat terbukti memakan 3 dari 8 slot Brain 1 sebelum 2 Okt.
console.log('\n-- duplikat disaring --');
{
  const calon = [
    { jenis: 'Lesson', judul: 'ADR-0007', isi: 'a' },
    { jenis: 'Lesson', judul: 'adr-0007 ', isi: 'b' },   // kembar di dalam satu jawaban
    { jenis: 'Lesson', judul: 'Hal baru', isi: 'c' },
  ];
  const hasil = pengetahuanBaru(['ADR-0007'], calon);
  cek(hasil.length === 1 && hasil[0].judul === 'Hal baru', 'judul yang sudah ada & kembar dibuang', hasil.map((h) => h.judul));
  cek(pengetahuanBaru([], calon).length === 2, 'tanpa judul tersimpan, kembar di dalam jawaban tetap disaring');
  cek(pengetahuanBaru(null, null).length === 0, 'argumen kosong aman');
}

// ── 6. Baris yang ditulis ke database ───────────────────────────────────────────────────────
console.log('\n-- baris database --');
{
  const b = barisBrain1({ jenis: 'Lesson', judul: 'J', isi: 'I' }, 'uid-123');
  for (const k of ['entry_type', 'title', 'content', 'user_id']) {
    cek(b[k] !== undefined && b[k] !== null && b[k] !== '', `kolom WAJIB ${k} terisi`, b);
  }
  cek(b.entry_type === 'Lesson' && b.title === 'J' && b.content === 'I' && b.user_id === 'uid-123', 'isinya dipetakan benar', b);
  cek(b.governance_status === 'ACTIVE' && b.is_current === true,
    'lolos saringan pembaca Engineer (is_current + governance_status)', b);
  cek(b.status === 'Hypothesis', 'ditandai Hypothesis — pengetahuan baru belum terbukti');
  cek(b.created_by === 'engineer', "created_by membedakannya dari seed 27 Juni yang bernilai 'system'");
  cek(!!b.approved_by && !!b.approved_at, 'persetujuan Owner tercatat — kliknya yang jadi izin');
}

// ── 7. TERPASANG di layar ───────────────────────────────────────────────────────────────────
// Modul benar tapi tak terpanggil = tak ada yang berubah. Itu persis nasib konstitusi di Brain 1
// (engineer.js:316 memuat 32 berkas dan hanya memakai JUMLAHNYA).
console.log('\n-- terpasang di layar --');
{
  const CE = readFileSync(`${AKAR}/frontend/src/components/workbench/ConversationEngine.jsx`, 'utf8').replace(/\r\n/g, '\n');
  const KODE = CE.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

  cek(/import \{ ambilBlokPengetahuan, pengetahuanBaru, barisBrain1 \}/.test(KODE), 'modul diimpor');
  cek(/const pengetahuanBelumSimpan = useMemo\(/.test(KODE), 'diturunkan dari daftar pesan, bukan useState');
  cek(/onClick=\{simpanPengetahuan\}/.test(KODE), 'tombol memanggil penyimpan');
  cek(/from\('project_memory_entries'\)\.insert\(/.test(KODE), 'benar-benar menulis ke project_memory_entries');
  cek(/\.select\('title'\)\.eq\('user_id', uid\)/.test(KODE),
    'judul dibaca ULANG dari database sebelum menulis — mencegah duplikat dari perangkat lain');
  cek(/isEngineerWorkspace && pengetahuanBelumSimpan\.length > 0/.test(KODE), 'tombol hanya di Engineer & hanya bila ada isinya');

  // Ikon WAJIB ada di subset font; nama di luar subset tampil sebagai tulisan mentah (3× terjadi).
  const subset = new Set(readFileSync(`${AKAR}/frontend/src/assets/fonts/daftar-ikon.txt`, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
  // Dipotong sampai </button>, bukan dengan batas panjang yang ditebak: atribut `title` tombol ini
  // panjang, dan versi pertama uji ini memakai 500 huruf lalu merah palsu karena ikonnya di luar
  // jendela. Jebakan yang sama dengan asersi "tiap putaran membawa signal" (1 Okt).
  const i = KODE.indexOf('onClick={simpanPengetahuan}');
  const tutup = KODE.indexOf('</button>', i);
  const ikon = (KODE.slice(i, tutup > 0 ? tutup : i + 1200).match(/material-symbols-outlined[^>]*>\s*([a-z0-9_]+)\s*</) || [])[1];
  cek(!!ikon && subset.has(ikon), `ikon tombol ("${ikon}") ada di subset font`);
}

// ── 8. Model DIBERI TAHU kemampuannya ───────────────────────────────────────────────────────
// Pelajaran termahal 1 Okt: kemampuan yang tidak disebut di prompt tidak akan pernah dipakai.
// Engineer punya git grep berminggu-minggu sambil dilarang memakainya, dan diam saja.
console.log('\n-- model diberi tahu --');
{
  const EC = readFileSync(`${AKAR}/supabase/functions/agent-process/lib/rag/engineer_context.ts`, 'utf8');
  cek(/<pengetahuan jenis="Lesson\|RootCause\|Solution\|ADRLink" judul=/.test(EC), 'bentuk bloknya diajarkan');
  cek(/judul attribute is mandatory and must be unique/.test(EC), 'syarat judul unik disebut');
  // Berkas ini satu template literal raksasa: satu backtick di dalam teks instruksi MENUTUPNYA dan
  // menggagalkan deploy. Terjadi hari ini juga — versi pertama menulis judul di antara backtick,
  // dan esbuild menolak dengan 'Expected ";" but found "judul"'. Ditangkap sebelum minta deploy.
  cek(!/Rules: `/.test(EC), 'tidak ada backtick di dalam teks instruksi', (EC.match(/.*Rules: `.*/g) || []));
  cek(/Do NOT record session or patch numbers/.test(EC),
    'dilarang mencatat nomor sesi/patch — kesalahan yang baru dibuang 1 Okt');
  cek(/Do NOT record what git already answers/.test(EC), 'dilarang menyalin yang sudah dijawab git');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
