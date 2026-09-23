/**
 * KonteksChat.js — jendela konteks per percakapan (ROADMAP-ENGINEER-MANDIRI Tahap 3a, 2026-09-23).
 *
 * SEBELUM INI: yang dikirim ke model hanya `history.slice(-10)` — sepuluh pesan terakhir, tanpa memandang
 * panjangnya. Jadi "konteks" bukan percakapan, melainkan jendela geser sepuluh pesan: pada tugas panjang Engineer
 * kehilangan benang merah, dan keluaran perintah yang lebih lama lenyap dari pandangannya.
 *
 * SEKARANG: percakapan ITULAH konteksnya, dibatasi ANGGARAN TOKEN — pesan diambil dari yang terbaru mundur ke
 * belakang sampai anggaran habis. Anggarannya diturunkan dari batas biaya harian Owner (Settings), bukan angka
 * karangan: konteks besar dibayar SETIAP pesan, dan pada tarif deepseek-v4-pro ($0,96/1 juta token masuk) jendela
 * 700 rb token berarti ±$0,67 sekali kirim.
 *
 * Keputusan Owner 23 September 2026:
 *   - "Bersihkan konteks" TIDAK menghapus pesan: pesan lama tetap terlihat di layar, hanya berhenti dikirim ke
 *     model. Bukti percakapan sudah dua kali menyelamatkan penelusuran bug hari itu.
 *   - Anggaran mengikuti kolom batas biaya di Settings.
 *   - Berlaku di Assistant DAN Engineer, masing-masing berdiri sendiri per percakapan.
 */

/** Perkiraan token: 1 token ≈ 4 huruf untuk teks Latin; nama berkas & kode sedikit lebih padat. */
export function perkiraanToken(teks) {
  const t = String(teks ?? '');
  if (!t) return 0;
  return Math.ceil(t.length / 4);
}

/** Token satu pesan chat, termasuk ongkos peran/pembungkus (±4 token per pesan). */
export function tokenPesan(pesan) {
  return perkiraanToken(pesan?.content) + 4;
}

export const PORSI_PER_PESAN = 0.05;   // satu pesan boleh memakai 5% sisa anggaran harian
export const ANGGARAN_MIN = 8000;      // di bawah ini konteks jadi tak berguna
export const ANGGARAN_BAWAAN = 60000;  // dipakai bila harga/batas harian belum diketahui

/**
 * Anggaran token untuk satu kirim, diturunkan dari batas biaya harian Owner.
 *
 * @param {{batasHarianUsd?: number, terpakaiHariIniUsd?: number, hargaInput1M?: number, batasModel?: number, porsi?: number}} p
 * @returns {{token: number, biayaPerkiraanUsd: number, sisaHarianUsd: number|null, alasan: string}}
 */
export function anggaranKonteks({ batasHarianUsd, terpakaiHariIniUsd = 0, hargaInput1M, batasModel, porsi = PORSI_PER_PESAN } = {}) {
  const batasModelAman = Number.isFinite(batasModel) && batasModel > 0 ? Math.floor(batasModel * 0.6) : Infinity;

  if (!Number.isFinite(batasHarianUsd) || batasHarianUsd <= 0 || !Number.isFinite(hargaInput1M) || hargaInput1M <= 0) {
    const token = Math.min(ANGGARAN_BAWAAN, batasModelAman);
    return { token, biayaPerkiraanUsd: 0, sisaHarianUsd: null, alasan: 'batas harian atau harga model belum diketahui — memakai anggaran bawaan' };
  }

  const sisa = Math.max(0, batasHarianUsd - Math.max(0, terpakaiHariIniUsd));
  const tokenDariBiaya = Math.floor(((sisa * porsi) / hargaInput1M) * 1_000_000);
  const token = Math.max(ANGGARAN_MIN, Math.min(tokenDariBiaya, batasModelAman));
  return {
    token,
    biayaPerkiraanUsd: (token / 1_000_000) * hargaInput1M,
    sisaHarianUsd: sisa,
    alasan: tokenDariBiaya < ANGGARAN_MIN
      ? 'sisa anggaran harian tipis — dipakai anggaran minimum'
      : token === batasModelAman
        ? 'dibatasi jendela model'
        : 'dari batas biaya harian',
  };
}

