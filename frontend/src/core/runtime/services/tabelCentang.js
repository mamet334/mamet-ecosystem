
const HURUF_CENTANG = '√✓✔☑☒';
const POLA_CENTANG_SAJA = new RegExp(`^(?:[${HURUF_CENTANG}]{1,2}|\\u00D6)$`);

export const TOLERANSI_SEJAJAR = 12;
const TOLERANSI_DALAM_JUDUL = 6;
const TOLERANSI_Y = 3;
const JARAK_JUDUL_MAKS = 400;
const PANJANG_JUDUL_MAKS = 30;
const CELAH_GABUNG_KATA = 4;
const CELAH_ANTAR_JUDUL_MIN = 5;
const CELAH_ANTAR_JUDUL_MAKS = 60;
const TINGGI_BLOK_JUDUL = 40;
const JARAK_SEL_TENGAH = 8;
const CELAH_BARIS_LANJUTAN = 20;

const ringkas = (s) => s.replace(/\s+/g, ' ').trim();

const POLA_CENTANG_TEKS = new RegExp(`[${HURUF_CENTANG}]|(?<=\\|[ \\t]*)\\u00D6(?=[ \\t]*\\|)`, 'g');

export const cariCentangTeks = (teks) => [...(teks || '').matchAll(POLA_CENTANG_TEKS)].map((m) => ({ i: m.index, huruf: m[0] }));
export const hitungCentangTeks = (teks) => cariCentangTeks(teks).length;

const kunciPotongan = (it) => `${Math.round(it.transform[4] / 2)}|${Math.round(it.transform[5] / 2)}|${it.str}`;

function potonganHalaman(items) {
  const hasil = [];
  const terlihat = new Set();
  for (const it of items || []) {
    if (!it || typeof it.str !== 'string' || !it.transform || !it.str.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const kunci = kunciPotongan(it);
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);
    const s = it.str.trim();
    hasil.push({ s, x, y, w: it.width || 0, centang: POLA_CENTANG_SAJA.test(s), kunci });
  }
  return hasil;
}

function barisVisual(potongan) {
  const baris = [];
  for (const p of [...potongan].sort((a, b) => b.y - a.y)) {
    const b = baris.find((r) => Math.abs(r.y - p.y) <= TOLERANSI_Y);
    if (b) b.isi.push(p); else baris.push({ y: p.y, isi: [p] });
  }
  for (const b of baris) b.isi.sort((a, c) => a.x - c.x);
  return baris;
}

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

export function kolomCentang(c, kolom) {
  if (!kolom?.length) return null;
  const pusat = c.x + c.w / 2;
  const terakhir = kolom[kolom.length - 1];
  if (pusat < kolom[0].x - TOLERANSI_SEJAJAR || pusat > terakhir.x + terakhir.w + TOLERANSI_SEJAJAR) return null;
  let rentang = kolom[0];
  for (const j of kolom) if (j.x <= pusat + TOLERANSI_DALAM_JUDUL) rentang = j;
  let tengah = kolom[0];
  for (let i = 1; i < kolom.length; i++) {
    const batas = ((kolom[i - 1].x + kolom[i - 1].w / 2) + (kolom[i].x + kolom[i].w / 2)) / 2;
    if (pusat >= batas) tengah = kolom[i];
  }
  return rentang === tengah ? rentang : null;
}

const bisaJadiJudul = (j) => j && j.teks.length <= PANJANG_JUDUL_MAKS && /\p{L}{2}/u.test(j.teks);

