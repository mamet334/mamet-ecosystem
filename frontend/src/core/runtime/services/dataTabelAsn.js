// DATA TABEL REKONSILIASI ASN — pengenal struktur (Item 92 Tahap 1, 2026-09-21)
//
// Membaca sheet Excel kiriman OPD menjadi SATU BENTUK BAKU per orang, tanpa AI dan tanpa vektor. RAG tidak bisa
// menjawab "berapa" / "siapa yang belum" (butuh semua baris & sel kosong) — jalur ini yang menghitung, dengan kode.
//
// Murni: tidak mengimpor pustaka apa pun. Pembaca berkas (SheetJS dll.) diubah dulu ke bentuk
// { nama, baris: string[][], gabungan: [{s:{r,c}, e:{r,c}}] } lewat adaptor (dariSheetJS di bawah), supaya pustakanya
// bisa diganti tanpa menyentuh aturan, dan modul ini bisa diuji di Node dengan 53 berkas ukur.
//
// Aturan disusun dari pengukuran 53 xlsx `D:\REKONSIALISASI 2026` (roadmap Item 92 §3): 0 gagal, 48/48 baris JUMLAH
// cocok, 5/5 total kunci cocok. Setiap aturan di bawah ada karena satu berkas nyata membutuhkannya.

const rapat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const kecil = (s) => rapat(s).toLowerCase();
const NOMOR = /^\d+\.?$/;
const KOSONG_ISI = (v) => !v || v === '-' || v === '–';

// Judul kolom (gabungan baris judul bertingkat, huruf kecil) → bidang baku. Urutan penting: aturan pertama menang.
const ATURAN_KOLOM = [
  ['no', (l) => /^no\.?$|^nomor$/.test(l)],
  ['nama_nip', (l) => /nama/.test(l) && /nip/.test(l)],
  ['nama', (l) => /^nama\b|nama pegawai|nama asn/.test(l)],
  ['nip', (l) => /^nip\b|\bnip$/.test(l)],
  ['jk_l', (l) => /(kelamin|l\/p).*\bl$|^l$/.test(l)],
  ['jk_p', (l) => /(kelamin|l\/p).*\bp$|^p$/.test(l)],
  ['jk', (l) => /jenis kelamin|^l\/p$|^jk$/.test(l)],
  ['status', (l) => /status|pns\/|pppk/.test(l) && !/jabatan|pendidikan/.test(l)],
  ['pendidikan_cpns', (l) => /(pendidikan|pendidkan).*(cpns|awal)/.test(l)],
  // DPRD: "KUALIFIKASI PENDIDIKAN" dengan subjudul "PENDIDIKAN" / "TAHUN" → label gabungan berulang kata.
  ['tahun_lulus', (l) => /(pendidikan|kualifikasi).*\btahun( lulus)?$/.test(l)],
  ['pendidikan_akhir', (l) => /(pendidikan|pendidkan).*(akhir|ahkir|terakhir)/.test(l) || /^(kualifikasi )?pendidikan( pendidikan| terakhir)?$/.test(l)],
  ['pim2', (l) => /pim\s*(ii|2)$/.test(l)],
  ['pim3', (l) => /pim\s*(iii|3)$/.test(l)],
  ['pim4', (l) => /pim\s*(iv|4)$/.test(l)],
  ['pim', (l) => /kepemimpinan|\bpim\b/.test(l)],
  ['pelatihan', (l) => /pelatihan|diklat|bimtek|kompetensi/.test(l)],
  ['nilai_ipa', (l) => /nilai|ip ?asn|\bipa\b/.test(l)],
  ['jabatan', (l) => /jabatan|\bjft\b|pelaksana|struktural|fungsional/.test(l)],
  ['pangkat', (l) => /pangkat|gol/.test(l)],
];
// Bidang yang boleh muncul di lebih dari satu kolom (isinya digabung).
const BIDANG_JAMAK = new Set(['pelatihan', 'pim']);

