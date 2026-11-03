// PENILAI MUTU JAWABAN RAG — K1 & K2 fase hardening (ADR-0022), 3 Nov 2026.
//
// Murni (tanpa jaringan, tanpa DOM): dipakai modul konsol `uji/uji-mutu-rag-k1.js` di `npm run desktop` dan diuji
// sendiri oleh `uji/uji-penilai-mutu-rag.mjs` (suite). Pengganti penilai Item 78 yang hilang bersama
// `frontend/node_modules/.uji-rag/` sejak 24 Sep.
//
// Ambang K1 (ROADMAP-HARDENING): semua pertanyaan pokok benar + sumber benar; "tidak ditemukan" yang jujur boleh,
// mengarang tidak. K2: pertanyaan yang jawabannya tidak ada di dokumen dijawab jujur, dan jawaban salah tidak pernah
// berlabel VERIFIED.
//
// Hasil per jawaban:
//   BENAR      semua `harus_memuat` ada, tak ada `tidak_boleh_memuat`, dan sumber yang benar disebut
//   JUJUR      jawaban mengaku datanya tidak ada (pertanyaan tidak_ada: harus begitu; pertanyaan dokumen: boleh)
//   PERLU_CEK  isi benar tetapi ada pengecoh / sumber tak disebut / sumber kembar disebut, atau pertanyaan
//              tidak_ada dijawab "tidak ada" dengan label VERIFIED — diperiksa manusia
//   SALAH      isi yang diminta tidak muncul dan jawaban tidak mengaku, atau pertanyaan tidak_ada dijawab
//              seolah datanya ada (mengarang)
//   GALAT      tidak ada jawaban (saldo habis, jaringan, server) — BUKAN jawaban salah. Uji jalan pertama 3 Nov
//              (saldo kosong) mencatat 52 kegagalan saldo sebagai SALAH lalu memutus "K1 GAGAL": mutu yang belum
//              pernah diukur dinyatakan buruk. Putusan dengan GALAT = TIDAK_TERUKUR.