function cariJudul(baris, c, barisSebelum = null) {
  const sumber = barisSebelum || baris;
  const kandidat = (barisSebelum || baris.filter((b) => b.y > c.y + TOLERANSI_Y && b.y - c.y <= JARAK_JUDUL_MAKS))
    .slice().sort((a, b) => a.y - b.y);
  const pusat = c.x + c.w / 2;
  const adaTeks = (r) => r.isi.some((p) => !p.centang);
  const xKiri = (r) => Math.min(...r.isi.filter((p) => !p.centang).map((p) => p.x));
  const atasKini = baris.filter((r) => r.y >= c.y - TOLERANSI_Y && adaTeks(r)).sort((p, q) => q.y - p.y);
  const teksSebaris = (jarak) => baris.filter((r) => Math.abs(r.y - c.y) <= jarak)
    .flatMap((r) => r.isi.filter((p) => !p.centang && /[\p{L}\p{N}]/u.test(p.s)));
  const labelSekitar = teksSebaris(TOLERANSI_Y).length ? teksSebaris(TOLERANSI_Y) : teksSebaris(JARAK_SEL_TENGAH);
  for (const b of kandidat) {
    const judul = gabungJudul(b.isi);
    const k = judul.findIndex((j) => pusat >= j.x - TOLERANSI_DALAM_JUDUL && pusat <= j.x + j.w + TOLERANSI_DALAM_JUDUL);
    if (k < 0 || !bisaJadiJudul(judul[k])) continue;
    const celah = (i) => judul[i + 1].x - (judul[i].x + judul[i].w);
    let awal = k;
    let akhir = k;
    while (awal > 0 && bisaJadiJudul(judul[awal - 1]) && celah(awal - 1) >= CELAH_ANTAR_JUDUL_MIN && celah(awal - 1) <= CELAH_ANTAR_JUDUL_MAKS) awal--;
    while (akhir < judul.length - 1 && bisaJadiJudul(judul[akhir + 1]) && celah(akhir) >= CELAH_ANTAR_JUDUL_MIN && celah(akhir) <= CELAH_ANTAR_JUDUL_MAKS) akhir++;
    if (akhir === awal) continue;
    if ((awal > 0 && celah(awal - 1) < CELAH_ANTAR_JUDUL_MIN) || (akhir < judul.length - 1 && celah(akhir) < CELAH_ANTAR_JUDUL_MIN)) continue;
    const kolom = judul.slice(awal, akhir + 1).map(({ teks, x, w }) => ({ teks, x, w }));
    if (!kolomCentang(c, kolom)) continue;
    if (labelSekitar.some((p) => p.x >= kolom[0].x - 1)) continue;
    const bawahSumber = sumber.filter((r) => r.y < b.y - TOLERANSI_Y && (barisSebelum || r.y >= c.y - TOLERANSI_Y) && adaTeks(r))
      .sort((p, q) => q.y - p.y);
    const bawah = barisSebelum ? [...bawahSumber, ...atasKini] : bawahSumber;
    if (!bawah.length || xKiri(bawah[0]) > Math.min(...bawah.map(xKiri)) + TOLERANSI_Y) continue;
    if (barisSebelum && bawahSumber.length && atasKini.length
      && Math.abs(Math.min(...bawahSumber.map(xKiri)) - Math.min(...atasKini.map(xKiri))) > 1.5) continue;
    if (barisSebelum && (!bawahSumber.length || !atasKini.length)) continue;
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
    if (b.isi.some((p) => p.centang)) break;
    if (yTerakhir - b.y > CELAH_BARIS_LANJUTAN) break;
    const isi = kiriDari(b);
    if (!isi.length || isi.length !== b.isi.length) break;
    if (Math.min(...isi.map((p) => p.x)) <= xAwal + 1) break;
    bagian.push(...isi);
    yTerakhir = b.y;
  }
  return { teks: rangkaiLabel(bagian, judul, xAwal), perkiraan: false };
}

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
      tanda: [],
      ringkasan: { centang: 0, terpetakan: 0, tidakPasti: alasan.length > 0 }
    };
  }
  if (jumlahOcr !== null && jumlahOcr !== centang.length) {
    alasan.push(`jumlah tanda centang di PDF ${centang.length}, di teks OCR ${jumlahOcr}`);
  }

  const entri = [];
  const gagal = [];
  const tanda = [];
  let judulTerakhir = null;
  const judulPerY = new Map();
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
    tanda.push({ kolom: judul && label ? terdekat.teks : null, label, kunci: c.kunci });
    if (!judul) {
      gagal.push(`${label || '(tanpa teks baris di dekatnya)'} → ${bawaanBerlaku
        ? `tabel tampaknya berlanjut dari halaman ${bawaan.halaman}, tetapi posisi tanda centang tidak sama dengan yang sudah terpetakan di sana`
        : 'tidak ada judul kolom yang sejajar dengan tanda centang'}`);
      continue;
    }
    if (!judul.centangX.some((k) => Math.abs(k.x - c.x) <= 1)) judul.centangX.push({ x: c.x, teks: terdekat.teks });
    judulTerakhir = judul;
    if (!label) {
      gagal.push(`tanda centang di kolom "${terdekat.teks}" tanpa teks baris di dekatnya — barisnya tidak bisa dipastikan`);
      continue;
    }
    const sama = entri.find((e) => e.judul === judul && e.label === label && Math.abs(e.y - c.y) <= TOLERANSI_Y);
    if (sama) { if (!sama.kolom.includes(terdekat.teks)) sama.kolom.push(terdekat.teks); }
    else entri.push({ judul, dibawa, label, perkiraan, y: c.y, kolom: [terdekat.teks] });
  }
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
    bawaan: judulTerakhir ? { ...judulTerakhir, halamanTerakhir: nomorHalaman } : bawaan,
    tanda,
    ringkasan: {
      centang: centang.length,
      terpetakan: centang.length - gagal.length,
      tidakPasti: alasan.length > 0 || gagal.length > 0,
      labelPerkiraan: selTengah
    }
  };
}