export function kelompokSheet(nama) {
  const s = kecil(nama);
  if (/paruh|\bpw\b/.test(s) && !/pppk dan/.test(s)) return 'paruh_waktu';
  if (/pppk|p3k/.test(s)) return 'pppk';
  if (/struktural|\bjpt\b|administrator|pengawas/.test(s)) return 'struktural';
  if (/\bjft\b|fungsional tertentu/.test(s)) return 'jft';
  if (/pelaksana|\bjfu\b|fungs umum|umum/.test(s)) return 'pelaksana';
  if (/fungsional/.test(s)) return 'jft';
  return 'tidak_dikenal';
}

/** NIP 18 digit dari teks (spasi di tengah diabaikan). */
export function cariNip(...teks) {
  for (const t of teks) {
    const m = rapat(t).replace(/\s/g, '').match(/(?:^|\D)(\d{18})(?!\d)/);
    if (m) return m[1];
  }
  return '';
}

// Baris kaki: tanggal surat & blok tanda tangan ("Baturaja, 29 April 2026", "NIP. 1976…", "an. DIREKTUR").
const POLA_KAKI = [/^[a-z .]+,\s*\d{1,2}\s+[a-z]+\s+20\d{2}$/i, /^nip[.\s:]/i, /^(an|a\.n)\.?\s/i, /^mengetahui\b/i];

/** Salin nilai sel gabungan ke seluruh rentangnya; kembalikan set "r,c" sel hasil salinan. */
function isiGabungan(baris, gabungan) {
  const salinan = new Set();
  for (const m of gabungan || []) {
    const nilai = baris[m.s.r]?.[m.s.c];
    if (nilai === undefined || nilai === '') continue;
    for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) {
      if (r === m.s.r && c === m.s.c) continue;
      if (!baris[r]) continue;
      if (rapat(baris[r][c]) === '') { baris[r][c] = nilai; salinan.add(`${r},${c}`); }
    }
  }
  return salinan;
}

function cariBarisJudul(baris) {
  for (let i = 0; i < Math.min(baris.length, 20); i++) {
    const l = (baris[i] || []).map(kecil);
    if (l.some((x) => /nama/.test(x)) && l.some((x) => /^no\.?$|jabatan/.test(x))) return i;
  }
  return -1;
}

/** Huruf kolom Excel (0 → A, 26 → AA). */
export function hurufKolom(i) { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; }

/**
 * Baca satu sheet.
 * @param {{nama:string, baris:string[][], gabungan?:Array}} sheet  baris = sel sebagai teks, indeks 0 = baris pertama rentang
 * @param {{barisAwal?:number, kolomAwal?:number}} [opsi]  nomor baris Excel dari baris[0] (untuk baris_asal) dan indeks
 *   kolom Excel dari kolom ke-0 (untuk huruf kolom di pratinjau); bawaan 1 dan 0
 */
