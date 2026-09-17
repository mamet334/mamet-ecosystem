/**
 * TABEL CENTANG PDF — KOLOM DARI KOORDINAT, BUKAN DARI OCR (Item 88, 2026-09-17)
 *
 * Masalah (docs/roadmap/ROADMAP-TABEL-CENTANG-PDF.md §1): pada tabel berjudul kolom bertingkat
 * ("Tingkat Pentingnya Terhadap Jabatan" di atas Mutlak | Penting | Perlu) mistral-ocr menaruh
 * uraian di slot kolom pertama, sehingga setiap centang bergeser satu kolom ke kanan. Buku Kepbup
 * Standar Kompetensi Jabatan: pelatihan yang "Penting" terbaca "Perlu" — dan model menjawabnya
 * berlabel VERIFIED karena memang begitu tertulis di potongan.
 *
 * pdf.js memberi posisi setiap potongan teks. Di buku itu `√` diukur tepat di x judul kolomnya
 * (437,9 = "Penting"; 374,1 = "Mutlak"). Modul ini:
 *   A — memetakan setiap tanda centang ke judul kolom yang sejajar di atasnya dan ke label barisnya,
 *       lalu menghasilkan blok fakta `[TABEL CENTANG …]` yang DITEMPEL sesudah teks halaman
 *       (teks OCR/pdf.js tidak ditulis ulang — keputusan Owner §7.1);
 *   B — menandai halaman `[TABEL CENTANG TIDAK PASTI …]` bila pemetaan tidak bisa dipastikan:
 *       centang tanpa judul sejajar, jumlah centang pdf.js ≠ jumlah centang di teks OCR, atau OCR
 *       memuat centang yang tidak ada di lapisan teks PDF (centang berupa gambar / halaman scan).
 *
 * Murni, tanpa impor — diuji di Node dengan PDF asli.
 *
 * SALINAN dari frontend/src/core/runtime/services/tabelCentang.js — mametlite proyek terpisah
 * (di-deploy sendiri ke mametlite.vercel.app). Ubah keduanya bersamaan.
 */

// √ ✓ ✔ ☑ ☒, dan glyph Wingdings (ü → U+F0FC, þ → U+F0FE) bila font simbol dipetakan ke area pribadi.
const HURUF_CENTANG = '√✓✔☑☒';
const POLA_CENTANG_SAJA = new RegExp(`^[${HURUF_CENTANG}]{1,2}$`);
const POLA_CENTANG_GLOBAL = new RegExp(`[${HURUF_CENTANG}]`, 'g');

export const TOLERANSI_SEJAJAR = 12;   // pt; centang di luar rentang deret judul lebih dari ini → tidak pasti
const TOLERANSI_DALAM_JUDUL = 6;       // pt; pusat centang harus di dalam lebar judul kolomnya ±6
const TOLERANSI_Y = 3;               // pt; potongan teks dianggap satu baris visual
const JARAK_JUDUL_MAKS = 400;          // pt di atas centang tempat judul kolom masih dicari
const PANJANG_JUDUL_MAKS = 30;         // huruf; judul kolom pendek, bukan kalimat isi sel
const CELAH_GABUNG_KATA = 4;           // pt; "Sangat" + "Penting" yang terpisah jadi satu judul
const CELAH_ANTAR_JUDUL_MIN = 5;       // pt; hanya memisahkan kata yang dipecah pdf.js (lihat cariJudul)
const CELAH_ANTAR_JUDUL_MAKS = 60;     // pt; judul label ("Uraian") yang jauh tidak ikut deret kolom
const TINGGI_BLOK_JUDUL = 40;          // pt di atas baris judul kolom tempat judul kolom label dicari
const JARAK_SEL_TENGAH = 8;            // pt; teks label terdekat untuk centang di tengah vertikal sel
const CELAH_BARIS_LANJUTAN = 20;     // pt; baris lanjutan label sejauh ini masih satu sel

