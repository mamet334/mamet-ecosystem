
import { bacaTabelCentang, tulisCentangDiItems, tulisCentangDiTeks } from './tabelCentang.js';

export const EKSTENSI_TEKS =['.txt', '.md', '.csv', '.json', '.html', '.xml'];
export const EKSTENSI_DIDUKUNG = [...EKSTENSI_TEKS, '.pdf', '.docx'];
export const ACCEPT_UNGGAH = EKSTENSI_DIDUKUNG.join(',');

const MAKS_MB = 60;
const AMBANG_HALAMAN_KOSONG = 25;
const PORSI_BERULANG = 0.3;
const PORSI_SCAN = 0.5;

const JARAK_MULTI_KOLOM = 25;
const JARAK_BARIS_YATIM = 60;
const PORSI_MULTI_KOLOM = 0.3;
const PORSI_BARIS_YATIM = 0.1;
const TOLERANSI_Y_BARIS = 3;

const DOLAR_PER_TOKEN = 0.20 / 1e6;
const HURUF_PER_TOKEN = 4;
const LANGKAH_POTONGAN = 700;
const TUMPANG_POTONGAN = 100;

export class GagalEkstrak extends Error {
  constructor(kode, message) {
    super(message);
    this.kode = kode;
  }
}

export function perkiraanUnggah(huruf) {
  const potongan = Math.max(1, Math.ceil(huruf / LANGKAH_POTONGAN));
  return { potongan, dolar: ((huruf + potongan * TUMPANG_POTONGAN) / HURUF_PER_TOKEN) * DOLAR_PER_TOKEN };
}

const ekstensi = (nama) => {
  const i = String(nama || '').lastIndexOf('.');
  return i >= 0 ? nama.slice(i).toLowerCase() : '';
};


const kunciBaris = (s) => s.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

function gabungBaris(bagian, buangTumpang) {
  bagian.sort((a, c) => a.x - c.x);
  let teks = '';
  let ujung = null;
  for (const p of bagian) {
    if (buangTumpang && ujung !== null && p.x < ujung - 1.5) {
      if (p.x + p.lebar <= ujung + 1.5) continue;
      let tumpang = 0;
      for (let k = Math.min(p.s.length, teks.length); k >= 3; k--) {
        if (teks.endsWith(p.s.slice(0, k))) { tumpang = k; break; }
      }
      if (tumpang === 0) continue;
      teks += p.s.slice(tumpang);
      ujung = p.x + p.lebar;
      continue;
    }
    if (ujung !== null && p.x - ujung > 1.5 && !teks.endsWith(' ') && !p.s.startsWith(' ')) teks += ' ';
    teks += p.s;
    ujung = Math.max(ujung ?? 0, p.x + p.lebar);
  }
  return teks.replace(/\s+/g, ' ').trim();
}

export function kelompokkanBaris(items) {
  const potongan = [];
  const terlihat = new Set();
  let salinan = 0;
  for (const it of items) {
    if (!it || typeof it.str !== 'string' || !it.transform) continue;
    const y = Math.round(it.transform[5]);
    const x = it.transform[4];
    if (it.str.trim()) {
      const kunci = `${Math.round(x / 2)}|${Math.round(y / 2)}|${it.str}`;
      if (terlihat.has(kunci)) { salinan++; continue; }
      terlihat.add(kunci);
    }
    potongan.push({ x, y, s: it.str, akhir: !!it.hasEOL, lebar: it.width || 0 });
  }

  if (salinan > 0) {
    const baris = [];
    for (const p of potongan.filter((q) => q.s.trim())) {
      let b = baris.find((r) => Math.abs(r.y - p.y) <= 2);
      if (!b) { b = { y: p.y, bagian: [] }; baris.push(b); }
      b.bagian.push(p);
    }
    baris.sort((a, c) => c.y - a.y);
    return { baris, cetakUlang: true };
  }

  const baris = [];
  let kini = null;
  for (const p of potongan) {
    if (!kini || Math.abs(kini.y - p.y) > 2) {
      kini = { y: p.y, bagian: [] };
      baris.push(kini);
    }
    kini.bagian.push(p);
    if (p.akhir) kini = null;
  }
  return { baris, cetakUlang: false };
}

