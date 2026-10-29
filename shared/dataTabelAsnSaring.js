// DATA TABEL REKONSILIASI ASN — saring & hitung (Item 92 Tahap 3, 2026-09-21)
//
// Menjawab "berapa" / "siapa yang belum" dengan KODE, bukan dengan model. Model perencana hanya menerjemahkan
// pertanyaan menjadi RENCANA (saringan terstruktur, lihat normalkanRencana); fungsi di sini yang menyaring baris
// asn_pegawai, menghitung, dan menyusun:
//   - teks untuk model penjawab: jumlah + paling banyak 30 nama, TANPA NIP;
//   - lampiran tabel lengkap DENGAN NIP, ditempel kode di bawah jawaban — model tidak pernah melihat NIP, dan NIP yang
//     tampil diambil langsung dari database (keputusan Owner 2026-09-21: bukan penanda [P-0231] yang harus disalin model).
//
// Murni & tanpa impor: dipakai server (agent-process, lewat impor relatif seperti KnowledgeService.js) dan diuji di Node
// dengan data 53 berkas `D:\REKONSIALISASI 2026`.

// Baris asal: Excel → "baris 12"; PDF pindaian (Tahap 5, disandikan negatif −(halaman×1000 + baris)) → "hal. 3 baris 5".
// Disalin dari dataTabelAsnOcr.uraiBaris supaya modul ini (dipakai server) tidak menarik pembaca Excel.
const teksBaris = (n) => (Number.isInteger(n) && n < 0 ? `hal. ${Math.floor(-n / 1000)} baris ${-n % 1000}` : `baris ${n}`);

export const KELOMPOK = ['struktural', 'jft', 'pelaksana', 'pppk', 'paruh_waktu', 'tidak_dikenal'];
export const BIDANG = {
  nama: 'nama pegawai',
  nip: 'NIP',
  jenis_kelamin: 'jenis kelamin (L/P)',
  status: 'status kepegawaian (PNS/CPNS/PPPK/…)',
  pendidikan_cpns: 'pendidikan saat CPNS',
  pendidikan_akhir: 'pendidikan terakhir',
  tahun_lulus: 'tahun lulus pendidikan',
  jabatan: 'nama jabatan',
  pangkat: 'pangkat/golongan',
  pim: 'pelatihan kepemimpinan (PIM II/III/IV) — daftar',
  pelatihan: 'pelatihan teknis/fungsional — daftar',
  nilai_ipa: 'nilai IP ASN (angka)',
};
export const OPERATOR = ['kosong', 'terisi', 'mengandung', 'tidak_mengandung', 'sama', 'lebih_dari', 'kurang_dari'];
export const KELOMPOKKAN = ['opd', 'kelompok', 'jenis_kelamin', 'pendidikan_akhir', 'jabatan', 'pim'];
export const MAKS_NAMA_UNTUK_MODEL = 30;
export const MAKS_BARIS_LAMPIRAN = 500;

const rapat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const kecil = (s) => rapat(s).toLowerCase();
const KOSONG_ISI = (v) => !v || v === '-' || v === '–';

/** Tingkat PIM dari nilai tersimpan ("IV", "PIM IV", "Diklat PIM III", "√" di kolom PIM IV → sudah "IV"). */
export function tingkatPim(v) {
  const m = rapat(v).toUpperCase().match(/\b(IV|III|II|I)\b/);
  return m ? m[1] : rapat(v).toUpperCase();
}

/**
 * Bersihkan rencana dari model perencana: hanya OPD/kelompok/bidang/operator yang dikenal yang dipakai; sisanya
 * dicatat di `diabaikan` supaya jawaban jujur tentang saringan yang tidak bisa diterapkan.
 * @param {object} mentah  keluaran JSON model
 * @param {string[]} daftarOpd  nama OPD aktif milik pengguna
 */