const ringkas = (s) => s.replace(/\s+/g, ' ').trim();

export const hitungCentangTeks = (teks) => (teks?.match(POLA_CENTANG_GLOBAL) || []).length;

/** Item getTextContent → potongan bersih; salinan cetak-ulang (efek tebal) dibuang seperti kelompokkanBaris. */
function potonganHalaman(items) {
  const hasil = [];
  const terlihat = new Set();
  for (const it of items || []) {
    if (!it || typeof it.str !== 'string' || !it.transform || !it.str.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const kunci = `${Math.round(x / 2)}|${Math.round(y / 2)}|${it.str}`;
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);
    const s = it.str.trim();
    hasil.push({ s, x, y, w: it.width || 0, centang: POLA_CENTANG_SAJA.test(s) });
  }
  return hasil;
}

/** Potongan → baris visual (y sama ±TOLERANSI_Y), atas ke bawah, kiri ke kanan. */
function barisVisual(potongan) {
  const baris = [];
  for (const p of [...potongan].sort((a, b) => b.y - a.y)) {
    const b = baris.find((r) => Math.abs(r.y - p.y) <= TOLERANSI_Y);
    if (b) b.isi.push(p); else baris.push({ y: p.y, isi: [p] });
  }
  for (const b of baris) b.isi.sort((a, c) => a.x - c.x);
  return baris;
}

/** Potongan teks satu baris → judul, potongan berdempetan (celah ≤ 4 pt) digabung. */
function gabungJudul(isi) {
  const hasil = [];
  for (const p of isi.filter((q) => !q.centang)) {
    const akhir = hasil[hasil.length - 1];
    if (akhir && p.x - (akhir.x + akhir.w) <= CELAH_GABUNG_KATA) {
      akhir.teks = `${akhir.teks} ${p.s}`;
      akhir.w = p.x + p.w - akhir.x;
    } else {
      hasil.push({ teks: p.s, x: p.x, w: p.w, y: p.y });
    }
  }
  return hasil;
}

/**
 * Kolom tempat sebuah centang jatuh, atau null bila tidak bisa dipastikan. Dua aturan harus sepakat:
 *   rentang — kolom ke-i dimulai di x judul ke-i sampai x judul berikutnya (judul rata kiri);
 *   tengah  — batas kolom di titik tengah antara pusat dua judul bersebelahan (judul rata tengah).
 * Buku Kepbup memakai keduanya: hal. 6 centang tepat di x judul, hal. 23 centang Mutlak 28 pt di
 * kanan x judulnya — aturan "jarak ≤ 12 pt ke judul terdekat" menolak yang benar di sana.
 */
export function kolomCentang(c, kolom) {
  if (!kolom?.length) return null;
  const pusat = c.x + c.w / 2;
  const terakhir = kolom[kolom.length - 1];
  if (pusat < kolom[0].x - TOLERANSI_SEJAJAR || pusat > terakhir.x + terakhir.w + TOLERANSI_SEJAJAR) return null;
  let rentang = kolom[0];
  // +6: hal. 396 centang 4,5 pt di kiri x "Penting" tetapi masih di sel Penting (aturan tengah sepakat).
  for (const j of kolom) if (j.x <= pusat + TOLERANSI_DALAM_JUDUL) rentang = j;
  let tengah = kolom[0];
  for (let i = 1; i < kolom.length; i++) {
    const batas = ((kolom[i - 1].x + kolom[i - 1].w / 2) + (kolom[i].x + kolom[i].w / 2)) / 2;
    if (pusat >= batas) tengah = kolom[i];
  }
  return rentang === tengah ? rentang : null;
}

const bisaJadiJudul = (j) => j && j.teks.length <= PANJANG_JUDUL_MAKS && /\p{L}{2}/u.test(j.teks);

