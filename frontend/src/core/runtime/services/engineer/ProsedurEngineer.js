
export function bakukanPerintah(perintah) {
  return String(perintah ?? '').trim().replace(/\s+/g, ' ');
}

export function gitShowTanpaRevisi(perintah) {
  const p = bakukanPerintah(perintah);
  const m = /^git show (?:--\S+ )*([^\s]+)$/.exec(p);
  if (!m) return null;
  const arg = m[1];
  if (arg.includes(':') || /^[0-9a-f]{7,40}$/i.test(arg) || arg === 'HEAD') return null;
  if (!/[./\\]/.test(arg)) return null;
  return arg;
}

export function keluaranKosong(keluaran) {
  return /\(tanpa keluaran\)/.test(String(keluaran ?? ''));
}

export function petunjukHasilKosong(perintah, keluaran) {
  if (!keluaranKosong(keluaran)) return null;
  const alamat = gitShowTanpaRevisi(perintah);
  if (!alamat) return null;
  return `PETUNJUK SISTEM: "git show ${alamat}" tanpa revisi TIDAK menampilkan isi berkas — git membacanya sebagai penyaring commit, jadi kosong itu normal dan BUKAN tanda berkas hilang. Untuk melihat isinya: git show HEAD:${alamat}`;
}

export function catatanAkarRepo(akar) {
  const alamat = String(akar || '').trim();
  if (!alamat) return '';
  return [
    '[AKAR REPO ENGINEER]',
    `Seluruh perintah [MAMET_CMD: …] dijalankan dengan direktori kerja: ${alamat}`,
    'Anda SUDAH berada di akar repo. Pakai alamat RELATIF terhadap folder itu',
    '(mis. frontend/src/core/runtime/Kernel.js), bukan alamat absolut.',
    'JANGAN menelusuri filesystem untuk mencari letak berkas — untuk menemukannya pakai',
    'git ls-files (daftar berkas) atau git grep -n (cari isi), keduanya sudah diizinkan.',
  ].join('\n');
}


export const BYTE_PER_BARIS_PERKIRAAN = 43;
export const KELUARAN_BAWAAN_BYTE = 20 * 1024;

export const DALAM_INDEKS = 3;

export function catatanPetaRepo(peta, { keluaranMaksByte = KELUARAN_BAWAAN_BYTE } = {}) {
  const isi = String(peta || '').trim();
  if (!isi) return '';
  const BARIS_BERKAS_BESAR = Math.floor(keluaranMaksByte / BYTE_PER_BARIS_PERKIRAAN);
  const kb = Math.round(keluaranMaksByte / 1024).toLocaleString('id-ID');

  const baris = isi.split('\n').filter(Boolean);
  const berkas = baris.map((b) => {
    const p = b.lastIndexOf(':');
    return { alamat: b.slice(0, p), jumlah: Number(b.slice(p + 1)) || 0 };
  }).filter((f) => f.alamat);
  if (!berkas.length) return '';

  const perFolder = new Map();
  for (const f of berkas) {
    const bagian = f.alamat.split('/');
    bagian.pop();
    const folder = bagian.slice(0, DALAM_INDEKS).join('/') || '(akar)';
    perFolder.set(folder, (perFolder.get(folder) || 0) + 1);
  }
  const daftarFolder = [...perFolder.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([folder, n]) => `${folder.padEnd(38)} ${n}`);

  const besar = berkas
    .filter((f) => f.jumlah > BARIS_BERKAS_BESAR)
    .sort((a, b) => b.jumlah - a.jumlah)
    .map((f) => `  ${f.alamat} ${f.jumlah}`);

  const petaUtuh = [
    '[PETA REPO — SELURUH BERKAS KODE, dengan jumlah barisnya]',
    `${berkas.length} berkas. Bentuk tiap baris: alamat:jumlah_baris`,
    'Daftar LENGKAP: bila sebuah berkas tidak ada di sini, ia memang tidak ada.',
    `Keluaran tiap perintah maksimal ${kb} KB (anggaran konteks Settings). Berkas >${BARIS_BERKAS_BESAR} baris (perkiraan) kemungkinan`,
    'tidak muat dalam satu `git show` — pakai `git grep -n -B2 -A4 <kata>` atau `git blame -L <awal>,<akhir> -- <alamat>`.',
    '',
    isi,
  ].join('\n');

  const indeks = [
    '[PETA REPO — INDEKS, bukan daftar berkas]',
    `${berkas.length} berkas kode di ${perFolder.size} folder. Daftar berkasnya TIDAK disertakan di sini.`,
    '',
    'Cara mengambil yang Anda perlukan (keduanya jalan TANPA dialog izin, jadi murah):',
    '  daftar berkas satu folder : git grep -c "" -- <folder>',
    '  mencari isi               : git grep -n -B2 -A4 <kata> -- <folder>',
    'JANGAN menebak alamat berkas dan JANGAN menyimpulkan sebuah berkas tidak ada — indeks ini',
    'hanya menyebut folder. Ambil daftarnya dulu dengan perintah di atas.',
    `Keluaran tiap perintah maksimal ${kb} KB (anggaran konteks Settings); lebih dari itu terpotong dan sistem memberi tahu.`,
    '',
    'FOLDER (jumlah berkas):',
    ...daftarFolder,
    ...(besar.length ? [
      '',
      `BERKAS >${BARIS_BERKAS_BESAR} BARIS (perkiraan) — kemungkinan melebihi ${kb} KB keluaran satu \`git show\`. Pakai \`git grep -n\` atau \`git blame -L\`:`,
      ...besar,
    ] : []),
  ].join('\n');

  return indeks.length < petaUtuh.length ? indeks : petaUtuh;
}