const KATA_UMUM = new Set(['yang', 'dengan', 'dalam', 'untuk', 'atau', 'pada', 'dari', 'oleh', 'serta', 'sebagai',
  'tahun', 'paling', 'kurang', 'sedikit', 'memiliki', 'sedang', 'pernah', 'jabatan', 'bidang', 'terkait', 'sesuai']);
const kataPembeda = (s) => {
  const semua = s.toLowerCase().match(/\p{L}{4,}/gu) || [];
  const pembeda = semua.filter((k) => !KATA_UMUM.has(k));
  return new Set(pembeda.length ? pembeda : semua);
};

export function tulisCentangDiTeks(teksOcr, tanda) {
  const asli = { teks: teksOcr, ditulis: 0 };
  if (!teksOcr || !tanda?.length) return { ...asli, alasan: null };
  const posisi = cariCentangTeks(teksOcr);
  if (posisi.length !== tanda.length) return { ...asli, alasan: `jumlah tanda di teks OCR ${posisi.length}, di PDF ${tanda.length}` };
  if (tanda.some((t) => !t.kolom || !t.label)) return { ...asli, alasan: 'ada tanda di PDF yang kolom atau barisnya tidak pasti' };
  const kataLabel = tanda.map((t) => kataPembeda(t.label));
  for (let k = 0; k < posisi.length; k++) {
    const awal = teksOcr.lastIndexOf('\n', posisi[k].i) + 1;
    const akhir = teksOcr.indexOf('\n', posisi[k].i);
    const kataBaris = new Set(teksOcr.slice(awal, akhir < 0 ? undefined : akhir).toLowerCase().match(/\p{L}{4,}/gu) || []);
    const skor = (j) => [...kataLabel[j]].filter((w) => kataBaris.has(w)).length;
    const milik = skor(k);
    if (!milik) return { ...asli, alasan: `tanda ke-${k + 1} jatuh di baris OCR yang tidak memuat kata dari labelnya di PDF` };
    if (tanda.some((t, j) => j !== k && t.kolom !== tanda[k].kolom && t.label !== tanda[k].label && skor(j) >= milik)) {
      return { ...asli, alasan: `baris OCR tanda ke-${k + 1} sama mirip atau lebih mirip dengan label tanda lain yang berkolom berbeda` };
    }
  }
  let teks = '';
  let dari = 0;
  posisi.forEach((p, k) => {
    teks += `${teksOcr.slice(dari, p.i)}${p.huruf} ${tanda[k].kolom}`;
    dari = p.i + p.huruf.length;
  });
  return { teks: teks + teksOcr.slice(dari), ditulis: posisi.length, alasan: null };
}

export function tulisCentangDiItems(items, tanda) {
  const kolomPer = new Map((tanda || []).filter((t) => t.kolom && t.kunci).map((t) => [t.kunci, t.kolom]));
  if (!kolomPer.size) return { items, ditulis: 0 };
  let ditulis = 0;
  const baru = (items || []).map((it) => {
    if (!it?.transform || typeof it.str !== 'string') return it;
    const kolom = kolomPer.get(kunciPotongan(it));
    if (!kolom) return it;
    ditulis++;
    return { ...it, str: `${it.str.trim()} ${kolom}` };
  });
  return { items: baru, ditulis };
}

function blokTidakPasti(alasan, gagal) {
  return [
    '[TABEL CENTANG TIDAK PASTI — posisi kolom tanda centang di halaman ini tidak bisa dipastikan dari PDF]',
    ...alasan.map((a) => `- ${a}`),
    ...gagal.map((g) => `- ${g}`),
    '[/TABEL CENTANG TIDAK PASTI]'
  ].join('\n');
}
