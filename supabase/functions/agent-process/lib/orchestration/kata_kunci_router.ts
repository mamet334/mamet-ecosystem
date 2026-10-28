/**
 * KATA KUNCI AKSI INTENT ROUTER — dicocokkan sebagai KATA, bukan potongan (Item 126 Fase 1, 2026-10-28).
 *
 * Dulu `actionKeywords.some(kw => lowerMsg.includes(kw))`: potongan kata. Mode bayangan atas 482 pesan Owner
 * (hanya agregat dihitung di database) menunjukkan salah picu yang tak bisa dibela: `cto` 36× (0 sebagai kata),
 * `send` 27× ("sendiri"), `api` 37× → 16 ("tapi", "rapi"), `kapan` 23× → 3 ("kelengkapan"), `yt` 16× → 0 ("python").
 * Tiap salah picu mengirim pesan biasa ke Coordinator & sub-agent.
 *
 * Kata utuh saja melewatkan kata kerja berimbuhan yang sah ("mencari", "membaca": `cari` 34 → 22, `baca` 43 → 27).
 * Pola imbuhan generik juga diukur dan DITOLAK: ia menangkap pasif "ditemukan"/"dimasukkan" (bukan perintah) dan
 * tetap gagal pada peluluhan ("kirim" → "mengirim"). Maka kata kerja perintah memakai daftar BENTUK EKSPLISIT —
 * bisa dibaca, diuji, dan ditambah satu per satu.
 *
 * Kata tanya (siapa, mengapa, bagaimana, kapan, dimana, apakah) DIBUANG dari daftar: 41 pesan tersangkut hanya
 * karenanya. Pertanyaan biasa tetap bisa sampai ke sub-agent lewat LLM pengklasifikasi di intent_router.ts.
 *
 * ADR-0021 langkah 1: aturan yang bisa ditulis dan diuji dengan kode → kode.
 * Modul ini murni (tanpa Deno/rctx) supaya uji bisa memuatnya langsung: uji/uji-kata-kunci-router.mjs.
 */

/** Kata & frasa yang menandai butuh aksi — dicocokkan sebagai kata utuh. */
export const KATA_KUNCI_AKSI: readonly string[] = [
  'jadwal', 'cron', 'otomatis', 'remind', 'ingatkan',
  'search', 'google', 'internet', 'web',
  'berita', 'motogp', 'cuaca', 'saham', 'info', 'terkini', 'terbaru', 'prediksi',
  'kurs', 'harga', 'nilai', 'jumlah', 'matematika',
  'kode', 'coding', 'program', 'javascript', 'python', 'html', 'css', 'buatkan', 'tuliskan',
  'excel', 'pdf', 'file', 'dokumen',
  'youtube', 'yt', 'video', 'transkrip', 'link', 'url', 'http', 'https',
  'slack', 'discord', 'telegram', 'api', 'webhook', 'post', 'send',
  'login', 'masuk', 'sign in', 'scrape', 'credential', 'username', 'password', 'sesi',
  'workspace', 'folder', 'analisis file', 'periksa file', 'scan folder', 'baca file', 'isi folder', 'struktur folder',
  'ingat', 'ingatlah', 'nama saya', 'panggil saya', 'saya suka', 'favorit saya', 'saya alergi', 'kebiasaan saya',
  'informasi penting',
  'debat', 'rapat', 'diskusikan', 'direksi', 'ceo', 'cfo', 'cto', 'board of directors', 'keputusan bisnis',
  'shopee', 'affiliate', 'afiliate', 'promosi', 'produk', 'jual', 'komisi',
];

/**
 * Kata kerja perintah beserta bentuk berimbuhannya. Sengaja TANPA pasif `di-` ("ditemukan", "dibaca") dan tanpa
 * kata benda `-an` ("catatan", "bacaan", "pencarian") — keduanya menggambarkan, bukan memerintah.
 */
export const KATA_KERJA_PERINTAH: Readonly<Record<string, readonly string[]>> = {
  cari: ['cari', 'carikan', 'cariin', 'carilah', 'mencari', 'mencarikan'],
  temukan: ['temukan', 'menemukan'],
  baca: ['baca', 'bacakan', 'bacalah', 'membaca', 'membacakan'],
  ringkas: ['ringkas', 'ringkaskan', 'meringkas'],
  rangkum: ['rangkum', 'rangkumkan', 'merangkum'],
  hitung: ['hitung', 'hitungkan', 'menghitung'],
  catat: ['catat', 'catatkan', 'catatlah', 'mencatat'],
  kirim: ['kirim', 'kirimkan', 'mengirim', 'mengirimkan'],
};

/** Huruf/angka di sekitar kecocokan membatalkannya — `(?<![\p{L}\p{N}])`, bukan `\b` yang hanya paham ASCII. */
const polaKata = (kata: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${kata.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}(?![\\p{L}\\p{N}])`, 'iu');

const DAFTAR: { kunci: string; pola: RegExp }[] = [
  ...KATA_KUNCI_AKSI.map((k) => ({ kunci: k, pola: polaKata(k) })),
  ...Object.entries(KATA_KERJA_PERINTAH).flatMap(([dasar, bentuk]) =>
    bentuk.map((b) => ({ kunci: b === dasar ? dasar : `${dasar} (${b})`, pola: polaKata(b) }))),
];

/**
 * Kata kunci aksi PERTAMA yang ada di pesan, atau null. Mengembalikan kata kuncinya (bukan sekadar true) supaya
 * langkah proses bisa menyebut APA yang memicu — data yang diminta Fase 0 ("kata kunci mana yang memicu").
 */
export function kataKunciAksi(pesan: string): string | null {
  if (!pesan) return null;
  for (const { kunci, pola } of DAFTAR) if (pola.test(pesan)) return kunci;
  return null;
}
