/**
 * BAGIAN TIDAK TERCAMPUR & BARIS KONTEKS DI SETIAP POTONGAN (Item 89 / Item 90 Tahap C, 2026-09-17)
 *
 * Buku Kepbup Standar Kompetensi Jabatan OKU memuat ±220 jabatan dengan susunan sama (I. IKHTISAR
 * JABATAN, II. STANDAR KOMPETENSI, III. PERSYARATAN JABATAN). Nama jabatan hanya tertulis sekali di
 * awal tiap jabatan, jadi potongan tabel persyaratan tidak tahu milik jabatan mana — pertanyaan
 * "… untuk Sekretaris DPRD" kalah oleh potongan yang menyebut nama itu (ukur: ROADMAP-KONTEKS-POTONGAN-RAG §2).
 * mistral-ocr juga menggabungkan tabel kompetensi & tabel persyaratan menjadi satu tabel Markdown,
 * sehingga baris "| III. PERSYARATAN JABATAN | | |" muncul di TENGAH tabel.
 *
 * Aturan diukur pada teks ekstraksi nyata (Tahap 0: buku Kepbup 1.008 halaman, berkas uji, HCDP DOCX,
 * KATALOG-PENDAS, Operator Handbook):
 *   - Judul bagian = angka Romawi + titik + teks HURUF BESAR, sebagai baris biasa atau satu-satunya sel
 *     berisi pada baris tabel. pdf.js kadang menempel ("II.STANDAR KOMPETENSI"). Judul yang diakhiri
 *     nomor halaman ("II. PENUTUP 275") adalah daftar isi → bukan judul.
 *   - Identitas HANYA "Nama Jabatan : …" (+ "Urusan Pemerintah : …" sebagai pembeda: 13× "Camat",
 *     13× "Sekretaris Camat"). Pola "kunci : nilai" umum ditolak — menangkap halaman redaksi KATALOG,
 *     daftar negara Operator Handbook, dan blok "Kolom: Mutlak | Penting | Perlu" (Item 88).
 *   - Baris konteks hanya ditempel bila dokumen punya identitas (keputusan Owner 2026-09-17): dokumen
 *     tanpa identitas (HCDP, KATALOG, …) tidak diberi awalan — awalan judul pernah menurunkan skor
 *     pertanyaan yang kata kuncinya sudah ada di potongan (Item 76).
 *
 * Murni — diuji di Node.
 */

const MAKS_KONTEKS = 220;

/** Isi sel tabel Markdown yang tidak kosong, atau null bila `baris` bukan baris tabel. */
function selBerisi(baris: string): string[] | null {
  const t = baris.trim();
  if (!t.startsWith('|') || !t.endsWith('|')) return null;
  return t.slice(1, -1).split('|').map((s) => s.trim()).filter(Boolean);
}

/** Teks tunggal sebuah baris: baris biasa, atau satu-satunya sel berisi pada baris tabel. */
function teksTunggal(baris: string): string | null {
  const sel = selBerisi(baris);
  if (sel) return sel.length === 1 ? sel[0] : null;
  const t = baris.trim();
  return t || null;
}

const JUDUL_ROMAWI = /^([IVX]{1,5})\.\s*([A-Z][A-Z0-9 ,.\/&()\-]{3,80})$/;

/** "III. PERSYARATAN JABATAN" bila `baris` adalah judul bagian Romawi, selain itu null. */
export function judulBagian(baris: string): string | null {
  const t = teksTunggal(baris);
  if (!t) return null;
  const m = t.match(JUDUL_ROMAWI);
  if (!m) return null;
  const isi = m[2].trim();
  if (/\s\d{1,4}$/.test(isi)) return null;                 // daftar isi: "II. PENUTUP 275"
  return `${m[1]}. ${isi}`;
}

const NAMA_JABATAN = /^Nama\s*Jabatan\s*:?\s*(.*)$/;
const URUSAN = /^Urusan\s*Pemerintah(?:an)?\s*:\s*(.+)$/;
const JARAK_URUSAN = 6;                                     // baris sesudah "Nama Jabatan"

export interface PeristiwaKonteks { posisi: number; jenis: 'identitas' | 'bagian'; nilai: string; }

/** Urutan peristiwa (posisi awal baris) identitas & judul bagian di teks penuh. */
export function petaKonteks(teks: string): PeristiwaKonteks[] {
  const hasil: PeristiwaKonteks[] = [];
  const baris = teks.split('\n');
  const awal: number[] = [];
  let pos = 0;
  for (const b of baris) { awal.push(pos); pos += b.length + 1; }

  for (let i = 0; i < baris.length; i++) {
    const t = teksTunggal(baris[i]);
    if (!t) continue;
    const nama = t.match(NAMA_JABATAN);
    if (nama) {
      let nilai = nama[1].trim();
      // Nilai terlipat ke baris berikutnya: "Nama Jabatan" / ": Kepala Bidang …"
      if (!nilai || nilai === ':') {
        const berikut = (baris[i + 1] || '').trim();
        if (berikut.startsWith(':')) nilai = berikut.slice(1).trim();
      } else if (!/:/.test(t.slice(0, t.length - nama[1].length))) {
        continue;                                            // "Nama Jabatan" tanpa titik dua & nilai sebaris → bukan identitas
      }
      if (nilai.length < 3) continue;
      let urusan = '';
      for (let j = i + 1; j <= i + JARAK_URUSAN && j < baris.length; j++) {
        const u = (teksTunggal(baris[j]) || '').match(URUSAN);
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

/**
 * Baris konteks untuk potongan yang isinya dimulai di `posisi`, atau null bila belum ada identitas.
 * Identitas baru mengosongkan bagian (jabatan berikutnya dimulai).
 */
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

/** Isi potongan yang dimulai di `awal` → diawali baris konteks bila ada & belum termuat di isinya. */
export function tambahKonteks(peta: PeristiwaKonteks[], teks: string, awal: number, isi: string): string {
  if (!isi || !peta.length) return isi;
  let posisi = awal;
  while (posisi < teks.length && /\s/.test(teks[posisi])) posisi++;
  const konteks = konteksPada(peta, posisi);
  if (!konteks) return isi;
  // Potongan yang memuat baris "Nama Jabatan" sendiri tidak perlu awalan.
  if (/Nama\s*Jabatan\s*:?/.test(isi)) return isi;
  return `${konteks}\n${isi}`;
}

/**
 * Porsi potongan tempat judul bagian memicu pemotongan (diukur 2026-09-17 pada unggahan nyata berkas uji
 * Kepbup, baris tabel OCR ±200 huruf): 0,3 masih mencampur kompetensi + persyaratan di 41 dari 81 posisi
 * awal potongan; 0,6 bersama `awalBagianSesudah` (240 huruf) → 0.
 */
export const PORSI_JENDELA_BAGIAN = 0.6;
export const JANGKAU_MAJU_BAGIAN = 0.3;

/**
 * Awal baris judul bagian yang dimulai di [akhir, akhir + jangkau] — potongan cukup diperpanjang sampai
 * judul itu (tidak melewatinya), supaya potongan berikutnya dimulai di judul, bukan di ekor bagian lama.
 * -1 bila tak ada.
 */
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

/**
 * Titik potong baru: awal baris judul bagian TERAKHIR di jendela akhir potongan (`porsiJendela` dari
 * panjang maksimum), supaya bagian baru dimulai di potongan berikutnya. `akhir` bila tak ada.
 */
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
