/**
 * EKSTRAKSI TEKS PDF / WORD DI BROWSER (Item 69, 2026-09-11)
 *
 * `rag-process` hanya menerima teks. Dulu PDF/DOCX dibaca mentah dengan file.text() — isi
 * berkasnya (kode biner, data terkompresi) ikut dikirim, dan sejak Item 64 ditolak sebagai
 * BINARY_FILE. Di sini teksnya diambil DI BROWSER sebelum dikirim:
 *   - bebas biaya dan tak terkena batas CPU edge function (buku 436 halaman: 4,1 detik di laptop);
 *   - berkas asli tidak pernah disimpan di Supabase — hanya teksnya.
 *
 * Diuji dengan kode ini sendiri (Node + pdfjs legacy) sebelum dipasang:
 *   HCDP DOCX / PDF Word 365 / PDF Word 2007 → 6.269 / 6.635 / 6.438 kata, frasa khas tepat sekali;
 *   ebook "Operator Handbook" 436 halaman → 645 ribu huruf, 0 huruf rusak; PDF CamScanner → 0 huruf.
 *
 * SALINAN dari frontend/src/core/runtime/services/documentTextExtractor.js — mametlite proyek
 * terpisah (di-deploy sendiri ke mametlite.vercel.app). Ubah keduanya bersamaan.
 */

export const EKSTENSI_TEKS = ['.txt', '.md', '.csv', '.json', '.html', '.xml'];
export const EKSTENSI_DIDUKUNG = [...EKSTENSI_TEKS, '.pdf', '.docx'];
export const ACCEPT_UNGGAH = EKSTENSI_DIDUKUNG.join(',');

// Berkas besar biasanya buku penuh gambar — teksnya sedikit, tapi browser HP bisa kehabisan memori.
const MAKS_MB = 60;
const AMBANG_HALAMAN_KOSONG = 25;     // huruf; di bawah ini halaman dianggap gambar/scan
const PORSI_BERULANG = 0.3;           // baris tepi yang muncul di ≥30% halaman = judul/nomor halaman
const PORSI_SCAN = 0.5;               // ≥50% halaman tanpa teks = PDF hasil scan

// Perkiraan biaya embedding (Item 63): google/gemini-embedding-2 ±$0,20 per juta token,
// ±4 huruf per token (HCDP: 11 potongan ≈ 12 ribu token). Potongan 4.500 huruf, tumpang 250.
const DOLAR_PER_TOKEN = 0.20 / 1e6;
const HURUF_PER_TOKEN = 4;
const HURUF_PER_POTONGAN = 4250;

export class GagalEkstrak extends Error {
  constructor(kode, message) {
    super(message);
    this.kode = kode;
  }
}

export function perkiraanUnggah(huruf) {
  return {
    potongan: Math.max(1, Math.ceil(huruf / HURUF_PER_POTONGAN)),
    dolar: (huruf / HURUF_PER_TOKEN) * DOLAR_PER_TOKEN
  };
}

const ekstensi = (nama) => {
  const i = String(nama || '').lastIndexOf('.');
  return i >= 0 ? nama.slice(i).toLowerCase() : '';
};

// ─── Penyusunan teks halaman PDF (murni, tanpa browser — diuji di Node) ─────────────────────

const kunciBaris = (s) => s.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

