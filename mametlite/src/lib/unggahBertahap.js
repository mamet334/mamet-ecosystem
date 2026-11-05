/**
 * UNGGAH BERTAHAP — sisi klien (K1 langkah 2, 2026-11-05).
 *
 * Keputusan Owner: satu berkas mentah = satu dokumen; yang gagal di tengah jalan menjadi cache; dilanjutkan dengan
 * berkas yang sama tanpa embedding ulang dari awal. `rag-process` bekerja ±80 detik per panggilan lalu menjawab
 * `selesai: false` + jumlah potongan tersimpan; modul ini memanggilnya lagi dengan teks yang sama sampai selesai.
 * Titik lanjut dihitung SERVER dari potongan yang tersimpan — klien hanya mengulang.
 *
 * Mengulang dengan jeda bila kegagalannya sesaat: jaringan putus (status 0), 429, 5xx — termasuk 503 gerbang Supabase
 * (5 Nov: 9 changelog ditolak beruntun dalam milidetik, fungsinya tak sempat berjalan) dan 502 penolakan penyedia yang
 * tetap gagal sesudah diulang server. Penolakan tetap (401 kunci, 402 saldo, 403, 409 tertunda berbeda, 413 kuota)
 * langsung dihentikan: mengulangnya hanya menunda pesan yang sama.
 *
 * 423 SEDANG_DIPROSES (kunci sementara dokumen, server): panggilan lama masih berjalan — ditunggu 30 s per kali, bukan
 * dianggap gagal; begitu kunci lepas, server melanjutkan dari potongan terakhir tanpa potongan ganda.
 *
 * Murni (tanpa impor; `panggil` & `tunggu` disuntikkan) — diuji di Node: `uji/uji-unggah-bertahap.mjs`.
 *
 * SALINAN dari frontend/src/core/runtime/services/unggahBertahap.js — mametlite proyek terpisah
 * (di-deploy sendiri ke mametlite.vercel.app). Ubah keduanya bersamaan.
 */

export const ULANG_MAKS = 4;            // percobaan ulang beruntun untuk satu panggilan yang gagal sesaat
export const JEDA_DASAR_MS = 2000;      // 2, 4, 8, 16 detik
const MACET_MAKS = 2;                   // jawaban "belum selesai" tanpa kemajuan berturut-turut
// 423 SEDANG_DIPROSES: panggilan lama (mis. sesudah muat ulang) masih memegang kunci dokumen, paling lama ±130 s.
// Ditunggu 30 s per kali, sampai 6 kali (3 menit) — lebih lama dari sewa kunci, jadi kunci pasti sudah lepas.
export const JEDA_KUNCI_MS = 30_000;
export const TUNGGU_KUNCI_MAKS = 6;

export class GagalUnggah extends Error {
  constructor(pesan, { status = 0, kode = null, tersimpan = null, total = null, bisaDilanjutkan = false } = {}) {
    super(pesan);
    this.name = 'GagalUnggah';
    Object.assign(this, { status, kode, tersimpan, total, bisaDilanjutkan });
  }
}

/** Kegagalan yang pantas dicoba lagi: jaringan putus, batas laju, server/gerbang/penyedia sibuk. */
export function bolehDiulang(status) {
  return status === 0 || status === 429 || status >= 500;
}

/**
 * Galat `supabase.functions.invoke` → { status, isi, pesan }. Status non-2xx: alasan sebenarnya ada di body jawaban
 * (error.context), bukan di error.message yang umum ("Edge Function returned a non-2xx status code", Item 63).
 * Tanpa `context` (jaringan putus) → status 0. Body bukan JSON (503 gerbang) → isi null.
 */
export async function bacaGalatFungsi(error) {
  const ctx = error?.context;
  const status = typeof ctx?.status === 'number' ? ctx.status : 0;
  let isi = null;
  try {
    const j = await ctx?.json?.();
    if (j && typeof j === 'object') isi = j;
  } catch {
    // Body bukan JSON — pakai pesan bawaan.
  }
  return { status, isi, pesan: isi?.error || error?.message || 'galat tak dikenal' };
}

const jedaBawaan = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param panggil    () => Promise<{ data, error }> — satu panggilan rag-process dengan teks yang SAMA setiap kali
 * @param onKemajuan ({ tersimpan, total, ulang? }) => void
 * @returns jawaban akhir rag-process (`selesai: true`)
 * @throws GagalUnggah — `bisaDilanjutkan` true bila sebagian sudah tersimpan di server
 */
export async function unggahBertahap({ panggil, onKemajuan, tunggu = jedaBawaan, ulangMaks = ULANG_MAKS }) {
  let ulang = 0;
  let macet = 0;
  let tungguKunci = 0;
  let terakhir = { tersimpan: null, total: null };
  for (;;) {
    let data = null;
    let error = null;
    try {
      ({ data, error } = await panggil());
    } catch (e) {
      error = e; // fetch yang melempar (jaringan putus) diperlakukan sama dengan galat tanpa jawaban
    }

    if (!error && data && !data.error) {
      const total = Number(data.total ?? data.chunks ?? 0);
      const tersimpan = Number(data.tersimpan ?? data.chunks ?? 0);
      onKemajuan?.({ tersimpan, total });
      if (data.selesai !== false) return data;
      macet = terakhir.tersimpan !== null && tersimpan <= terakhir.tersimpan ? macet + 1 : 0;
      terakhir = { tersimpan, total };
      ulang = 0;
      tungguKunci = 0;
      if (macet >= MACET_MAKS) {
        throw new GagalUnggah(
          `Unggahan tidak maju (${tersimpan} dari ${total} potongan). Yang sudah tersimpan tetap ada — unggah berkas yang sama lagi untuk melanjutkan.`,
          { status: 200, kode: 'TIDAK_MAJU', tersimpan, total, bisaDilanjutkan: tersimpan > 0 }
        );
      }
      continue;
    }

    const g = error ? await bacaGalatFungsi(error) : { status: 200, isi: data, pesan: data?.error || 'jawaban kosong' };
    if (typeof g.isi?.tersimpan === 'number') terakhir = { tersimpan: g.isi.tersimpan, total: g.isi.total ?? terakhir.total };
    const tersimpan = terakhir.tersimpan;
    if (g.status === 423 && tungguKunci < TUNGGU_KUNCI_MAKS) {
      tungguKunci++;
      onKemajuan?.({ tersimpan: tersimpan ?? 0, total: terakhir.total ?? 0, menunggu: tungguKunci });
      await tunggu(JEDA_KUNCI_MS);
      continue;
    }
    const bisaDilanjutkan = Boolean(g.isi?.bisaDilanjutkan) || (tersimpan ?? 0) > 0;
    if (!bolehDiulang(g.status) || ulang >= ulangMaks) {
      const saran = bisaDilanjutkan && !/unggah berkas yang sama/i.test(g.pesan)
        ? ` Yang sudah tersimpan (${tersimpan}${terakhir.total ? ` dari ${terakhir.total}` : ''} potongan) tetap ada — unggah berkas yang sama lagi untuk melanjutkan.`
        : '';
      throw new GagalUnggah(`${g.pesan}${saran}`, {
        status: g.status, kode: g.isi?.code ?? null, tersimpan, total: terakhir.total, bisaDilanjutkan
      });
    }
    ulang++;
    onKemajuan?.({ tersimpan: tersimpan ?? 0, total: terakhir.total ?? 0, ulang });
    await tunggu(JEDA_DASAR_MS * 2 ** (ulang - 1));
  }
}
