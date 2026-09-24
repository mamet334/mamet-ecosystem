// UJI 2026-09-23 — ProsedurEngineer.js: tiga penjaga prosedur kerja Engineer.
// Bahan uji diambil PERSIS dari kegagalan live TUGAS-02 (chat 871733fa, 23 September 2026).
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem/frontend/src/';
const P = await import(pathToFileURL(AKAR + 'core/runtime/services/engineer/ProsedurEngineer.js').href + '?v=' + Date.now());
console.log('uji-prosedur-engineer v5');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      → ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const ALAMAT = 'frontend/src/core/runtime/services/engineer/IntentClassifier.js';
const KOSONG = `(tanpa keluaran)\n\nKode keluar 0 (0,1 s).`;

// ---------- 0.3 petunjuk hasil kosong ----------
cek(/git show HEAD:/.test(P.petunjukHasilKosong(`git show ${ALAMAT}`, KOSONG) || ''),
  'git show <alamat> + hasil kosong → petunjuk memakai HEAD: (kegagalan live TUGAS-02)');
cek(P.petunjukHasilKosong(`git show HEAD:${ALAMAT}`, KOSONG) === null,
  'bentuk yang sudah benar tidak diberi petunjuk (tidak cerewet)');
cek(P.petunjukHasilKosong(`git show ${ALAMAT}`, 'isi berkas...\n\nKode keluar 0 (0,1 s).') === null,
  'ADA keluaran → tidak ada petunjuk (petunjuk hanya untuk kosong yang menyesatkan)');
cek(P.petunjukHasilKosong('git show HEAD', KOSONG) === null, 'git show HEAD (commit) bukan pembacaan berkas');
cek(P.petunjukHasilKosong('git show 4b264c7', KOSONG) === null, 'git show <sha> tidak dianggap salah bentuk');
cek(P.petunjukHasilKosong('git status', KOSONG) === null, 'perintah lain yang kosong tidak diberi petunjuk palsu');

// ---------- 0.4 perintah berulang ----------
const riwayat = [{ perintah: `git show ${ALAMAT}`, keluaran: KOSONG }];
let r = P.cekPerintahBerulang(`git show ${ALAMAT}`, riwayat);
cek(r.ulang === true && /TIDAK DIJALANKAN/.test(r.pesan), 'perintah identik → tidak dijalankan lagi', r);
cek(/ganti cara|0\.4/.test(r.pesan), 'pesannya menyuruh GANTI CARA, bukan sekadar menolak', r.pesan);
cek(/git show HEAD:/.test(r.pesan), 'sekaligus memberi bentuk perintah yang benar', r.pesan);
cek(P.cekPerintahBerulang(`  git   show ${ALAMAT}  `, riwayat).ulang === true, 'beda spasi tetap dianggap sama');
cek(P.cekPerintahBerulang(`git show HEAD:${ALAMAT}`, riwayat).ulang === false, 'perintah yang DIUBAH boleh jalan');
cek(P.cekPerintahBerulang('git ls-files frontend/src/', riwayat).ulang === false, 'perintah lain tidak terhalang');
cek(P.cekPerintahBerulang('git status', []).ulang === false, 'riwayat kosong → jalan seperti biasa');

// riwayat dari pesan chat sungguhan
const pesanChat = [
  { role: 'user', content: 'kerjakan TUGAS-02 dari dokumen tugas uji engineer' },
  { role: 'model', content: '... [MAMET_CMD: git show ' + ALAMAT + '] ...' },
  { role: 'user', content: `[TERMINAL OUTPUT for: git show ${ALAMAT}]\n${KOSONG}` },
  { role: 'user', content: `[TERMINAL OUTPUT for: git ls-files frontend/src/core/runtime/services/engineer/]\nApprovalGateway.js\n\nKode keluar 0 (0,1 s).` },
];
const riwayat2 = P.riwayatPerintahDariPesan(pesanChat);
cek(riwayat2.length === 2 && riwayat2[0].perintah === `git show ${ALAMAT}`, 'riwayat perintah terbaca dari pesan chat', riwayat2.map(x => x.perintah));
cek(P.cekPerintahBerulang(`git show ${ALAMAT}`, riwayat2).ulang === true, 'pengulangan live TUGAS-02 tertangkap dari riwayat chat');

