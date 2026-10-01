/**
 * ProsedurEngineer.js — penjaga prosedur kerja Engineer (constitution/28_PROSEDUR_KERJA_ENGINEER.md), 2026-09-23.
 *
 * Aturan yang hanya ditulis di prompt akan dilanggar ketika model lupa. Tiga langkah prosedur yang bisa diperiksa
 * secara deterministik dijaga di sini, masing-masing lahir dari kegagalan live TUGAS-02 (23 September 2026):
 *
 *  [0.1] umumkan tugas + kutip kalimat sumbernya → diminta TUGAS-02, yang dikerjakan isi TUGAS-04;
 *  [0.3] baca berkas dengan `git show HEAD:<alamat>` → `git show <alamat>` kosong & keluar 0, dikira berkas hilang;
 *  [0.4] satu cara gagal → ganti cara            → perintah identik diulang dua kali, hasil sama-sama kosong.
 *
 * Semua fungsi murni (tanpa efek samping) supaya bisa diuji tanpa merender aplikasi.
 */

/** Perintah dianggap sama bila hanya berbeda spasi. Huruf besar/kecil TETAP dibedakan (alamat berkas peka huruf). */
export function bakukanPerintah(perintah) {
  return String(perintah ?? '').trim().replace(/\s+/g, ' ');
}

/** `git show <alamat>` tanpa revisi: git memperlakukan alamat sebagai penyaring commit → keluaran kosong, keluar 0. */
export function gitShowTanpaRevisi(perintah) {
  const p = bakukanPerintah(perintah);
  const m = /^git show (?:--\S+ )*([^\s]+)$/.exec(p);
  if (!m) return null;
  const arg = m[1];
  if (arg.includes(':') || /^[0-9a-f]{7,40}$/i.test(arg) || arg === 'HEAD') return null; // sudah menyebut revisi
  if (!/[./\\]/.test(arg)) return null;                                                  // bukan alamat berkas
  return arg;
}

/** Keluaran perintah kosong (hanya kaki "Kode keluar …"), bukan gagal. */
export function keluaranKosong(keluaran) {
  return /\(tanpa keluaran\)/.test(String(keluaran ?? ''));
}

/**
 * Petunjuk jujur setelah perintah berjalan tapi tidak menghasilkan apa-apa. TIDAK mengubah perintah Owner —
 * hanya memberi tahu bentuk yang benar, supaya model tidak menyimpulkan "berkasnya tidak ada".
 * @returns {string|null} teks tambahan untuk keluaran, atau null
 */
export function petunjukHasilKosong(perintah, keluaran) {
  if (!keluaranKosong(keluaran)) return null;
  const alamat = gitShowTanpaRevisi(perintah);
  if (!alamat) return null;
  return `PETUNJUK SISTEM: "git show ${alamat}" tanpa revisi TIDAK menampilkan isi berkas — git membacanya sebagai penyaring commit, jadi kosong itu normal dan BUKAN tanda berkas hilang. Untuk melihat isinya: git show HEAD:${alamat}`;
}

/**
 * Catatan akar repo untuk model — disisipkan ke tiap kiriman Engineer.
 *
 * Kejadian live 2026-09-28: model menulis *"Keduanya dijalankan dari direktori kerja yang berbeda"*
 * lalu mengarang perintah `python` untuk menelusuri filesystem mencari berkas yang **alamatnya sudah
 * ia ketahui**. Perintahnya memang dijalankan dengan `cwd = akarRepo()`, tetapi tidak ada satu pun
 * tempat yang memberitahukan itu kepadanya — jadi ia menebak, dan menebak ke arah yang salah.
 *
 * Sebelum Tahap 5 catatan ini mustahil ditulis: akarnya sendiri tidak pasti. Sesudah Owner memilih
 * folder repo, akarnya eksplisit dan tinggal disebutkan.
 *
 * @param {string} akar alamat absolut akar repo, atau kosong bila belum dipilih / bukan desktop
 * @returns {string} blok catatan, atau string kosong bila tidak ada yang bisa disebutkan
 */
export function catatanAkarRepo(akar) {
  const alamat = String(akar || '').trim();
  if (!alamat) return '';
  return [
    '[AKAR REPO ENGINEER]',
    `Seluruh perintah [MAMET_CMD: …] dijalankan dengan direktori kerja: ${alamat}`,
    'Anda SUDAH berada di akar repo. Pakai alamat RELATIF terhadap folder itu',
    '(mis. frontend/src/core/runtime/Kernel.js), bukan alamat absolut.',
    'JANGAN menelusuri filesystem untuk mencari letak berkas — untuk menemukannya pakai',
    'git ls-files (daftar berkas) atau git grep -n (cari isi), keduanya sudah diizinkan.',
  ].join('\n');
}

