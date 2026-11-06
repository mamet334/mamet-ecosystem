
const KATA_UMUM = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'pada', 'untuk', 'ini', 'itu', 'adalah', 'sebagai', 'dengan',
  'oleh', 'secara', 'dalam', 'bisa', 'dapat', 'akan', 'agar', 'sesuai', 'tentang', 'tersebut',
  'maka', 'atau', 'juga', 'tidak', 'bukan', 'ada', 'para', 'serta', 'bahwa', 'saja', 'telah',
  'sudah', 'harus', 'wajib', 'setiap', 'antara', 'karena', 'jika', 'bila', 'kepada', 'atas',
  'lebih', 'masih', 'hanya', 'yaitu', 'yakni', 'dll', 'dsb', 'the', 'and', 'for', 'with', 'that'
]);

const AKAR_MIN = 4;

const AWALAN = ['di', 'me', 'mem', 'men', 'meng', 'meny', 'pe', 'pem', 'pen', 'peng', 'peny', 'ber', 'ter', 'per', 'se', 'ke'];
const AKHIRAN = ['kan', 'annya', 'nya', 'an', 'i', 'lah', 'kah'];

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
    const kembali: Record<string, string> = { men: 't', pen: 't', meny: 's', peny: 's', mem: 'p', pem: 'p', meng: 'k', peng: 'k' };
    const huruf = kembali[aw];
    if (huruf && /^[aeiou]/.test(sisa)) {
      for (const s of kupasAkhiran(huruf + sisa)) calon.add(s);
    }
  }

  return [...calon].filter((c) => c.length >= AKAR_MIN || c === k);
}

const rapikanTeks = (s: string) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function kataIsi(teks: string): string[] {
  return rapikanTeks(teks)
    .split(' ')
    .filter((w) => w.length >= 3 && !KATA_UMUM.has(w) && !/^\d+$/.test(w));
}

export function akarTeks(teks: string): Set<string> {
  const himpunan = new Set<string>();
  for (const w of kataIsi(teks)) for (const a of akarKata(w)) himpunan.add(a);
  return himpunan;
}

const POLA_THINK = /<think>[\s\S]*?<\/think>/gi;
const PENANDA_BUTIR = /^\s*(?:[-*+•]|\d+[.)])\s+/;

const barisPemisahTabel = (baris: string) => /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-*:?\s*\|?$/.test(baris);

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

export const KATA_MIN_DINILAI = 4;

export const PORSI_SANDARAN = 0.34;

export const AMBANG_TUDUH = 0.15;

export type Sandaran = { indeks: number; porsi: number };

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

export function sandaranKlaim(klaim: string, akarPotongan: Set<string>[]): Sandaran | null {
  const t = porsiTerbaik(klaim, akarPotongan);
  return t && t.porsi >= PORSI_SANDARAN ? t : null;
}

export type NilaiKlaim = {
  dinilai: string[];
  bersandar: { klaim: string; sandaran: Sandaran }[];
  takBersandar: string[];
  takDiputuskan: string[];
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
    if (!terbaik) continue;
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

export const KLAIM_MIN_DIPUTUS = 2;

export type PutusanKlaim =
  | { putusan: 'diam' }
  | { putusan: 'parsial'; alasan: string; takBersandar: string[]; atribusi: { indeks: number; jumlah: number }[] }
  | { putusan: 'hipotesis'; alasan: string; takBersandar: string[]; atribusi: { indeks: number; jumlah: number }[] };

export function putuskanKlaim(jawaban: string, isiDokumen: string[]): PutusanKlaim {
  const nilai = nilaiKlaim(jawaban, isiDokumen);
  if (nilai.dinilai.length < KLAIM_MIN_DIPUTUS) return { putusan: 'diam' };
  if (!nilai.takBersandar.length) return { putusan: 'diam' };

  const total = nilai.dinilai.length;
  const kurang = nilai.takBersandar.length;
  const dasar = { takBersandar: nilai.takBersandar, atribusi: nilai.atribusi };

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

export function ringkasTakBersandar(takBersandar: string[], maksimal = 2): string {
  const petik = takBersandar.slice(0, maksimal).map((k) => `"${k.length > 120 ? `${k.slice(0, 117)}…` : k}"`);
  const sisa = takBersandar.length - petik.length;
  return petik.join('; ') + (sisa > 0 ? ` (dan ${sisa} lainnya)` : '');
}