// ---------- 0.1 umumkan tugas ----------
const jawabanLive = 'TUGAS-02 dari dokumen tugas uji engineer meminta untuk membaca fungsi `detectIntent` dalam berkas `IntentClassifier.js` ...';
cek(P.peringatanTugasTakDiumumkan('kerjakan TUGAS-02 dari dokumen tugas uji engineer', jawabanLive) !== null,
  'jawaban live TUGAS-02 (tanpa kutipan sumber) → diperingatkan');
const jawabanBenar = 'TUGAS YANG DIKERJAKAN: TUGAS-02 — "dokumentasi fungsi logCommand (sekitar baris 88-96) menyebut CommandRegistry"\n\nBerikut rencananya...';
cek(P.peringatanTugasTakDiumumkan('kerjakan TUGAS-02 dari dokumen tugas uji engineer', jawabanBenar) === null,
  'jawaban yang mengumumkan tugas + kutipan → tidak diperingatkan');
// Live 2026-09-23 01:53: format pengumuman BENAR tapi tugas yang disebut salah (TASK-0014, kutipan milik TUGAS-04).
const jawabanSalahTugas = 'TUGAS YANG DIKERJAKAN: TASK-0014 — "Berkas: `IntentClassifier.js` (77 baris, fungsi `detectIntent`)."\n\nSaya akan membaca berkas itu.';
const peringatanSalah = P.peringatanTugasTakDiumumkan('kerjakan TUGAS-02 dari dokumen tugas uji engineer', jawabanSalahTugas);
cek(peringatanSalah !== null && /TUGAS-02/.test(peringatanSalah), 'format benar tapi TUGAS LAIN yang diumumkan → tetap diperingatkan', peringatanSalah);
cek(/mengumumkan tugas lain/.test(peringatanSalah || ''), 'peringatannya menyebut sebabnya: tugas yang diumumkan bukan yang diminta');
cek(P.peringatanTugasTakDiumumkan('kerjakan TUGAS-2 dari dokumen', 'TUGAS YANG DIKERJAKAN: TUGAS-02 — "dokumentasi fungsi logCommand menyebut CommandRegistry"') === null,
  'nomor tugas cocok walau ditulis TUGAS-2 vs TUGAS-02');
// Live 2026-09-23 09:00: kutipan memuat backtick (nama fungsi) — versi pertama pola gagal mendeteksinya.
const barisLive = 'TUGAS YANG DIKERJAKAN: TASK-0014 — "Baca `detectIntent`, lalu jelaskan dengan contoh kalimat nyata: kalimat mana yang salah digolongkan."';
const pLive = P.peringatanTugasTakDiumumkan('kerjakan TUGAS-02 dari dokumen tugas uji engineer', barisLive);
cek(/mengumumkan tugas lain/.test(pLive || ''), 'kutipan ber-backtick TETAP terbaca sebagai pengumuman; yang ditegur adalah tugasnya yang salah', pLive);
cek(P.peringatanTugasTakDiumumkan('kerjakan TUGAS-02', 'TUGAS YANG DIKERJAKAN: TUGAS-02 — "keterangan `@param` pada fungsi `logCommand` menyebut CommandRegistry"') === null,
  'kutipan ber-backtick dengan tugas yang BENAR → tidak diperingatkan');
// Live 2026-09-23 10:40 (deepseek-v4-pro): menolak karena tugasnya tidak ada di sumber = langkah 0.1 DIJALANKAN,
// bukan dilanggar. Teks di bawah dipendekkan dari jawaban aslinya.
const jawabanMenolak = 'Maaf, Pak Slamet — saya harus berhenti di sini dulu. **TUGAS-04 tidak ada di sumber saya.** Dokumen yang tersedia hanya memuat TUGAS-01, TUGAS-02, TUGAS-03. Sesuai RULE 0.1 saya tidak boleh mengerjakan tugas terdekat. [STATUS: INSUFFICIENT]';
cek(P.peringatanTugasTakDiumumkan('kerjakan TUGAS-04 dari dokumen tugas uji engineer', jawabanMenolak) === null,
  'menolak karena tugas tidak ada di sumber → TIDAK diperingatkan (peringatan palsu 2026-09-23 diperbaiki)');
cek(P.peringatanTugasTakDiumumkan('kerjakan TUGAS-04 dari dokumen', 'TUGAS-04 tidak ada di sumber saya, mohon unggah dokumennya.') === null,
  'penolakan tanpa label pun dikenali dari kalimatnya');