export function catatanKebijakanPerintah(kebijakan, { keluaranMaksByte = KELUARAN_BAWAAN_BYTE } = {}) {
  const daftar = Array.isArray(kebijakan?.program) ? kebijakan.program : [];
  if (!daftar.length) return '';
  const git = daftar.find((p) => p.nama === 'git');
  const lain = daftar.filter((p) => p.nama !== 'git');
  const internet = lain.filter((p) => p.internetDitolak).map((p) => `${p.nama} ${p.internet.join('|')}`);
  const tolak = lain.filter((p) => p.tolak.length).map((p) => `${p.nama} ${p.tolak.join('|')}`);
  return [
    '[PERINTAH YANG BISA DIJALANKAN — dibaca dari aturan aplikasi, bukan perkiraan]',
    `Satu program per [MAMET_CMD: …], dijalankan di ${kebijakan.tempat || 'repo'} TANPA shell: ${(kebijakan.tanpaShell || []).join(' ')} di luar tanda kutip ditolak. Alamat relatif repo saja.`,
    kebijakan.tanpaDialog?.length ? `Jalan langsung tanpa dialog izin: ${kebijakan.tanpaDialog.join(', ')}.` : '',
    git ? `git HANYA: ${git.sub.join(', ')} (branch hanya melihat daftar). Selain itu (add, commit, push, pull, reset, checkout, …) ditolak — perubahan lewat patch, Owner yang commit & push.` : '',
    `Program lain (dengan dialog izin Owner): ${lain.map((p) => p.nama).join(', ')}.`,
    internet.length ? `Ditolak karena mengunduh dari internet: ${internet.join('; ')} — tulis sebagai teks biasa agar Owner menjalankannya sendiri.` : '',
    tolak.length ? `Ditolak (menerbitkan/akun/pengaturan global): ${tolak.join('; ')}.` : '',
    `Batas waktu bawaan ${kebijakan.waktuBawaanS} detik (maks ${kebijakan.waktuMaksS}); keluaran maks ${Math.round(keluaranMaksByte / 1024).toLocaleString('id-ID')} KB (anggaran konteks Settings).`,
  ].filter(Boolean).join('\n');
}

