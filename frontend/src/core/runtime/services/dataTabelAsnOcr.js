
import { bacaWorkbookAsn, cariNip, kelompokSheet } from './dataTabelAsn.js';

export const SUMBER_OCR = 'ocr';
const PENGALI_BARIS = 1000;

const rapat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const kecil = (s) => rapat(s).toLowerCase();

export function pisahHalamanOcr(teks) {
  const bagian = String(teks || '').split(/<!--\s*HALAMAN\s+(\d+)\s*-->/);
  const hasil = [];
  for (let i = 1; i < bagian.length; i += 2) hasil.push({ nomor: Number(bagian[i]), teks: bagian[i + 1] || '' });
  return hasil;
}

const barisTabel = (l) => /^\s*\|.*\|\s*$/.test(l);
const pemisah = (sel) => sel.length > 0 && sel.every((x) => /^:?-{2,}:?$/.test(x.trim()));
const selDari = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
  .map((x) => rapat(x)).map((x) => (/^[=_~—–-]+$/.test(x) ? '-' : x));
const judulTabel = (l) => {
  const t = rapat(l.replace(/^#+\s*/, ''));
  if (!t) return '';
  if (/^#/.test(l.trim())) return t;
  return /jabatan/i.test(t) && /data|asn|ans/i.test(t) ? t : '';
};

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

export function dariOcr(halaman) {
  const catatan = [];
  const per = halaman.map((h) => ({ ...h, tabel: tabelHalaman(h.teks) }));

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
  const menunggu = [];
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
        const kolomJabatan = t.baris[iJudul].find((x) => /jabatan/i.test(x)) || '';
        const nama = kelompokSheet(t.judul) !== 'tidak_dikenal' ? t.judul
          : rapat(`${t.judul || `Tabel halaman ${h.nomor}`} — ${kolomJabatan}`).replace(/ — $/, '');
        aktif = { nama, baris: [], asal: [], lebar, halaman: [h.nomor] };
        sheets.push(aktif);
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

export function uraiBaris(kode) {
  if (!Number.isInteger(kode) || kode >= 0) return String(kode ?? '');
  const n = -kode;
  return `hal. ${Math.floor(n / PENGALI_BARIS)} baris ${n % PENGALI_BARIS}`;
}
export const labelBaris = (kode) => (Number.isInteger(kode) && kode >= 0 ? `baris ${kode}` : uraiBaris(kode));

export function bacaOcrAsn(namaBerkas, halaman) {
  const { sheets, catatan } = dariOcr(halaman);
  const hasil = bacaWorkbookAsn(sheets.map((s) => ({ nama: s.nama, baris: s.baris, gabungan: [], barisAwal: 1, kolomAwal: 0 })));
  hasil.sheets.forEach((h, i) => {
    const asal = sheets[i].asal;
    const tukar = (n) => (Number.isInteger(n) && asal[n - 1] !== undefined ? asal[n - 1] : n);
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
