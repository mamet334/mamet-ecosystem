
export function perkiraanToken(teks) {
  const t = String(teks ?? '');
  if (!t) return 0;
  return Math.ceil(t.length / 4);
}

export function tokenPesan(pesan) {
  return perkiraanToken(pesan?.content) + 4;
}

export const PORSI_PER_PESAN = 0.05;
export const ANGGARAN_MIN = 8000;
export const ANGGARAN_BAWAAN = 60000;

export const PORSI_JENDELA_MODEL = 0.6;

export function anggaranKonteks({ batasHarianUsd, terpakaiHariIniUsd = 0, hargaInput1M, batasModel, porsi = PORSI_PER_PESAN } = {}) {
  const batasModelAman = Number.isFinite(batasModel) && batasModel > 0 ? Math.floor(batasModel * PORSI_JENDELA_MODEL) : Infinity;

  if (!Number.isFinite(batasHarianUsd) || batasHarianUsd <= 0 || !Number.isFinite(hargaInput1M) || hargaInput1M <= 0) {
    const token = Math.min(ANGGARAN_BAWAAN, batasModelAman);
    return {
      token,
      biayaPerkiraanUsd: 0,
      sisaHarianUsd: null,
      batasModel: Number.isFinite(batasModel) && batasModel > 0 ? batasModel : null,
      dibatasiJendelaModel: token === batasModelAman,
      alasan: token === batasModelAman
        ? 'dibatasi jendela model'
        : 'batas harian atau harga model belum diketahui — memakai anggaran bawaan',
    };
  }

  const sisa = Math.max(0, batasHarianUsd - Math.max(0, terpakaiHariIniUsd));
  const tokenDariBiaya = Math.floor(((sisa * porsi) / hargaInput1M) * 1_000_000);
  const token = Math.min(Math.max(ANGGARAN_MIN, tokenDariBiaya), batasModelAman);
  const dibatasiJendelaModel = token === batasModelAman;
  return {
    token,
    biayaPerkiraanUsd: (token / 1_000_000) * hargaInput1M,
    sisaHarianUsd: sisa,
    batasModel: Number.isFinite(batasModel) && batasModel > 0 ? batasModel : null,
    dibatasiJendelaModel,
    alasan: dibatasiJendelaModel
      ? 'dibatasi jendela model'
      : tokenDariBiaya < ANGGARAN_MIN
        ? 'sisa anggaran harian tipis — dipakai anggaran minimum'
        : 'dari batas biaya harian',
  };
}

export const PATOK = '_patok';

export const adalahPatok = (p) => !!(p && p[PATOK] === true);


export function pilihPesanKonteks(pesan, { anggaranToken, mulaiDari = 0, sisakanUntukJawaban = 2000 } = {}) {
  const semua = Array.isArray(pesan) ? pesan : [];
  const patok = semua.filter(adalahPatok);
  const percakapan = semua.filter((p) => !adalahPatok(p));

  const awal = Math.max(0, Math.min(mulaiDari, percakapan.length));
  const layak = percakapan.slice(awal);
  const batas = Math.max(0, (anggaranToken || 0) - sisakanUntukJawaban);

  const tokenPatok = patok.reduce((n, p) => n + tokenPesan(p), 0);
  const tokenTerbaru = layak.length ? tokenPesan(layak[layak.length - 1]) : 0;
  const patokIkut = patok.length > 0 && tokenPatok + tokenTerbaru <= batas;

  const terpilih = [];
  let token = patokIkut ? tokenPatok : 0;
  for (let i = layak.length - 1; i >= 0; i--) {
    const t = tokenPesan(layak[i]);
    if (token + t > batas && terpilih.length > 0) break;
    terpilih.unshift(layak[i]);
    token += t;
  }

  return {
    dikirim: patokIkut ? [...patok, ...terpilih] : terpilih,
    tokenTerpakai: token,
    dilewati: percakapan.length - terpilih.length,
    penuh: terpilih.length < layak.length,
    patokDilepas: patok.length > 0 && !patokIkut,
  };
}

export function angkaRingkas(n) {
  const x = Number(n) || 0;
  if (x < 1000) return String(x);
  if (x < 1_000_000) return `${(x / 1000).toFixed(1).replace('.', ',')}k`;
  return `${(x / 1_000_000).toFixed(1).replace('.', ',')}jt`;
}

