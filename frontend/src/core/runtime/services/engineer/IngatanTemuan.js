/**
 * IngatanTemuan.js — ingatan temuan Engineer (ROADMAP-ENGINEER-MANDIRI Tahap 3b, 2026-09-24).
 *
 * MASALAH: setiap chat Engineer mulai dari nol. Memori percakapan sengaja dimatikan di Engineer dan itu
 * benar — tapi akibatnya Engineer tidak punya catatan TEMUAN. Tanpa itu, Engineer yang berjalan otonom
 * (Tahap 1) akan melaporkan temuan yang sama setiap hari sampai Owner berhenti membacanya.
 *
 * PILIHAN PENYIMPANAN: berkas markdown DI DALAM REPO, bukan tabel database.
 * Alasannya: Owner bisa membaca dan MENGOREKSI isinya, ia ikut ter-commit bersama kode yang dibicarakan,
 * dan ia tidak hilang kalau database dibersihkan. Ongkosnya: menulis butuh tindakan Owner. Itu diterima —
 * batas "menulis berkas selalu lewat persetujuan Owner" (constitution 04) tidak digeser untuk kenyamanan.
 *
 * BENTUK EKSPLISIT, BUKAN TEBAKAN DARI PROSA. Sama seperti <uji_klaim> (Tahap 2) dan penanda patch:
 * tiga kali sistem ini tertipu karena menebak maksud dari teks bebas, jadi temuan HARUS ditulis dalam blok
 * <temuan>. Prosa yang terdengar seperti temuan sengaja TIDAK ditangkap — lebih baik terlewat dan terlihat
 * terlewat, daripada tertangkap salah dan tercatat sebagai fakta.
 *
 * ID DIBERI MESIN, BUKAN MODEL. Model tidak bisa dipercaya memberi nomor unik: ia tidak melihat berkasnya
 * dan akan mengulang "TMN-0001". Nomor diberi di sini, berurutan dari isi berkas yang ada.
 */

/** Tingkat risiko yang diakui. Nilai lain dinormalkan ke 'sedang' — bukan ditolak, supaya temuannya tak hilang. */
export const TINGKAT = ['rendah', 'sedang', 'tinggi'];

const POLA_BLOK = /<temuan\b([^>]*)>([\s\S]*?)<\/temuan>/g;
const POLA_ATRIBUT = /([a-z]+)\s*=\s*"([^"]*)"/g;

/** Baris berlabel di dalam blok: `BUKTI: …` sampai label berikutnya atau akhir blok. */
function ambilBagian(teks, label) {
  const pola = new RegExp('^[ \\t]*' + label + '[ \\t]*:[ \\t]*([\\s\\S]*?)(?=^[ \\t]*[A-Z]{4,}[ \\t]*:|$)', 'm');
  const cocok = teks.match(pola);
  return cocok ? cocok[1].trim() : '';
}

/**
 * Kunci pembanding untuk menolak temuan kembar. Sengaja SEDERHANA dan bisa dijelaskan:
 * alamat berkas + ringkasan yang dinormalkan (huruf kecil, tanda baca & spasi ganda dibuang).
 *
 * BATASNYA DISADARI: temuan sama yang ditulis ulang dengan kalimat berbeda TIDAK akan tertangkap.
 * Pencocokan makna (embedding/model) akan menangkap lebih banyak, tapi juga akan diam-diam membuang
 * temuan yang sebenarnya berbeda — dan pembuangan senyap lebih buruk daripada satu baris kembar yang
 * kelihatan. Owner bisa menggabungkan yang kembar; Owner tidak bisa memulihkan yang hilang tanpa jejak.
 */