function gabungBaris(bagian, buangTumpang) {
  bagian.sort((a, c) => a.x - c.x);
  let teks = '';
  let ujung = null;
  for (const p of bagian) {
    if (buangTumpang && ujung !== null && p.x < ujung - 1.5) {
      // Salinan cetak ulang yang dipecah di titik berbeda dan bertumpuk dengan teks yang sudah ada.
      if (p.x + p.lebar <= ujung + 1.5) continue;               // seluruhnya sudah tertutup
      // Sambung lewat bagian yang sama: akhir `teks` = awal `p.s` → tambahkan sisanya saja.
      let tumpang = 0;
      for (let k = Math.min(p.s.length, teks.length); k >= 3; k--) {
        if (teks.endsWith(p.s.slice(0, k))) { tumpang = k; break; }
      }
      if (tumpang === 0) continue;                               // tak bisa diselaraskan → salinan
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

/** Item `getTextContent()` satu halaman → daftar baris teks. */
export function susunBarisHalaman(items) {
  // Sebagian pembuat PDF mencetak teks yang sama 2–3 kali di koordinat yang sama (efek tebal /
  // bayangan). Terbukti di PDF HCDP asli dari Word 2007: tiap kalimat 3 salinan, dipecah di titik
  // berbeda — tanpa penanganan ini teksnya 133 ribu huruf berantakan, bukan ±60 ribu. HCDP yang
  // tersimpan di RAG sebelum Item 69 memuat setiap bagian 3 kali karena hal ini.
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
    // Halaman bercetak ulang: urutan aliran tak bisa dipercaya → susun menurut POSISI (atas ke
    // bawah, kiri ke kanan). Spasi dibuang — di PDF itu spasi berlebar ±8,8 px yang menumpuk ke
    // kata berikutnya dan membuatnya dikira salinan; jarak antarkata dihitung dari posisi.
    const baris = [];
    for (const p of potongan.filter((q) => q.s.trim())) {
      let b = baris.find((r) => Math.abs(r.y - p.y) <= 2);
      if (!b) { b = { y: p.y, bagian: [] }; baris.push(b); }
      b.bagian.push(p);
    }
    baris.sort((a, c) => c.y - a.y);
    return baris.map((b) => gabungBaris(b.bagian, true)).filter(Boolean);
  }

  // Halaman normal: ikuti urutan aliran — menjaga urutan kolom pada buku dua kolom.
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
  return baris.map((b) => gabungBaris(b.bagian, false)).filter(Boolean);
}

/** Baris per halaman → teks utuh, tanpa judul/kaki halaman berulang, dengan penanda [Halaman N]. */
export function rakitTeksHalaman(halaman) {
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
    // Sambung kata yang dipotong tanda hubung di akhir baris: "kom-\npetensi" → "kompetensi".
    const teks = bersih.join('\n').replace(/([a-zà-ÿ])-\n([a-zà-ÿ])/g, '$1$2').trim();
    if (teks.replace(/\s/g, '').length < AMBANG_HALAMAN_KOSONG) kosong++;
    // Penanda halaman: model bisa menyebut "halaman N" tanpa kolom database baru.
    return teks ? `[Halaman ${i + 1}]\n${teks}` : '';
  });

  return { teks: bagian.filter(Boolean).join('\n\n'), halamanKosong: kosong };
}

/** Inti ekstraksi PDF — `pdfjs` diberikan pemanggil (browser: build legacy + worker; uji: Node). */
export async function ekstrakPdfDariData(data, pdfjs, onProgress) {
  // Yang dihentikan di akhir adalah loadingTask, bukan doc: pdfjs 6 (mametlite) tak lagi punya
  // doc.destroy() — terbukti saat uji salinan mametlite. loadingTask.destroy() ada di v5 dan v6.
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
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const isi = await page.getTextContent();
      halaman.push(susunBarisHalaman(isi.items));
      page.cleanup();
      onProgress?.({ tahap: 'membaca', halaman: n, total: doc.numPages });
    }
    const { teks, halamanKosong } = rakitTeksHalaman(halaman);
    return { jenis: 'pdf', teks, halaman: halaman.length, halamanKosong };
  } finally {
    await tugas.destroy();
  }
}

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

// ─── Pintu utama untuk browser ─────────────────────────────────────────────────────────────

/**
 * Berkas unggahan → teks siap dikirim ke rag-process.
 * @returns {Promise<{jenis, teks, huruf, halaman?, halamanKosong?}>}
 * @throws {GagalEkstrak}
 */
export async function ekstrakTeksDokumen(file, { onProgress } = {}) {
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
      hasil = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    } catch (e) {
      throw new GagalEkstrak('DOCX_RUSAK', `DOCX tidak bisa dibaca: ${e?.message || e}`);
    }
    return periksaHasil(file.name, { jenis: 'docx', teks: hasil.value.replace(/\n{3,}/g, '\n\n').trim() });
  }

  // PDF — build "legacy" supaya jalan juga di browser HP yang lebih tua. Dimuat hanya saat
  // mengunggah PDF (±1 MB), bukan saat aplikasi dibuka.
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const hasil = await ekstrakPdfDariData(new Uint8Array(await file.arrayBuffer()), pdfjs, onProgress);
  return periksaHasil(file.name, hasil);
}

export { periksaHasil as _periksaHasilUntukUji };