export function bacaSheetAsn(sheet, { barisAwal = 1, kolomAwal = 0 } = {}) {
  const baris = (sheet.baris || []).map((b) => (b || []).map((x) => (x === null || x === undefined ? '' : String(x))));
  const hasil = {
    sheet: sheet.nama, kelompok: kelompokSheet(sheet.nama), status: 'BERSIH',
    orang: [], pemetaan: [], kolomTakTerpeta: [], dilewati: [], kejanggalan: [], jumlahTertulis: null,
  };
  const janggal = (jenis, pesan, barisExcel) => hasil.kejanggalan.push({ jenis, pesan, ...(barisExcel ? { baris: barisExcel } : {}) });

  if (!baris.some((b) => b.some((x) => rapat(x)))) { hasil.status = 'KOSONG'; return hasil; }
  const salinan = isiGabungan(baris, sheet.gabungan);
  const hj = cariBarisJudul(baris);
  if (hj < 0) { hasil.status = 'GAGAL'; janggal('struktur', 'baris judul (NO / NAMA / JABATAN) tidak ditemukan'); return hasil; }

  // Judul bertingkat: baris kelompok di atas (bila ada), baris judul, 0–2 baris subjudul.
  const barisSub = (b) => b && !NOMOR.test(rapat(b[0])) && b.some((x) => /^(l|p|pim|cpns|akhir|ahkir|terakhir|ii|iii|iv|pendidikan|tahun)\b/i.test(rapat(x)));
  const judul = [];
  const atas = baris[hj - 1];
  if (atas && atas.filter((x) => rapat(x)).length >= 2 && atas.some((x) => /kelamin|pendidikan|pelatihan|jabatan/i.test(rapat(x)))) judul.push(atas);
  judul.push(baris[hj]);
  let nSub = 0;
  while (nSub < 2 && barisSub(baris[hj + 1 + nSub])) { judul.push(baris[hj + 1 + nSub]); nSub++; }

  const lebar = Math.max(...judul.map((b) => b.length));
  const peta = {};
  for (let c = 0; c < lebar; c++) {
    const bagian = [];
    for (const b of judul) { const v = rapat(b[c]); if (v && !bagian.includes(v)) bagian.push(v); }
    const label = kecil(bagian.join(' '));
    if (!label) continue;
    const hit = ATURAN_KOLOM.find(([, f]) => f(label));
    const huruf = hurufKolom(c + kolomAwal);
    if (!hit) { hasil.kolomTakTerpeta.push({ kolom: c, huruf, label }); continue; }
    let bidang = hit[0];
    if (peta[bidang] !== undefined) {
      if (BIDANG_JAMAK.has(bidang)) { peta[bidang + '_lain'] = [...(peta[bidang + '_lain'] || []), c]; hasil.pemetaan.push({ kolom: c, huruf, label, bidang }); continue; }
      if (bidang === 'nama_nip' && peta.nip === undefined) bidang = 'nip'; // "NAMA /NIP" digabung di atas dua kolom
      else { hasil.kolomTakTerpeta.push({ kolom: c, huruf, label: `${label} (ganda: ${bidang})` }); continue; }
    }
    peta[bidang] = c;
    hasil.pemetaan.push({ kolom: c, huruf, label, bidang });
  }
  if (peta.no === undefined) peta.no = 0;
  const kolomNama = peta.nama_nip ?? peta.nama;
  if (kolomNama === undefined) { hasil.status = 'GAGAL'; janggal('struktur', 'kolom nama tidak dikenali'); return hasil; }
  if (peta.jabatan === undefined) janggal('struktur', 'kolom jabatan tidak dikenali');

  const kolomPelatihan = [peta.pelatihan, ...(peta.pelatihan_lain || [])].filter((c) => c !== undefined);
  const ambilPelatihan = (b) => kolomPelatihan.map((c) => rapat(b[c])).filter((x) => !KOSONG_ISI(x));
  const kolomPim = [['II', peta.pim2], ['III', peta.pim3], ['IV', peta.pim4]].filter(([, c]) => c !== undefined);

  const mulai = hj + 1 + nSub;
  for (let i = mulai; i < baris.length; i++) {
    const b = baris[i];
    const noteks = rapat(b[peta.no]);
    const barisExcel = i + barisAwal;
    if (/^(jumlah|total)\b/i.test(noteks) || /^(jumlah|total)\b/i.test(rapat(b[1]))) {
      const tl = rapat(b[peta.jk_l]), tp = rapat(b[peta.jk_p]);
      if (peta.jk_l !== undefined && peta.jk_p !== undefined && /^\d+$/.test(tl)) {
        // Sel JUMLAH digabung melintasi kolom L & P (Sosoh Buay Rayap, INSPEKTORAT, SETDA…) = satu total, bukan L dan P.
        if (salinan.has(`${i},${peta.jk_p}`) || !/^\d+$/.test(tp)) hasil.jumlahTertulis = { l: null, p: null, total: Number(tl), baris: barisExcel };
        else hasil.jumlahTertulis = { l: Number(tl), p: Number(tp), total: Number(tl) + Number(tp), baris: barisExcel };
      }
      break;
    }
    const namaMentah = rapat(b[kolomNama]);
    const nomorBaru = NOMOR.test(noteks) && !(salinan.has(`${i},${peta.no}`) && hasil.orang.length && hasil.orang[hasil.orang.length - 1].no === noteks.replace('.', ''));

    if (nomorBaru) {
      if (!namaMentah) { hasil.dilewati.push({ baris: barisExcel, alasan: 'baris bernomor tanpa nama (templat kosong)' }); continue; }
      // Baris bawah milik orang yang sama bila nomornya kosong ATAU hasil salinan sel gabungan (DPRD: "NIP. …" di bawah nama)
      const nb = baris[i + 1];
      const berikut = nb && (!NOMOR.test(rapat(nb[peta.no])) || salinan.has(`${i + 1},${peta.no}`)) ? nb : [];
      const nip = cariNip(namaMentah, peta.nip !== undefined ? b[peta.nip] : '', ...b) || cariNip(...berikut);
      const nama = rapat(namaMentah.replace(/(?:nip\.?\s*[:.]?\s*)?\d[\d\s]{16,}\d/i, '').replace(/[\/|,;]\s*$/, '').replace(/\s*\/\s*$/, ''));
      const jl = peta.jk_l !== undefined && !KOSONG_ISI(rapat(b[peta.jk_l]));
      const jp = peta.jk_p !== undefined && !KOSONG_ISI(rapat(b[peta.jk_p]));
      let jk = jl && !jp ? 'L' : jp && !jl ? 'P' : '';
      if (!jk && peta.jk !== undefined) { const v = kecil(b[peta.jk]); jk = /^l/.test(v) ? 'L' : /^p/.test(v) ? 'P' : ''; }
      if (jl && jp) janggal('jenis_kelamin', `L dan P sama-sama terisi: ${nama}`, barisExcel);
      // Nilai bidang dari baris orang; bila kosong, dari baris bawah milik orang yang sama (DPRD menaruh pendidikan &
      // tahun di baris NIP).
      const ambil = (bidang) => { const c = peta[bidang]; if (c === undefined) return ''; const v = rapat(b[c]); return v || rapat(berikut[c]); };
      const pim = kolomPim.filter(([, c]) => !KOSONG_ISI(rapat(b[c]))).map(([t]) => t);
      if (peta.pim !== undefined) { const v = rapat(b[peta.pim]); if (!KOSONG_ISI(v)) pim.push(v); }
      hasil.orang.push({
        no: noteks.replace('.', ''), baris_asal: barisExcel, nama, nip, jenis_kelamin: jk,
        status: ambil('status'), pendidikan_cpns: ambil('pendidikan_cpns'), pendidikan_akhir: ambil('pendidikan_akhir'),
        tahun_lulus: ambil('tahun_lulus'), jabatan: ambil('jabatan'), pangkat: ambil('pangkat'),
        pim, pelatihan: ambilPelatihan(b), nilai_ipa: ambil('nilai_ipa'),
      });
      continue;
    }
    if (!hasil.orang.length) continue;
    // Baris kaki (tanda tangan) → data selesai; jangan sampai masuk ke pelatihan orang terakhir. Hanya sel asli di
    // luar kolom pelatihan yang dinilai: nama pelatihan sering memuat tempat & tanggal ("…Jakarta, 28 Agustus 2023").
    const selKaki = b.some((x, c) => !kolomPelatihan.includes(c) && !salinan.has(`${i},${c}`) && POLA_KAKI.some((p) => p.test(rapat(x))));
    if (!namaMentah && selKaki) break;
    // Baris lanjutan orang sebelumnya: pelatihan tambahan — kecuali salinan sel gabungan (isinya sudah diambil).
    const pel = kolomPelatihan.filter((c) => !salinan.has(`${i},${c}`)).map((c) => rapat(b[c])).filter((x) => !KOSONG_ISI(x));
    if (pel.length) hasil.orang[hasil.orang.length - 1].pelatihan.push(...pel);
  }

  // Kejanggalan data (bahan rekonsiliasi)
  const o = hasil.orang;
  if (!o.length) hasil.status = hasil.dilewati.length ? 'KOSONG' : 'GAGAL';
  const tanpaJabatan = o.filter((x) => !x.jabatan);
  if (peta.jabatan !== undefined && tanpaJabatan.length) janggal('jabatan_kosong', `${tanpaJabatan.length} orang tanpa jabatan`);
  const tanpaNip = o.filter((x) => !x.nip);
  if (tanpaNip.length) janggal('tanpa_nip', `${tanpaNip.length} orang tanpa NIP terbaca`);
  const nomor = o.map((x) => x.no); const nomorGanda = [...new Set(nomor.filter((x, i) => nomor.indexOf(x) !== i))];
  if (nomorGanda.length) janggal('nomor_ganda', `nomor urut ganda: ${nomorGanda.join(', ')}`);
  const nips = o.filter((x) => x.nip).map((x) => x.nip); const nipGanda = [...new Set(nips.filter((x, i) => nips.indexOf(x) !== i))];
  if (nipGanda.length) janggal('nip_ganda', `${nipGanda.length} NIP muncul lebih dari sekali di sheet ini`);
  if (hasil.jumlahTertulis) {
    const l = o.filter((x) => x.jenis_kelamin === 'L').length, p = o.filter((x) => x.jenis_kelamin === 'P').length;
    const t = hasil.jumlahTertulis;
    const tertulis = t.l === null ? `${t.total}` : `L${t.l}+P${t.p}=${t.total}`;
    if (t.total !== o.length)
      janggal('jumlah_salah', `baris JUMLAH tertulis ${tertulis}, terbaca ${o.length} orang (L${l} P${p})`, t.baris);
    else if (t.l !== null && (t.l !== l || t.p !== p))
      // Total cocok tetapi pembagian L/P tidak: tanda L/P per orang tak sejalan dengan rumus JUMLAH di Excel.
      janggal('jumlah_lp_beda', `total ${t.total} cocok, tetapi JUMLAH tertulis L${t.l} P${t.p} sedangkan tanda per orang L${l} P${p}`, t.baris);
  }
  const berat = hasil.kejanggalan.some((k) => ['struktur', 'jabatan_kosong', 'nomor_ganda', 'jumlah_salah'].includes(k.jenis));
  if (hasil.status === 'BERSIH' && berat) hasil.status = 'PERLU_CEK';
  return hasil;
}

