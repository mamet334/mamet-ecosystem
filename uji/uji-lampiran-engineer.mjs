// UJI 2026-10-02 — lampiran untuk Engineer: mata terhadap tata letak, dan dokumen instruksi.
//
// ── Permintaan Owner ────────────────────────────────────────────────────────────────────────
// *"menempelkan berkas maupun gambar ke engineer belum ada, karena itu sebagai MATA untuk engineer
//  terhadap aplikasi yang dikerjakannya menyangkut nanti tata letak yang seharusnya berada. Dan
//  dokumen yang bisa ditempel agar engineer tahu instruksi secara teknis."*
//
// Engineer sudah bisa MEMBACA kode sejak 1 Okt (kacamata kuda dilepas). Ini yang membuatnya bisa
// MELIHAT hasilnya. Tangkapan layar adalah satu-satunya bukti tentang rupa aplikasi — tata letak,
// jarak, warna, glif yang tampil sebagai kotak. Itu TIDAK bisa diturunkan dari kode sumber.
//
// ── Cacat yang ditemukan saat mengerjakannya ────────────────────────────────────────────────
// Jalur kliennya sudah generik, tombolnya saja yang dikunci ke ws-lite & ws-assistant. Tetapi saat
// memeriksa sisi server, ketahuan nama medan yang TIDAK PERNAH COCOK:
//
//   klien  (AssistantService.buildFileData)  mengirim  { name, type, size, data }
//   server (request_parser)                  membaca   file.mimeType
//
// `mimeType` nol kemunculan di frontend/src maupun mametlite/src. Jadi cabang gambar TIDAK PERNAH
// menyala — setiap tangkapan layar jatuh ke cabang terakhir dan model hanya menerima nama berkas.
// Lampiran gambar sudah rusak SEJAK AWAL, di semua ruang kerja, dan tak ada yang memberi tahu.
//
// Membuka tombolnya tanpa memperbaiki ini akan memberi Owner fitur yang TERLIHAT ADA TETAPI BUTA.

