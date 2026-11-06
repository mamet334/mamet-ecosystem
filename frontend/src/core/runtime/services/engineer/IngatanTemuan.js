
export const TINGKAT = ['rendah', 'sedang', 'tinggi'];

const POLA_BLOK = /<temuan\b([^>]*)>([\s\S]*?)<\/temuan>/g;
const POLA_ATRIBUT = /([a-z]+)\s*=\s*"([^"]*)"/g;

function ambilBagian(teks, label) {
  const pola = new RegExp('^[ \\t]*' + label + '[ \\t]*:[ \\t]*([\\s\\S]*?)(?=^[ \\t]*[A-Z]{4,}[ \\t]*:|$)', 'm');
  const cocok = teks.match(pola);
  return cocok ? cocok[1].trim() : '';
}

export function kunciTemuan({ berkas, ringkasan }) {
  const t = String(ringkasan || '')
    .toLowerCase()
    .replace(/[`*_~"'.,;:!?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${String(berkas || '').trim().toLowerCase()}::${t}`;
}

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


export const ALAMAT_BERKAS = 'docs/project-memory/temuan-engineer/TEMUAN-ENGINEER.md';

const KEPALA = `# Temuan Engineer

<!-- Berkas ini ditulis mesin dari blok <temuan> dalam jawaban Engineer, lalu disimpan atas perintah Owner.
     Owner boleh menyunting, menggabungkan, atau menutup temuan dengan tangan — bentuk di bawah yang dibaca
     kembali oleh IngatanTemuan.js. Temuan berstatus DITUTUP tidak akan diangkat lagi oleh Engineer. -->
`;

const tanggalHariIni = (sekarang = new Date()) => sekarang.toISOString().slice(0, 10);

const nomorTemuan = (n) => `TMN-${String(n).padStart(4, '0')}`;

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

export function susunBerkasTemuan(daftar) {
  const terbuka = daftar.filter((t) => t.status !== 'DITUTUP');
  const tertutup = daftar.filter((t) => t.status === 'DITUTUP');
  const bagian = [KEPALA.trim(), '', `**${terbuka.length} terbuka · ${tertutup.length} ditutup**`, ''];
  for (const t of [...terbuka, ...tertutup]) bagian.push(tulisSatu(t), '');
  return bagian.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export function keutuhanTemuan(isi) {
  const teks = String(isi || '');
  const judul = (teks.match(/^## TMN-\d{4}.*$/gm) || []).length;
  const terbaca = (teks.match(/^## TMN-\d{4} — (TERBUKA|DITUTUP)[ \t]*$/gm) || []).length;
  return { judul, terbaca, utuh: judul === terbaca };
}

export function bacaBerkasTemuan(isi) {
  const teks = String(isi || '');
  const k = keutuhanTemuan(teks);
  if (!k.utuh) {
    console.error(
      `[IngatanTemuan] BENTUK BERKAS MELENCENG: ${k.judul} judul TMN- ada di berkas, hanya ${k.terbaca} yang bisa diurai. ` +
      'Judul wajib berbentuk persis "## TMN-0001 — TERBUKA" atau "## TMN-0001 — DITUTUP", tanpa apa pun sesudahnya. ' +
      'Selama ini belum diperbaiki, temuan yang TIDAK terurai tidak akan pernah sampai ke Engineer.'
    );
  }
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

export function tutupTemuan(daftar, id, alasan, sekarang = new Date()) {
  return (daftar || []).map((t) => (t.id === id
    ? { ...t, status: 'DITUTUP', ditutup: tanggalHariIni(sekarang), alasanTutup: String(alasan || 'ditutup Owner') }
    : t));
}


export function laporanTemuan({ baru, kembar, pernahDitutup, galat = [] }) {
  if (!baru.length && !kembar.length && !pernahDitutup.length && !galat.length) return null;
  const baris = ['🔎 **Temuan Engineer**', ''];

  if (baru.length) {
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

export function ringkasanUntukKonteks(daftar, batas = 20, keutuhan = null) {
  const terbuka = (daftar || []).filter((t) => t.status !== 'DITUTUP');

  const peringatan = keutuhan && !keutuhan.utuh
    ? [
        `[INGATAN TEMUAN TIDAK TERBACA UTUH — ${keutuhan.terbaca} dari ${keutuhan.judul} entri]`,
        'Berkas catatan temuan ada, tetapi sebagian judulnya tidak bisa diurai, jadi daftar di bawah',
        'TIDAK LENGKAP. JANGAN menyimpulkan sebuah temuan belum pernah dilaporkan hanya karena ia',
        'tidak muncul di sini. Bila kamu menemukan sesuatu, laporkan apa adanya dan sebutkan bahwa',
        'ingatan temuan sedang tidak utuh.',
      ]
    : [];

  if (!terbuka.length) return peringatan.length ? peringatan.join('\n') : '';
  const urut = [...terbuka].sort((a, b) => TINGKAT.indexOf(b.tingkat) - TINGKAT.indexOf(a.tingkat));
  const baris = urut.slice(0, batas).map((t) => `- ${t.id} (${t.tingkat}) ${t.berkas}: ${t.ringkasan}`);
  const sisa = urut.length - baris.length;
  return [
    ...peringatan,
    ...(peringatan.length ? [''] : []),
    `[TEMUAN ENGINEER YANG MASIH TERBUKA — ${terbuka.length}]`,
    'Ini sudah pernah dilaporkan dan disimpan. JANGAN laporkan ulang sebagai temuan baru.',
    'Kalau kamu menemukan bukti BARU tentang salah satunya, sebut ID-nya dan jelaskan apa yang berubah.',
    ...baris,
    ...(sisa > 0 ? [`- … ${sisa} temuan terbuka lainnya tidak ditampilkan.`] : []),
  ].join('\n');
}