/**
 * Peta repo: daftar berkas kode beserta jumlah barisnya.
 *
 * ── Kenapa ada, diukur 1 Oktober 2026 ───────────────────────────────────────────────────────
 * Komposisi satu permintaan Engineer nyata: aturan & identitas 21.756 huruf (62% prompt), RAG
 * dokumen tugas 6.566, riwayat percakapan 4.807 — dan riwayat itulah SATU-SATUNYA tempat kode
 * sumber bisa muncul. Artinya Engineer menerima ±5.400 token aturan dan ±1.200 token kode, tanpa
 * satu pun blok khusus untuk kode.
 *
 * Owner: *"di mana Engineer yang seharusnya tahu kode sumber Mamet?"* Jawabannya saat itu: belum
 * ada. Yang ada Engineer yang bisa **mencari** potongan, bukan yang **tahu apa yang ada**.
 *
 * ── Kenapa jumlah barisnya ikut ────────────────────────────────────────────────────────────
 * Bukan hiasan. Keluaran perintah dipotong pada 20 KB, jadi `git show` pada berkas besar terpotong
 * DIAM-DIAM. Dengan tahu `ConversationEngine.jsx` 2.195 baris, model bisa memilih `git grep` sejak
 * awal — bukan mencoba membaca utuh lalu gagal tanpa tahu sebabnya (live 28 September).
 *
 * ── Harga ───────────────────────────────────────────────────────────────────────────────────
 * 270 berkas, 15.494 huruf (±3.870 token) — lebih kecil daripada blok aturan yang sudah ada, dan
 * anggaran konteks 60.000 token baru terpakai ±10.000.
 *
 * @param {string} peta keluaran `git grep -c ""`, bentuk "berkas:jumlah_baris" per baris
 * @returns {string} blok catatan, atau kosong bila peta tidak ada
 */
export function catatanPetaRepo(peta) {
  const isi = String(peta || '').trim();
  if (!isi) return '';
  const baris = isi.split('\n').filter(Boolean);
  return [
    '[PETA REPO — SELURUH BERKAS KODE, dengan jumlah barisnya]',
    `${baris.length} berkas. Bentuk tiap baris: alamat:jumlah_baris`,
    'Ini daftar LENGKAP kode aplikasi — bila sebuah berkas tidak ada di sini, ia memang tidak ada.',
    'JANGAN mencari letak berkas; alamatnya sudah di bawah ini. Yang perlu dicari hanya ISInya.',
    'Berkas besar (>400 baris) TIDAK muat lewat `git show` (keluaran dipotong 20 KB) — pakai',
    '`git grep -n -B2 -A4 <kata>` atau `git blame -L <awal>,<akhir> -- <alamat>`.',
    '',
    isi,
  ].join('\n');
}

/** `git show HEAD:<alamat>` / `git show <sha>:<alamat>` — pembacaan berkas utuh, satu-satunya yang bisa terpotong diam-diam. */
const POLA_BACA_UTUH = /^git\s+show\s+[^\s:]*:(\S+)\s*$/i;

/**
 * Keluaran terpotong pada pembacaan berkas utuh → beri jalan keluarnya, bukan sekadar menandai.
 *
 * Kejadian nyata 2026-09-28: TMN-0001 menunjuk komentar di `engineer.js` sekitar baris 1035. Engineer
 * menjalankan `git show HEAD:…`, menerima 20 KB pertama dari 47.767 bita, TAHU keluarannya terpotong —
 * ia menuliskannya sendiri — lalu mengarang perintah `python` untuk menelusuri filesystem mencari berkas
 * yang alamatnya sudah ia ketahui. Yang kurang bukan kesadaran, melainkan **jalan keluarnya**:
 * `git grep` dan `git blame` sudah diizinkan sejak lama, hanya tidak pernah disebutkan kepadanya.
 *
 * Sejalan dengan `petunjukHasilKosong`: saat sistem tahu bentuk perintahnya yang keliru, ia menyebut
 * bentuk yang benar — bukan membiarkan model menebak.
 *
 * @param {string} perintah perintah yang dijalankan
 * @param {{terpotong?: boolean, byteKeluaran?: number}} hasil hasil dari penjalan perintah
 * @returns {string|null} petunjuk untuk model, atau null bila tidak berlaku
 */
