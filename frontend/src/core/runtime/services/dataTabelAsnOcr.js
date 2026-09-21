// DATA TABEL dari PDF PINDAIAN (Item 92 Tahap 5, 2026-09-21) — adaptor hasil OCR (markdown mistral-ocr) → bentuk
// masukan pembaca yang sama dengan Excel (`bacaSheetAsn`). Murni, tanpa pustaka, bisa diuji di Node.
//
// Pengukuran 10 PDF / 39 halaman (semua gambar pindaian, 0 huruf di lapisan teks) menemukan yang ditangani di sini:
//   - Tabel bersambung ke halaman berikutnya TANPA judul kolom → disambung ke tabel terakhir yang berjudul.
//   - Halaman dipindai DUA KALI (Disdik fungsional: hal. 1–2 = hal. 4–5) → halaman yang NIP-nya sudah ada di halaman
//     lain dilewati, dengan catatan.
//   - Tabel lanjutan dengan jumlah kolom BERBEDA dari judulnya (11 vs 12) → dicatat; isi kolom kanan patut dicek.
//   - Baris asal: tidak ada nomor baris Excel → disandikan NEGATIF: −(halaman × 1000 + urutan baris tabel di halaman
//     itu). Negatif supaya tak pernah bentrok dengan baris Excel asli (RSUD JFT sampai baris 1.095). Lihat `uraiBaris`.
// Yang TIDAK bisa ditangani kode dan wajib lewat pratinjau: digit NIP salah baca, isi bergeser kolom, nomor urut
// salah baca. Karena itu setiap hasil OCR ditandai `sumber: 'ocr'`.

import { bacaWorkbookAsn, cariNip, kelompokSheet } from './dataTabelAsn.js';

export const SUMBER_OCR = 'ocr';
const PENGALI_BARIS = 1000;

const rapat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const kecil = (s) => rapat(s).toLowerCase();

/** "<!-- HALAMAN n -->" (skrip ukur) → [{nomor, teks}]. Aplikasi memberi peta halaman langsung. */
export function pisahHalamanOcr(teks) {
  const bagian = String(teks || '').split(/<!--\s*HALAMAN\s+(\d+)\s*-->/);
  const hasil = [];
  for (let i = 1; i < bagian.length; i += 2) hasil.push({ nomor: Number(bagian[i]), teks: bagian[i + 1] || '' });
  return hasil;
}

const barisTabel = (l) => /^\s*\|.*\|\s*$/.test(l);
const pemisah = (sel) => sel.length > 0 && sel.every((x) => /^:?-{2,}:?$/.test(x.trim()));
// Tanda strip kosong dibaca OCR sebagai "=", "_", "—" (Ulu Ogan: "= | = | =") → "-".
const selDari = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
  .map((x) => rapat(x)).map((x) => (/^[=_~—–-]+$/.test(x) ? '-' : x));
