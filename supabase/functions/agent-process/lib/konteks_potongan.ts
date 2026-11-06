
const MAKS_KONTEKS = 220;

function selBerisi(baris: string): string[] | null {
  const t = baris.trim();
  if (!t.startsWith('|') || !t.endsWith('|')) return null;
  return t.slice(1, -1).split('|').map((s) => s.trim()).filter(Boolean);
}

function teksTunggal(baris: string): string | null {
  const sel = selBerisi(baris);
  if (sel) return sel.length === 1 ? sel[0] : null;
  const t = baris.trim();
  return t || null;
}

const JUDUL_ROMAWI = /^([IVX]{1,5})\.\s*([A-Z][A-Z0-9 ,.\/&()\-]{3,80})$/;

export function judulBagian(baris: string): string | null {
  const t = teksTunggal(baris);
  if (!t) return null;
  const m = t.match(JUDUL_ROMAWI);
  if (!m) return null;
  const isi = m[2].trim();
  if (/\s\d{1,4}$/.test(isi)) return null;
  return `${m[1]}. ${isi}`;
}

const NAMA_JABATAN = /^Nama\s*Jabatan\s*:?\s*(.*)$/;
const URUSAN = /^Urusan\s*Pemerintah(?:an)?\s*:\s*(.+)$/;
const JARAK_URUSAN = 8;

function barisKunciNilai(baris: string): string | null {
  const sel = selBerisi(baris);
  if (!sel) return teksTunggal(baris);
  if (sel.length === 1) return sel[0];
  const isi = sel.filter((s) => s !== ':');
  if (isi.length < 2 || !/^(Nama\s*Jabatan|Urusan\s*Pemerintah(?:an)?|Kelompok\s*Jabatan|Kode\s*Jabatan)$/i.test(isi[0])) return null;
  return `${isi[0]} : ${isi.slice(1).join(' ')}`;
}

export interface PeristiwaKonteks { posisi: number; jenis: 'identitas' | 'bagian'; nilai: string; }

export function petaKonteks(teks: string): PeristiwaKonteks[] {
  const hasil: PeristiwaKonteks[] = [];
  const baris = teks.split('\n');
  const awal: number[] = [];
  let pos = 0;
  for (const b of baris) { awal.push(pos); pos += b.length + 1; }

  for (let i = 0; i < baris.length; i++) {
    const t = barisKunciNilai(baris[i]);
    if (!t) continue;
    const nama = t.match(NAMA_JABATAN);
    if (nama) {
      let nilai = nama[1].trim();
      if (!nilai || nilai === ':') {
        const berikut = (baris[i + 1] || '').trim();
        if (berikut.startsWith(':')) nilai = berikut.slice(1).trim();
      } else if (!/:/.test(t.slice(0, t.length - nama[1].length))) {
        continue;
      }
      if (nilai.length < 3) continue;
      let urusan = '';
      for (let j = i + 1; j <= i + JARAK_URUSAN && j < baris.length; j++) {
        const u = (barisKunciNilai(baris[j]) || '').match(URUSAN);
        if (u) { urusan = u[1].trim(); break; }
        if (judulBagian(baris[j])) break;
      }
      hasil.push({
        posisi: awal[i], jenis: 'identitas',
        nilai: `Nama Jabatan: ${nilai}${urusan ? ` · Urusan Pemerintah: ${urusan}` : ''}`
      });
      continue;
    }
    const bagian = judulBagian(baris[i]);
    if (bagian) hasil.push({ posisi: awal[i], jenis: 'bagian', nilai: bagian });
  }
  return hasil;
}

export function konteksPada(peta: PeristiwaKonteks[], posisi: number): string | null {
  let identitas: string | null = null;
  let bagian: string | null = null;
  for (const p of peta) {
    if (p.posisi > posisi) break;
    if (p.jenis === 'identitas') { identitas = p.nilai; bagian = null; } else bagian = p.nilai;
  }
  if (!identitas) return null;
  const isi = bagian ? `${identitas} › ${bagian}` : identitas;
  return `[Konteks: ${isi.length > MAKS_KONTEKS ? `${isi.slice(0, MAKS_KONTEKS - 1)}…` : isi}]`;
}

export function tambahKonteks(peta: PeristiwaKonteks[], teks: string, awal: number, isi: string): string {
  if (!isi || !peta.length) return isi;
  let posisi = awal;
  while (posisi < teks.length && /\s/.test(teks[posisi])) posisi++;
  const konteks = konteksPada(peta, posisi);
  if (!konteks) return isi;
  if (/Nama\s*Jabatan\s*:?/.test(isi)) return isi;
  return `${konteks}\n${isi}`;
}

export const PORSI_JENDELA_BAGIAN = 0.6;
export const JANGKAU_MAJU_BAGIAN = 0.3;

export function awalBagianSesudah(teks: string, akhir: number, jangkau: number): number {
  if (akhir >= teks.length) return -1;
  let awalBaris = akhir === 0 || teks[akhir - 1] === '\n' ? akhir : teks.indexOf('\n', akhir) + 1;
  while (awalBaris > 0 && awalBaris <= akhir + jangkau && awalBaris < teks.length) {
    const akhirBaris = teks.indexOf('\n', awalBaris);
    if (judulBagian(teks.slice(awalBaris, akhirBaris < 0 ? teks.length : akhirBaris))) return awalBaris;
    if (akhirBaris < 0) break;
    awalBaris = akhirBaris + 1;
  }
  return -1;
}

export function akhirSebelumBagian(teks: string, awal: number, akhir: number, maks: number, porsiJendela = PORSI_JENDELA_BAGIAN): number {
  const batasJendela = awal + Math.round(maks * (1 - porsiJendela));
  let cari = akhir;
  while (cari > batasJendela) {
    const awalBaris = teks.lastIndexOf('\n', cari - 1) + 1;
    if (awalBaris <= batasJendela) break;
    const akhirBaris = teks.indexOf('\n', awalBaris);
    if (judulBagian(teks.slice(awalBaris, akhirBaris < 0 ? teks.length : akhirBaris))) return awalBaris;
    cari = awalBaris - 1;
  }
  return akhir;
}