export function petunjukKeluaranTerpotong(perintah, hasil) {
  if (!hasil?.terpotong) return null;
  const cocok = POLA_BACA_UTUH.exec(String(perintah || '').trim());
  if (!cocok) return null;
  const alamat = cocok[1];
  const ukuran = Number(hasil.byteKeluaran) || 0;
  return [
    `PETUNJUK SISTEM: keluaran terpotong — berkas "${alamat}"${ukuran ? ` berukuran ${ukuran.toLocaleString('id-ID')} bita` : ''} dan hanya bagian AWALNYA yang sampai kepada Anda.`,
    'JANGAN mengulang pembacaan utuh dan jangan mencari jalan lain di luar git. Pakai dua langkah ini (keduanya sudah diizinkan):',
    `1. Cari sekaligus baca sekitarnya: git grep -n -B2 -A4 "<pola>" -- ${alamat}`,
    `2. Baca rentang baris tertentu: git blame -L <awal>,<akhir> -- ${alamat}`,
    'Keduanya mengembalikan nomor baris, dan ratusan kali lebih kecil daripada berkas utuh.',
  ].join('\n');
}

/**
 * Penjaga langkah [0.4]: perintah yang sama persis sudah pernah dijalankan pada percakapan ini.
 * Mengulangnya tidak akan memberi hasil berbeda, jadi perintahnya tidak dijalankan lagi.
 *
 * @param {string} perintah perintah yang akan dijalankan
 * @param {Array<{perintah: string, keluaran: string}>} riwayat perintah yang sudah dijalankan di chat ini
 * @returns {{ulang: boolean, pesan: string|null}}
 */
export function cekPerintahBerulang(perintah, riwayat = []) {
  const baku = bakukanPerintah(perintah);
  if (!baku) return { ulang: false, pesan: null };
  const sebelumnya = (riwayat || []).find((r) => bakukanPerintah(r?.perintah) === baku);
  if (!sebelumnya) return { ulang: false, pesan: null };

  const kosong = keluaranKosong(sebelumnya.keluaran);
  const petunjuk = petunjukHasilKosong(baku, sebelumnya.keluaran);
  return {
    ulang: true,
    pesan: [
      `TIDAK DIJALANKAN: perintah yang sama persis sudah dijalankan pada percakapan ini dan hasilnya ${kosong ? 'kosong' : 'sudah Anda terima'}.`,
      'Mengulangi perintah yang identik tidak akan memberi hasil berbeda (prosedur kerja Engineer langkah 0.4: satu cara gagal → ganti cara). Ubah bentuk perintahnya, ubah sumber buktinya, atau katakan terus terang bahwa buktinya tidak bisa Anda dapatkan.',
      petunjuk,
    ].filter(Boolean).join('\n\n'),
  };
}

/** Riwayat perintah dari pesan chat: pesan hasil berbentuk "[TERMINAL OUTPUT for: <perintah>]\n<keluaran>". */
export function riwayatPerintahDariPesan(pesan = []) {
  const hasil = [];
  for (const m of pesan || []) {
    const isi = String(m?.content ?? '');
    const m1 = /^\[TERMINAL OUTPUT for: ([\s\S]*?)\]\n([\s\S]*)$/.exec(isi);
    if (m1) hasil.push({ perintah: m1[1], keluaran: m1[2] });
  }
  return hasil;
}

// PENANDA PATCH sebagai SINYAL, bukan sebutan (live 2026-09-23 TUGAS-04): Engineer menulis kalimat
// "ini analisis, bukan permintaan patch — jadi saya tidak menandai `[MAMET_PATCH_READY]`", dan jalur patch tetap
// dimulai karena penanda dicari dengan includes() di mana saja. Akibatnya tugas ANALISIS masuk ke pipeline patch,
// lalu gagal ("Provider returned empty response"), dan penandanya dibuang dari kalimat sehingga tersisa "saya tidak
// menandai ``". Penanda hanya dihitung bila BERDIRI SENDIRI di satu baris, di luar blok kode dan di luar <think>.
const PENANDA_PATCH = '[MAMET_PATCH_READY]';
const POLA_PENANDA_BARIS = /^[ \t>*-]*\[MAMET_PATCH_READY\][ \t]*$/m;