/**
 * Pilih pesan yang dikirim ke model: dari yang TERBARU mundur ke belakang sampai anggaran habis.
 * Pesan sebelum `mulaiDari` (hasil tombol "Bersihkan konteks") tidak pernah ikut — tetapi TIDAK dihapus.
 *
 * @param {Array<{role: string, content: string}>} pesan seluruh pesan percakapan (urut lama → baru)
 * @param {{anggaranToken: number, mulaiDari?: number, sisakanUntukJawaban?: number}} opsi
 * @returns {{dikirim: Array, tokenTerpakai: number, dilewati: number, penuh: boolean}}
 */
export function pilihPesanKonteks(pesan, { anggaranToken, mulaiDari = 0, sisakanUntukJawaban = 2000 } = {}) {
  const semua = Array.isArray(pesan) ? pesan : [];
  const awal = Math.max(0, Math.min(mulaiDari, semua.length));
  const layak = semua.slice(awal);
  const batas = Math.max(0, (anggaranToken || 0) - sisakanUntukJawaban);

  const terpilih = [];
  let token = 0;
  for (let i = layak.length - 1; i >= 0; i--) {
    const t = tokenPesan(layak[i]);
    if (token + t > batas && terpilih.length > 0) break;
    terpilih.unshift(layak[i]);
    token += t;
  }
  return {
    dikirim: terpilih,
    tokenTerpakai: token,
    dilewati: semua.length - terpilih.length,
    penuh: terpilih.length < layak.length,
  };
}

/** Tampilan angka: 1234 → "1,2k", 723800 → "723,8k". */
export function angkaRingkas(n) {
  const x = Number(n) || 0;
  if (x < 1000) return String(x);
  if (x < 1_000_000) return `${(x / 1000).toFixed(1).replace('.', ',')}k`;
  return `${(x / 1_000_000).toFixed(1).replace('.', ',')}jt`;
}

/**
 * Bahan meteran untuk bilah atas chat — satu jendela per percakapan.
 * @returns {{teks: string, persen: number, warna: 'aman'|'hampir'|'penuh', rincian: string}}
 */
export function meteranKonteks({ tokenTerpakai, anggaranToken, dilewati = 0, biayaPerkiraanUsd = 0, sisaHarianUsd = null, alasan = '' }) {
  const anggaran = Math.max(1, anggaranToken || 0);
  const persen = Math.min(100, Math.round((tokenTerpakai / anggaran) * 100));
  const warna = persen >= 90 ? 'penuh' : persen >= 70 ? 'hampir' : 'aman';
  const biaya = biayaPerkiraanUsd ? ` · ±$${(biayaPerkiraanUsd).toFixed(3)}/pesan` : '';
  const sisa = sisaHarianUsd != null ? ` · sisa harian $${sisaHarianUsd.toFixed(2)}` : '';
  const lewat = dilewati > 0 ? ` · ${dilewati} pesan lama tidak dikirim (tetap terlihat)` : '';
  return {
    teks: `${angkaRingkas(tokenTerpakai)} / ${angkaRingkas(anggaran)} (${persen}%)`,
    persen,
    warna,
    rincian: `Jendela konteks percakapan ini: ${tokenTerpakai.toLocaleString('id-ID')} dari ${anggaran.toLocaleString('id-ID')} token${biaya}${sisa}${lewat}. Anggaran ${alasan}.`,
  };
}

/** Kunci penyimpanan batas "Bersihkan konteks" — per percakapan, tidak saling mengganggu antar workspace. */
export const kunciMulaiDari = (chatId) => `mamet:konteks:mulai:${chatId || 'baru'}`;

export function bacaMulaiDari(chatId, ls) {
  try {
    const s = ls || (typeof localStorage !== 'undefined' ? localStorage : null);
    const v = parseInt(s?.getItem(kunciMulaiDari(chatId)) || '0', 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch { return 0; }
}

export function simpanMulaiDari(chatId, nilai, ls) {
  try {
    const s = ls || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (nilai > 0) s?.setItem(kunciMulaiDari(chatId), String(nilai));
    else s?.removeItem(kunciMulaiDari(chatId));
  } catch { /* penyimpanan penuh — konteks kembali ke bawaan */ }
}
