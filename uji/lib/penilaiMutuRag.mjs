
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

export function memuat(teks, token) {
  if (Array.isArray(token)) return token.some((t) => memuat(teks, t));
  const t = normalisasi(token);
  if (!t) return false;
  const kiri = /^\d/.test(t) ? '(?<![\\d.,])' : '';
  const kanan = /\d$/.test(t) ? '(?![\\d]|[.,]\\d)' : '';
  return new RegExp(kiri + lolosRegex(t) + kanan).test(normalisasi(teks));
}

export function periksaPasangan(teks, pasangan = []) {
  const t = normalisasi(teks);
  const salah = [];
  const hilang = [];
  for (const p of pasangan) {
    const baris = normalisasi(p.baris);
    const pilihan = p.pilihan.map(normalisasi);
    const nilai = normalisasi(p.nilai);
    const ditemukan = [];
    let i = t.indexOf(baris);
    while (i >= 0) {
      let jendela = t.slice(i + baris.length, i + baris.length + (p.jendela || 120));
      for (const x of pilihan) jendela = jendela.replace(new RegExp(`\\bbukan\\s+${lolosRegex(x)}\\b`, 'g'), ' ');
      const m = jendela.match(new RegExp(`\\b(${pilihan.map(lolosRegex).join('|')})\\b`));
      if (m) ditemukan.push(m[1]);
      i = t.indexOf(baris, i + baris.length);
    }
    if (!ditemukan.length) hilang.push(`${p.baris} → ${p.nilai}`);
    else if (ditemukan.some((d) => d !== nilai)) salah.push(`${p.baris} → ${ditemukan.find((d) => d !== nilai)} (seharusnya ${p.nilai})`);
  }
  return { salah, hilang };
}

export function labelJawaban(teks) {
  const m = String(teks || '').match(/\[STATUS:\s*([A-Z]+)/);
  return m ? m[1] : null;
}

const POLA_MENGAKU = new RegExp([
  '(tidak|belum)\\s+(ada|ditemukan|menemukan|tersedia|tercantum|disebutkan|disebut|dimuat|memuat|terdapat|diatur|mencantumkan|menyebutkan|dijelaskan|menjelaskan)',
  'tidak\\s+dapat\\s+(menemukan|memastikan|dipastikan)',
  'tidak\\s+bisa\\s+(menemukan|memastikan|dipastikan)',
  'di\\s*luar\\s+(cakupan|isi)\\s+dokumen',
].join('|'), 'i');

export function mengakuTidakAda(teks) {
  return POLA_MENGAKU.test(normalisasi(teks));
}

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
    const ada = (soal.harus_memuat || []).filter((t) => memuat(teks, t));
    const pas = periksaPasangan(teks, soal.pasangan || []);
    hilang.push(...pas.hilang);
    if (pas.salah.length) {
      hasil = 'SALAH';
      alasan.push(`pasangan salah: ${pas.salah.join('; ')}`);
    } else if (hilang.length) {
      if (mengaku && !ada.length) { hasil = 'JUJUR'; alasan.push('mengaku tidak menemukan'); }
      else if (mengaku) {
        hasil = 'PERLU_CEK';
        alasan.push(`memuat sebagian fakta kunci (${ada.map((t) => JSON.stringify(t)).join(', ')}) tanpa ${hilang.map((t) => JSON.stringify(t)).join(', ')}; kalimat "tidak ada…" tidak dihitung pengakuan`);
      } else { hasil = 'SALAH'; alasan.push(`tidak memuat: ${hilang.map((t) => JSON.stringify(t)).join(', ')}`); }
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

export function hasilGalat(galat) {
  return { hasil: 'GALAT', alasan: [`galat: ${galat}`], galat: String(galat), label: null, label_bohong: false, label_turun: false, rag_turun: false };
}

export function hasilTerburuk(daftar) {
  return daftar.reduce((a, b) => (PERINGKAT[b] > PERINGKAT[a] ? b : a), 'BENAR');
}

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
