export const VERSI_GERBANG = 'gerbang-jejak v1';

export const LAPIS_DIIZINKAN = {
  buang_think: 'nalar model lama tidak dikirim ulang (praktik penyedia model reasoning)',
  buang_tag_call: 'tag <call:…> dibuang dari jawaban lama (penanda format, bukan isi)',
  bersihkan_data_tabel: 'tabel ber-NIP dibuang dari riwayat (melindungi data pribadi, K3)',
};

const MERAH = 'MERAH';
const KUNING = 'KUNING';
const INFO = 'INFO';

function periksaPasangan(p, tambah) {
  const { klien, server } = p;
  if (!server) {
    tambah(MERAH, 'tanpa_jejak_server', 'jawaban server tidak membawa jejakPrompt — apa yang sampai ke model tak terukur');
    return;
  }
  if (klien) {
    const k = klien.dikirim, s = server.riwayatDiterima;
    if (k && s && (k.pesan !== s.pesan || k.huruf !== s.huruf)) {
      tambah(MERAH, 'riwayat_hilang_di_jalan', `klien mengirim ${k.pesan} pesan/${k.huruf} huruf, server menerima ${s.pesan}/${s.huruf}`);
    }
    if (klien.konteksRag && klien.konteksRag.sesudah < klien.konteksRag.sebelum) {
      tambah(MERAH, 'konteks_dipotong_klien', `konteks memori+dokumen+web ${klien.konteksRag.sebelum} → ${klien.konteksRag.sesudah} huruf di klien`);
    }
    if (klien.semantik && klien.semantik.sesudah < klien.semantik.sebelum) {
      tambah(MERAH, 'semantik_dipotong_klien', `konteks semantik ${klien.semantik.sebelum} → ${klien.semantik.sesudah} huruf di klien`);
    }
    if (klien.cmg === 'REJECT') tambah(MERAH, 'cmg_menolak', 'penjaga memori lama membuang seluruh konteks memori & dokumen klien');
    if ((klien.jalur === 'LOOKUP' || klien.jalur === 'SKILL') && klien.dikirim.pesan < klien.riwayatTersedia.pesan) {
      tambah(MERAH, 'jalur_memotong_riwayat', `jalur ${klien.jalur} mengirim ${klien.dikirim.pesan} dari ${klien.riwayatTersedia.pesan} pesan, di luar anggaran`);
    }
    if (klien.anggaran && klien.anggaran.dilewati > 0) {
      tambah(INFO, 'anggaran_klien', `${klien.anggaran.dilewati} pesan lama dilewati anggaran Settings (${klien.anggaran.terpakai}/${klien.anggaran.token} token)`);
    }
  }

  for (const l of server.lapisRiwayat || []) {
    const sah = Object.prototype.hasOwnProperty.call(LAPIS_DIIZINKAN, l.nama);
    if (l.pesanDisisipkan > 0) tambah(MERAH, 'catatan_palsu', `lapis ${l.nama} menyisipkan ${l.pesanDisisipkan} pesan yang tidak ditulis pengguna maupun model`);
    if (sah) continue;
    const bolehHilang = l.duplikatPesanSaatIni ? 1 : 0;
    const hilang = l.sebelum.pesan + l.pesanDisisipkan - l.sesudah.pesan - bolehHilang;
    if (hilang > 0) tambah(MERAH, 'pesan_dibuang', `lapis ${l.nama} membuang ${hilang} pesan (${l.sebelum.pesan} → ${l.sesudah.pesan})`);
    if (l.pesanDipotong > 0) tambah(MERAH, 'pesan_dipotong', `lapis ${l.nama} memendekkan ${l.pesanDipotong} pesan (${l.sebelum.huruf} → ${l.sesudah.huruf} huruf)`);
    const alatHilang = l.sebelum.hasilAlatPesan - l.sesudah.hasilAlatPesan - bolehHilang;
    if (alatHilang > 0) tambah(MERAH, 'hasil_alat_dibuang', `lapis ${l.nama} membuang ${alatHilang} hasil alat`);
  }

  const kb = server.kebijakan;
  if (kb && kb.keputusan !== 'ALLOW') {
    tambah(MERAH, 'kebijakan_membatasi', `keputusan ${kb.keputusan} (skor ${kb.skorRisiko})${kb.alatDimatikan ? ', alat dimatikan' : ''}${kb.webDimatikan ? ', web dimatikan' : ''}, RAG ${kb.ragTopK} potongan`);
  }
  for (const t of server.penolakan || []) {
    tambah(t.lapis === 'kuota' ? KUNING : MERAH, `ditolak_${t.lapis}`, t.sebab);
  }

  const r = server.rag || {};
  if (r.diminta) {
    if (r.habisWaktu) tambah(MERAH, 'rag_habis_waktu', `pencarian dokumen melewati ${r.batasWaktuMs} ms dan dihentikan`);
    if (r.datangTerlambat && r.datangTerlambat.potongan > 0) {
      tambah(MERAH, 'rag_ketemu_dibuang', `${r.datangTerlambat.potongan} potongan ditemukan pada ${r.datangTerlambat.ms} ms, sesudah dibuang batas ${r.batasWaktuMs} ms`);
    }
    if (r.galat) tambah(MERAH, 'rag_galat', r.galat);
    if (r.turunKeKata) tambah(KUNING, 'rag_turun_ke_kata', 'pencarian makna tak jalan, turun ke pencocokan kata');
    if (r.ditemukan != null && r.dikirim < r.ditemukan && !r.dataTabelMenggantikan) {
      tambah(MERAH, 'rag_tak_terkirim', `${r.ditemukan} potongan ditemukan, ${r.dikirim} dikirim ke model`);
    }
  }

  const utama = (server.panggilanModel || []).filter((m) => m.utama);
  const akhir = (server.lapisRiwayat || []).at(-1)?.sesudah;
  if (utama.length && akhir) {
    const m = utama.at(-1).riwayat;
    if (m.pesan !== akhir.pesan || m.huruf !== akhir.huruf) {
      tambah(MERAH, 'riwayat_berubah_sebelum_model', `riwayat sesudah lapis terakhir ${akhir.pesan}/${akhir.huruf}, yang sampai ke model ${m.pesan}/${m.huruf} — ada pemangkas yang tak tercatat`);
    }
  } else if (!utama.length && !(server.penolakan || []).length) {
    tambah(INFO, 'tanpa_panggilan_utama', 'tak ada panggilan model utama yang tercatat (jalur stream atau jawaban tanpa model)');
  }
  if (server.panggilanTakTercatat > 0) tambah(KUNING, 'panggilan_tak_tercatat', `${server.panggilanTakTercatat} panggilan model melewati batas catatan`);
}