const tanpaKodeDanNalar = (teks) => String(teks ?? '')
  .replace(/<think>[\s\S]*?<\/think>/gi, '')
  .replace(/```[\s\S]*?```/g, '')
  .replace(/`[^`\n]*`/g, '');

/** Apakah jawaban benar-benar MENANDAI patch siap (bukan sekadar menyebut penandanya)? */
export function adaPenandaPatch(teks) {
  return POLA_PENANDA_BARIS.test(tanpaKodeDanNalar(teks));
}

/** Buang HANYA baris penanda; sebutan di dalam kalimat/backtick dibiarkan utuh agar kalimatnya tidak rusak. */
export function buangPenandaPatch(teks) {
  const t = String(teks ?? '');
  if (!adaPenandaPatch(t)) return t;
  return t.split('\n').filter((b) => !POLA_PENANDA_BARIS.test(b)).join('\n').trim();
}

const POLA_MINTA_TUGAS = /\bTUGAS[-\s]?\d+/i;
// Baris wajib: TUGAS YANG DIKERJAKAN: <id> — "<kutipan kalimat sumber>" (kutip lurus atau melengkung).
// Isi kutipan BOLEH memuat backtick: kalimat dokumen sering menyebut nama fungsi/berkas dalam backtick, dan versi
// pertama pola ini menolaknya sehingga pengumuman yang sah dikira tidak ada (live 2026-09-23 09:00:
// `TUGAS YANG DIKERJAKAN: TASK-0014 — "Baca \`detectIntent\`, lalu jelaskan …"` tidak terdeteksi).
const POLA_UMUMKAN = /TUGAS YANG DIKERJAKAN\s*:[^\n]*?["“]([^"“”\n]{15,})["”]/i;

/**
 * Penjaga langkah [0.1]: pengguna meminta tugas bernama, jawaban Engineer wajib menyebut tugas yang dikerjakan
 * beserta KUTIPAN kalimat sumbernya. Peringatan ini hanya dipasang bila pengguna benar-benar menyebut "TUGAS-xx",
 * jadi obrolan biasa tak pernah kena. Isinya selalu benar saat dipasang: barisnya memang tidak ada.
 *
 * @param {string} pesanPengguna pesan yang dijawab
 * @param {string} jawaban jawaban Engineer
 * @returns {string|null}
 */
export function peringatanTugasTakDiumumkan(pesanPengguna, jawaban) {
  const p = String(pesanPengguna ?? '');
  if (!POLA_MINTA_TUGAS.test(p)) return null;
  if (/^\[TERMINAL OUTPUT for: /.test(p)) return null; // putaran lanjutan, bukan permintaan tugas baru

  // MENOLAK BUKAN PELANGGARAN. Bila Engineer justru berhenti karena tugasnya tidak ada di sumbernya, itu langkah 0.1
  // yang dijalankan dengan BENAR — menuntut baris pengumuman di situ adalah peringatan palsu.
  // Live 2026-09-23 10:40 (deepseek-v4-pro): TUGAS-04 belum terunggah, Engineer mendaftar dokumen yang ia punya,
  // menolak mengerjakan tugas terdekat, dan melabeli jawabannya INSUFFICIENT — lalu tetap kena peringatan.
  // Risiko yang saya terima sadar: model bisa "kabur" dari penjaga dengan mengaku tugasnya tak ditemukan. Klaim itu
  // terlihat Owner di layar dan label INSUFFICIENT diperiksa sistem label server, jadi bukan jalan sunyi.
  const t0 = String(jawaban ?? '');
  if (/\[STATUS:\s*INSUFFICIENT/i.test(t0)) return null;
  if (/tidak ada di sumber|tidak ditemukan di (?:sumber|dokumen)|tidak ada di dokumen|belum (?:ter)?unggah|tidak tersedia di konteks/i.test(t0)) return null;
  const t = String(jawaban ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  const diminta = (POLA_MINTA_TUGAS.exec(p) || [''])[0].toUpperCase().replace(/\s/, '-');
  const umumkan = POLA_UMUMKAN.exec(t);

  if (!umumkan) {
    return `⚠️ **Peringatan sistem:** jawaban di atas tidak mengumumkan tugas yang dikerjakan beserta kutipan kalimat sumbernya, padahal prosedur kerja Engineer langkah 0.1 mewajibkannya — baris \`TUGAS YANG DIKERJAKAN: ${diminta} — "<kutipan kalimat dari dokumen>"\` tidak ada. Tanpa kutipan itu, tidak ada cara memastikan Engineer mengerjakan tugas yang benar (23 September 2026: diminta TUGAS-02, yang dikerjakan isi TUGAS-04). Minta Engineer mengumumkan tugasnya lebih dulu sebelum menerima hasil di atas.`;
  }

  // Pengumumannya ada, tapi tugas yang disebut harus tugas yang DIMINTA. Live 2026-09-23 01:53: diminta TUGAS-02,
  // yang diumumkan "TASK-0014" (nomor tugas internal Brain 2) dengan kutipan milik TUGAS-04 — format benar, isi salah.
  const barisUmumkan = umumkan[0];
  const nomorDiminta = (/\d+/.exec(diminta) || [''])[0];
  const cocok = new RegExp(`TUGAS[-\\s]?0*${nomorDiminta}\\b`, 'i').test(barisUmumkan);
  if (cocok) return null;

  const disebut = barisUmumkan.split(/[-—:]/).slice(1).join(' ').trim().slice(0, 60);
  return `⚠️ **Peringatan sistem:** pengguna meminta **${diminta}**, tetapi jawaban di atas mengumumkan tugas lain (\`${disebut}…\`). Prosedur kerja Engineer langkah 0.1: tugas yang diumumkan harus tugas yang diminta, dengan kutipan kalimat dari bagian dokumen tugas itu. Periksa dulu apakah Engineer mengerjakan tugas yang benar sebelum menerima hasil di atas.`;
}
