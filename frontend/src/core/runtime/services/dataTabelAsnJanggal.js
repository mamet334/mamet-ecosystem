
import { uraiBaris } from './dataTabelAsnOcr.js';

export const TINGKAT = {
  salah: 'Perlu dibetulkan',
  lengkapi: 'Perlu dilengkapi',
};

export const JENIS = {
  jumlah_salah: { tingkat: 'salah', label: 'Baris JUMLAH tidak sama dengan jumlah orang' },
  jumlah_lp_beda: { tingkat: 'salah', label: 'Pembagian L/P di baris JUMLAH tidak sama dengan tanda per orang' },
  jk_beda_nip: { tingkat: 'salah', label: 'L/P tidak sesuai digit jenis kelamin di NIP' },
  nip_tak_sah: { tingkat: 'salah', label: 'NIP tidak sah (susunan angka mustahil)' },
  nip_berkas_lain: { tingkat: 'salah', label: 'NIP juga tercatat di berkas aktif lain' },
  nip_ganda: { tingkat: 'salah', label: 'NIP tercatat lebih dari sekali di berkas ini' },
  nip_tak_lengkap: { tingkat: 'salah', label: 'NIP hasil OCR tidak 18 digit' },
  nomor_ganda: { tingkat: 'salah', label: 'Nomor urut dipakai lebih dari sekali di sheet yang sama' },
  lp_ganda: { tingkat: 'salah', label: 'Kolom L dan P sama-sama terisi' },
  struktur: { tingkat: 'salah', label: 'Susunan sheet tidak terbaca' },
  tanpa_nip: { tingkat: 'lengkapi', label: 'NIP belum diisi / tidak terbaca' },
  jabatan_kosong: { tingkat: 'lengkapi', label: 'Jabatan belum diisi' },
  lp_kosong: { tingkat: 'lengkapi', label: 'L/P belum diisi' },
};
const URUTAN_JENIS = Object.keys(JENIS);

const rapat = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const kecil = (v) => rapat(v).toLowerCase();

export function uraiNip(nip, tahunKini = new Date().getFullYear()) {
  const alasan = [];
  if (!/^\d{18}$/.test(nip || '')) return { sah: false, alasan: ['bukan 18 digit angka'], jk: '', pppk: false };
  const th = +nip.slice(0, 4), bl = +nip.slice(4, 6), tg = +nip.slice(6, 8);
  const tth = +nip.slice(8, 12), kode = +nip.slice(12, 14), dj = nip[14];
  const pppk = kode === 21;
  const tglOk = th >= 1940 && th <= tahunKini - 17 && bl >= 1 && bl <= 12 && tg >= 1 && tg <= new Date(th, bl, 0).getDate();
  if (!tglOk) alasan.push(`tanggal lahir ${nip.slice(0, 4)}-${nip.slice(4, 6)}-${nip.slice(6, 8)} mustahil`);
  if (pppk) {
    if (tth < 2019 || tth > tahunKini) alasan.push(`tahun pengangkatan PPPK ${tth} mustahil (PPPK mulai 2019)`);
  } else if (tth < 1960 || tth > tahunKini || kode < 1 || kode > 12) {
    alasan.push(`TMT ${nip.slice(8, 12)}-${nip.slice(12, 14)} mustahil`);
  }
  if (tglOk && tth - th < 17 && tth >= 1960) alasan.push(`diangkat pada usia ${tth - th} tahun`);
  const jk = dj === '1' ? 'L' : dj === '2' ? 'P' : '';
  if (!jk) alasan.push(`digit jenis kelamin "${dj}" (harus 1 atau 2)`);
  return { sah: alasan.length === 0, alasan, jk, pppk };
}