export function normalkanRencana(mentah, daftarOpd = []) {
  const r = mentah && typeof mentah === 'object' ? mentah : {};
  const diabaikan = [];
  const opd = [];
  for (const o of Array.isArray(r.opd) ? r.opd : []) {
    const t = kecil(o);
    if (!t) continue;
    const pas = daftarOpd.find((d) => kecil(d) === t) || daftarOpd.find((d) => kecil(d).includes(t) || t.includes(kecil(d)));
    if (pas) { if (!opd.includes(pas)) opd.push(pas); } else diabaikan.push(`OPD "${o}" tidak ada di data tersimpan`);
  }
  const kelompok = (Array.isArray(r.kelompok) ? r.kelompok : []).map(kecil).filter((k) => {
    if (KELOMPOK.includes(k)) return true;
    diabaikan.push(`kelompok "${k}" tidak dikenal`);
    return false;
  });
  const syarat = [];
  for (const s of Array.isArray(r.syarat) ? r.syarat : []) {
    const bidang = kecil(s?.bidang), operator = kecil(s?.operator);
    if (!BIDANG[bidang]) { diabaikan.push(`bidang "${s?.bidang}" tidak dikenal`); continue; }
    if (!OPERATOR.includes(operator)) { diabaikan.push(`operator "${s?.operator}" tidak dikenal`); continue; }
    const perluNilai = !['kosong', 'terisi'].includes(operator);
    if (perluNilai && !rapat(s?.nilai)) { diabaikan.push(`syarat ${bidang} ${operator} tanpa nilai`); continue; }
    syarat.push({ bidang, operator, ...(perluNilai ? { nilai: rapat(s.nilai) } : {}) });
  }
  const keluaran = r.keluaran === 'daftar' ? 'daftar' : 'hitung';
  const kelompokkan = KELOMPOKKAN.includes(kecil(r.kelompokkan)) ? kecil(r.kelompokkan) : null;
  return { relevan: r.relevan !== false, opd, kelompok, syarat, keluaran, kelompokkan, diabaikan };
}

function nilaiBidang(p, bidang) {
  const v = p[bidang];
  if (bidang === 'pim' || bidang === 'pelatihan') return (Array.isArray(v) ? v : []).filter((x) => !KOSONG_ISI(rapat(x)));
  return KOSONG_ISI(rapat(v)) ? '' : rapat(v);
}

function angka(v) {
  const n = Number(rapat(v).replace(',', '.'));
  return Number.isFinite(n) && rapat(v) !== '' ? n : null;
}

/** true bila satu pegawai memenuhi satu syarat. */
export function cocokSyarat(p, s) {
  const v = nilaiBidang(p, s.bidang);
  const daftar = Array.isArray(v);
  const ada = daftar ? v.length > 0 : v !== '';
  const cari = kecil(s.nilai);
  const isi = (x) => (s.bidang === 'pim' ? tingkatPim(x).toLowerCase() : kecil(x));
  switch (s.operator) {
    case 'kosong': return !ada;
    case 'terisi': return ada;
    case 'mengandung': return daftar ? v.some((x) => (s.bidang === 'pim' ? isi(x) === tingkatPim(cari).toLowerCase() : isi(x).includes(cari))) : isi(v).includes(cari);
    case 'tidak_mengandung': return !cocokSyarat(p, { ...s, operator: 'mengandung' });
    case 'sama': return daftar ? v.some((x) => isi(x) === (s.bidang === 'pim' ? tingkatPim(cari).toLowerCase() : cari)) : isi(v) === cari;
    case 'lebih_dari': { const a = angka(v), b = angka(s.nilai); return a !== null && b !== null && a > b; }
    case 'kurang_dari': { const a = angka(v), b = angka(s.nilai); return a !== null && b !== null && a < b; }
    default: return false;
  }
}

/**
 * Saring & hitung.
 * @param {Array} pegawai  baris asn_pegawai + `opd` (dari berkas aktif)
 * @param {object} rencana  hasil normalkanRencana
 */