/**
 * Baris judul kolom untuk satu centang: baris terdekat DI ATAS centang yang berupa deret ≥2 judul
 * pendek berhuruf (≤60 pt satu sama lain), centangnya jatuh di dalam lebar salah satu judul, judul
 * pertama di kanan label baris centang, dan baris tepat di bawahnya mulai di kolom paling kiri tabel.
 * Kata judul tidak ditentukan di kode — "Ya/Tidak", "Wajib/Dianjurkan" dipakai apa adanya.
 *
 * Diukur di buku Kepbup penuh (1.008 halaman): versi pertama ("ada kata sejajar dengan centang")
 * memilih baris ISI SEL sebagai judul — "Manajemen, Hukum yang relevan dengan" (hal. 185) dan
 * "- - -" (hal. 23) — sehingga ratusan centang bernilai "relevan", "bidang", "-". Celah antarkata
 * (prosa ±8–10 pt) sempat dipakai pembeda, tetapi hal. 256 judul aslinya pun hanya berjarak 9,9 pt;
 * setelah aturan lain dipasang, ambang 5 dan 12 pt sama-sama 0 beda dari pembanding independen.
 */
function cariJudul(baris, c, barisSebelum = null) {
  // barisSebelum: baris halaman SEBELUMNYA — judul tabel di dasar halaman itu, centangnya di halaman
  // ini (hal. 30 → 31). Semua baris halaman sebelumnya dianggap berada di atas centang.
  const sumber = barisSebelum || baris;
  const kandidat = (barisSebelum || baris.filter((b) => b.y > c.y + TOLERANSI_Y && b.y - c.y <= JARAK_JUDUL_MAKS))
    .slice().sort((a, b) => a.y - b.y);
  const pusat = c.x + c.w / 2;
  const adaTeks = (r) => r.isi.some((p) => !p.centang);
  const xKiri = (r) => Math.min(...r.isi.filter((p) => !p.centang).map((p) => p.x));
  // Baris halaman ini dari atas sampai baris centang (untuk mode halaman sebelumnya).
  const atasKini = baris.filter((r) => r.y >= c.y - TOLERANSI_Y && adaTeks(r)).sort((p, q) => q.y - p.y);
  // Teks label di sekitar centang: baris yang sama, atau ±8 pt bila centang di tengah sel (hal. 858).
  // "-" pengisi kolom kosong ("3. Fungsional  -  -  √", hal. 372) bukan label.
  const teksSebaris = (jarak) => baris.filter((r) => Math.abs(r.y - c.y) <= jarak)
    .flatMap((r) => r.isi.filter((p) => !p.centang && /[\p{L}\p{N}]/u.test(p.s)));
  const labelSekitar = teksSebaris(TOLERANSI_Y).length ? teksSebaris(TOLERANSI_Y) : teksSebaris(JARAK_SEL_TENGAH);
  for (const b of kandidat) {
    const judul = gabungJudul(b.isi);
    const k = judul.findIndex((j) => pusat >= j.x - TOLERANSI_DALAM_JUDUL && pusat <= j.x + j.w + TOLERANSI_DALAM_JUDUL);
    if (k < 0 || !bisaJadiJudul(judul[k])) continue;
    const celah = (i) => judul[i + 1].x - (judul[i].x + judul[i].w);   // antara judul i dan i+1
    let awal = k;
    let akhir = k;
    while (awal > 0 && bisaJadiJudul(judul[awal - 1]) && celah(awal - 1) >= CELAH_ANTAR_JUDUL_MIN && celah(awal - 1) <= CELAH_ANTAR_JUDUL_MAKS) awal--;
    while (akhir < judul.length - 1 && bisaJadiJudul(judul[akhir + 1]) && celah(akhir) >= CELAH_ANTAR_JUDUL_MIN && celah(akhir) <= CELAH_ANTAR_JUDUL_MAKS) akhir++;
    if (akhir === awal) continue;
    // Kata yang menempel rapat di tepi deret = deret itu bagian dari kalimat, bukan judul kolom.
    if ((awal > 0 && celah(awal - 1) < CELAH_ANTAR_JUDUL_MIN) || (akhir < judul.length - 1 && celah(akhir) < CELAH_ANTAR_JUDUL_MIN)) continue;
    const kolom = judul.slice(awal, akhir + 1).map(({ teks, x, w }) => ({ teks, x, w }));
    if (!kolomCentang(c, kolom)) continue;
    // Judul kolom centang ada di KANAN label baris. Hal. 396: "2. Bidang Ilmu | Seluruh disiplin ilmu"
    // (x 176,7) lolos semua aturan lain, tetapi label baris centangnya sendiri mulai di x 281,9.
    if (labelSekitar.some((p) => p.x >= kolom[0].x - 1)) continue;
    // Prosa rata kanan-kiri di dalam sel juga berupa deret kata berjarak. Pembedanya: tepat di bawah
    // judul kolom asli ada baris data yang mulai di kolom PALING KIRI tabel ("A. Pendidikan"), sedangkan
    // di bawah baris prosa ada lanjutan sel yang mulai di tengah. (Aturan "tak ada teks di bawah yang
    // mulai di x judul" dicoba lebih dulu dan gagal: hal. 613 kata "bidang" jatuh 1,9 pt dari x "Mutlak".)
    const bawahSumber = sumber.filter((r) => r.y < b.y - TOLERANSI_Y && (barisSebelum || r.y >= c.y - TOLERANSI_Y) && adaTeks(r))
      .sort((p, q) => q.y - p.y);
    const bawah = barisSebelum ? [...bawahSumber, ...atasKini] : bawahSumber;
    if (!bawah.length || xKiri(bawah[0]) > Math.min(...bawah.map(xKiri)) + TOLERANSI_Y) continue;
    // Judul dari halaman sebelumnya hanya sah bila skalanya sama: kolom paling kiri tabel di kedua
    // halaman di x yang sama. Hal. 256 → 257 buku Kepbup: 59,5 vs 77,5 — halaman berskala lain.
    if (barisSebelum && bawahSumber.length && atasKini.length
      && Math.abs(Math.min(...bawahSumber.map(xKiri)) - Math.min(...atasKini.map(xKiri))) > 1.5) continue;
    if (barisSebelum && (!bawahSumber.length || !atasKini.length)) continue;
    // Awal kolom label (mis. "Jenis Persyaratan" | "Uraian") dari blok judul tabel di sekitarnya,
    // supaya "Pengalaman / Kerja" yang terbelah dua baris tetap dibaca per sel, bukan per baris.
    // Hanya x yang juga menjadi AWAL teks di ≥2 baris data: judul rata tengah ("Uraian") bukan awal
    // kolom — tanpa saringan ini hal. 504 terbaca "Pelatihan Administrator — Kepemimpinan".
    const kiri = kolom[0].x - 6;
    const barisData = barisSebelum ? [...bawahSumber, ...baris] : baris.filter((r) => r.y < b.y - TOLERANSI_Y);
    const awalDiData = (x) => barisData.filter((r) => r.isi.some((p) => !p.centang && Math.abs(p.x - x) <= 2)).length >= 2;
    const awalLabel = [];
    for (const r of sumber) {
      if (r.y < b.y - TOLERANSI_Y || r.y > b.y + TINGGI_BLOK_JUDUL) continue;
      for (const j of gabungJudul(r.isi)) {
        if (j.x < kiri && !awalLabel.some((x) => Math.abs(x - j.x) <= 3) && awalDiData(j.x)) awalLabel.push(j.x);
      }
    }
    return { y: b.y, kolom, awalLabel: awalLabel.sort((a, x) => a - x), dariHalamanSebelum: !!barisSebelum };
  }
  return null;
}

