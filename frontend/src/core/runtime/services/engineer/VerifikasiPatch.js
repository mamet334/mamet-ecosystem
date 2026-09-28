/**
 * VerifikasiPatch.js — putusan dan laporan untuk Tahap 6 (ROADMAP-ENGINEER-MANDIRI, 28 September 2026):
 * verifikasi patch yang DIJALANKAN, bukan dicocokkan.
 *
 * Tiga lapis verifikasi yang ada sebelumnya menebak dari BENTUK TEKS — `includes('eval(')` menandai berkas
 * yang sekadar menyebutnya, `formatRegex` memotong patch karena di dalamnya ada "ADR-0017". Keduanya salah
 * dengan cara yang sama pada 24 September, dan keduanya memblokir patch yang benar. Lapis ini bertanya hal
 * lain: *apakah sistem ini masih benar SESUDAH patch* — dijawab dengan menjalankan 50 berkas uji sungguhan.
 *
 * Modul ini MURNI: ia tidak menjalankan uji dan tidak menyentuh berkas. Menjalankan suite dan memulihkan
 * berkas dilakukan proses utama (IPC `eng:verifikasi-patch`), karena di mode pengembangan menulis berkas
 * aplikasi memicu Vite memuat ulang halaman — layar yang menunggu hasil mati di tengah jalan, sedangkan
 * pemulihannya tidak boleh ikut mati.
 *
 * YANG DIJANJIKAN LAPIS INI, dan tidak lebih: **patch tidak merusak yang sudah terbukti.**
 * BUKAN: patch ini benar.
 */

/** Nama berkas uji yang gagal pada satu hasil penjalan. */
export function namaGagal(hasil) {
  return ((hasil && hasil.gagal) || []).map((g) => g.nama);
}

/**
 * Putusan sesudah patch ditulis: perlukah berkas dipulihkan dari checkpoint?
 *
 * Penjalan yang tidak bisa dijalankan sama sekali (node hilang, akar repo belum dipilih, habis waktu)
 * BUKAN alasan memulihkan. Ia berarti verifikasi tidak terjadi — dan itu harus dikatakan apa adanya,
 * bukan disamarkan jadi "aman" maupun jadi "patch merusak".
 */
export function putusanVerifikasi(hasil) {
  if (!hasil || hasil.galat) {
    return { status: 'TAK_TERVERIFIKASI', pulihkan: false, alasan: (hasil && hasil.galat) || 'hasil uji tidak ada' };
  }
  const gagal = namaGagal(hasil);
  if (!gagal.length) return { status: 'AMAN', pulihkan: false, gagal: [] };
  return { status: 'GAGAL', pulihkan: true, gagal };
}

/**
 * Sesudah pemulihan, berkas uji yang tadi gagal DIJALANKAN ULANG terhadap kode yang sudah kembali.
 *
 * Tanpa langkah ini, satu uji yang sudah merah sebelum patch akan memulihkan SETIAP patch yang benar,
 * selamanya, dengan alasan yang terdengar meyakinkan. Itu bukan kemungkinan teoretis: `uji-folder-label`
 * merah diam-diam selama empat hari (24–28 September) karena folder di luar repo berganti nama.
 *
 * Ongkosnya satu-dua berkas uji (sekitar 1 detik), bukan menjalankan seluruh suite dua kali (33 detik).
 *
 * @returns {{ karenaPatch: string[], sudahRusak: string[] }}
 */
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

/** Blok keluaran satu berkas uji yang gagal — APA ADANYA, bukan diringkas jadi "2 masalah kritis". */
function blokKeluaran(hasil, nama) {
  const g = ((hasil && hasil.gagal) || []).find((x) => x.nama === nama);
  if (!g) return `\n**${nama}** — keluarannya tidak tersimpan.`;
  return `\n**${nama}** — ${g.barisTerakhir}\n\n\`\`\`\n${potong(g.keluaran, 1200)}\n\`\`\``;
}

/** Satu baris tentang berkas uji yang dilewati & yang hanya menguji cermin. Selalu ikut, juga saat hijau. */
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

/**
 * Laporan yang ditempel di bawah hasil patch.
 * @param {object} p
 * @param {object} p.sesudahPatch   hasil penjalan penuh sesudah patch ditulis
 * @param {object} [p.sesudahPulih] hasil penjalan ULANG berkas yang gagal, sesudah pemulihan
 * @param {boolean} [p.dipulihkan]  apakah berkas benar-benar dikembalikan
 * @param {string} [p.galatPulih]   bila pemulihan sendiri gagal
 */
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
    bagian.push(`### Rusak oleh patch ini — ${karenaPatch.length} berkas uji\n\nKetiganya lulus lagi sesudah berkas dikembalikan, jadi sebabnya memang patch tadi.${karenaPatch.map((n) => blokKeluaran(sesudahPatch, n)).join('\n')}`);
  }

  if (sudahRusak.length) {
    bagian.push(`### BUKAN karena patch ini — ${sudahRusak.length} berkas uji\n\nMasih gagal juga sesudah berkas dikembalikan, jadi ia sudah merah SEBELUM patch. Patch tetap dipulihkan (tidak ada cara aman memisahkannya), dan isinya masih ada di jawaban di atas bila Anda ingin menerapkannya lagi.${sudahRusak.map((n) => blokKeluaran(sesudahPatch, n)).join('\n')}`);
  }

  if (!sesudahPulih && !galatPulih) {
    bagian.push(`_Berkas yang gagal tidak dijalankan ulang sesudah pemulihan, jadi belum diketahui apakah patch ini penyebabnya._`);
  }

  return bagian.join('\n\n') + batasYangJujur(sesudahPatch);
}