export function saringPegawai(pegawai, rencana) {
  const cocok = pegawai.filter((p) =>
    (!rencana.opd.length || rencana.opd.includes(p.opd))
    && (!rencana.kelompok.length || rencana.kelompok.includes(p.kelompok))
    && rencana.syarat.every((s) => cocokSyarat(p, s)));
  const urut = [...cocok].sort((a, b) => (a.opd || '').localeCompare(b.opd || '') || (a.sheet || '').localeCompare(b.sheet || '') || Math.abs(a.baris_asal) - Math.abs(b.baris_asal));
  let rincian = null;
  if (rencana.kelompokkan) {
    rincian = {};
    for (const p of urut) {
      let kunci;
      if (rencana.kelompokkan === 'pim') kunci = (p.pim || []).length ? (p.pim || []).map(tingkatPim).join('+') : 'belum PIM';
      else kunci = rapat(p[rencana.kelompokkan]) || '(kosong)';
      rincian[kunci] = (rincian[kunci] || 0) + 1;
    }
  }
  return { jumlah: urut.length, dari: pegawai.length, daftar: urut, rincian };
}

// Label tampilan — TANPA kata "daftar". Uji live 2026-09-21: "pelatihan teknis/fungsional — daftar kosong" dibaca model
// sebagai "daftar hasilnya kosong" dan jawabannya membalik 155 menjadi "tidak ada satu pun".
const LABEL_TAMPIL = {
  nama: 'nama', nip: 'NIP', jenis_kelamin: 'jenis kelamin', status: 'status', pendidikan_cpns: 'pendidikan CPNS',
  pendidikan_akhir: 'pendidikan terakhir', tahun_lulus: 'tahun lulus', jabatan: 'jabatan', pangkat: 'pangkat',
  pim: 'PIM', pelatihan: 'pelatihan teknis/fungsional', nilai_ipa: 'nilai IP ASN',
};
const KELOMPOK_TAMPIL = { struktural: 'struktural', jft: 'JFT', pelaksana: 'pelaksana', pppk: 'PPPK', paruh_waktu: 'PPPK paruh waktu', tidak_dikenal: 'kelompok tak dikenal' };

function uraiSyarat(s) {
  const l = LABEL_TAMPIL[s.bidang] || s.bidang;
  switch (s.operator) {
    case 'kosong': return `${l}: BELUM ADA`;
    case 'terisi': return `${l}: SUDAH ADA`;
    case 'mengandung': return `${l} memuat "${s.nilai}"`;
    case 'tidak_mengandung': return `${l} tidak memuat "${s.nilai}"`;
    case 'sama': return `${l} = "${s.nilai}"`;
    case 'lebih_dari': return `${l} > ${s.nilai}`;
    case 'kurang_dari': return `${l} < ${s.nilai}`;
    default: return `${l} ${s.operator}`;
  }
}

/** Uraian saringan dalam bahasa manusia — tampil di jawaban supaya Owner bisa memeriksa apa yang dihitung. */
export function uraiRencana(rencana) {
  const bagian = [];
  bagian.push(rencana.opd.length ? `OPD: ${rencana.opd.join(', ')}` : 'semua OPD tersimpan (berkas aktif)');
  if (rencana.kelompok.length) bagian.push(`kelompok: ${rencana.kelompok.map((k) => KELOMPOK_TAMPIL[k] || k).join(', ')}`);
  for (const s of rencana.syarat) bagian.push(uraiSyarat(s));
  return bagian.join(' · ');
}

/** Kalimat hasil dari KODE — ditaruh di baris paling atas jawaban, sebelum teks model. */
export function susunJudulHasil(hasil, rencana) {
  const rincian = hasil.rincian ? ` · per ${rencana.kelompokkan}: ${Object.entries(hasil.rincian).map(([k, n]) => `${k} ${n}`).join(', ')}` : '';
  return `**📊 Hasil hitung sistem: ${hasil.jumlah} orang** — ${uraiRencana(rencana)}${rincian}`;
}

// Tabel data dimulai dengan garis + judul tebal ini (susunLampiran). Model yang meniru formatnya juga menulis judul ini.
const POLA_LAMPIRAN = /\n*-{3,}\s*\n+\*\*(?:📊\s*)?Data Tabel\s+—[\s\S]*$/;
const POLA_NIP = /\b\d{18}\b|\b\d{8}[ .]\d{6}[ .]\d[ .]\d{3}\b/g;

/**
 * Bersihkan pesan asisten di RIWAYAT sebelum dikirim ke model: tabel data (berisi NIP asli) dibuang dan angka NIP
 * disamarkan. Uji live 2026-09-21: tabel ber-NIP dari jawaban sebelumnya ikut riwayat → NIP sampai ke model, dan model
 * meniru tabel itu lengkap dengan 30 NIP KARANGAN (0 dari 30 ada di database).
 */
