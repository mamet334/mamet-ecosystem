/**
 * ukurRecall.mjs — logika penilaian set uji pengambilan (Item 93 Tahap 3).
 *
 * Murni: tidak menyentuh berkas, database, maupun jaringan. Dipisah supaya bisa DIIMPOR berkas uji —
 * alat ukur yang salah akan meluluskan model yang buruk, dan itu kesalahan yang paling mahal di sini.
 *
 * Aturan penilaian BUKAN karangan modul ini. Ia disalin apa adanya dari `aturan` di dalam berkas set
 * uji (`uji/data-lokal/set-uji-*.json`, disusun Item 90 Tahap A):
 *
 *   bukti        daftar alternatif; satu alternatif = daftar teks yang SEMUA harus ada di satu
 *                potongan (spasi dirapatkan, huruf besar/kecil diabaikan).
 *                Potongan pertama yang cocok = peringkat bukti.
 *   recall@8     peringkat bukti <= 8 DAN skor > 0,55 (aturan server hari ini)
 *   neg          tidak punya bukti; dicatat skor ke-1 & jumlah potongan di atas ambang
 *
 * CATATAN PENTING tentang ambang 0,55: angka itu milik model yang dipakai server sekarang
 * (`gemini-embedding-2`). Skala kemiripan kosinus BERBEDA antar model — e5, mpnet, dan LaBSE punya
 * sebaran skor sendiri. Karena itu hasil dilaporkan DUA kali: dengan ambang dan tanpa ambang.
 * Menilai model lokal memakai ambang model lain adalah membandingkan dua hal yang berbeda.
 */

/** Rapatkan spasi & samakan huruf — persis yang dimaksud "spasi dirapatkan, huruf besar/kecil diabaikan". */
export function rapatkan(teks) {
  return String(teks ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Apakah satu potongan memuat SEMUA teks dalam satu alternatif bukti? */
export function potonganCocok(isiPotongan, alternatif) {
  const isi = rapatkan(isiPotongan);
  const semua = Array.isArray(alternatif?.semua) ? alternatif.semua : [];
  if (!semua.length) return false;
  return semua.every((t) => isi.includes(rapatkan(t)));
}

/**
 * Peringkat bukti = posisi (1-based) potongan PERTAMA di daftar terurut yang cocok dengan salah satu
 * alternatif. Tidak ada yang cocok → null (bukan 0, bukan Infinity — supaya tak bisa dihitung diam-diam).
 *
 * @param {Array<{id:string, isi:string}>} terurut potongan sudah terurut skor menurun
 * @param {Array<{nama?:string, semua:string[]}>} bukti
 */
export function peringkatBukti(terurut, bukti) {
  const daftar = Array.isArray(bukti) ? bukti : [];
  if (!daftar.length) return null;
  for (let i = 0; i < terurut.length; i++) {
    for (const alt of daftar) {
      if (potonganCocok(terurut[i]?.isi, alt)) return { peringkat: i + 1, alternatif: alt.nama || null };
    }
  }
  return null;
}

/** Kemiripan kosinus. Panjang berbeda → null, bukan angka yang menyesatkan. */
export function kosinus(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return null;
  let atas = 0, kiri = 0, kanan = 0;
  for (let i = 0; i < a.length; i++) { atas += a[i] * b[i]; kiri += a[i] * a[i]; kanan += b[i] * b[i]; }
  if (kiri === 0 || kanan === 0) return null;
  return atas / (Math.sqrt(kiri) * Math.sqrt(kanan));
}

/**
 * Nilai satu pertanyaan.
 * @returns {{id, negatif, peringkat, skorBukti, lolos, lolosTanpaAmbang, skorTeratas, diAtasAmbang}}
 */
export function nilaiPertanyaan(soal, terurut, { ambang = 0.55, ambilN = 8 } = {}) {
  const negatif = !Array.isArray(soal?.bukti) || soal.bukti.length === 0;
  const skorTeratas = terurut[0]?.skor ?? null;
  const diAtasAmbang = terurut.filter((p) => (p.skor ?? -1) > ambang).length;

  if (negatif) {
    return { id: soal.id, negatif: true, peringkat: null, skorBukti: null, lolos: null, lolosTanpaAmbang: null, skorTeratas, diAtasAmbang };
  }
  const temuan = peringkatBukti(terurut, soal.bukti);
  const peringkat = temuan?.peringkat ?? null;
  const skorBukti = peringkat ? (terurut[peringkat - 1]?.skor ?? null) : null;
  return {
    id: soal.id,
    negatif: false,
    peringkat,
    skorBukti,
    // Dua angka, sengaja: yang kedua tidak memakai ambang milik model lain.
    lolos: peringkat !== null && peringkat <= ambilN && (skorBukti ?? -1) > ambang,
    lolosTanpaAmbang: peringkat !== null && peringkat <= ambilN,
    skorTeratas,
    diAtasAmbang,
  };
}

/** Ringkasan satu putaran pengukuran. */
export function ringkasHasil(hasil) {
  const positif = hasil.filter((h) => !h.negatif);
  const negatif = hasil.filter((h) => h.negatif);
  return {
    total: positif.length,
    lolos: positif.filter((h) => h.lolos).length,
    lolosTanpaAmbang: positif.filter((h) => h.lolosTanpaAmbang).length,
    gagal: positif.filter((h) => !h.lolosTanpaAmbang).map((h) => h.id),
    // Yang peringkatnya baik tetapi skornya di bawah ambang — inilah tanda ambang perlu ditera ulang
    // untuk model ini, BUKAN tanda modelnya buruk.
    kalahAmbangSaja: positif.filter((h) => h.lolosTanpaAmbang && !h.lolos).map((h) => h.id),
    negatif: negatif.map((h) => ({ id: h.id, skorTeratas: h.skorTeratas, diAtasAmbang: h.diAtasAmbang })),
  };
}
