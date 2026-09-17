// Pemotongan teks dipindah ke potong_teks.ts (Item 89, 2026-09-17) agar bisa diuji di Node; diekspor ulang di sini.
export { chunkText, UKURAN_POTONGAN, TUMPANG_POTONGAN } from './potong_teks.ts';

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