export function kunciTemuan({ berkas, ringkasan }) {
  const t = String(ringkasan || '')
    .toLowerCase()
    .replace(/[`*_~"'.,;:!?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${String(berkas || '').trim().toLowerCase()}::${t}`;
}

/**
 * Ambil blok <temuan> dari jawaban model.
 * @returns {{temuan: Array, galat: string[]}}
 */
export function ambilBlokTemuan(teks) {
  const temuan = [];
  const galat = [];
  const isi = String(teks || '');
  POLA_BLOK.lastIndex = 0;
  let m;
  while ((m = POLA_BLOK.exec(isi)) !== null) {
    const atribut = {};
    POLA_ATRIBUT.lastIndex = 0;
    let a;
    while ((a = POLA_ATRIBUT.exec(m[1])) !== null) atribut[a[1]] = a[2];

    const badan = m[2];
    // Tanpa label RINGKASAN:, baris pertama yang berisi dipakai — TAPI baris berlabel lain dilewati.
    // Kalau tidak, `<temuan berkas="…">BUKTI: y</temuan>` akan lolos dengan ringkasan "BUKTI: y",
    // yaitu temuan tanpa ringkasan yang menyamar jadi lengkap.
    const ringkasan = ambilBagian(badan, 'RINGKASAN')
      || badan.split('\n').map((s) => s.trim()).filter((s) => s && !/^[A-Z]{4,}[ \t]*:/.test(s))[0]
      || '';
    const bukti = ambilBagian(badan, 'BUKTI');
    const berkas = (atribut.berkas || '').trim();

    if (!ringkasan) { galat.push('Satu blok <temuan> tidak punya ringkasan — dilewati.'); continue; }
    if (!berkas) { galat.push(`Temuan "${ringkasan.slice(0, 60)}" tanpa atribut berkas="…" — dilewati.`); continue; }
    if (!bukti) { galat.push(`Temuan "${ringkasan.slice(0, 60)}" tanpa baris BUKTI: — dilewati (temuan tanpa bukti bukan temuan).`); continue; }

    temuan.push({
      berkas,
      tingkat: TINGKAT.includes((atribut.tingkat || '').toLowerCase()) ? atribut.tingkat.toLowerCase() : 'sedang',
      ringkasan: ringkasan.replace(/\s+/g, ' ').trim(),
      bukti: bukti.trim(),
    });
  }
  return { temuan, galat };
}

// =============================================
// BERKAS CATATAN — tulis & baca ulang
// =============================================

export const ALAMAT_BERKAS = 'docs/project-memory/temuan-engineer/TEMUAN-ENGINEER.md';

const KEPALA = `# Temuan Engineer

<!-- Berkas ini ditulis mesin dari blok <temuan> dalam jawaban Engineer, lalu disimpan atas perintah Owner.
     Owner boleh menyunting, menggabungkan, atau menutup temuan dengan tangan — bentuk di bawah yang dibaca
     kembali oleh IngatanTemuan.js. Temuan berstatus DITUTUP tidak akan diangkat lagi oleh Engineer. -->
`;

const tanggalHariIni = (sekarang = new Date()) => sekarang.toISOString().slice(0, 10);

const nomorTemuan = (n) => `TMN-${String(n).padStart(4, '0')}`;

/** Satu temuan → potongan markdown. */
function tulisSatu(t) {
  const baris = [
    `## ${t.id} — ${t.status}`,
    `- **Berkas:** \`${t.berkas}\``,
    `- **Tingkat:** ${t.tingkat}`,
    `- **Ditemukan:** ${t.ditemukan}`,
    `- **Ringkasan:** ${t.ringkasan}`,
    `- **Bukti:** ${t.bukti.replace(/\n/g, ' ')}`,
  ];
  if (t.status === 'DITUTUP') baris.push(`- **Ditutup:** ${t.ditutup || ''} — ${t.alasanTutup || 'tanpa keterangan'}`);
  return baris.join('\n');
}

/** Seluruh daftar → isi berkas markdown. */
export function susunBerkasTemuan(daftar) {
  const terbuka = daftar.filter((t) => t.status !== 'DITUTUP');
  const tertutup = daftar.filter((t) => t.status === 'DITUTUP');
  const bagian = [KEPALA.trim(), '', `**${terbuka.length} terbuka · ${tertutup.length} ditutup**`, ''];
  for (const t of [...terbuka, ...tertutup]) bagian.push(tulisSatu(t), '');
  return bagian.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** Isi berkas markdown → daftar temuan. Berkas kosong/tak ada → daftar kosong, bukan galat. */
export function bacaBerkasTemuan(isi) {
  const teks = String(isi || '');
  const daftar = [];
  const pola = /^## (TMN-\d{4}) — (TERBUKA|DITUTUP)[ \t]*$/gm;
  const kepala = [];
  let m;
  while ((m = pola.exec(teks)) !== null) kepala.push({ id: m[1], status: m[2], mulai: m.index, akhirKepala: pola.lastIndex });

  for (let i = 0; i < kepala.length; i++) {
    const badan = teks.slice(kepala[i].akhirKepala, i + 1 < kepala.length ? kepala[i + 1].mulai : teks.length);
    const ambil = (label) => {
      const c = badan.match(new RegExp('^- \\*\\*' + label + ':\\*\\*[ \\t]*(.*)$', 'm'));
      return c ? c[1].trim() : '';
    };
    const tutup = ambil('Ditutup');
    daftar.push({
      id: kepala[i].id,
      status: kepala[i].status,
      berkas: ambil('Berkas').replace(/^`|`$/g, ''),
      tingkat: ambil('Tingkat') || 'sedang',
      ditemukan: ambil('Ditemukan'),
      ringkasan: ambil('Ringkasan'),
      bukti: ambil('Bukti'),
      ditutup: tutup ? tutup.split(' — ')[0] : '',
      alasanTutup: tutup ? tutup.split(' — ').slice(1).join(' — ') : '',
    });
  }
  return daftar;
}

// =============================================
// PENGGABUNGAN
// =============================================

/**
 * Gabungkan temuan baru ke daftar yang ada.
 *
 * Temuan yang kuncinya sudah ada TIDAK ditambahkan lagi — termasuk bila status lamanya DITUTUP. Itu inti
 * Tahap 3b: sesudah Owner menutup satu temuan, Engineer tidak boleh mengangkatnya lagi tanpa bukti baru.
 *
 * @returns {{daftar: Array, baru: Array, kembar: Array, pernahDitutup: Array}}
 */
export function gabungTemuan(daftarLama, temuanBaru, sekarang = new Date()) {
  const daftar = [...(daftarLama || [])];
  const indeks = new Map(daftar.map((t) => [kunciTemuan(t), t]));
  const baru = [];
  const kembar = [];
  const pernahDitutup = [];

  let nomor = daftar.reduce((maks, t) => Math.max(maks, parseInt(String(t.id).replace('TMN-', ''), 10) || 0), 0);

  for (const t of temuanBaru || []) {
    const kunci = kunciTemuan(t);
    const ada = indeks.get(kunci);
    if (ada) {
      (ada.status === 'DITUTUP' ? pernahDitutup : kembar).push(ada);
      continue;
    }
    const lengkap = { ...t, id: nomorTemuan(++nomor), status: 'TERBUKA', ditemukan: tanggalHariIni(sekarang) };
    daftar.push(lengkap);
    indeks.set(kunci, lengkap);
    baru.push(lengkap);
  }
  return { daftar, baru, kembar, pernahDitutup };
}

/** Tutup satu temuan (dipakai Owner lewat perintah, bukan oleh model). */
export function tutupTemuan(daftar, id, alasan, sekarang = new Date()) {
  return (daftar || []).map((t) => (t.id === id
    ? { ...t, status: 'DITUTUP', ditutup: tanggalHariIni(sekarang), alasanTutup: String(alasan || 'ditutup Owner') }
    : t));
}

// =============================================
// TAMPILAN
// =============================================

/** Pesan yang ditempel di chat sesudah blok <temuan> diproses. Null bila tak ada apa-apa untuk dilaporkan. */
export function laporanTemuan({ baru, kembar, pernahDitutup, galat = [] }) {
  if (!baru.length && !kembar.length && !pernahDitutup.length && !galat.length) return null;
  const baris = ['🔎 **Temuan Engineer**', ''];

  if (baru.length) {
    // Tempat tombolnya DISEBUT. Live 24 September: Owner mencari tombol "Simpan temuan" di dalam chat,
    // padahal ia ada di bilah atas — petunjuk tanpa alamat membuat fitur yang bekerja tampak rusak.
    baris.push(`**${baru.length} temuan baru** — belum tersimpan. Tekan tombol **"Simpan ${baru.length} temuan"** di **bilah atas** (sebelah meteran konteks) untuk menulisnya ke repo:`, '');
    for (const t of baru) baris.push(`- \`${t.id}\` (${t.tingkat}) \`${t.berkas}\` — ${t.ringkasan}`);
    baris.push('');
  }
  if (kembar.length) {
    baris.push(`**${kembar.length} sudah pernah dilaporkan** dan masih terbuka — tidak ditambahkan lagi:`, '');
    for (const t of kembar) baris.push(`- \`${t.id}\` — ${t.ringkasan}`);
    baris.push('');
  }
  if (pernahDitutup.length) {
    baris.push(`**${pernahDitutup.length} sudah DITUTUP Owner** — tidak diangkat lagi tanpa bukti baru:`, '');
    for (const t of pernahDitutup) baris.push(`- \`${t.id}\` — ${t.ringkasan} (ditutup ${t.ditutup}: ${t.alasanTutup})`);
    baris.push('');
  }
  if (galat.length) {
    baris.push('**Blok yang dilewati:**', '');
    for (const g of galat) baris.push(`- ${g}`);
    baris.push('');
  }
  return baris.join('\n').trim();
}

/**
 * Ringkasan temuan terbuka untuk dibawa ke chat Engineer berikutnya.
 * Dipotong supaya tidak memakan jendela konteks: temuan lama yang masih terbuka tetap disebut ID-nya.
 */
export function ringkasanUntukKonteks(daftar, batas = 20) {
  const terbuka = (daftar || []).filter((t) => t.status !== 'DITUTUP');
  if (!terbuka.length) return '';
  const urut = [...terbuka].sort((a, b) => TINGKAT.indexOf(b.tingkat) - TINGKAT.indexOf(a.tingkat));
  const baris = urut.slice(0, batas).map((t) => `- ${t.id} (${t.tingkat}) ${t.berkas}: ${t.ringkasan}`);
  const sisa = urut.length - baris.length;
  return [
    `[TEMUAN ENGINEER YANG MASIH TERBUKA — ${terbuka.length}]`,
    'Ini sudah pernah dilaporkan dan disimpan. JANGAN laporkan ulang sebagai temuan baru.',
    'Kalau kamu menemukan bukti BARU tentang salah satunya, sebut ID-nya dan jelaskan apa yang berubah.',
    ...baris,
    ...(sisa > 0 ? [`- … ${sisa} temuan terbuka lainnya tidak ditampilkan.`] : []),
  ].join('\n');
}
