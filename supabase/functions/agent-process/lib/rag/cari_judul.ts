
export interface PotonganRag {
  id: string;
  document_id: string;
  title?: string;
  content?: string;
  space_name?: string;
  [k: string]: unknown;
}

export const MAKS_POTONGAN_JUDUL = 3;

export const LEBAR_PADDING = [2, 3];

export function kataKunciJudul(teks: string, dasar: string[] = []): string[] {
  const keluar = new Set((dasar || []).filter((w) => typeof w === 'string' && w));
  for (const m of String(teks || '').toLowerCase().matchAll(/\d+/g)) {
    const telanjang = m[0].replace(/^0+/, '') || '0';
    keluar.add(telanjang);
    for (const lebar of LEBAR_PADDING) {
      if (telanjang.length < lebar) keluar.add(telanjang.padStart(lebar, '0'));
    }
  }
  return [...keluar];
}

export function gabungkan(
  dariIsi: PotonganRag[],
  dariJudul: PotonganRag[],
  batas: number,
): { hasil: PotonganRag[]; disisipkan: number } {
  const isi = Array.isArray(dariIsi) ? dariIsi : [];
  const judul = Array.isArray(dariJudul) ? dariJudul : [];
  if (!judul.length) return { hasil: isi, disisipkan: 0 };

  const dokumenAda = new Set(isi.map((p) => p?.document_id).filter(Boolean));
  const idAda = new Set(isi.map((p) => p?.id).filter(Boolean));

  const sisipan: PotonganRag[] = [];
  for (const p of judul) {
    if (sisipan.length >= MAKS_POTONGAN_JUDUL) break;
    if (!p?.id || idAda.has(p.id)) continue;
    if (p.document_id && dokumenAda.has(p.document_id)) continue;
    sisipan.push(p);
    idAda.add(p.id);
  }
  if (!sisipan.length) return { hasil: isi, disisipkan: 0 };

  const batasSah = Number.isFinite(batas) && batas > 0 ? batas : isi.length + sisipan.length;
  return { hasil: [...sisipan, ...isi].slice(0, batasSah), disisipkan: sisipan.length };
}