const POLA_BACA_UTUH =/^git\s+show\s+[^\s:]*:(\S+)\s*$/i;

export function petunjukKeluaranTerpotong(perintah, hasil) {
  if (!hasil?.terpotong) return null;
  const cocok = POLA_BACA_UTUH.exec(String(perintah || '').trim());
  if (!cocok) return null;
  const alamat = cocok[1];
  const ukuran = Number(hasil.byteKeluaran) || 0;
  return [
    `PETUNJUK SISTEM: keluaran terpotong — berkas "${alamat}"${ukuran ? ` berukuran ${ukuran.toLocaleString('id-ID')} bita` : ''} dan hanya bagian AWALNYA yang sampai kepada Anda.`,
    'JANGAN mengulang pembacaan utuh dan jangan mencari jalan lain di luar git. Pakai dua langkah ini (keduanya sudah diizinkan):',
    `1. Cari sekaligus baca sekitarnya: git grep -n -B2 -A4 "<pola>" -- ${alamat}`,
    `2. Baca rentang baris tertentu: git blame -L <awal>,<akhir> -- ${alamat}`,
    'Keduanya mengembalikan nomor baris, dan ratusan kali lebih kecil daripada berkas utuh.',
  ].join('\n');
}

export function petunjukGrepSebagian(perintah, hasil) {
  const teks = String(perintah || '').trim();
  if (!/^git\s+grep\b/i.test(teks)) return null;
  if (!hasil?.ok) return null;

  if (/(^|\s)-(A|B|C)\b|(^|\s)-(A|B|C)\d|--(after|before)-context\b|--context\b/.test(teks)) return null;
  if (/(^|\s)-(c|l|L)\b|--count\b|--files-with-matches\b|--files-without-match\b/.test(teks)) return null;

  const baris = String(hasil.keluaran || '').split('\n').filter((b) => b.trim()).length;
  if (!baris) return null;

  return [
    `PETUNJUK SISTEM: perintah di atas mengembalikan ${baris} BARIS YANG COCOK, bukan isi berkasnya.`,
    'Baris di antaranya TIDAK Anda lihat. Jangan menyimpulkan apa yang ada atau tidak ada di sekitarnya dari hasil ini.',
    'Bila kesimpulan Anda bergantung pada konteks sekitar baris itu, ambil dulu salah satu:',
    '1. git grep -n -B2 -A4 "<pola>" -- <alamat>   (baris yang cocok beserta sekitarnya)',
    '2. git blame -L <awal>,<akhir> -- <alamat>    (rentang baris tertentu, bernomor)',
    'Bila kesimpulan Anda memang hanya tentang ADA/TIDAKNYA pola itu, hasil ini sudah cukup — katakan begitu.',
  ].join('\n');
}

export function cekPerintahBerulang(perintah, riwayat = []) {
  const baku = bakukanPerintah(perintah);
  if (!baku) return { ulang: false, pesan: null };
  const sebelumnya = (riwayat || []).find((r) => bakukanPerintah(r?.perintah) === baku);
  if (!sebelumnya) return { ulang: false, pesan: null };

  const kosong = keluaranKosong(sebelumnya.keluaran);
  const petunjuk = petunjukHasilKosong(baku, sebelumnya.keluaran);
  return {
    ulang: true,
    pesan: [
      `TIDAK DIJALANKAN: perintah yang sama persis sudah dijalankan pada percakapan ini dan hasilnya ${kosong ? 'kosong' : 'sudah Anda terima'}.`,
      'Mengulangi perintah yang identik tidak akan memberi hasil berbeda (prosedur kerja Engineer langkah 0.4: satu cara gagal → ganti cara). Ubah bentuk perintahnya, ubah sumber buktinya, atau katakan terus terang bahwa buktinya tidak bisa Anda dapatkan.',
      petunjuk,
    ].filter(Boolean).join('\n\n'),
  };
}