export function bersihkanRiwayatDataTabel(teks) {
  return String(teks ?? '').replace(POLA_LAMPIRAN, '\n[tabel data dari sistem — tidak disertakan]').replace(POLA_NIP, '[NIP]');
}

/** Angka berbentuk NIP di teks MODEL = karangan (model tidak pernah menerima NIP) → disamarkan. */
export function samarkanNipKarangan(teks) {
  let n = 0;
  const hasil = String(teks ?? '').replace(POLA_NIP, () => { n++; return '[NIP — lihat tabel sistem]'; });
  return { teks: hasil, jumlah: n };
}

/** Teks untuk model penjawab — jumlah, rincian, ≤30 nama. TANPA NIP. */
export function susunTeksUntukModel(hasil, rencana) {
  const baris = [
    `HASIL DATA TABEL REKONSILIASI ASN — dihitung oleh KODE dari data yang tersimpan (berkas aktif), bukan perkiraan.`,
    `Saringan: ${uraiRencana(rencana)}`,
    `JUMLAH: ${hasil.jumlah} orang (dari ${hasil.dari} orang di data aktif).`,
    `ARTINYA: ada ${hasil.jumlah} orang yang MEMENUHI SEMUA saringan di atas. Setiap nama di bawah memenuhi saringan itu. JANGAN membalik arti angka ini.`,
  ];
  if (rencana.diabaikan.length) baris.push(`Bagian pertanyaan yang TIDAK bisa diterapkan: ${rencana.diabaikan.join('; ')}.`);
  if (hasil.rincian) baris.push(`Rincian per ${rencana.kelompokkan}: ${Object.entries(hasil.rincian).map(([k, n]) => `${k} ${n}`).join(', ')}.`);
  const tampil = hasil.daftar.slice(0, MAKS_NAMA_UNTUK_MODEL);
  if (tampil.length) {
    baris.push(`Nama (${tampil.length}${hasil.jumlah > tampil.length ? ` dari ${hasil.jumlah}` : ''}), jabatan, OPD, sumber:`);
    tampil.forEach((p, i) => baris.push(`${i + 1}. ${p.nama} — ${p.jabatan || '(jabatan kosong)'} — ${p.opd} (sheet ${p.sheet}, ${teksBaris(p.baris_asal)})`));
  }
  baris.push(`Kalimat hasil & tabel lengkap (dengan NIP) DITEMPEL OTOMATIS oleh sistem di atas & di bawah jawaban Anda — JANGAN membuat tabel sendiri, JANGAN menulis ulang daftar nama panjang, JANGAN menulis NIP.`);
  return baris.join('\n');
}

const sel = (s) => rapat(s).replace(/\|/g, '/');

/** Lampiran markdown DENGAN NIP — ditempel kode di bawah jawaban, tidak lewat model. */
export function susunLampiran(hasil, rencana) {
  if (!hasil.jumlah) return '';
  const tampil = hasil.daftar.slice(0, MAKS_BARIS_LAMPIRAN);
  const kepala = [
    '', '---', `**Data Tabel — ${hasil.jumlah} orang** · ${uraiRencana(rencana)}`,
    '_Disusun langsung dari data tersimpan (bukan ditulis AI). Sumber = berkas, sheet, dan baris Excel._', '',
    '| No | Nama | NIP | Jabatan | OPD | Sheet | Baris |', '|---|---|---|---|---|---|---|',
  ];
  const isi = tampil.map((p, i) => `| ${i + 1} | ${sel(p.nama)} | ${p.nip || '—'} | ${sel(p.jabatan) || '—'} | ${sel(p.opd)} | ${sel(p.sheet)} | ${teksBaris(p.baris_asal).replace(/^baris /, '')} |`);
  const ekor = hasil.jumlah > tampil.length ? ['', `_…${hasil.jumlah - tampil.length} baris berikutnya tidak ditampilkan — persempit pertanyaan (mis. per OPD atau kelompok)._`] : [];
  return [...kepala, ...isi, ...ekor].join('\n');
}