export function susunLaporanJanggal({ berkas = [], pegawai = [], tahunKini = new Date().getFullYear() }) {
  const perBerkas = new Map(berkas.map((b) => [b.id, []]));
  for (const p of pegawai) perBerkas.get(p.berkas_id)?.push(p);

  const nipDi = new Map();
  for (const p of pegawai) {
    if (!p.nip || !perBerkas.has(p.berkas_id)) continue;
    const s = nipDi.get(p.nip) || new Set();
    s.add(p.berkas_id); nipDi.set(p.nip, s);
  }
  const namaBerkas = new Map(berkas.map((b) => [b.id, b]));

  const perOpd = berkas.map((b) => {
    const orang = perBerkas.get(b.id) || [];
    const butir = [];
    const orangDi = (sheet, baris) => orang.find((p) => p.sheet === sheet && p.baris_asal === baris);
    const tambah = (jenis, p, keterangan, lain = {}) => butir.push({
      jenis, tingkat: JENIS[jenis].tingkat, sheet: p?.sheet ?? lain.sheet ?? '', baris: p?.baris_asal ?? lain.baris ?? null,
      nama: p?.nama ?? '', nip: p?.nip ?? '', keterangan,
    });

    const infoSheet = new Map();
    const nipTerpotong = new Set();
    for (const s of b.ringkasan_sheet || []) {
      const bidang = new Set((s.pemetaan || []).map((m) => m.bidang));
      infoSheet.set(s.sheet, {
        adaJabatan: bidang.has('jabatan'),
        adaJk: bidang.has('jk_l') || bidang.has('jk_p') || bidang.has('jk'),
      });
      for (const k of s.kejanggalan || []) {
        if (k.jenis === 'jumlah_salah' || k.jenis === 'jumlah_lp_beda' || k.jenis === 'struktur') {
          tambah(k.jenis, null, k.pesan, { sheet: s.sheet, baris: k.baris ?? null });
        } else if (k.jenis === 'nip_tak_lengkap') {
          const p = orangDi(s.sheet, k.baris);
          if (p) nipTerpotong.add(p);
          tambah('nip_tak_lengkap', p, `${(k.pesan.match(/angka NIP terbaca \d+ digit/) || ['angka NIP tidak 18 digit'])[0]} — cocokkan dengan berkas kertas`, { sheet: s.sheet, baris: k.baris ?? null });
        } else if (k.jenis === 'jenis_kelamin') {
          tambah('lp_ganda', orangDi(s.sheet, k.baris), 'isi kolom L dan P bertentangan', { sheet: s.sheet, baris: k.baris ?? null });
        }
      }
    }

    const nipDalam = new Map();
    for (const p of orang) if (p.nip) nipDalam.set(p.nip, [...(nipDalam.get(p.nip) || []), p]);
    const nomorDalam = new Map();
    for (const p of orang) {
      const no = rapat(p.no_urut);
      if (!no) continue;
      const k = `${p.sheet}|${no}`;
      nomorDalam.set(k, [...(nomorDalam.get(k) || []), p]);
    }
    for (const p of orang) {
      const info = infoSheet.get(p.sheet) || { adaJabatan: true, adaJk: true };
      if (!p.nip) {
        if (!nipTerpotong.has(p)) tambah('tanpa_nip', p, p.kelompok === 'paruh_waktu' ? 'PPPK paruh waktu — periksa apakah NIP sudah terbit' : 'NIP belum diisi atau tidak 18 digit');
      } else {
        const u = uraiNip(p.nip, tahunKini);
        if (!u.sah) tambah('nip_tak_sah', p, u.alasan.join('; '));
        if (u.jk && p.jenis_kelamin && u.jk !== p.jenis_kelamin) {
          tambah('jk_beda_nip', p, `tertulis ${p.jenis_kelamin}, digit ke-15 NIP menunjukkan ${u.jk}`);
        }
        const dobel = nipDalam.get(p.nip);
        if (dobel.length > 1) {
          const lain = dobel.filter((x) => x !== p).map((x) => `${x.sheet} ${x.baris_asal < 0 ? uraiBaris(x.baris_asal) : `baris ${x.baris_asal}`}`);
          tambah('nip_ganda', p, `juga di ${lain.join(', ')}`);
        }
        const berkasLain = [...(nipDi.get(p.nip) || [])].filter((id) => id !== b.id).map((id) => namaBerkas.get(id));
        if (berkasLain.length) {
          tambah('nip_berkas_lain', p, `juga di ${berkasLain.map((x) => `${x.opd} (${x.nama_berkas})`).join(', ')}`);
        }
      }
      const noGanda = nomorDalam.get(`${p.sheet}|${rapat(p.no_urut)}`);
      if (noGanda && noGanda.length > 1) tambah('nomor_ganda', p, `nomor ${rapat(p.no_urut)} dipakai ${noGanda.length}×`);
      if (info.adaJabatan && !rapat(p.jabatan)) tambah('jabatan_kosong', p, 'kolom jabatan kosong');
      if (info.adaJk && !p.jenis_kelamin) tambah('lp_kosong', p, 'kolom L/P kosong');
    }

    butir.sort((x, y) => (x.tingkat === y.tingkat ? 0 : x.tingkat === 'salah' ? -1 : 1)
      || URUTAN_JENIS.indexOf(x.jenis) - URUTAN_JENIS.indexOf(y.jenis)
      || String(x.sheet).localeCompare(String(y.sheet)) || (x.baris ?? 0) - (y.baris ?? 0));
    const hitung = {};
    for (const x of butir) hitung[x.jenis] = (hitung[x.jenis] || 0) + 1;
    return {
      berkas_id: b.id, opd: b.opd, nama_berkas: b.nama_berkas, jumlah_orang: orang.length, butir, hitung,
      salah: butir.filter((x) => x.tingkat === 'salah').length,
      lengkapi: butir.filter((x) => x.tingkat === 'lengkapi').length,
    };
  });
  perOpd.sort((a, b) => b.salah - a.salah || b.lengkapi - a.lengkapi || kecil(a.opd).localeCompare(kecil(b.opd)));
  return {
    perOpd,
    total: { salah: perOpd.reduce((a, x) => a + x.salah, 0), lengkapi: perOpd.reduce((a, x) => a + x.lengkapi, 0) },
  };
}

