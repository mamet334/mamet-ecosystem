export { chunkText, UKURAN_POTONGAN, TUMPANG_POTONGAN } from './potong_teks.ts';

export const EMBED_MODEL = 'google/gemini-embedding-2';
export const EMBED_DIMENSI = 768;


export function penolakanSesaat(status: number, pesan: string): boolean {
  if (status === 429 || status >= 500) return true;
  return status === 400 && /location is not supported|FAILED_PRECONDITION/i.test(pesan);
}

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

    if (penolakanSesaat(res.status, pesanAsli) && percobaan < MAKS_PERCOBAAN) {
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