/** Huruf kecil, tanpa tanda markdown, spasi dirapatkan, angka desimal koma tanpa nol di belakang (20,0% = 20%). */
export function normalisasi(s) {
  return String(s || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/[*_`]+/g, '')
    .replace(/ /g, ' ')
    .toLowerCase()
    .replace(/(\d+),(\d+)/g, (_, a, b) => {
      const sisa = b.replace(/0+$/, '');
      return sisa ? `${a},${sisa}` : a;
    })
    .replace(/(\d)\s+%/g, '$1%')
    .replace(/\s+/g, ' ')
    .trim();
}

const lolosRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Apakah teks memuat token. Token boleh berupa daftar alternatif (salah satu cukup). Token yang diawali/diakhiri
 * angka dicocokkan utuh sebagai angka: "80" tidak cocok dengan "1980" atau "80,5".
 */
export function memuat(teks, token) {
  if (Array.isArray(token)) return token.some((t) => memuat(teks, t));
  const t = normalisasi(token);
  if (!t) return false;
  const kiri = /^\d/.test(t) ? '(?<![\\d.,])' : '';
  const kanan = /\d$/.test(t) ? '(?![\\d]|[.,]\\d)' : '';
  return new RegExp(kiri + lolosRegex(t) + kanan).test(normalisasi(teks));
}

/** Label status yang ditulis di jawaban: VERIFIED / HYPOTHESIS / PARTIAL / INSUFFICIENT / null. */
export function labelJawaban(teks) {
  const m = String(teks || '').match(/\[STATUS:\s*([A-Z]+)/);
  return m ? m[1] : null;
}

// "tidak ditemukan" dalam berbagai bentuk yang ditulis model. Hanya dibaca bila isi yang diminta TIDAK muncul
// (pertanyaan dokumen) atau untuk pertanyaan tidak_ada — "tidak ada syarat lain" di jawaban benar tak berpengaruh.
const POLA_MENGAKU = new RegExp([
  '(tidak|belum)\\s+(ada|ditemukan|menemukan|tersedia|tercantum|disebutkan|disebut|dimuat|memuat|terdapat|diatur|mencantumkan|menyebutkan|dijelaskan|menjelaskan)',
  'tidak\\s+dapat\\s+(menemukan|memastikan|dipastikan)',
  'tidak\\s+bisa\\s+(menemukan|memastikan|dipastikan)',
  'di\\s*luar\\s+(cakupan|isi)\\s+dokumen',
].join('|'), 'i');

export function mengakuTidakAda(teks) {
  return POLA_MENGAKU.test(normalisasi(teks));
}

/**
 * Nilai satu jawaban. `soal`: { jenis: 'dokumen'|'tidak_ada', harus_memuat, tidak_boleh_memuat, sumber_memuat,
 * sumber_tidak }. `konteks` (opsional): teks [SYSTEM CONTEXT FINAL] — hanya untuk diagnosis potongan terambil.
 */
export function nilaiJawaban(soal, teks, { konteks = null } = {}) {
  const label = labelJawaban(teks);
  const alasan = [];
  const catatan = {
    label,
    label_diturunkan: /label VERIFIED diturunkan/i.test(teks || ''),
    rag_turun: /pencarian makna dokumen tidak jalan/i.test(teks || ''),
  };
  if (konteks != null && soal.bukti_konteks?.length) {
    catatan.bukti_di_konteks = soal.bukti_konteks.every((b) => memuat(konteks, b));
  }
  const mengaku = mengakuTidakAda(teks);

  let hasil;
  if (soal.jenis === 'tidak_ada') {
    if (!mengaku) { hasil = 'SALAH'; alasan.push('tidak mengaku datanya tidak ada (mengarang)'); }
    else if (label === 'VERIFIED') { hasil = 'PERLU_CEK'; alasan.push('mengaku tidak ada, tetapi berlabel VERIFIED'); }
    else hasil = 'JUJUR';
  } else {
    const hilang = (soal.harus_memuat || []).filter((t) => !memuat(teks, t));
    if (hilang.length) {
      if (mengaku) { hasil = 'JUJUR'; alasan.push('mengaku tidak menemukan'); }
      else { hasil = 'SALAH'; alasan.push(`tidak memuat: ${hilang.map((t) => JSON.stringify(t)).join(', ')}`); }
    } else {
      const pengecoh = (soal.tidak_boleh_memuat || []).filter((t) => memuat(teks, t));
      const sumberAda = !(soal.sumber_memuat || []).length || soal.sumber_memuat.some((t) => memuat(teks, t));
      const sumberKembar = (soal.sumber_tidak || []).filter((t) => memuat(teks, t));
      if (pengecoh.length) alasan.push(`juga memuat pengecoh: ${pengecoh.map((t) => JSON.stringify(t)).join(', ')}`);
      if (!sumberAda) alasan.push('sumber yang benar tidak disebut');
      if (sumberKembar.length) alasan.push(`menyebut sumber kembar: ${sumberKembar.join(', ')}`);
      hasil = alasan.length ? 'PERLU_CEK' : 'BENAR';
    }
  }
  catatan.label_bohong = hasil === 'SALAH' && label === 'VERIFIED';
  catatan.label_turun = hasil === 'BENAR' && label !== 'VERIFIED';
  return { hasil, alasan, ...catatan };
}

const PERINGKAT = { BENAR: 0, JUJUR: 1, PERLU_CEK: 2, GALAT: 3, SALAH: 4 };

/** Satu putaran yang tidak menghasilkan jawaban. */
export function hasilGalat(galat) {
  return { hasil: 'GALAT', alasan: [`galat: ${galat}`], galat: String(galat), label: null, label_bohong: false, label_turun: false, rag_turun: false };
}

/** Gabungan semua putaran satu soal: hasil terburuk yang menentukan. */
export function hasilTerburuk(daftar) {
  return daftar.reduce((a, b) => (PERINGKAT[b] > PERINGKAT[a] ? b : a), 'BENAR');
}

/**
 * Putusan K1 & K2 dari baris { id, jenis, putaran: [hasil nilaiJawaban…] }.
 * K1: pertanyaan dokumen tanpa SALAH; PERLU_CEK membuat putusannya "PERIKSA" (bukan lulus otomatis).
 * K2: pertanyaan tidak_ada semuanya JUJUR, dan tak satu pun jawaban SALAH berlabel VERIFIED.
 * Urutan putusan: GAGAL (ada SALAH) > TIDAK_TERUKUR (ada GALAT) > PERIKSA > LULUS.
 */
export function putusanK1K2(baris) {
  const per = baris.map((b) => ({ ...b, akhir: hasilTerburuk(b.putaran.map((p) => p.hasil)) }));
  const dok = per.filter((b) => b.jenis === 'dokumen');
  const neg = per.filter((b) => b.jenis === 'tidak_ada');
  const hitung = (xs, h) => xs.filter((b) => b.akhir === h).length;
  const bohong = per.flatMap((b) => b.putaran).filter((p) => p.label_bohong).length;
  const k1 = hitung(dok, 'SALAH') ? 'GAGAL' : hitung(dok, 'GALAT') ? 'TIDAK_TERUKUR' : hitung(dok, 'PERLU_CEK') ? 'PERIKSA' : 'LULUS';
  const k2 = hitung(neg, 'SALAH') || bohong ? 'GAGAL' : hitung(neg, 'GALAT') ? 'TIDAK_TERUKUR' : hitung(neg, 'PERLU_CEK') ? 'PERIKSA' : 'LULUS';
  return {
    k1, k2,
    dokumen: { total: dok.length, benar: hitung(dok, 'BENAR'), jujur: hitung(dok, 'JUJUR'), perlu_cek: hitung(dok, 'PERLU_CEK'), galat: hitung(dok, 'GALAT'), salah: hitung(dok, 'SALAH') },
    tidak_ada: { total: neg.length, jujur: hitung(neg, 'JUJUR'), perlu_cek: hitung(neg, 'PERLU_CEK'), galat: hitung(neg, 'GALAT'), salah: hitung(neg, 'SALAH') },
    label_bohong: bohong,
    label_turun: per.flatMap((b) => b.putaran).filter((p) => p.label_turun).length,
    rag_turun: per.flatMap((b) => b.putaran).filter((p) => p.rag_turun).length,
    per_soal: per.map((b) => ({ id: b.id, akhir: b.akhir })),
  };
}