export function lembarExcelOpd(lap, tanggal = new Date()) {
  const tgl = tanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const aoa = [
    [`Daftar kejanggalan data rekonsiliasi ASN — ${lap.opd}`],
    [`Berkas: ${lap.nama_berkas} · ${lap.jumlah_orang} orang terbaca · disusun ${tgl}`],
    [`${lap.salah} perlu dibetulkan · ${lap.lengkapi} perlu dilengkapi. Baris = nomor baris di berkas Excel yang dikirim OPD; PDF pindaian: halaman dan urutan baris tabel.`],
    [],
    ['No', 'Tingkat', 'Masalah', 'Sheet', 'Baris', 'Nama', 'NIP', 'Keterangan'],
  ];
  lap.butir.forEach((x, i) => aoa.push([
    i + 1, TINGKAT[x.tingkat], JENIS[x.jenis].label, x.sheet, x.baris == null ? '' : x.baris < 0 ? uraiBaris(x.baris) : x.baris, x.nama, x.nip ? String(x.nip) : '', x.keterangan,
  ]));
  if (!lap.butir.length) aoa.push(['', '', 'Tidak ada kejanggalan yang ditemukan pemeriksaan otomatis.']);
  return aoa;
}

export function namaLembar(opd, dipakai = new Set()) {
  const dasar = rapat(String(opd).replace(/[[\]:*?\/\\]/g, ' ')).slice(0, 28) || 'OPD';
  let nama = dasar;
  for (let n = 2; dipakai.has(nama.toLowerCase()); n++) nama = `${dasar.slice(0, 27 - String(n).length)} (${n})`;
  dipakai.add(nama.toLowerCase());
  return nama;
}

export function lembarRingkasan(laporan, tanggal = new Date()) {
  const tgl = tanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const jenis = URUTAN_JENIS.filter((j) => laporan.perOpd.some((x) => x.hitung[j]));
  const aoa = [
    [`Ringkasan kejanggalan data rekonsiliasi ASN — ${laporan.perOpd.length} berkas aktif · disusun ${tgl}`],
    [],
    ['OPD', 'Berkas', 'Orang', TINGKAT.salah, TINGKAT.lengkapi, ...jenis.map((j) => JENIS[j].label)],
  ];
  for (const x of laporan.perOpd) aoa.push([x.opd, x.nama_berkas, x.jumlah_orang, x.salah, x.lengkapi, ...jenis.map((j) => x.hitung[j] || 0)]);
  return aoa;
}