export function susunBarisHalaman(items) {
  const { baris, cetakUlang } = kelompokkanBaris(items);
  return baris.map((b) => gabungBaris(b.bagian, cetakUlang)).filter(Boolean);
}

export function deteksiTabelHalaman(items) {
  const isi = (items || []).filter((it) => it && typeof it.str === 'string' && it.str.trim() && it.transform);
  if (isi.reduce((s, it) => s + it.str.trim().length, 0) < AMBANG_HALAMAN_KOSONG) return false;
  const perY = new Map();
  for (const it of isi) {
    const kunci = Math.round(it.transform[5] / TOLERANSI_Y_BARIS);
    if (!perY.has(kunci)) perY.set(kunci, []);
    perY.get(kunci).push({ x: it.transform[4], lebar: it.width || 0 });
  }
  const baris = [...perY.values()].map((r) => r.sort((a, c) => a.x - c.x));
  const margin = Math.min(...baris.map((r) => r[0].x));
  let multiKolom = 0;
  let yatim = 0;
  for (const r of baris) {
    if (r.some((p, k) => k > 0 && p.x - (r[k - 1].x + r[k - 1].lebar) > JARAK_MULTI_KOLOM)) multiKolom++;
    if (r[0].x - margin > JARAK_BARIS_YATIM) yatim++;
  }
  return (multiKolom / baris.length) >= PORSI_MULTI_KOLOM && (yatim / baris.length) >= PORSI_BARIS_YATIM;
}

export function rakitTeksHalaman(halaman, tambahan = []) {
  const hitung = new Map();
  for (const bs of halaman) {
    const tepi = new Set([...bs.slice(0, 3), ...bs.slice(-3)].map(kunciBaris));
    for (const k of tepi) hitung.set(k, (hitung.get(k) || 0) + 1);
  }
  const minimal = Math.max(3, Math.ceil(halaman.length * PORSI_BERULANG));
  const berulang = new Set([...hitung].filter(([k, c]) => c >= minimal && k.length < 120).map(([k]) => k));
  const nomorSaja = /^(halaman\s*)?[#ivxlc]+(\s*(dari|of|\/)\s*#)?$/i;

  let kosong = 0;
  const bagian = halaman.map((bs, i) => {
    const bersih = bs.filter((b, j) => {
      const diTepi = j < 3 || j >= bs.length - 3;
      const k = kunciBaris(b);
      return !(diTepi && (berulang.has(k) || nomorSaja.test(k)));
    });
    const teks = bersih.join('\n').replace(/([a-zà-ÿ])-\n([a-zà-ÿ])/g, '$1$2').trim();
    if (teks.replace(/\s/g, '').length < AMBANG_HALAMAN_KOSONG) kosong++;
    const isi = [teks, tambahan[i]].filter(Boolean).join('\n');
    return isi ? `[Halaman ${i + 1}]\n${isi}` : '';
  });

  return { teks: bagian.filter(Boolean).join('\n\n'), halamanKosong: kosong };
}

export async function ekstrakPdfDariData(data, pdfjs, onProgress, petaOcr) {
  const tugas = pdfjs.getDocument({ data, isEvalSupported: false });
  let doc;
  try {
    doc = await tugas.promise;
  } catch (e) {
    if (e?.name === 'PasswordException') {
      throw new GagalEkstrak('TERKUNCI', 'PDF ini dikunci kata sandi. Buka kuncinya dulu, lalu unggah lagi.');
    }
    throw new GagalEkstrak('PDF_RUSAK', `PDF tidak bisa dibuka: ${e?.message || e}`);
  }
  try {
    const halaman = [];
    const bertabel = [];
    const blokCentang = [];
    const centang = { halaman: [], tidakPasti: [], ditulis: [] };
    let judulCentang = null;
    let itemsSebelumnya = null;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const isi = await page.getTextContent();
      const { baris, cetakUlang } = kelompokkanBaris(isi.items);
      if (deteksiTabelHalaman(isi.items)) bertabel.push(n);
      const teksOcr = petaOcr?.get(n);
      const tc = bacaTabelCentang(isi.items, { teksOcr, bawaan: judulCentang, nomorHalaman: n, itemsSebelumnya });
      judulCentang = tc.bawaan;
      itemsSebelumnya = isi.items;
      if (teksOcr !== undefined) {
        const barisOcr = teksOcr.split('\n').filter(Boolean);
        const tulis = tulisCentangDiTeks(barisOcr.join('\n'), tc.tanda);
        halaman.push(tulis.ditulis ? tulis.teks.split('\n') : barisOcr);
        if (tulis.ditulis) centang.ditulis.push(n);
      } else {
        const tulis = tulisCentangDiItems(isi.items, tc.tanda);
        const susunan = tulis.ditulis ? kelompokkanBaris(tulis.items) : { baris, cetakUlang };
        halaman.push(susunan.baris.map((b) => gabungBaris(b.bagian, susunan.cetakUlang)).filter(Boolean));
        if (tulis.ditulis) centang.ditulis.push(n);
      }
      blokCentang.push(tc.blok);
      if (tc.blok) centang.halaman.push(n);
      if (tc.ringkasan.tidakPasti) centang.tidakPasti.push(n);
      page.cleanup();
      onProgress?.({ tahap: 'membaca', halaman: n, total: doc.numPages });
    }
    const { teks, halamanKosong } = rakitTeksHalaman(halaman, blokCentang);
    return {
      jenis: 'pdf', teks, halaman: halaman.length, halamanKosong, halamanBertabelTerdeteksi: bertabel,
      halamanTabelCentang: centang.halaman, halamanCentangTidakPasti: centang.tidakPasti,
      halamanCentangDitulis: centang.ditulis
    };
  } finally {
    await tugas.destroy();
  }
}


