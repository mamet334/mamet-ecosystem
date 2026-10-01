/**
 * PengetahuanBrain1.js — Engineer akhirnya bisa MENAMBAH pengetahuan, bukan hanya membacanya.
 *
 * MASALAH (diukur 2 Oktober 2026). `project_memory_entries` — blok yang dikirim ke model dengan judul
 * "BRAIN 1 — STATIC ENGINEERING KNOWLEDGE … Source of truth for architecture & rules" — ternyata:
 *   · berisi 15 baris, SEMUANYA dibuat 27 Juni 2026, lalu berhenti;
 *   · tidak punya satu pun jalur tulis di seluruh repo (hanya dibaca `engineer_context.ts` dan
 *     dicadangkan `cadanganData.js`);
 *   · memuat duplikat (ADR-0007 dua kali, "Engineer Dashboard" dua kali) dan klaim yang sudah salah
 *     ("Created EngineerDashboard.jsx" — berkasnya tidak ada).
 *
 * Jadi tiga bulan kerja rekayasa tidak menambah apa pun, dan 3 dari 8 slot yang dibaca Engineer
 * terpakai oleh duplikat/klaim basi sehingga 2 entri yang sahih tidak pernah sampai ke model.
 *
 * Owner: *"engineer belum bisa menulis agar bisa semakin pintar terhadap pengetahuan mamet
 * ecosystem, yaitu penulisan untuk project memory entries."*
 *
 * ── KENAPA DI DATABASE, PADAHAL TEMUAN DI BERKAS REPO ───────────────────────────────────────
 * `IngatanTemuan.js` sengaja memilih berkas di dalam repo: Owner bisa mengoreksi, ikut ter-commit,
 * selamat walau database dibersihkan. Brain 1 TIDAK BISA begitu — ia dibaca edge function, dan edge
 * function tidak punya akses ke repo. Jadi keduanya memang beda rumah, dan rumah yang di database
 * inilah yang baru saja terbukti bisa membusuk diam-diam selama tiga bulan tanpa ada yang tahu.
 * Karena itu bentuknya dibuat sesempit mungkin dan selalu lewat persetujuan Owner.
 *
 * ── BENTUK EKSPLISIT, BUKAN TEBAKAN DARI PROSA ──────────────────────────────────────────────
 * Sama seperti `<temuan>` (Tahap 3b) dan `<uji_klaim>` (Tahap 2): pengetahuan HARUS ditulis dalam
 * blok `<pengetahuan>`. Prosa yang terdengar seperti pelajaran sengaja TIDAK ditangkap — lebih baik
 * terlewat dan terlihat terlewat, daripada tertangkap salah lalu tersimpan sebagai sumber kebenaran.
 * Tiga kali sistem ini tertipu karena menebak maksud dari teks bebas.
 */

/** Jenis yang BENAR-BENAR dibaca Engineer (`engineer_context.ts` menyaring tepat keempat ini). */
export const JENIS = ['ADRLink', 'Solution', 'Lesson', 'RootCause'];

/**
 * Jenis bawaan untuk nilai yang tidak dikenali. Dinormalkan, BUKAN ditolak — alasan yang sama dengan
 * `TINGKAT` di IngatanTemuan: menolak gara-gara satu atribut salah ketik berarti membuang isinya.
 */
export const JENIS_BAWAAN = 'Lesson';

const POLA_BLOK = /<pengetahuan\b([^>]*)>([\s\S]*?)<\/pengetahuan>/g;
const POLA_ATRIBUT = /([a-z]+)\s*=\s*"([^"]*)"/g;

const rapikan = (s) => String(s ?? '').replace(/\r\n/g, '\n').trim();

/** Cocokkan tanpa memandang besar-kecil huruf; model sering menulis "lesson" atau "ROOTCAUSE". */
function normalkanJenis(nilai) {
  const n = rapikan(nilai).toLowerCase();
  return JENIS.find((j) => j.toLowerCase() === n) || JENIS_BAWAAN;
}

/**
 * Ambil blok `<pengetahuan jenis="Lesson" judul="…">isi</pengetahuan>` dari satu jawaban.
 *
 * `dilewati` dikembalikan APA ADANYA, bukan dibuang diam-diam: blok tanpa judul atau tanpa isi
 * adalah kesalahan model yang harus terlihat Owner. Diam di sini akan membuat pengetahuan yang
 * dimaksudkan hilang tanpa seorang pun tahu — persis cacat yang kita kejar seharian.
 */
export function ambilBlokPengetahuan(teks) {
  const isi = rapikan(teks);
  const pengetahuan = [];
  const dilewati = [];
  if (!isi) return { pengetahuan, dilewati };

  for (const m of isi.matchAll(POLA_BLOK)) {
    const atribut = {};
    for (const a of String(m[1] || '').matchAll(POLA_ATRIBUT)) atribut[a[1]] = a[2];

    const judul = rapikan(atribut.judul);
    const konten = rapikan(m[2]);

    if (!judul) { dilewati.push({ alasan: 'tanpa atribut judul', potongan: konten.slice(0, 80) }); continue; }
    if (!konten) { dilewati.push({ alasan: 'isinya kosong', potongan: judul.slice(0, 80) }); continue; }

    pengetahuan.push({ jenis: normalkanJenis(atribut.jenis), judul, isi: konten });
  }
  return { pengetahuan, dilewati };
}

/** Judul dibandingkan tanpa memandang spasi & besar-kecil huruf — "ADR-0007" vs "adr-0007 " itu sama. */
const kunci = (j) => rapikan(j).toLowerCase().replace(/\s+/g, ' ');

/**
 * Buang yang judulnya sudah ada di Brain 1, dan yang kembar di dalam satu jawaban.
 * Dipanggil tepat sebelum menulis, dengan judul yang DIBACA ULANG dari database — bukan dari salinan
 * lama di layar, karena Brain 1 bisa berubah dari perangkat lain.
 */
export function pengetahuanBaru(judulTersimpan, calon) {
  const ada = new Set((judulTersimpan || []).map(kunci));
  const hasil = [];
  for (const p of calon || []) {
    const k = kunci(p.judul);
    if (ada.has(k)) continue;
    ada.add(k);
    hasil.push(p);
  }
  return hasil;
}

/**
 * Bentuk baris untuk `project_memory_entries`.
 *
 * Kolom yang WAJIB diisi: entry_type, title, content, user_id. Sisanya punya nilai bawaan.
 * Yang disetel di sini sengaja hanya yang bermakna:
 *   · `status: 'Hypothesis'` — pengetahuan baru belum terverifikasi; itu nilai bawaan tabelnya juga,
 *     ditulis eksplisit supaya terbaca orang yang membaca kode ini.
 *   · `created_by: 'engineer'` — membedakannya dari 15 baris seed 27 Juni yang bernilai 'system'.
 *   · `approved_by`/`approved_at` — Owner menekan tombolnya; itu persetujuan, dan layak tercatat.
 */
export function barisBrain1(p, userId) {
  return {
    entry_type: p.jenis,
    title: p.judul,
    content: p.isi,
    user_id: userId,
    status: 'Hypothesis',
    governance_status: 'ACTIVE',
    is_current: true,
    created_by: 'engineer',
    approved_by: userId,
    approved_at: new Date().toISOString(),
  };
}