export function catatanKonstitusi(daftar) {
  const isi = Array.isArray(daftar) ? daftar.filter((d) => d && typeof d.alamat === 'string' && d.alamat) : [];
  if (!isi.length) return '';

  const baris = isi.map((d) => `- ${d.alamat}${d.judul ? ` — ${d.judul}` : ''}`);
  return [
    '[KONSTITUSI MAMET — INDEKS]',
    `${isi.length} berkas. Ini DAFTAR, bukan isinya: isi tidak dikirim karena ±44.000 token.`,
    '',
    ...baris,
    '',
    'CARA MEMBACA (jalan tanpa dialog izin):',
    '  [MAMET_CMD: git show HEAD:constitution/24_ANTI_HALLUCINATION_PROTOCOL.md]',
    '',
    'ATURAN PEMAKAIAN:',
    '- AGENTS.md menempatkan Konstitusi DI ATAS kode sumber sebagai sumber kebenaran. Bila',
    '  jawaban Anda menyangkut aturan, prinsip, atau keputusan arsitektur, BACA berkasnya lebih',
    '  dulu — jangan menjawab dari ingatan atau dari kode saja.',
    '- JANGAN mengaku sudah membaca berkas yang belum Anda buka. Daftar ini memberi tahu apa yang',
    '  ADA, bukan apa yang sudah Anda baca.',
    '- JANGAN menyimpulkan sebuah aturan TIDAK ADA hanya karena judulnya tak menyebutnya; judul',
    '  di sini sebagian hanya nama berkas.',
  ].join('\n');
}

export const BATAS_KELUARAN_MODEL = 8000;

const PORSI_KEPALA = 0.7;

export function potongKeluaranUntukModel(keluaran, batas = BATAS_KELUARAN_MODEL) {
  const teks = String(keluaran ?? '');
  if (teks.length <= batas) return { teks, dipotong: false, asli: teks.length };

  const baris = teks.split('\n');
  const ambil = (dari, maks, mundur) => {
    const keluar = [];
    let n = 0;
    const urut = mundur ? [...dari].reverse() : dari;
    for (const b of urut) {
      if (n + b.length + 1 > maks) break;
      n += b.length + 1;
      keluar.push(b);
    }
    return mundur ? keluar.reverse() : keluar;
  };
  const kepala = ambil(baris, Math.floor(batas * PORSI_KEPALA), false);
  const ekor = ambil(baris.slice(kepala.length), batas - kepala.join('\n').length, true);
  const dibuang = baris.length - kepala.length - ekor.length;

  const catatan = [
    '',
    `… [KELUARAN DIPOTONG SISTEM] keluaran aslinya ${teks.length.toLocaleString('id-ID')} huruf (${baris.length.toLocaleString('id-ID')} baris); ${dibuang.toLocaleString('id-ID')} baris di TENGAH dibuang karena melebihi batas ${batas.toLocaleString('id-ID')} huruf per keluaran (anggaran konteks Settings).`,
    'Awal dan AKHIR keluaran tetap utuh, jadi jangan simpulkan bahwa kecocokan berhenti di sini.',
    'Bila yang Anda cari ada di bagian yang dibuang, PERSEMPIT pencariannya — jangan ulangi perintah yang sama:',
    '  • batasi foldernya: tambahkan `-- <folder>` yang lebih sempit',
    '  • daftar berkasnya dulu: `git grep -l "<pola>" -- <folder>`, baru baca satu berkas',
    '  • hitung dulu sebarannya: `git grep -c "<pola>" -- <folder>`',
    '',
  ].join('\n');

  return { teks: kepala.join('\n') + '\n' + catatan + ekor.join('\n'), dipotong: true, asli: teks.length };
}

export function pesanKeluaranPerintah(perintah, keluaran, { batas } = {}) {
  const { teks } = potongKeluaranUntukModel(keluaran, Number.isInteger(batas) && batas > 0 ? Math.max(batas, BATAS_KELUARAN_MODEL) : BATAS_KELUARAN_MODEL);
  return `[TERMINAL OUTPUT for: ${perintah}]\n${teks}`;
}

