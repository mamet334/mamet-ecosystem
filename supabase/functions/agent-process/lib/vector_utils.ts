/**
 * UKURAN POTONGAN (Item 70, 2026-09-11): 800 huruf, tumpang 100 — sebelumnya 4.500 / 250.
 *
 * Potongan besar mencampur banyak topik, dan vektornya menjadi rata-rata yang kabur. Terukur pada
 * ebook "Operator Handbook": potongan 4.500 huruf berisi 19 perintah adb; kalimat
 * `adb shell dumpsys battery reset` — yang tertulis PERSIS di dalamnya — hanya mendapat skor 0,510
 * terhadapnya (peringkat 5), dan untuk enam pertanyaan uji potongan itu KALAH dari potongan
 * bertopik lain. Dipotong ulang, potongan berisi jawaban naik ke peringkat #1–#2 di keenamnya:
 *   800 huruf → #1/#1/#2/#1/#2/#1;  1.000 → cadangan (ID) #3–4;  1.200 → #5.
 */
export const UKURAN_POTONGAN = 800;
export const TUMPANG_POTONGAN = 100;

export function chunkText(text: string, maxLength: number = UKURAN_POTONGAN, tumpang: number = TUMPANG_POTONGAN): string[] {
  const chunks: string[] = [];
  let i = 0;
  // Batas mundur untuk mencari akhir baris/kalimat — dulu 150 dari tumpang 250.
  const jangkauBatas = Math.round(tumpang * 0.6);
  while (i < text.length) {
    let end = i + maxLength;
    if (end < text.length) {
      let breakPoint = text.lastIndexOf('\n', end);
      if (breakPoint <= i) breakPoint = text.lastIndexOf('. ', end);
      if (breakPoint > i) {
        end = breakPoint + 1;
      }
    }
    chunks.push(text.substring(i, end).trim());
    if (end >= text.length) break;

    let nextI = end - tumpang;
    let bLine = text.lastIndexOf('\n', end);
    let bDot = text.lastIndexOf('. ', end);
    let boundary = bLine >= end - jangkauBatas ? bLine : (bDot >= end - jangkauBatas ? bDot : -1);
    
    if (boundary > nextI && boundary < end) {
      nextI = boundary + 1;
    }
    if (nextI <= i) nextI = end;
    i = nextI;
  }
  return chunks.filter(c => c.length > 0);
}

/**
 * EMBEDDING LEWAT OPENROUTER DENGAN KUNCI PENGGUNA (Item 63–64, 2026-09-10)
 *
 * Menggantikan getGeminiEmbeddingWithRetry (Gemini langsung, kunci sistem). Keputusan
 * Owner di Item 63: model TETAP `google/gemini-embedding-2` — hanya jalurnya pindah —
 * dan yang membayar adalah pengguna dengan kunci OpenRouter-nya sendiri.
 *
 * Model tidak boleh diganti tanpa memvektorkan ulang SEMUA baris: vektor dari model lain
 * tidak sebanding (Item 62). Lewat OpenRouter model ini terbukti menghasilkan vektor yang
 * identik dengan yang sudah tersimpan (sidik "saya suka kopi", Item 63).
 *
 * Kunci diterima sebagai ARGUMEN, bukan lewat CapabilityRegistry — Map statis di sana
 * dipakai bersama semua permintaan, dan kunci pengguna tidak boleh ikut tertukar.
 *
 * Satu panggilan = satu kelompok teks (OpenRouter menerima array). Uji HCDP: 11 potongan
 * ±12 ribu token selesai ±1 detik per permintaan, 0 kali 429 — dibanding satu per satu
 * dengan jeda 0,6 s yang gagal setelah 44 detik.
 */
