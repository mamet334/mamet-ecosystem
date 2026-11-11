import { MAKS_TOKEN_JAWABAN } from './reasoning_openrouter.ts';

export const UMUR_KATALOG_MS = 6 * 60 * 60 * 1000;
export const BATAS_WAKTU_KATALOG_MS = 4000;
export const UMUR_PLAFON_TERJANGKAU_MS = 5 * 60 * 1000;

export const HURUF_PER_TOKEN_PROMPT = 3;
export const CADANGAN_TOKEN_JENDELA = 2048;

const katalog = new Map<string, { waktu: number; nilai: number | null }>();
const jendela = new Map<string, number | null>();
const terjangkau = new Map<string, { waktu: number; nilai: number }>();

const sidikKunci = (kunci: string) => String(kunci || '').slice(-12);

export function maksKeluaranDariEndpoint(data: any): number | null {
  const daftar = Array.isArray(data?.data?.endpoints) ? data.data.endpoints : [];
  const nilai = daftar
    .map((e: any) => Number(e?.max_completion_tokens))
    .filter((n: number) => Number.isInteger(n) && n > 0);
  return nilai.length ? Math.min(...nilai) : null;
}

export function jendelaDariEndpoint(data: any): number | null {
  const daftar = Array.isArray(data?.data?.endpoints) ? data.data.endpoints : [];
  const nilai = daftar
    .map((e: any) => Number(e?.context_length))
    .filter((n: number) => Number.isInteger(n) && n > 0);
  return nilai.length ? Math.min(...nilai) : null;
}

export function jendelaModelTersimpan(model: string): number | null {
  return jendela.get(String(model || '').trim()) ?? null;
}

export function plafonDalamJendela(plafon: number, jendelaModel: number | null, hurufPrompt: number): number {
  if (!jendelaModel || !(hurufPrompt >= 0)) return plafon;
  const ruang = jendelaModel - Math.ceil(hurufPrompt / HURUF_PER_TOKEN_PROMPT) - CADANGAN_TOKEN_JENDELA;
  if (ruang >= plafon) return plafon;
  return Math.max(MAKS_TOKEN_JAWABAN, ruang);
}

export async function maksKeluaranModel(
  model: string,
  ambil: (url: string, init?: RequestInit) => Promise<Response> = fetch,
  sekarang: number = Date.now(),
): Promise<number | null> {
  const id = String(model || '').trim();
  if (!/^[\w.-]+\/[\w.:-]+$/.test(id)) return null;
  const tersimpan = katalog.get(id);
  if (tersimpan && sekarang - tersimpan.waktu < UMUR_KATALOG_MS) return tersimpan.nilai;
  let nilai: number | null = null;
  const pemutus = new AbortController();
  const tenggat = setTimeout(() => pemutus.abort(), BATAS_WAKTU_KATALOG_MS);
  try {
    const res = await ambil(`https://openrouter.ai/api/v1/models/${id}/endpoints`, { signal: pemutus.signal });
    if (res.ok) {
      const isi = await res.json();
      nilai = maksKeluaranDariEndpoint(isi);
      jendela.set(id, jendelaDariEndpoint(isi));
    }
    else console.warn(`[KemampuanModel] katalog ${id}: HTTP ${res.status} — memakai plafon bawaan ${MAKS_TOKEN_JAWABAN}`);
  } catch (e: any) {
    console.warn(`[KemampuanModel] katalog ${id} tak terbaca (${e?.message || e}) — memakai plafon bawaan ${MAKS_TOKEN_JAWABAN}`);
  } finally {
    clearTimeout(tenggat);
  }
  katalog.set(id, { waktu: sekarang, nilai });
  return nilai;
}

export function plafonJawaban(maksModel: number | null, plafonTerjangkau: number | null = null): number {
  const dasar = maksModel && maksModel > MAKS_TOKEN_JAWABAN ? maksModel : MAKS_TOKEN_JAWABAN;
  return plafonTerjangkau && plafonTerjangkau > 0 && plafonTerjangkau < dasar ? plafonTerjangkau : dasar;
}

export function ingatPlafonTerjangkau(kunci: string, plafonDipakai: number | undefined, plafonDiminta: number, sekarang: number = Date.now()) {
  const sidik = sidikKunci(kunci);
  if (!sidik) return;
  if (plafonDipakai && plafonDipakai > 0 && plafonDipakai < plafonDiminta) terjangkau.set(sidik, { waktu: sekarang, nilai: plafonDipakai });
}

export function plafonTerjangkauTerakhir(kunci: string, sekarang: number = Date.now()): number | null {
  const t = terjangkau.get(sidikKunci(kunci));
  if (!t) return null;
  if (sekarang - t.waktu >= UMUR_PLAFON_TERJANGKAU_MS) { terjangkau.delete(sidikKunci(kunci)); return null; }
  return t.nilai;
}

export async function plafonUntukPermintaan(
  model: string,
  kunci: string,
  ambil: (url: string, init?: RequestInit) => Promise<Response> = fetch,
  sekarang: number = Date.now(),
  hurufPrompt: number = 0,
): Promise<number> {
  const maksModel = await maksKeluaranModel(model, ambil, sekarang);
  const jendelaModel = jendelaModelTersimpan(model);
  const plafon = plafonDalamJendela(plafonJawaban(maksModel, plafonTerjangkauTerakhir(kunci, sekarang)), jendelaModel, hurufPrompt);
  if (plafon !== MAKS_TOKEN_JAWABAN) console.log(`[KemampuanModel] ${model}: plafon jawaban ${plafon} token (katalog ${maksModel ?? 'tak ada'}, jendela ${jendelaModel ?? 'tak ada'}, prompt ${hurufPrompt} huruf)`);
  return plafon;
}

export function kosongkanIngatanKemampuan() {
  katalog.clear();
  jendela.clear();
  terjangkau.clear();
}