import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const baca = (p) => readFileSync(`${AKAR}/${p}`, 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-lampiran-engineer v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const RP = tanpaKomentar(baca('supabase/functions/agent-process/lib/request/request_parser.ts'));
const AS = tanpaKomentar(baca('frontend/src/core/runtime/services/AssistantService.js'));
const CE = tanpaKomentar(baca('frontend/src/components/workbench/ConversationEngine.jsx'));
const EC = baca('supabase/functions/agent-process/lib/rag/engineer_context.ts');

// ── 1. Nama medan klien & server akhirnya bertemu ───────────────────────────────────────────
console.log('\n-- nama medan bertemu --');

cek(/name: attachedFile\.name,\s*type: attachedFile\.type,/.test(AS),
  'klien tetap mengirim medan `type` (tidak diubah — ia yang dipakai sejak awal)', (AS.match(/.*attachedFile\.type.*/g) || []));
cek(!/file\.mimeType && file\.mimeType\.startsWith/.test(RP),
  'server tidak lagi HANYA membaca mimeType yang tak pernah ada');
cek(/file\.mimeType \|\| file\.type/.test(RP),
  'server menerima KEDUANYA — `type` dari klien, `mimeType` untuk pemanggil lama', (RP.match(/.*mimeType \|\|.*/g) || []));

// ── 2. Gambar benar-benar bisa menyala ──────────────────────────────────────────────────────
console.log('\n-- gambar --');

cek(/mime\.startsWith\('image\/'\) \|\| akhiranGambar/.test(RP),
  'gambar dikenali dari mime ATAU akhiran berkas', (RP.match(/.*akhiranGambar.*/g) || []));
cek(/\\\.\(png\|jpe\?g\|gif\|webp\|bmp\)\$/.test(RP) || /png\|jpe\?g\|gif\|webp\|bmp/.test(RP),
  'akhiran gambar yang lazim dikenali');
cek(/extractedImage = \{ mimeType:/.test(RP), 'hasilnya tetap diisi ke extractedImage (jalur vision yang sudah ada)');

// ── 3. Dokumen teknis bisa dibaca ───────────────────────────────────────────────────────────
// Owner meminta "dokumen yang bisa ditempel agar engineer tahu instruksi secara teknis".
console.log('\n-- dokumen teknis --');
{
  const pola = (RP.match(/const TEKS = \/[^/]+\//) || [])[0] || '';
  for (const ext of ['txt', 'csv', 'md', 'json', 'sql', 'tsx', 'ps1']) {
    cek(pola.includes(ext), `akhiran .${ext} ikut dibaca isinya`, pola);
  }
  cek(/Isi Dokumen:/.test(RP), 'isinya ditempel ke pesan dengan penanda yang jelas');
  cek(/substring\(0, 50000\)/.test(RP), 'batas 50.000 huruf dipertahankan — bukan dibuka lebar diam-diam');
}

// ── 4. Jenis yang TIDAK didukung dikatakan apa adanya ───────────────────────────────────────
// Kalimat lama menjanjikan "PDF akan dibaca secara ringkas jika memungkinkan" — janji yang tidak
// pernah ditepati siapa pun di jalur ini. Model lalu menebak isi dari nama berkas.
console.log('\n-- yang tak didukung tidak berjanji --');

cek(!/PDF akan dibaca secara ringkas/.test(RP), 'janji lama yang tak pernah ditepati dibuang');
cek(/ISINYA TIDAK DIBACA/.test(RP), 'dikatakan tegas bahwa isinya tidak sampai');
cek(/Jangan menebak isinya/.test(RP), 'model dilarang menebak isi dari nama berkas', (RP.match(/.*Jangan menebak.*/g) || []));

// ── 5. Tombolnya terbuka untuk Engineer, tanpa menutup yang lain ────────────────────────────
console.log('\n-- tombol lampiran --');

cek(/isEngineerWorkspace \|\| workspaceManager\?\.activeWorkspaceId === 'ws-lite'/.test(CE),
  'Engineer ikut, dan dua ruang lama TIDAK dicabut', (CE.match(/.*ws-lite.*/g) || []).slice(0, 2));
cek(/isEngineerWorkspace \? 'Lampirkan tangkapan layar atau dokumen teknis/.test(CE),
  'judul tombolnya menjelaskan gunanya di Engineer');
cek(/isinya ikut ke penyedia model/.test(CE),
  'T12 disebut di tempat Owner menekannya — bukan hanya di dokumen', (CE.match(/.*penyedia model.*/g) || []).slice(0, 1));

// ── 6. Model DIBERI TAHU ────────────────────────────────────────────────────────────────────
// Pelajaran termahal 1 Okt: kemampuan yang tidak disebut di prompt tidak akan pernah dipakai.
console.log('\n-- model diberi tahu --');

cek(/\[0\.2e\] THE OWNER CAN ATTACH SCREENSHOTS AND DOCUMENTS/.test(EC), 'langkah 0.2e ditambahkan');
cek(/You cannot derive that from source code/.test(EC), 'ditegaskan tata letak tak bisa diturunkan dari kode');
cek(/describe what you SEE before explaining it/.test(EC), 'disuruh menyebut yang DILIHAT sebelum menafsirkan');
cek(/ISINYA TIDAK DIBACA/.test(EC), 'diajari mengenali penanda berkas yang tak terbaca');
cek(/do NOT guess from the filename/.test(EC), 'dilarang menebak dari nama berkas');
// Berkas ini satu template literal raksasa: satu backtick di teks instruksi menutupnya dan
// menggagalkan deploy — terjadi hari ini juga saat menulis langkah [0.2d].
cek(!/\[0\.2e\][\s\S]{0,900}?`/.test(EC), 'tidak ada backtick di dalam langkah 0.2e');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