export const EMBED_MODEL = 'google/gemini-embedding-2';
// 768, bukan 3072 (Item 70). Model ini "Matryoshka": angka-angka awal vektornya sudah memuat makna
// utama, jadi vektor bisa dipersingkat. Terukur: peringkat potongan berisi jawaban SAMA PERSIS pada
// 3072/1536/768 untuk keenam pertanyaan uji; `dimensions: 768` dari OpenRouter identik dengan
// memotong sendiri (kemiripan 1,0000); ambang memori 0,70 tetap memisahkan pasangan kalibrasinya
// (teh 0,7327 lolos, jalan pagi 0,6735 tidak). Seperempat ruang (±3 KB/vektor, bukan ±12 KB) dan kini
// bisa diindeks (pgvector membatasi indeks 2.000 dimensi). Kolom database WAJIB ikut 768.
export const EMBED_DIMENSI = 768;

export class EmbedGagal extends Error {
  constructor(public kode: string, message: string, public status: number = 502) {
    super(message);
  }
}

export async function embedLewatOpenRouter(
  teks: string[],
  kunci: string,
  opsi: { batasWaktuMs?: number } = {}
): Promise<number[][]> {
  const tenggat = opsi.batasWaktuMs ? Date.now() + opsi.batasWaktuMs : Infinity;
  const MAKS_PERCOBAAN = 4;

  for (let percobaan = 1; ; percobaan++) {
    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${kunci}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: teks, dimensions: EMBED_DIMENSI })
    });

    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      const data = Array.isArray(body?.data) ? [...body.data].sort((a: any, b: any) => a.index - b.index) : [];
      if (data.length !== teks.length) {
        throw new EmbedGagal('JAWABAN_TIDAK_LENGKAP', `OpenRouter mengembalikan ${data.length} vektor untuk ${teks.length} teks.`);
      }
      const vektor = data.map((d: any) => d.embedding);
      const salah = vektor.find((v: any) => !Array.isArray(v) || v.length !== EMBED_DIMENSI);
      if (salah !== undefined) {
        throw new EmbedGagal('DIMENSI_SALAH', `Vektor berdimensi ${Array.isArray(salah) ? salah.length : typeof salah}, seharusnya ${EMBED_DIMENSI}.`);
      }
      return vektor;
    }

    const pesanAsli = (await res.text().catch(() => '')).slice(0, 300);
    if (res.status === 401) {
      throw new EmbedGagal('KUNCI_TIDAK_VALID', 'Kunci OpenRouter Anda ditolak (401). Periksa kunci di Pengaturan.', 401);
    }
    if (res.status === 402) {
      throw new EmbedGagal('SALDO_HABIS', 'Saldo OpenRouter Anda tidak cukup untuk memproses dokumen ini (402).', 402);
    }

    // 429 dan 5xx: tunggu lalu coba lagi — sesuai Retry-After bila ada, selain itu 2, 4, 8 detik.
    // (Versi Gemini dulu hanya menunggu 1 lalu 2 detik, terlalu singkat untuk jatah per menit.)
    if ((res.status === 429 || res.status >= 500) && percobaan < MAKS_PERCOBAAN) {
      const saran = Number(res.headers.get('retry-after'));
      const tunggu = Math.min(Number.isFinite(saran) && saran > 0 ? saran * 1000 : 2000 * 2 ** (percobaan - 1), 30_000);
      if (Date.now() + tunggu > tenggat) {
        throw new EmbedGagal('WAKTU_HABIS', `OpenRouter meminta menunggu ${Math.round(tunggu / 1000)} detik, melebihi sisa waktu proses.`, 503);
      }
      console.warn(`[embed] OpenRouter ${res.status}, percobaan ${percobaan}/${MAKS_PERCOBAAN} — menunggu ${tunggu} ms`);
      await new Promise((r) => setTimeout(r, tunggu));
      continue;
    }

    throw new EmbedGagal(
      res.status === 429 ? 'BATAS_PERMINTAAN' : 'OPENROUTER_GAGAL',
      `OpenRouter menjawab ${res.status}: ${pesanAsli}`,
      502
    );
  }
}