/** Baca semua sheet satu berkas + ringkasan. */
export function bacaWorkbookAsn(sheets) {
  const hasil = sheets.map((s) => bacaSheetAsn(s, { barisAwal: s.barisAwal || 1, kolomAwal: s.kolomAwal || 0 }));
  const orang = hasil.flatMap((h) => h.orang);
  const nips = orang.filter((x) => x.nip).map((x) => x.nip);
  const nipGandaBerkas = [...new Set(nips.filter((x, i) => nips.indexOf(x) !== i))];
  return {
    sheets: hasil,
    ringkasan: {
      jumlahOrang: orang.length,
      perKelompok: hasil.reduce((a, h) => ((a[h.kelompok] = (a[h.kelompok] || 0) + h.orang.length), a), {}),
      status: hasil.reduce((a, h) => ((a[h.status] = (a[h.status] || 0) + 1), a), {}),
      nipGandaAntarSheet: nipGandaBerkas.length,
    },
  };
}

/**
 * Adaptor SheetJS → bentuk masukan modul ini. Pustaka diberikan pemanggil (tidak diimpor di sini).
 * Indeks baris & kolom digeser dari awal rentang `!ref` (sheet tidak selalu mulai di A1 — DPRD).
 */
export function dariSheetJS(wb, XLSX) {
  return wb.SheetNames.map((nama) => {
    const ws = wb.Sheets[nama];
    if (!ws || !ws['!ref']) return { nama, baris: [], gabungan: [], barisAwal: 1, kolomAwal: 0 };
    const awal = XLSX.utils.decode_range(ws['!ref']).s;
    const baris = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: true });
    const gabungan = (ws['!merges'] || []).map((m) => ({
      s: { r: m.s.r - awal.r, c: m.s.c - awal.c }, e: { r: m.e.r - awal.r, c: m.e.c - awal.c },
    }));
    return { nama, baris, gabungan, barisAwal: awal.r + 1, kolomAwal: awal.c };
  });
}