export function nilaiGiliran(giliran) {
  const temuan = [];
  const daftar = Array.isArray(giliran) ? giliran : [];
  daftar.forEach((g, i) => {
    for (const p of g.pasangan || []) {
      const traceId = p.server?.traceId || p.klien?.traceId || null;
      periksaPasangan(p, (tingkat, kode, rinci) => temuan.push({ giliran: g.nomor ?? i + 1, traceId, tingkat, kode, rinci }));
    }
    const sebelumnya = daftar[i - 1];
    if (!sebelumnya || g.harapan?.pakaiHasilAlatSebelumnya !== true) return;
    const alatSebelumnya = (sebelumnya.pasangan || []).some((p) => p.klien?.putaranAlat === true || (p.klien?.dikirim?.hasilAlatPesan || 0) > 0 || (p.server?.riwayatDiterima?.hasilAlatPesan || 0) > 0);
    const pertama = (g.pasangan || [])[0];
    const terbawa = pertama?.server?.panggilanModel?.filter((m) => m.utama).at(-1)?.riwayat?.hasilAlatPesan ?? pertama?.server?.riwayatDiterima?.hasilAlatPesan ?? 0;
    if (!alatSebelumnya) {
      temuan.push({ giliran: g.nomor ?? i + 1, traceId: null, tingkat: KUNING, kode: 'alat_tak_terpakai_sebelumnya', rinci: 'giliran sebelumnya tidak memakai alat — harapan hasil alat tak bisa diuji' });
    } else if (terbawa === 0) {
      temuan.push({ giliran: g.nomor ?? i + 1, traceId: pertama?.server?.traceId || null, tingkat: MERAH, kode: 'hasil_alat_hilang', rinci: 'hasil alat giliran sebelumnya tidak sampai ke model di giliran ini' });
    }
  });
  const hitung = (t) => temuan.filter((x) => x.tingkat === t).length;
  const perKode = {};
  for (const t of temuan) perKode[t.kode] = (perKode[t.kode] || 0) + 1;
  return { versi: VERSI_GERBANG, hijau: hitung(MERAH) === 0, merah: hitung(MERAH), kuning: hitung(KUNING), info: hitung(INFO), perKode, temuan };
}

export function kelompokkanGiliran(riwayatJejak) {
  const giliran = [];
  for (const p of Array.isArray(riwayatJejak) ? riwayatJejak : []) {
    const lanjutan = p?.klien?.putaranAlat === true && giliran.length > 0;
    if (lanjutan) giliran.at(-1).pasangan.push(p);
    else giliran.push({ nomor: giliran.length + 1, pasangan: [p] });
  }
  for (let i = 1; i < giliran.length; i++) {
    const pakaiAlat = giliran[i - 1].pasangan.some((p) => p?.klien?.putaranAlat === true);
    if (pakaiAlat) giliran[i].harapan = { pakaiHasilAlatSebelumnya: true };
  }
  return giliran;
}