cek(P.peringatanTugasTakDiumumkan('kerjakan TUGAS-04 dari dokumen', 'Baik, saya kerjakan analisis detectIntent sekarang.') !== null,
  'jawaban yang TETAP mengerjakan tanpa pengumuman → tetap diperingatkan (celah tidak dibuka lebar)');
cek(P.peringatanTugasTakDiumumkan('bagaimana keadaan sistem mamet?', 'BRAIN 1 health: ...') === null,
  'obrolan biasa tidak pernah kena peringatan');
cek(P.peringatanTugasTakDiumumkan(`[TERMINAL OUTPUT for: git status]\nKode keluar 0 (0,1 s).`, 'Hasilnya bersih.') === null,
  'putaran lanjutan (hasil perintah) bukan permintaan tugas baru');
cek(/TUGAS-02/.test(P.peringatanTugasTakDiumumkan('kerjakan tugas-02 dari dokumen', 'saya kerjakan ya') || ''),
  'nama tugas yang diminta ikut disebut dalam peringatan');
cek(P.peringatanTugasTakDiumumkan('kerjakan TUGAS-01', '<think>TUGAS YANG DIKERJAKAN: TUGAS-01 — "komentar basi di SkillGuardService"</think> hasil') !== null,
  'pengumuman yang hanya ada di dalam <think> tidak dihitung (nalar bukan jawaban)');

// ---------- penanda patch: sinyal vs sebutan ----------
// Live 2026-09-23 TUGAS-04 (tugas ANALISIS): "…jadi saya tidak menandai `[MAMET_PATCH_READY]`" → jalur patch tetap
// dimulai, lalu gagal, dan kalimatnya rusak jadi "saya tidak menandai ``".
const kalimatMenyebut = 'Ini analisis, bukan permintaan patch — jadi saya tidak menandai `[MAMET_PATCH_READY]`.';
cek(P.adaPenandaPatch(kalimatMenyebut) === false, 'menyebut penanda dalam kalimat BUKAN sinyal patch');
cek(P.buangPenandaPatch(kalimatMenyebut) === kalimatMenyebut, 'kalimat yang menyebut penanda tidak dirusak');
const jawabanMenandai = 'Perubahan siap diterapkan.\n\n[MAMET_PATCH_READY]';
cek(P.adaPenandaPatch(jawabanMenandai) === true, 'penanda berdiri sendiri di satu baris → sinyal patch');
cek(!/MAMET_PATCH_READY/.test(P.buangPenandaPatch(jawabanMenandai)), 'baris penanda dibuang dari teks yang ditampilkan');
cek(P.adaPenandaPatch('```\n[MAMET_PATCH_READY]\n```') === false, 'penanda di dalam blok kode (contoh) bukan sinyal');
cek(P.adaPenandaPatch('<think>saya akan tulis [MAMET_PATCH_READY]</think> belum siap') === false, 'penanda di dalam nalar bukan sinyal');
cek(P.adaPenandaPatch('- [MAMET_PATCH_READY]') === true, 'penanda sebagai butir daftar tetap sinyal');
const as0 = readFileSync(AKAR + 'core/runtime/services/AssistantService.js', 'utf8');
cek(!/includes\('\[MAMET_PATCH_READY\]'\)/.test(as0), 'tidak ada lagi deteksi penanda dengan includes() di jalur mana pun');

// ---------- terpasang di jalur yang dipakai ----------
const as = readFileSync(AKAR + 'core/runtime/services/AssistantService.js', 'utf8');
cek(/cekPerintahBerulang\(perintah, riwayatPerintah\)/.test(as), 'penjaga pengulangan dipanggil di AssistantService.runCommand');
cek(/petunjukHasilKosong\(perintah, output\)/.test(as), 'petunjuk hasil kosong dipasang pada keluaran perintah');
cek(/peringatanTugasTakDiumumkan\(userMsg, teks\)/.test(as), 'peringatan umumkan-tugas dipasang di jalur ENGINEER');
const ce = readFileSync(AKAR + 'components/workbench/ConversationEngine.jsx', 'utf8');
cek(/runCommand\(cmd, riwayatPerintahDariPesan\(messages\)\)/.test(ce), 'UI mengirim riwayat perintah percakapan ini');
cek(/if \(ditolakAturan\) return;/.test(ce) && !/if \(ditolakAturan \|\| ditolakProsedur\) return;/.test(ce),
  'penolakan PROSEDUR tetap dikirim ke model (isinya perintah ganti cara), berbeda dari penolakan aturan');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