export function meteranKonteks({ tokenTerpakai, anggaranToken, dilewati = 0, biayaPerkiraanUsd = 0, sisaHarianUsd = null, alasan = '', batasModel = null, dibatasiJendelaModel = false }) {
  const anggaran = Math.max(1, anggaranToken || 0);
  const persen = Math.min(100, Math.round((tokenTerpakai / anggaran) * 100));
  const warna = persen >= 90 ? 'penuh' : persen >= 70 ? 'hampir' : 'aman';
  const biaya = biayaPerkiraanUsd ? ` · ±$${(biayaPerkiraanUsd).toFixed(3)}/pesan` : '';
  const sisa = sisaHarianUsd != null ? ` · sisa harian $${sisaHarianUsd.toFixed(2)}` : '';
  const lewat = dilewati > 0 ? ` · ${dilewati} pesan lama tidak dikirim (tetap terlihat)` : '';
  const jendela = Number.isFinite(batasModel) && batasModel > 0
    ? dibatasiJendelaModel
      ? ` Dipotong jendela model ${batasModel.toLocaleString('id-ID')} token (konteks memakai ${Math.round(PORSI_JENDELA_MODEL * 100)}%, sisanya untuk jawaban).`
      : ` Jendela model ${batasModel.toLocaleString('id-ID')} token.`
    : ' Jendela model belum diketahui — hanya biaya yang membatasi.';
  return {
    teks: `${angkaRingkas(tokenTerpakai)} / ${angkaRingkas(anggaran)} (${persen}%)`,
    persen,
    warna,
    rincian: `Jendela konteks percakapan ini: ${tokenTerpakai.toLocaleString('id-ID')} dari ${anggaran.toLocaleString('id-ID')} token${biaya}${sisa}${lewat}. Anggaran ${alasan}.${jendela}`,
  };
}


export function pesanUntukDipadatkan(pesan, mulaiDari = 0) {
  const semua = Array.isArray(pesan) ? pesan : [];
  return semua.slice(Math.max(0, Math.min(mulaiDari, semua.length)))
    .filter((p) => String(p?.content || '').trim().length > 0);
}

export const MIN_PESAN_PADATKAN = 4;

export function bolehPadatkan(pesan, mulaiDari = 0) {
  return pesanUntukDipadatkan(pesan, mulaiDari).length >= MIN_PESAN_PADATKAN;
}

export function bentukPesanRingkasan(ringkasan, { jumlahPesan = 0, tokenSebelum = 0, tokenSesudah = 0 } = {}) {
  const hemat = tokenSebelum > 0 ? Math.max(0, Math.round((1 - tokenSesudah / tokenSebelum) * 100)) : 0;
  const kepala = `🗜️ **Konteks dipadatkan.** ${jumlahPesan} pesan di atas tetap ada di layar dan tetap tersimpan — mulai sekarang yang dikirim ke model adalah ringkasan di bawah ini (${angkaRingkas(tokenSebelum)} → ${angkaRingkas(tokenSesudah)} token, hemat ${hemat}%). Kalau ada yang penting terlewat dari ringkasan ini, tulis saja lagi di pesan berikutnya.`;
  return {
    role: 'model',
    isRingkasanKonteks: true,
    content: `${kepala}\n\n---\n\n${ringkasan}`,
  };
}

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
  } catch {  }
}

export const PORSI_KONTEKS_TAMBAHAN = 0.5;

export function bagiAnggaranKonteks(anggaranToken, teks, porsi = PORSI_KONTEKS_TAMBAHAN) {
  const t = String(teks ?? '');
  const batasToken = Math.floor(Math.max(0, Number(anggaranToken) || 0) * porsi);
  const token = perkiraanToken(t);
  if (token <= batasToken) return { teks: t, hurufDipotong: 0, tokenTerpakai: token, artikelDilewati: 0 };
  const batasHuruf = batasToken * 4;
  const bagian = t.split(POLA_AWAL_ARTIKEL);
  if (bagian.length > 1) {
    let utuh = bagian[0];
    let diambil = 0;
    for (const artikel of bagian.slice(1)) {
      if (utuh.length + artikel.length > batasHuruf) break;
      utuh += artikel;
      diambil++;
    }
    if (diambil > 0) {
      const dilewati = bagian.length - 1 - diambil;
      const sisaArtikel = t.length - utuh.length;
      const teksUtuh = `${utuh.replace(/\s+$/, '')}\n[CATATAN SISTEM: ${dilewati} artikel/konteks terakhir (${sisaArtikel.toLocaleString('id-ID')} huruf) tidak dikirim karena anggaran konteks di Settings; ${diambil} artikel pertama dikirim utuh.]`;
      return { teks: teksUtuh, hurufDipotong: sisaArtikel, tokenTerpakai: perkiraanToken(teksUtuh), artikelDilewati: dilewati };
    }
  }
  const potongan = t.slice(0, batasHuruf);
  const sisa = t.length - potongan.length;
  const teksAkhir = `${potongan}\n[CATATAN SISTEM: ${sisa.toLocaleString('id-ID')} huruf konteks dokumen/web/memori tidak dikirim karena anggaran konteks di Settings.]`;
  return { teks: teksAkhir, hurufDipotong: sisa, tokenTerpakai: perkiraanToken(teksAkhir), artikelDilewati: 0 };
}

const POLA_AWAL_ARTIKEL = /(?=---\s*Konteks\s*\d+)/;
