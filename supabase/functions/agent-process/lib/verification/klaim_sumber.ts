/**
 * PENILAIAN PER-KLAIM (T13, 2026-09-28)
 *
 * `label_sumber.ts` menilai jawaban sebagai SATU GUMPALAN: lolos semua atau turun semua. Akibatnya
 * jawaban panjang yang 7 dari 8 kalimatnya bersandar dokumen — sementara 1 kalimat datang dari
 * pengetahuan umum model — tetap berlabel `VERIFIED` utuh, selama baris Sumber, halaman, rujukan,
 * angka, dan tabel centangnya lolos. Itu bentuk Item 70 pada tingkat kalimat.
 *
 * Berkas ini menilai TIAP PERNYATAAN sendiri-sendiri, mencatat pernyataan mana bersandar pada
 * potongan mana (atribusi), dan memungkinkan vonis PARSIAL.
 *
 * ── Tiga pagar yang TIDAK boleh dilanggar ───────────────────────────────────────────────────
 * Ketiganya lahir dari uji T13 terhadap CHIMERA WASM, yang gagal di 5 dari 6 kasus Mamet nyata
 * (`uji/uji-chimera-verifier-nyata.mjs`). Kesalahannya jangan diulang di sini:
 *
 *  1. TIDAK ADA VONIS "BERTENTANGAN". Kecocokan kata tidak bisa membuktikan sesuatu SALAH, hanya
 *     bahwa sandarannya tidak ditemukan. CHIMERA mencap jawaban BENAR sebagai kontradiksi dengan
 *     keyakinan 0,95 karena satu kata "dilarang" ada di potongan yang sama — padahal dokumen
 *     regulasi selalu menaruh hak dan larangan berdampingan dalam satu pasal. Berkas ini hanya
 *     mengenal "bersandar" dan "tidak ditemukan sandarannya".
 *
 *  2. ANGKA BUKAN URUSAN BERKAS INI. CHIMERA menganggap tiap angka jawaban yang tak tercetak identik
 *     di potongan sebagai kontradiksi — sehingga "Nomor 19 Tahun 2026" dan "[Halaman 3]" pada
 *     jawaban BENAR ikut jatuh. Angka, halaman, dan rujukan sudah punya pemeriksa sendiri yang
 *     sudah terbukti di `label_sumber.ts`; di sini angka justru DIBUANG dari perbandingan.
 *
 *  3. AMBANGNYA RENDAH, BUKAN TINGGI. CHIMERA menuntut 55% tumpang-tindih token, sehingga parafrase
 *     yang sah ikut diturunkan. Lapisan ini bertanya "apakah pernyataan ini punya pijakan sama
 *     sekali di dokumen", bukan "seberapa mirip". Kalimat yang terlalu pendek untuk dinilai
 *     dilewatkan diam-diam — lebih baik melewatkan ekstrapolasi daripada menurunkan jawaban benar.
 *
 * ── Kenapa kata dibandingkan lewat AKAR ─────────────────────────────────────────────────────
 * Tumpang-tindih token mentah tidak cocok untuk bahasa Indonesia, dan di situlah CHIMERA jatuh pada
 * kasus F: "Pembayaran tunjangan dilakukan bulanan" vs dokumen "Tunjangan kinerja pegawai
 * DIBAYARKAN setiap BULAN" hanya berbagi satu kata mentah, padahal maknanya sama. Maka tiap kata
 * dipecah menjadi beberapa calon akar (`akarKata`) dan dianggap cocok bila ada calon yang sama:
 * `pembayaran` → {pembayaran, bayaran, pembayar, bayar}, `dibayarkan` → {dibayarkan, bayarkan,
 * dibayar, bayar} → bertemu di `bayar`.
 */

/** Kata yang ada di hampir semua kalimat Indonesia — tidak membuktikan sandaran apa pun. */
const KATA_UMUM = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'pada', 'untuk', 'ini', 'itu', 'adalah', 'sebagai', 'dengan',
  'oleh', 'secara', 'dalam', 'bisa', 'dapat', 'akan', 'agar', 'sesuai', 'tentang', 'tersebut',
  'maka', 'atau', 'juga', 'tidak', 'bukan', 'ada', 'para', 'serta', 'bahwa', 'saja', 'telah',
  'sudah', 'harus', 'wajib', 'setiap', 'antara', 'karena', 'jika', 'bila', 'kepada', 'atas',
  'lebih', 'masih', 'hanya', 'yaitu', 'yakni', 'dll', 'dsb', 'the', 'and', 'for', 'with', 'that'
]);

