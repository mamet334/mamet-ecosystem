
export const ULANG_MAKS = 4;
export const JEDA_DASAR_MS = 2000;
const MACET_MAKS = 2;
export const JEDA_KUNCI_MS = 30_000;
export const TUNGGU_KUNCI_MAKS = 6;

export class GagalUnggah extends Error {
  constructor(pesan, { status = 0, kode = null, tersimpan = null, total = null, bisaDilanjutkan = false } = {}) {
    super(pesan);
    this.name = 'GagalUnggah';
    Object.assign(this, { status, kode, tersimpan, total, bisaDilanjutkan });
  }
}

export function bolehDiulang(status) {
  return status === 0 || status === 429 || status >= 500;
}

export async function bacaGalatFungsi(error) {
  const ctx = error?.context;
  const status = typeof ctx?.status === 'number' ? ctx.status : 0;
  let isi = null;
  try {
    const j = await ctx?.json?.();
    if (j && typeof j === 'object') isi = j;
  } catch {
  }
  return { status, isi, pesan: isi?.error || error?.message || 'galat tak dikenal' };
}

const jedaBawaan = (ms) => new Promise((r) => setTimeout(r, ms));

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
      error = e;
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
