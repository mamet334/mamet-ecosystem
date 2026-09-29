/**
 * labelRamah.js — label verifikasi dalam bahasa yang dimengerti pengguna awam (Mametlite, 2026-09-29).
 *
 * KENAPA ADA. Mametlite dibuat untuk orang awam: chat dengan hasil pencarian lengkap dan RAG, tanpa
 * Engineer, tanpa memori, tanpa jejak pemrosesan. Artinya **tidak ada siapa pun yang memeriksa jawaban**
 * — berbeda dari Mamet Ecosystem, tempat Owner sendiri yang jadi pemeriksanya.
 *
 * Justru di sanalah labelnya paling lemah. Sampai hari ini `mametlite/src` tidak punya satu pun kode yang
 * menangani label; `[STATUS: VERIFIED]` sampai ke pegawai ASN sebagai **teks mentah** di dalam jawaban,
 * dengan kosakata Inggris berhuruf besar yang tidak berarti apa-apa bagi mereka. Label yang tidak
 * dimengerti sama nilainya dengan tidak ada label.
 *
 * YANG TIDAK DILAKUKAN MODUL INI. Ia tidak menilai, tidak menghitung, dan tidak pernah menaikkan derajat
 * sebuah jawaban. Seluruh penilaian tetap milik server (`label_sumber.ts`). Di sini hanya penerjemahan:
 * satu label yang sudah diputuskan server → satu kalimat bahasa Indonesia.
 *
 * TANPA HOVER. Pengguna Mametlite membuka dari HP. Tidak ada kursor, jadi tidak ada tooltip — penjelasan
 * harus selalu terlihat, bukan disembunyikan di balik sentuhan.
 */

/** Nada warna: 'aman' (bersandar dokumen), 'hati' (perlu diperiksa), 'netral' (tidak tahu). */
export const ARTI_LABEL = {
  VERIFIED: {
    kunci: 'VERIFIED',
    judul: 'Dari dokumen',
    penjelasan: 'Jawaban ini bersandar pada dokumen yang tersimpan di Mamet. Sumbernya disebut di dalam jawaban.',
    nada: 'aman',
  },
  PARTIAL: {
    kunci: 'PARTIAL',
    judul: 'Sebagian dari dokumen',
    penjelasan: 'Sebagian jawaban ini dari dokumen, sebagian lagi perkiraan AI. Periksa dulu bagian yang penting.',
    nada: 'hati',
  },
  HYPOTHESIS: {
    kunci: 'HYPOTHESIS',
    judul: 'Perkiraan AI',
    penjelasan: 'Tidak diambil dari dokumen Anda. Periksa dulu sebelum dipakai untuk pekerjaan.',
    nada: 'hati',
  },
  INSUFFICIENT: {
    kunci: 'INSUFFICIENT',
    judul: 'Jawabannya tidak ditemukan',
    penjelasan: 'Mamet tidak menemukan datanya di dokumen yang ada. Belum tentu tidak ada — mungkin dokumennya belum diunggah.',
    nada: 'netral',
  },
  UMUM: {
    kunci: 'UMUM',
    judul: 'Pengetahuan umum AI',
    penjelasan: 'Bukan dari dokumen Anda, melainkan pengetahuan umum model. Periksa dulu sebelum dipakai.',
    nada: 'hati',
  },
};

// Menangkap semua varian tulisan server DAN model: [STATUS: VERIFIED], [Status: Verified],
// [STATUS: HYPOTHESIS - Rekomendasi AI], [STATUS: PARTIAL - Sebagian Bersandar Dokumen].
const POLA_STATUS = /\[\s*status\s*:\s*(verified|hypothesis|partial|insufficient)[^\]]*\]/gi;
// Label "bukan dari dokumen" yang dipakai mode LOOKUP saat tidak ada dokumen sama sekali.
const POLA_UMUM = /\[\s*pengetahuan umum ai[^\]]*\]/gi;
// Catatan sistem ditulis server dengan garis bawah (_miring_) — parseMarkdown Mametlite hanya
// mengenal *miring*, jadi bila dibiarkan di badan jawaban ia tampil beserta garis bawahnya.
const POLA_CATATAN = /^_?\s*(Catatan sistem:[^\n]*?)\s*_?$/gim;

/**
 * Urutan yang menang bila lebih dari satu label muncul di satu jawaban.
 *
 * Arahnya sengaja selalu ke yang LEBIH HATI-HATI. Server biasanya sudah menyisakan satu label saja
 * (VERIFIED diganti seluruhnya oleh HYPOTHESIS/PARTIAL saat diturunkan), tetapi bila model sempat
 * menulis dua, menampilkan yang paling menenangkan adalah kesalahan yang paling mahal di sini —
 * pembacanya tidak punya cara memeriksa sendiri.
 */
const URUTAN = ['HYPOTHESIS', 'PARTIAL', 'INSUFFICIENT', 'UMUM', 'VERIFIED'];

/**
 * Pisahkan label & catatan sistem dari badan jawaban.
 *
 * @param {string} teks jawaban apa adanya dari server
 * @returns {{ label: object|null, jawaban: string, catatan: string[] }}
 *   `label` null bila tidak ada label yang dikenali — jangan pernah mengarang label; jawaban tanpa
 *   label lebih jujur daripada jawaban berlabel keliru.
 *   `jawaban` sudah TANPA baris label & catatan, supaya tidak tampil dua kali.
 */
export function pisahLabel(teks) {
  const asli = String(teks ?? '');
  if (!asli.trim()) return { label: null, jawaban: asli, catatan: [] };

  const ditemukan = new Set();
  POLA_STATUS.lastIndex = 0;
  for (const m of asli.matchAll(POLA_STATUS)) ditemukan.add(m[1].toUpperCase());
  POLA_UMUM.lastIndex = 0;
  if (POLA_UMUM.test(asli)) ditemukan.add('UMUM');

  const catatan = [];
  POLA_CATATAN.lastIndex = 0;
  for (const m of asli.matchAll(POLA_CATATAN)) catatan.push(m[1].trim());

  const kunci = URUTAN.find((k) => ditemukan.has(k)) || null;

  const jawaban = asli
    .replace(POLA_STATUS, '')
    .replace(POLA_UMUM, '')
    .replace(POLA_CATATAN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { label: kunci ? ARTI_LABEL[kunci] : null, jawaban, catatan };
}

/** Kelas warna per nada. Dipisah supaya bisa diuji tanpa merender React. */
export function warnaLabel(nada) {
  if (nada === 'aman') return { bingkai: 'border-emerald-500/40 bg-emerald-500/10', teks: 'text-emerald-300' };
  if (nada === 'hati') return { bingkai: 'border-amber-500/40 bg-amber-500/10', teks: 'text-amber-300' };
  return { bingkai: 'border-slate-500/40 bg-slate-500/10', teks: 'text-slate-300' };
}