const penandaTabel = (i) => `\u0000T${i}\u0000`;
const PENANDA_TABEL = /\u0000T(\d+)\u0000/g;

const dekodeEntitas = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

const htmlKeParagraf = (html) => dekodeEntitas(html
  .replace(/<\/(p|h[1-6]|li)>/g, '\n\n').replace(/<br\s*\/?>/g, '\n')
  .replace(/<li[^>]*>/g, '• ').replace(/<[^>]+>/g, ''));

const htmlKeSel = (html) => dekodeEntitas(html
  .replace(/<\/(p|h[1-6]|li)>/g, ' / ').replace(/<br\s*\/?>/g, ' / ').replace(/<[^>]+>/g, ''))
  .replace(/(\s*\/\s*)+/g, ' / ').replace(/^\s*\/\s*|\s*\/\s*$/g, '')
  .replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

function tabelKeTeks(isi, tabel) {
  const rataSel = (s) => s.replace(PENANDA_TABEL, (m, i) => (tabel[+i] ?? m)
    .split('\n').filter((l) => l.trim() && !/^\|( --- \|)+$/.test(l))
    .join(' ; ').replace(/(?<!\\)\|/g, '\\|'));
  const rows = [...isi.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((r) => [...r[1].matchAll(/<t([dh])([^>]*)>([\s\S]*?)<\/t[dh]>/g)].flatMap((c) => {
      const lebar = Number(c[2].match(/colspan="(\d+)"/)?.[1] || 1);
      return [rataSel(htmlKeSel(c[3])), ...Array(lebar - 1).fill('')];
    }))
    .filter((r) => r.some(Boolean));
  const kolom = rows.length ? Math.max(...rows.map((r) => r.length)) : 0;
  if (kolom < 2) return htmlKeParagraf(isi).trim();
  const baris = (r) => `| ${[...r, ...Array(kolom - r.length).fill('')].join(' | ')} |`;
  return [baris(rows[0]), `|${' --- |'.repeat(kolom)}`, ...rows.slice(1).map(baris)].join('\n');
}

export function teksDariHtmlDocx(html) {
  const tabel = [];
  const terdalam = /<table[^>]*>((?:(?!<table[\s>])[\s\S])*?)<\/table>/;
  let sisa = html;
  while (terdalam.test(sisa)) {
    sisa = sisa.replace(terdalam, (_, isi) => penandaTabel(tabel.push(tabelKeTeks(isi, tabel)) - 1));
  }
  const teks = htmlKeParagraf(sisa).replace(PENANDA_TABEL, (m, i) => (tabel[+i] === undefined ? m : `\n\n${tabel[+i]}\n\n`));
  return teks.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const opsiHtmlDocx = (mammoth) => ({
  convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' }))
});

function periksaHasil(nama, hasil) {
  const huruf = hasil.teks.replace(/\s/g, '').length;
  if (hasil.jenis === 'pdf' && hasil.halaman > 0 && (huruf < 200 || hasil.halamanKosong / hasil.halaman >= PORSI_SCAN)) {
    throw new GagalEkstrak(
      'SCAN',
      `"${nama}" tampaknya PDF hasil scan (${hasil.halamanKosong} dari ${hasil.halaman} halaman tanpa teks). ` +
      'Halaman scan berupa gambar, jadi teksnya tidak bisa dibaca tanpa OCR — belum didukung.'
    );
  }
  if (huruf === 0) throw new GagalEkstrak('KOSONG', `"${nama}" tidak berisi teks yang bisa dibaca.`);
  const rusak = (hasil.teks.match(/\uFFFD/g) || []).length;
  if (rusak / hasil.teks.length > 0.01) {
    throw new GagalEkstrak('HURUF_RUSAK', `Teks "${nama}" terbaca sebagai huruf acak (font khusus). Coba sumber lain.`);
  }
  return { ...hasil, huruf: hasil.teks.length };
}


export async function ekstrakTeksDokumen(file, { onProgress, petaOcrHalaman } = {}) {
  const eks = ekstensi(file?.name);
  if (eks === '.doc') {
    throw new GagalEkstrak('TIDAK_DIDUKUNG', 'Format .doc lama belum didukung. Simpan ulang sebagai .docx di Word, lalu unggah lagi.');
  }
  if (!EKSTENSI_DIDUKUNG.includes(eks)) {
    throw new GagalEkstrak('TIDAK_DIDUKUNG', `Format "${eks || 'tanpa ekstensi'}" belum didukung. Gunakan PDF, DOCX, atau teks (${EKSTENSI_TEKS.join(' ')}).`);
  }
  if (file.size > MAKS_MB * 1024 * 1024) {
    throw new GagalEkstrak('TERLALU_BESAR', `Berkas ${(file.size / 1048576).toFixed(0)} MB melebihi batas ${MAKS_MB} MB. Pecah per bab, lalu unggah bagian demi bagian.`);
  }

  if (EKSTENSI_TEKS.includes(eks)) {
    return periksaHasil(file.name, { jenis: 'teks', teks: (await file.text()).trim() });
  }

  if (eks === '.docx') {
    onProgress?.({ tahap: 'membaca' });
    const { default: mammoth } = await import('mammoth');
    let hasil;
    try {
      hasil = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, opsiHtmlDocx(mammoth));
    } catch (e) {
      throw new GagalEkstrak('DOCX_RUSAK', `DOCX tidak bisa dibaca: ${e?.message || e}`);
    }
    return periksaHasil(file.name, { jenis: 'docx', teks: teksDariHtmlDocx(hasil.value) });
  }

  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const hasil = await ekstrakPdfDariData(new Uint8Array(await file.arrayBuffer()), pdfjs, onProgress, petaOcrHalaman);
  return periksaHasil(file.name, hasil);
}

export { periksaHasil as _periksaHasilUntukUji };
