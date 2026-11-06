
export function namaGagal(hasil) {
  return ((hasil && hasil.gagal) || []).map((g) => g.nama);
}

export function putusanVerifikasi(hasil) {
  if (!hasil || hasil.galat) {
    return { status: 'TAK_TERVERIFIKASI', pulihkan: false, alasan: (hasil && hasil.galat) || 'hasil uji tidak ada' };
  }
  const gagal = namaGagal(hasil);
  if (!gagal.length) return { status: 'AMAN', pulihkan: false, gagal: [] };
  return { status: 'GAGAL', pulihkan: true, gagal };
}

export function pilahSebab(gagalSesudahPatch, hasilSesudahPulih) {
  const masihGagal = new Set(namaGagal(hasilSesudahPulih));
  const karenaPatch = [];
  const sudahRusak = [];
  for (const nama of gagalSesudahPatch || []) {
    (masihGagal.has(nama) ? sudahRusak : karenaPatch).push(nama);
  }
  return { karenaPatch, sudahRusak };
}

const potong = (s, n) => {
  const t = String(s || '').trim();
  return t.length > n ? `${t.slice(0, n)}\n… (dipotong)` : t;
};

function blokKeluaran(hasil, nama) {
  const g = ((hasil && hasil.gagal) || []).find((x) => x.nama === nama);
  if (!g) return `\n**${nama}** — keluarannya tidak tersimpan.`;
  return `\n**${nama}** — ${g.barisTerakhir}\n\n\`\`\`\n${potong(g.keluaran, 1200)}\n\`\`\``;
}

function batasYangJujur(hasil) {
  const baris = [];
  const dilewati = (hasil && hasil.dilewati) || [];
  const cermin = (hasil && hasil.cermin) || [];
  const takDijalankan = (hasil && hasil.takDijalankan) || [];
  if (dilewati.length) baris.push(`${dilewati.length} dilewati (${dilewati.map((d) => d.nama).join(', ')})`);
  if (cermin.length) baris.push(`${cermin.length} hanya menguji **cermin** — salinan logika, bukan kode aslinya, jadi tidak dihitung sebagai bukti keselamatan`);
  if (takDijalankan.length) baris.push(`${takDijalankan.length} berkas \`uji-*.js\` tidak dijalankan (modul konsol DevTools)`);
  baris.push('berkas tanpa berkas uji tetap tak terjaga — yang dijanjikan hanya *patch tidak merusak yang sudah terbukti*, bukan *patch ini benar*');
  return `\n\n_Batasnya: ${baris.join('; ')}._`;
}

export function laporanVerifikasi({ sesudahPatch, sesudahPulih, dipulihkan, galatPulih } = {}) {
  const putusan = putusanVerifikasi(sesudahPatch);

  if (putusan.status === 'TAK_TERVERIFIKASI') {
    return `⚠️ **Patch TIDAK diverifikasi** — ${putusan.alasan}.\n\nBerkas tetap seperti sesudah patch dan TIDAK dipulihkan: tidak ada bukti ia merusak apa pun. Jalankan \`node uji/jalankan-semua.mjs\` sendiri sebelum mempercayainya.`;
  }

  if (putusan.status === 'AMAN') {
    return `✅ **Uji dijalankan: ${sesudahPatch.lulus}/${sesudahPatch.total} lulus** _(${sesudahPatch.detik} detik, sesudah patch ditulis)_\n\nTidak ada yang rusak oleh patch ini. Tombol Undo tetap tersedia.${batasYangJujur(sesudahPatch)}`;
  }

  const { karenaPatch, sudahRusak } = pilahSebab(putusan.gagal, sesudahPulih);
  const bagian = [];

  if (galatPulih) {
    bagian.push(`🚨 **Uji gagal DAN pemulihan gagal** — ${galatPulih}\n\nBerkas mungkin masih dalam keadaan sesudah patch. Periksa dengan \`git diff\` sebelum melanjutkan.`);
  } else if (dipulihkan) {
    bagian.push(`↩️ **Uji gagal — berkas sudah DIKEMBALIKAN sendiri ke isi sebelum patch.** _(${sesudahPatch.detik} detik)_`);
  } else {
    bagian.push(`❌ **Uji gagal.** _(${sesudahPatch.detik} detik)_ Berkas belum dipulihkan.`);
  }

  if (karenaPatch.length) {
    const sebut = karenaPatch.length === 1 ? 'Ia lulus lagi' : `Ke-${karenaPatch.length}-nya lulus lagi`;
    bagian.push(`### Rusak oleh patch ini — ${karenaPatch.length} berkas uji\n\n${sebut} sesudah berkas dikembalikan, jadi sebabnya memang patch tadi.${karenaPatch.map((n) => blokKeluaran(sesudahPatch, n)).join('\n')}`);
  }

  if (sudahRusak.length) {
    bagian.push(`### BUKAN karena patch ini — ${sudahRusak.length} berkas uji\n\nMasih gagal juga sesudah berkas dikembalikan, jadi ia sudah merah SEBELUM patch. Patch tetap dipulihkan (tidak ada cara aman memisahkannya), dan isinya masih ada di jawaban di atas bila Anda ingin menerapkannya lagi.${sudahRusak.map((n) => blokKeluaran(sesudahPatch, n)).join('\n')}`);
  }

  if (!sesudahPulih && !galatPulih) {
    bagian.push(`_Berkas yang gagal tidak dijalankan ulang sesudah pemulihan, jadi belum diketahui apakah patch ini penyebabnya._`);
  }

  return bagian.join('\n\n') + batasYangJujur(sesudahPatch);
}