/** Panjang minimal sebuah akar agar boleh dipakai membandingkan — mencegah potongan pendek bertemu kebetulan. */
const AKAR_MIN = 4;

const AWALAN = ['di', 'me', 'mem', 'men', 'meng', 'meny', 'pe', 'pem', 'pen', 'peng', 'peny', 'ber', 'ter', 'per', 'se', 'ke'];
const AKHIRAN = ['kan', 'annya', 'nya', 'an', 'i', 'lah', 'kah'];

/**
 * Calon akar sebuah kata. Sengaja MURAH HATI: menghasilkan beberapa calon dan membiarkan
 * pencocokan yang memilih. Calon yang keliru (mis. `kerima` dari `menerima`) tidak berbahaya —
 * ia hanya akan cocok bila kata itu memang ada di dokumen.
 */
export function akarKata(kata: string): string[] {
  const k = String(kata || '').toLowerCase();
  if (k.length < AKAR_MIN) return k.length ? [k] : [];
  const calon = new Set<string>([k]);

  const kupasAkhiran = (s: string): string[] => {
    const hasil = [s];
    for (const a of AKHIRAN) {
      if (s.length - a.length >= AKAR_MIN && s.endsWith(a)) hasil.push(s.slice(0, -a.length));
    }
    return hasil;
  };

  for (const s of kupasAkhiran(k)) calon.add(s);

  for (const aw of AWALAN) {
    if (!k.startsWith(aw) || k.length - aw.length < AKAR_MIN) continue;
    const sisa = k.slice(aw.length);
    for (const s of kupasAkhiran(sisa)) calon.add(s);
    // Peluruhan huruf pertama: me(N) + terima → menerima, meny + susun → menyusun, mem + pukul → memukul.
    // Huruf yang luruh dikembalikan sebagai calon TAMBAHAN, bukan pengganti.
    const kembali: Record<string, string> = { men: 't', pen: 't', meny: 's', peny: 's', mem: 'p', pem: 'p', meng: 'k', peng: 'k' };
    const huruf = kembali[aw];
    if (huruf && /^[aeiou]/.test(sisa)) {
      for (const s of kupasAkhiran(huruf + sisa)) calon.add(s);
    }
  }

  return [...calon].filter((c) => c.length >= AKAR_MIN || c === k);
}

const rapikanTeks = (s: string) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Kata bermakna sebuah teks: bukan kata umum, bukan angka, panjang ≥3. */
export function kataIsi(teks: string): string[] {
  return rapikanTeks(teks)
    .split(' ')
    .filter((w) => w.length >= 3 && !KATA_UMUM.has(w) && !/^\d+$/.test(w));
}

/** Himpunan semua calon akar sebuah teks — dipakai sekali per potongan, lalu dipakai ulang. */
export function akarTeks(teks: string): Set<string> {
  const himpunan = new Set<string>();
  for (const w of kataIsi(teks)) for (const a of akarKata(w)) himpunan.add(a);
  return himpunan;
}

// ── Memecah jawaban menjadi pernyataan ───────────────────────────────────────────────────────
// Yang DILEWATKAN, dan kenapa:
//  - blok ```…```      : isi kode/keluaran perintah, bukan pernyataan tentang dokumen (pelajaran trace_parser)
//  - baris tabel `|`   : sudah dinilai `periksaAngkaSumber` & `periksaTabelCentang`, jauh lebih teliti
//  - judul `#`         : bukan klaim
//  - baris berlabel    : `[STATUS: …]`, `[Pengetahuan umum AI…]`
//  - baris Sumber      : itu kutipan judul, sudah dinilai `periksaLabelSumber`
//  - kalimat tanya     : bukan pernyataan
//  - `<think>…</think>`: nalar sengaja ditampilkan, tetapi label menilai JAWABAN AKHIR saja
//                        (keputusan Owner, uji mutu RAG putaran 4 — lihat label_sumber.ts)
const POLA_THINK = /<think>[\s\S]*?<\/think>/gi;
const PENANDA_BUTIR = /^\s*(?:[-*+•]|\d+[.)])\s+/;