/**
 * Label baris sebuah centang: teks di kirinya pada baris yang sama + baris lanjutan di bawahnya.
 *
 * Sel rata tengah (buku Kepbup: 100 dari 855 centang, 59 halaman): centang berada di tengah vertikal
 * selnya, baris centang itu sendiri tanpa teks, teks terdekat ≤8 pt di atas/bawah. Batas sel tidak
 * bisa dipastikan dari posisi teks — beberapa pembagian baris sama-sama cocok (dicoba 2026-09-17) —
 * jadi label diambil dari baris dalam ±8 pt dan ditandai `perkiraan`. Kolomnya tetap pasti.
 */
function susunLabel(baris, c, judul) {
  const batasKanan = judul ? judul.kolom[0].x - 2 : c.x - 2;
  const kiriDari = (b) => b.isi.filter((p) => !p.centang && p.x + Math.min(p.w, 1) < batasKanan);
  const urut = [...baris].sort((a, b) => b.y - a.y);
  const i = urut.findIndex((b) => Math.abs(b.y - c.y) <= TOLERANSI_Y && kiriDari(b).length);
  if (i < 0) {
    const dekat = urut.filter((b) => Math.abs(b.y - c.y) <= JARAK_SEL_TENGAH && !b.isi.some((p) => p.centang) && kiriDari(b).length);
    if (!dekat.length) return { teks: '', perkiraan: false };
    return { teks: rangkaiLabel(dekat.flatMap(kiriDari), judul, Math.min(...dekat.flatMap(kiriDari).map((p) => p.x))), perkiraan: true };
  }

  const bagian = [...kiriDari(urut[i])];
  const xAwal = Math.min(...bagian.map((p) => p.x));
  let yTerakhir = urut[i].y;
  for (let k = i + 1; k < urut.length; k++) {
    const b = urut[k];
    if (b.isi.some((p) => p.centang)) break;                    // baris centang berikutnya
    if (yTerakhir - b.y > CELAH_BARIS_LANJUTAN) break;
    const isi = kiriDari(b);
    if (!isi.length || isi.length !== b.isi.length) break;      // teks masuk area kolom centang
    if (Math.min(...isi.map((p) => p.x)) <= xAwal + 1) break;   // baris tabel baru mulai di kolom kiri
    bagian.push(...isi);
    yTerakhir = b.y;
  }
  return { teks: rangkaiLabel(bagian, judul, xAwal), perkiraan: false };
}