export function riwayatPerintahDariPesan(pesan = []) {
  const hasil = [];
  for (const m of pesan || []) {
    const isi = String(m?.content ?? '');
    const m1 = /^\[TERMINAL OUTPUT for: ([\s\S]*?)\]\n([\s\S]*)$/.exec(isi);
    if (m1) hasil.push({ perintah: m1[1], keluaran: m1[2] });
  }
  return hasil;
}

const PENANDA_PATCH = '[MAMET_PATCH_READY]';
const POLA_PENANDA_BARIS = /^[ \t>*-]*\[MAMET_PATCH_READY\][ \t]*$/m;

const tanpaKodeDanNalar = (teks) => String(teks ?? '')
  .replace(/<think>[\s\S]*?<\/think>/gi, '')
  .replace(/```[\s\S]*?```/g, '')
  .replace(/`[^`\n]*`/g, '');

export function adaPenandaPatch(teks) {
  return POLA_PENANDA_BARIS.test(tanpaKodeDanNalar(teks));
}

export function buangPenandaPatch(teks) {
  const t = String(teks ?? '');
  if (!adaPenandaPatch(t)) return t;
  return t.split('\n').filter((b) => !POLA_PENANDA_BARIS.test(b)).join('\n').trim();
}

const POLA_MINTA_TUGAS = /\bTUGAS[-\s]?\d+/i;
const POLA_UMUMKAN = /TUGAS YANG DIKERJAKAN\s*:[^\n]*?["“]([^"“”\n]{15,})["”]/i;

export function peringatanTugasTakDiumumkan(pesanPengguna, jawaban) {
  const p = String(pesanPengguna ?? '');
  if (!POLA_MINTA_TUGAS.test(p)) return null;
  if (/^\[TERMINAL OUTPUT for: /.test(p)) return null;

  const t0 = String(jawaban ?? '');
  if (/\[STATUS:\s*INSUFFICIENT/i.test(t0)) return null;
  if (/tidak ada di sumber|tidak ditemukan di (?:sumber|dokumen)|tidak ada di dokumen|belum (?:ter)?unggah|tidak tersedia di konteks/i.test(t0)) return null;
  const t = String(jawaban ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  const diminta = (POLA_MINTA_TUGAS.exec(p) || [''])[0].toUpperCase().replace(/\s/, '-');
  const umumkan = POLA_UMUMKAN.exec(t);

  if (!umumkan) {
    return `⚠️ **Peringatan sistem:** jawaban di atas tidak mengumumkan tugas yang dikerjakan beserta kutipan kalimat sumbernya, padahal prosedur kerja Engineer langkah 0.1 mewajibkannya — baris \`TUGAS YANG DIKERJAKAN: ${diminta} — "<kutipan kalimat dari dokumen>"\` tidak ada. Tanpa kutipan itu, tidak ada cara memastikan Engineer mengerjakan tugas yang benar (23 September 2026: diminta TUGAS-02, yang dikerjakan isi TUGAS-04). Minta Engineer mengumumkan tugasnya lebih dulu sebelum menerima hasil di atas.`;
  }

  const barisUmumkan = umumkan[0];
  const nomorDiminta = (/\d+/.exec(diminta) || [''])[0];
  const cocok = new RegExp(`TUGAS[-\\s]?0*${nomorDiminta}\\b`, 'i').test(barisUmumkan);
  if (cocok) return null;

  const disebut = barisUmumkan.split(/[-—:]/).slice(1).join(' ').trim().slice(0, 60);
  return `⚠️ **Peringatan sistem:** pengguna meminta **${diminta}**, tetapi jawaban di atas mengumumkan tugas lain (\`${disebut}…\`). Prosedur kerja Engineer langkah 0.1: tugas yang diumumkan harus tugas yang diminta, dengan kutipan kalimat dari bagian dokumen tugas itu. Periksa dulu apakah Engineer mengerjakan tugas yang benar sebelum menerima hasil di atas.`;
}