/** Baris pemisah tabel Markdown: `| --- | :---: |` — tidak pernah jadi klaim. */
const barisPemisahTabel = (baris: string) => /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-*:?\s*\|?$/.test(baris);

/**
 * @param opsi.sertakanTabel Baris tabel ikut dinilai.
 *   `false` (bawaan) untuk lapisan leksikal: angka & pasangan kolom sudah ditangani
 *   `periksaAngkaSumber` dan `periksaTabelCentang` yang jauh lebih teliti.
 *   `true` untuk hakim bayangan. Terbukti perlu 2026-09-28: satu jawaban campuran menulis bagian
 *   yang bersandar dokumen sebagai TABEL, sehingga hakim hanya menerima paragraf rekomendasinya
 *   dan menyimpulkan HYPOTHESIS. Vonisnya benar atas apa yang ia lihat; yang salah adalah apa yang
 *   dikirimkan kepadanya. Model menjawab dengan tabel hampir setiap saat.
 */
export function pecahKlaim(jawaban: string, opsi: { sertakanTabel?: boolean } = {}): string[] {
  const teks = String(jawaban || '').replace(POLA_THINK, '');
  const klaim: string[] = [];
  let dalamPagar = false;

  for (const barisMentah of teks.split('\n')) {
    const baris = barisMentah.trim();
    if (/^```/.test(baris)) { dalamPagar = !dalamPagar; continue; }
    if (dalamPagar) continue;
    if (!baris) continue;
    if (baris.startsWith('#') || baris.startsWith('>')) continue;
    if (baris.includes('|')) {
      // Baris pemisah tidak pernah bermakna; baris tabel lain hanya ikut bila diminta, dan masuk
      // APA ADANYA (bukan dipecah per titik) supaya satu baris tabel tetap satu satuan penilaian.
      if (!opsi.sertakanTabel || barisPemisahTabel(baris)) continue;
      klaim.push(baris);
      continue;
    }
    if (/\[\s*status\s*:/i.test(baris) || baris.includes('[Pengetahuan umum AI')) continue;
    if (/^\s*(?:\*\*)?sumber\s*:?/i.test(baris)) continue;

    const isiBaris = baris.replace(PENANDA_BUTIR, '');
    for (const kalimat of pecahKalimat(isiBaris)) {
      if (kalimat.endsWith('?')) continue;
      klaim.push(kalimat);
    }
  }
  return klaim;
}

/** Pemecah kalimat: titik/seru/tanya yang diikuti spasi atau akhir baris. */
function pecahKalimat(baris: string): string[] {
  const hasil: string[] = [];
  let mulai = 0;
  for (let i = 0; i < baris.length; i++) {
    const c = baris[i];
    if (c !== '.' && c !== '!' && c !== '?') continue;
    if (i + 1 < baris.length && !/\s/.test(baris[i + 1])) continue;
    const potong = baris.slice(mulai, i + 1).trim();
    if (potong) hasil.push(potong);
    mulai = i + 1;
  }
  const sisa = baris.slice(mulai).trim();
  if (sisa) hasil.push(sisa);
  return hasil;
}

// ── Menilai sandaran tiap klaim ──────────────────────────────────────────────────────────────
/**
 * Kalimat dengan kata bermakna lebih sedikit dari ini TIDAK dinilai. "Ketiganya sama." tidak punya
 * cukup bahan untuk dibuktikan maupun disangsikan; menilainya hanya menghasilkan tuduhan palsu.
 */
export const KATA_MIN_DINILAI = 4;

/**
 * DUA AMBANG, BUKAN SATU — dan ini hasil pengukuran, bukan pilihan rasa.
 *
 * Rancangan pertama memakai satu ambang 0,34: di atasnya "bersandar", di bawahnya "tidak". Ambang
 * itu dibatalkan setelah porsi tiap kalimat diukur terhadap dokumen uji:
 *
 *   kalimat benar yang mengutip langsung  0,75 – 1,00
 *   kalimat SIMPULAN yang sah             0,25 – 0,57   ← bertumpang-tindih
 *   kalimat asing (ekstrapolasi)          0,00 – 0,13
 *
 * Kalimat simpulan ("Dengan demikian, pegawai memperoleh haknya secara rutin…") memang miskin kata
 * dokumen — ia merujuk balik ke kalimat sebelumnya, bukan membawa fakta baru. Tiga dari lima kalimat
 * semacam itu akan DITUDUH keliru oleh ambang tunggal 0,34. Menggeser ambangnya hanya memindahkan
 * korban, karena dua sebaran itu memang beririsan.
 *
 * Maka ambangnya dipisah menjadi dua, dengan zona diam di tengah:
 *
 *   porsi ≥ PORSI_SANDARAN   → bersandar, dicatat atribusinya
 *   porsi ≤ AMBANG_TUDUH     → tidak ditemukan sandarannya
 *   di antaranya             → TIDAK DIPUTUSKAN — tidak dihitung ke mana pun
 *
 * Zona diam itu bukan kelemahan; itu penerapan pagar ke-3 di kepala berkas. Lebih baik melewatkan
 * ekstrapolasi daripada menuduh kalimat simpulan yang benar. Kalimat yang tak bisa diputuskan
 * memang tak diputuskan.
 */
export const PORSI_SANDARAN = 0.34;

/**
 * Di bawah ini sebuah kalimat dianggap tak punya pijakan sama sekali. Diukur dari sebaran di atas:
 * kalimat asing tertinggi 0,13, kalimat simpulan terendah 0,25 — 0,15 duduk di antaranya, condong
 * ke sisi yang aman. Kalimat asing yang kebetulan memakai kata dokumen ("tunjangan", "pegawai")
 * akan lolos; itu memang harganya, dan harga itu yang dipilih.
 */
export const AMBANG_TUDUH = 0.15;

export type Sandaran = { indeks: number; porsi: number };

/** Potongan dengan pijakan terbanyak, apa pun porsinya. null bila kalimat terlalu pendek untuk dinilai. */
export function porsiTerbaik(klaim: string, akarPotongan: Set<string>[]): Sandaran | null {
  const kata = kataIsi(klaim);
  if (kata.length < KATA_MIN_DINILAI || !akarPotongan.length) return null;

  let terbaik: Sandaran = { indeks: -1, porsi: 0 };
  for (let i = 0; i < akarPotongan.length; i++) {
    const akar = akarPotongan[i];
    let cocok = 0;
    for (const w of kata) {
      if (akarKata(w).some((a) => akar.has(a))) cocok++;
    }
    const porsi = cocok / kata.length;
    if (porsi > terbaik.porsi) terbaik = { indeks: i, porsi };
  }
  return terbaik;
}

/** Potongan yang menyandari klaim, atau null bila tak ada yang melewati `PORSI_SANDARAN`. */
export function sandaranKlaim(klaim: string, akarPotongan: Set<string>[]): Sandaran | null {
  const t = porsiTerbaik(klaim, akarPotongan);
  return t && t.porsi >= PORSI_SANDARAN ? t : null;
}

export type NilaiKlaim = {
  /** Kalimat yang benar-benar diputuskan: bersandar + takBersandar. Tidak termasuk zona diam. */
  dinilai: string[];
  /** Kalimat yang bersandar, beserta potongan penyandaranya. */
  bersandar: { klaim: string; sandaran: Sandaran }[];
  /** Kalimat yang tidak ditemukan sandarannya — BUKAN berarti salah. */
  takBersandar: string[];
  /** Zona diam: ada pijakan tetapi tidak cukup untuk diputuskan ke arah mana pun. */
  takDiputuskan: string[];
  /** Potongan mana menyandari berapa klaim — dipakai untuk pesan & log. */
  atribusi: { indeks: number; jumlah: number }[];
};

export function nilaiKlaim(jawaban: string, isiDokumen: string[]): NilaiKlaim {
  const isi = (isiDokumen || []).filter((t) => typeof t === 'string' && t.trim());
  const akarPotongan = isi.map(akarTeks);
  const hasil: NilaiKlaim = { dinilai: [], bersandar: [], takBersandar: [], takDiputuskan: [], atribusi: [] };
  if (!akarPotongan.length) return hasil;

  const hitung = new Map<number, number>();

  for (const klaim of pecahKlaim(jawaban)) {
    const terbaik = porsiTerbaik(klaim, akarPotongan);
    if (!terbaik) continue; // terlalu pendek untuk dinilai
    if (terbaik.porsi >= PORSI_SANDARAN) {
      hasil.dinilai.push(klaim);
      hasil.bersandar.push({ klaim, sandaran: terbaik });
      hitung.set(terbaik.indeks, (hitung.get(terbaik.indeks) || 0) + 1);
    } else if (terbaik.porsi <= AMBANG_TUDUH) {
      hasil.dinilai.push(klaim);
      hasil.takBersandar.push(klaim);
    } else {
      hasil.takDiputuskan.push(klaim);
    }
  }

  hasil.atribusi = [...hitung.entries()]
    .map(([indeks, jumlah]) => ({ indeks, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah);
  return hasil;
}

// ── Putusan ──────────────────────────────────────────────────────────────────────────────────
/**
 * Jawaban dengan pernyataan sesedikit ini tidak dipecah. Satu kalimat yang meleset dari ambang
 * tidak boleh menjatuhkan seluruh jawaban — untuk itulah pemeriksa lama sudah bekerja.
 */
export const KLAIM_MIN_DIPUTUS = 2;

export type PutusanKlaim =
  | { putusan: 'diam' }
  | { putusan: 'parsial'; alasan: string; takBersandar: string[]; atribusi: { indeks: number; jumlah: number }[] }
  | { putusan: 'hipotesis'; alasan: string; takBersandar: string[]; atribusi: { indeks: number; jumlah: number }[] };

/**
 * Dipanggil HANYA sesudah seluruh pemeriksaan `label_sumber.ts` lolos — yaitu di tempat yang hari
 * ini dibiarkan apa adanya. Karena itu ia hanya bisa MEMPERKETAT, tidak pernah melonggarkan.
 */
export function putuskanKlaim(jawaban: string, isiDokumen: string[]): PutusanKlaim {
  const nilai = nilaiKlaim(jawaban, isiDokumen);
  if (nilai.dinilai.length < KLAIM_MIN_DIPUTUS) return { putusan: 'diam' };
  if (!nilai.takBersandar.length) return { putusan: 'diam' };

  const total = nilai.dinilai.length;
  const kurang = nilai.takBersandar.length;
  const dasar = { takBersandar: nilai.takBersandar, atribusi: nilai.atribusi };

  // HIPOTESIS hanya bila memang tak ada apa pun yang menopang: tidak satu klaim bersandar, DAN tidak
  // ada klaim di zona diam. Selama masih ada kalimat yang tak diputuskan, mengatakan "tidak satu pun
  // bersandar" melampaui yang dibuktikan — maka PARSIAL yang dipakai.
  if (kurang === total && !nilai.takDiputuskan.length) {
    return {
      putusan: 'hipotesis',
      alasan: `tidak satu pun dari ${total} pernyataan ditemukan sandarannya di potongan yang dilampirkan`,
      ...dasar
    };
  }
  return {
    putusan: 'parsial',
    alasan: `${total - kurang} dari ${total} pernyataan bersandar pada dokumen; ${kurang} tidak ditemukan sandarannya`,
    ...dasar
  };
}

/** Ringkasan pernyataan tak bersandar untuk catatan yang dibaca Owner — dipotong agar tidak membanjiri chat. */
export function ringkasTakBersandar(takBersandar: string[], maksimal = 2): string {
  const petik = takBersandar.slice(0, maksimal).map((k) => `"${k.length > 120 ? `${k.slice(0, 117)}…` : k}"`);
  const sisa = takBersandar.length - petik.length;
  return petik.join('; ') + (sisa > 0 ? ` (dan ${sisa} lainnya)` : '');
}