// Judul tabel: baris "# …", atau baris teks biasa yang menyebut jabatan (Talang Jawa hal. 2 tanpa "#").
const judulTabel = (l) => {
  const t = rapat(l.replace(/^#+\s*/, ''));
  if (!t) return '';
  if (/^#/.test(l.trim())) return t;
  return /jabatan/i.test(t) && /data|asn|ans/i.test(t) ? t : '';
};

/** Tabel markdown dalam satu halaman, masing-masing dengan judul (baris "# …") terakhir di atasnya. */
export function tabelHalaman(teks) {
  const hasil = [];
  let judul = '';
  let kini = null;
  const baris = String(teks || '').split('\n');
  baris.forEach((l, i) => {
    if (barisTabel(l)) {
      if (!kini) { kini = { judul, baris: [], nomorBaris: [] }; hasil.push(kini); }
      const sel = selDari(l);
      if (!pemisah(sel)) { kini.baris.push(sel); kini.nomorBaris.push(kini.baris.length); }
      return;
    }
    kini = null;
    const t = judulTabel(l);
    if (t && (/data|jabatan|asn/i.test(t) || !judul)) judul = t;
  });
  return hasil;
}

const barisJudulKolom = (sel) => sel.some((x) => /nama/i.test(x)) && sel.some((x) => /^no\.?$|jabatan/i.test(x));
const kosong = (sel) => sel.every((x) => !x || x === '-');

/**
 * Halaman hasil OCR → masukan `bacaWorkbookAsn` (satu "sheet" per tabel berjudul kolom) + catatan.
 * @param {Array<{nomor:number, teks:string}>} halaman
 */
export function dariOcr(halaman) {
  const catatan = [];
  const per = halaman.map((h) => ({ ...h, tabel: tabelHalaman(h.teks) }));

  // Halaman pindaian ganda: ≥2 NIP dan ≥80% NIP-nya ada di halaman lain → yang tanpa judul kolom / yang lebih awal
  // dilewati (yang disimpan: salinan yang mengikuti judul kolomnya).
  const nipHal = per.map((h) => new Set(h.tabel.flatMap((t) => t.baris.flatMap((s) => s.map((x) => cariNip(x)).filter(Boolean)))));
  const adaJudul = per.map((h) => h.tabel.some((t) => t.baris.some(barisJudulKolom)));
  const dilewati = new Set();
  per.forEach((h, i) => {
    const a = nipHal[i];
    if (a.size < 2) return;
    per.forEach((g, j) => {
      if (i === j || dilewati.has(j) || dilewati.has(i)) return;
      const sama = [...a].filter((n) => nipHal[j].has(n)).length;
      if (sama / a.size < 0.8) return;
      const buangI = adaJudul[j] && !adaJudul[i] ? true : adaJudul[i] && !adaJudul[j] ? false : i < j;
      if (buangI) {
        dilewati.add(i);
        catatan.push({ jenis: 'halaman_ganda', pesan: `halaman ${h.nomor} sama dengan halaman ${g.nomor} (dipindai dua kali, ${sama} NIP sama) — dilewati` });
      }
    });
  });

  const sheets = [];
  let aktif = null;
  const menunggu = []; // tabel tanpa judul kolom sebelum tabel berjudul pertama
  const tambahBaris = (s, t, h, dariIndeks) => {
    for (let r = dariIndeks; r < t.baris.length; r++) {
      const sel = t.baris[r];
      if (kosong(sel)) continue;
      const lebar = s.lebar;
      const isi = sel.length >= lebar ? sel.slice(0, lebar) : [...sel, ...Array(lebar - sel.length).fill('')];
      s.baris.push(isi);
      s.asal.push(-(h.nomor * PENGALI_BARIS + t.nomorBaris[r]));
    }
  };
  per.forEach((h, i) => {
    if (dilewati.has(i)) return;
    for (const t of h.tabel) {
      const iJudul = t.baris.findIndex(barisJudulKolom);
      if (iJudul >= 0) {
        const lebar = Math.max(...t.baris.map((s) => s.length));
        // Judul tanpa jenis jabatan (Baturaja Lama hal. 2 hanya "KABUPATEN … TAHUN 2026") → pakai judul kolom
        // jabatannya ("JABATAN SRUKTURAL") supaya kelompoknya tetap terbaca.
        const kolomJabatan = t.baris[iJudul].find((x) => /jabatan/i.test(x)) || '';
        const nama = kelompokSheet(t.judul) !== 'tidak_dikenal' ? t.judul
          : rapat(`${t.judul || `Tabel halaman ${h.nomor}`} — ${kolomJabatan}`).replace(/ — $/, '');
        aktif = { nama, baris: [], asal: [], lebar, halaman: [h.nomor] };
        sheets.push(aktif);
        // Judul kolom + subjudul disalin apa adanya (tanpa baris kosong), lalu data.
        for (let r = iJudul; r < t.baris.length; r++) {
          const sel = t.baris[r];
          if (r > iJudul && kosong(sel)) continue;
          aktif.baris.push(sel.length >= lebar ? sel : [...sel, ...Array(lebar - sel.length).fill('')]);
          aktif.asal.push(-(h.nomor * PENGALI_BARIS + t.nomorBaris[r]));
        }
        for (const m of menunggu.splice(0)) {
          catatan.push({ jenis: 'urutan_halaman', pesan: `tabel tanpa judul kolom di halaman ${m.h.nomor} (sebelum judulnya) disambung ke "${aktif.nama}"` });
          tambahBaris(aktif, m.t, m.h, 0);
        }
        continue;
      }
      if (!t.baris.some((s) => !kosong(s))) continue;
      if (!aktif) {
        // Tabel sebelum judul kolom pertama: disimpan hanya bila berisi angka mirip NIP (halaman data yang urutannya
        // terbalik, Disdik). Tabel surat pengantar ("No | Isi Surat | Banyaknya") tidak — dulu terbaca sebagai orang.
        if (t.baris.some((s) => s.some((x) => /\d{14,}/.test(x.replace(/[\s.'’]/g, ''))))) menunggu.push({ t, h });
        continue;
      }
      const lebarT = Math.max(...t.baris.map((s) => s.length));
      if (lebarT !== aktif.lebar) {
        catatan.push({ jenis: 'kolom_beda', pesan: `tabel lanjutan halaman ${h.nomor} punya ${lebarT} kolom, judulnya ${aktif.lebar} — isi kolom paling kanan patut dicek` });
      }
      if (!aktif.halaman.includes(h.nomor)) aktif.halaman.push(h.nomor);
      tambahBaris(aktif, t, h, 0);
    }
  });
  for (const m of menunggu) catatan.push({ jenis: 'tanpa_judul', pesan: `tabel di halaman ${m.h.nomor} tanpa judul kolom dan tanpa tabel berjudul sesudahnya — tidak dibaca` });
  return { sheets, catatan };
}

/** Baris asal untuk ditampilkan: Excel → "12"; hasil OCR (negatif) → "hal. 3 baris 5". */
export function uraiBaris(kode) {
  if (!Number.isInteger(kode) || kode >= 0) return String(kode ?? '');
  const n = -kode;
  return `hal. ${Math.floor(n / PENGALI_BARIS)} baris ${n % PENGALI_BARIS}`;
}
/** Seperti uraiBaris, tetapi Excel diberi kata "baris": "baris 12" / "hal. 3 baris 5". */
export const labelBaris = (kode) => (Number.isInteger(kode) && kode >= 0 ? `baris ${kode}` : uraiBaris(kode));

/**
 * Hasil OCR satu PDF → bentuk yang sama dengan `bacaBerkasExcelAsn` (+ `sumber: 'ocr'`, `catatanOcr`). Nomor baris
 * dari pembaca (indeks baris sheet gabungan) ditukar ke kode halaman/baris asal.
 */
export function bacaOcrAsn(namaBerkas, halaman) {
  const { sheets, catatan } = dariOcr(halaman);
  const hasil = bacaWorkbookAsn(sheets.map((s) => ({ nama: s.nama, baris: s.baris, gabungan: [], barisAwal: 1, kolomAwal: 0 })));
  hasil.sheets.forEach((h, i) => {
    const asal = sheets[i].asal;
    const tukar = (n) => (Number.isInteger(n) && asal[n - 1] !== undefined ? asal[n - 1] : n);
    // NIP terpotong OCR (Ulu Ogan: 16–17 digit): pembaca hanya menerima 18 digit → orangnya "tanpa NIP" diam-diam.
    // Deret 14–20 digit di baris orang (atau baris bawahnya) dicatat supaya dicek ke berkas kertasnya.
    const rusak = [];
    for (const o of h.orang) {
      if (o.nip) continue;
      const teks = [sheets[i].baris[o.baris_asal - 1], sheets[i].baris[o.baris_asal]].flat().join(' ').replace(/(\d)[\s.'’]+(?=\d)/g, '$1');
      const m = teks.match(/(?:^|\D)(\d{14,20})(?!\d)/);
      if (m && m[1].length !== 18) rusak.push({ o, panjang: m[1].length });
    }
    for (const o of h.orang) o.baris_asal = tukar(o.baris_asal);
    for (const { o, panjang } of rusak) {
      h.kejanggalan.push({ jenis: 'nip_tak_lengkap', pesan: `angka NIP terbaca ${panjang} digit (harus 18) — cek berkas kertas: ${o.nama}`, baris: o.baris_asal });
    }
    if (rusak.length && h.status === 'BERSIH') h.status = 'PERLU_CEK';
    for (const k of h.kejanggalan) if (k.baris) k.baris = tukar(k.baris);
    for (const d of h.dilewati) d.baris = tukar(d.baris);
    if (h.jumlahTertulis) h.jumlahTertulis.baris = tukar(h.jumlahTertulis.baris);
    h.sumber = SUMBER_OCR;
    h.halaman = sheets[i].halaman;
  });
  return { berkas: namaBerkas, sumber: SUMBER_OCR, catatanOcr: catatan, ...hasil };
}