/** Potongan label → teks per kolom label ("C. Pengalaman Kerja — Pernah Menduduki …"). */
function rangkaiLabel(bagian, judul, xAwal) {
  const awal = judul?.awalLabel?.length ? judul.awalLabel : [xAwal];
  const kolomKe = (p) => {
    let k = 0;
    for (let n = 0; n < awal.length; n++) if (awal[n] <= p.x + 2) k = n;
    return k;
  };
  const perKolom = new Map();
  for (const p of bagian.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const k = kolomKe(p);
    if (!perKolom.has(k)) perKolom.set(k, []);
    perKolom.get(k).push(p.s);
  }
  return [...perKolom.keys()].sort((a, b) => a - b).map((k) => ringkas(perKolom.get(k).join(' '))).join(' — ');
}

/**
 * Satu halaman → blok fakta centang.
 * @param items     `getTextContent().items` halaman itu (koordinat pdf.js)
 * @param teksOcr   teks OCR halaman itu bila halaman ini memakai OCR (untuk periksa silang B)
 * @param bawaan    judul kolom dari halaman sebelumnya (tabel lintas halaman tanpa judul ulang) —
 *                  objek `bawaan` hasil panggilan halaman sebelumnya, apa adanya
 * @param nomorHalaman wajib agar judul bawaan bisa dipakai (hanya untuk halaman tepat berikutnya)
 * @param itemsSebelumnya `getTextContent().items` halaman sebelumnya — judul tabel di dasar halaman itu
 *                  tanpa centang, centangnya mulai di halaman ini
 * @returns {{ blok: string, bawaan, ringkasan: { centang, terpetakan, tidakPasti: boolean, labelPerkiraan: boolean } }}
 */
export function bacaTabelCentang(items, { teksOcr, bawaan = null, nomorHalaman, itemsSebelumnya = null } = {}) {
  const potongan = potonganHalaman(items);
  const baris = barisVisual(potongan);
  const centang = potongan.filter((p) => p.centang).sort((a, b) => b.y - a.y || a.x - b.x);
  const jumlahOcr = teksOcr === undefined ? null : hitungCentangTeks(teksOcr);

  const alasan = [];
  if (!centang.length) {
    if (jumlahOcr) alasan.push(`teks OCR memuat ${jumlahOcr} tanda centang, tetapi lapisan teks PDF tidak memuat satu pun (centang berupa gambar atau halaman hasil scan)`);
    return {
      blok: alasan.length ? blokTidakPasti(alasan, []) : '',
      bawaan,
      ringkasan: { centang: 0, terpetakan: 0, tidakPasti: alasan.length > 0 }
    };
  }
  if (jumlahOcr !== null && jumlahOcr !== centang.length) {
    alasan.push(`jumlah tanda centang di PDF ${centang.length}, di teks OCR ${jumlahOcr}`);
  }

  const entri = [];          // { judul, label, kolom[] } berurutan atas ke bawah
  const gagal = [];
  let judulTerakhir = null;
  const judulPerY = new Map();   // satu objek per baris judul → "Kolom:" dicetak sekali per tabel
  // Judul bawaan hanya untuk halaman TEPAT sesudahnya, dan hanya untuk centang yang posisi x-nya sama
  // (±2 pt) dengan centang yang sudah terpetakan di bawah judul itu. Posisi x judul lama TIDAK dipakai:
  // hal. 257 buku Kepbup berskala lain dari hal. 256 (kolom "-" di x 395/458/512, judul hal. 256 di
  // x 421/470/520) — dengan judul hal. 256, centang Penting di x 458 terbaca Mutlak.
  // Bila SATU centang halaman ini tepat di x centang terpetakan, skala halaman terbukti sama → centang
  // lain (mis. kolom Mutlak yang belum muncul di halaman sebelumnya) boleh memakai x judul bawaan.
  const bawaanBerlaku = bawaan?.centangX?.length && nomorHalaman !== undefined && nomorHalaman === bawaan.halamanTerakhir + 1;
  const xDikenal = (c) => bawaan.centangX.find((k) => Math.abs(k.x - c.x) <= TOLERANSI_Y - 1);
  const skalaSama = bawaanBerlaku && centang.some(xDikenal);
  let barisSebelum;
  for (const c of centang) {
    let judul = cariJudul(baris, c);
    if (!judul && itemsSebelumnya && nomorHalaman !== undefined) {
      barisSebelum ??= barisVisual(potonganHalaman(itemsSebelumnya));
      judul = cariJudul(baris, c, barisSebelum);
    }
    if (judul) {
      const kunci = `${judul.dariHalamanSebelum ? 'sebelum' : 'kini'}|${judul.y}`;
      if (!judulPerY.has(kunci)) {
        judulPerY.set(kunci, { ...judul, halaman: judul.dariHalamanSebelum ? nomorHalaman - 1 : nomorHalaman, centangX: [] });
      }
      judul = judulPerY.get(kunci);
    }
    let terdekat = judul ? kolomCentang(c, judul.kolom) : null;
    let dibawa = false;
    if (!judul && skalaSama) {
      const serupa = xDikenal(c);
      terdekat = serupa ? bawaan.kolom.find((j) => j.teks === serupa.teks) : kolomCentang(c, bawaan.kolom);
      if (terdekat) {
        judul = bawaan;
        dibawa = true;
      }
    }
    const { teks: label, perkiraan } = susunLabel(baris, c, judul);
    if (!judul) {
      gagal.push(`${label || '(tanpa teks baris di dekatnya)'} → ${bawaanBerlaku
        ? `tabel tampaknya berlanjut dari halaman ${bawaan.halaman}, tetapi posisi tanda centang tidak sama dengan yang sudah terpetakan di sana`
        : 'tidak ada judul kolom yang sejajar dengan tanda centang'}`);
      continue;
    }
    if (!judul.centangX.some((k) => Math.abs(k.x - c.x) <= 1)) judul.centangX.push({ x: c.x, teks: terdekat.teks });
    judulTerakhir = judul;
    if (!label) {
      // Kolom pasti, tetapi baris mana yang dicentang tidak — fakta tanpa baris tidak boleh diberikan.
      gagal.push(`tanda centang di kolom "${terdekat.teks}" tanpa teks baris di dekatnya — barisnya tidak bisa dipastikan`);
      continue;
    }
    const sama = entri.find((e) => e.judul === judul && e.label === label && Math.abs(e.y - c.y) <= TOLERANSI_Y);
    if (sama) { if (!sama.kolom.includes(terdekat.teks)) sama.kolom.push(terdekat.teks); }
    else entri.push({ judul, dibawa, label, perkiraan, y: c.y, kolom: [terdekat.teks] });
  }
  // Satu centang rata tengah = tata letak halaman itu rata tengah: label baris lain (yang kebetulan
  // sebaris dengan centang) juga bisa hanya sepotong sel. Hal. 858: "2. Teknis — Jasa" dari sel 5 baris.
  const selTengah = entri.some((e) => e.perkiraan);

  const bagian = [];
  if (entri.length) {
    const garis = ['[TABEL CENTANG — dibaca dari posisi tanda di PDF; bila berbeda dengan tabel di atas, blok ini yang benar]'];
    let judulKini = null;
    for (const e of entri) {
      if (e.judul !== judulKini) {
        const daftar = e.judul.kolom.map((j) => j.teks).join(' | ');
        garis.push((e.dibawa || e.judul.dariHalamanSebelum) && e.judul.halaman
          ? `Kolom (judul tabel dari halaman ${e.judul.halaman}): ${daftar}`
          : `Kolom: ${daftar}`);
        if (selTengah && judulKini === null) {
          garis.push('Catatan: tanda centang di halaman ini berada di tengah sel, jadi label baris hanya perkiraan dari teks terdekat — cocokkan barisnya dengan tabel di atas; kolomnya pasti.');
        }
        judulKini = e.judul;
      }
      garis.push(`- ${selTengah ? '(label perkiraan) ' : ''}${e.label} → ${e.kolom.join(', ')}`);
    }
    garis.push('[/TABEL CENTANG]');
    bagian.push(garis.join('\n'));
  }
  if (alasan.length || gagal.length) bagian.push(blokTidakPasti(alasan, gagal));

  return {
    blok: bagian.join('\n'),
    // Tanpa centang terpetakan di halaman ini, rantai bawaan putus (halamanTerakhir tidak maju).
    bawaan: judulTerakhir ? { ...judulTerakhir, halamanTerakhir: nomorHalaman } : bawaan,
    ringkasan: {
      centang: centang.length,
      terpetakan: centang.length - gagal.length,
      tidakPasti: alasan.length > 0 || gagal.length > 0,
      labelPerkiraan: selTengah
    }
  };
}

function blokTidakPasti(alasan, gagal) {
  return [
    '[TABEL CENTANG TIDAK PASTI — posisi kolom tanda centang di halaman ini tidak bisa dipastikan dari PDF]',
    ...alasan.map((a) => `- ${a}`),
    ...gagal.map((g) => `- ${g}`),
    '[/TABEL CENTANG TIDAK PASTI]'
  ].join('\n');
}
