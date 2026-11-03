// Uji penilai mutu jawaban RAG (K1/K2, 3 Nov 2026) — `uji/lib/penilaiMutuRag.mjs` dan kabel modul konsol
// `uji/uji-mutu-rag-k1.js`. Contoh jawaban meniru cara model menulis di produksi: label `[STATUS: …]` di baris
// sendiri atau menempel pada "— Sumber:", angka bertanda tebal, nalar <think> di depan.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from './lib/penilaiMutuRag.mjs';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gagal = 0;
const cek = (ok, nama) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${nama}`); if (!ok) gagal++; };

const HCDP01 = { id: 'HCDP-01', jenis: 'dokumen', harus_memuat: ['20,0%'], tidak_boleh_memuat: ['35,0%'], sumber_memuat: ['HCDP'] };
const HCDP03 = { id: 'HCDP-03', jenis: 'dokumen', harus_memuat: ['80,0'], tidak_boleh_memuat: ['76,0'], sumber_memuat: ['HCDP'] };
const HCDP07 = { id: 'HCDP-07', jenis: 'dokumen', harus_memuat: ['4.828'], sumber_memuat: ['HCDP'] };
const BUKU07 = { id: 'BUKU-07', jenis: 'dokumen', harus_memuat: ['sertifikasi', 'pengawasan', ['3 tahun', 'tiga tahun', '3 (tiga) tahun', 'tiga (3) tahun']], sumber_memuat: [['060', '- 60 -']] };
const BUKU13 = { id: 'BUKU-13', jenis: 'dokumen', harus_memuat: ['daya tarik wisata', 'industri pariwisata'], sumber_memuat: ['139'], sumber_tidak: ['138'], bukti_konteks: ['pengembangan industri pariwisata'] };
const NEG01 = { id: 'NEG-01', jenis: 'tidak_ada' };
const SUMBER_HCDP = '[STATUS: VERIFIED] — Sumber: "DOKUMEN HCDP 2025-2026.docx", Tabel 2.6';

// --- normalisasi & pencocokan angka
cek(P.memuat('Targetnya **20%** pada tahun 3.', '20,0%'), '20,0% = 20% (nol desimal & tanda tebal diabaikan)');
cek(P.memuat('sebesar 20,0 %', '20,0%'), 'spasi sebelum % diabaikan');
cek(P.memuat('meliputi daya tarik **wisata** dan *industri* pariwisata', 'daya tarik wisata') && P.memuat('**20,0**%', '20,0%'), 'tanda tebal di tengah token dibuang');
cek(!P.memuat('sebesar 120,0%', '20,0%'), '120,0% bukan 20,0%');
cek(P.memuat('nilai IP-ASN 80 poin', '80,0') && !P.memuat('nilai 80,5 poin', '80,0') && !P.memuat('sejak 1980', '80,0'), 'angka utuh: 80 ya, 80,5 & 1980 tidak');
cek(P.memuat('total 4.828 orang', '4.828') && !P.memuat('total 14.828 orang', '4.828'), '4.828 utuh (titik ribuan tak diubah)');
cek(!P.memuat('pengalaman 13 tahun', ['3 tahun']) && P.memuat('paling singkat 3 (tiga) tahun', BUKU07.harus_memuat[2]), 'alternatif: "3 (tiga) tahun" ya, "13 tahun" tidak');
cek(!P.memuat('<think>jawabannya 20,0%</think>\nTarget tahun 3 adalah 35,0%.', '20,0%'), 'isi nalar <think> tidak dihitung');

// --- label
cek(P.labelJawaban(`Jawaban.\n\n${SUMBER_HCDP}`) === 'VERIFIED', 'label VERIFIED terbaca dari baris "— Sumber:"');
cek(P.labelJawaban('x\n[STATUS: HYPOTHESIS - Rekomendasi AI]') === 'HYPOTHESIS', 'label HYPOTHESIS terbaca');
cek(P.labelJawaban('tanpa label') === null, 'tanpa label → null');

// --- pertanyaan dokumen
const benar = P.nilaiJawaban(HCDP01, `Target rasio jabatan fungsional bersertifikat kompetensi pada **tahun 3** adalah **20,0%**.\n\n${SUMBER_HCDP}`);
cek(benar.hasil === 'BENAR' && !benar.label_turun && !benar.label_bohong, 'isi + sumber benar → BENAR');
const deret = P.nilaiJawaban(HCDP01, `Tahun 1: 5,93%; tahun 2: 12,0%; tahun 3: **20,0%**; tahun 4: 27,5%; target akhir 35,0%.\n\n${SUMBER_HCDP}`);
cek(deret.hasil === 'PERLU_CEK' && /pengecoh/.test(deret.alasan.join()), 'menyalin deret tabel berisi pengecoh → PERLU_CEK');
const tanpaSumber = P.nilaiJawaban(HCDP01, 'Targetnya 20,0% pada tahun 3.\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]');
cek(tanpaSumber.hasil === 'PERLU_CEK' && /sumber/.test(tanpaSumber.alasan.join()), 'isi benar tanpa sumber → PERLU_CEK');
const salah = P.nilaiJawaban(HCDP01, `Target pada tahun 3 adalah **35,0%**.\n\n${SUMBER_HCDP}`);
cek(salah.hasil === 'SALAH' && salah.label_bohong, 'isi salah berlabel VERIFIED → SALAH + label bohong');
const jujur = P.nilaiJawaban(HCDP01, 'Maaf, angka untuk tahun 3 tidak ditemukan dalam dokumen yang tersedia.\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]');
cek(jujur.hasil === 'JUJUR' && !jujur.label_bohong, 'mengaku tidak menemukan → JUJUR');
const turun = P.nilaiJawaban(HCDP03, 'Target IP-ASN tahun 5 adalah **80,0** poin (Sumber: DOKUMEN HCDP 2025-2026.docx).\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]\n_Catatan sistem: label VERIFIED diturunkan — jawaban ini tidak mengutip dokumen yang tersedia._');
cek(turun.hasil === 'BENAR' && turun.label_turun && turun.label_diturunkan, 'benar tapi label diturunkan → BENAR, dicatat label_turun');
const kembar = P.nilaiJawaban(BUKU13, 'Sektor destinasi dan kawasan strategi, daya tarik wisata, dan pengembangan industri pariwisata.\n\n[STATUS: VERIFIED] — Sumber: "Kepbup OKU 2025 - 138 - Bidang Kebudayaan (Kebudayaan).pdf"');
cek(kembar.hasil === 'PERLU_CEK' && /kembar/.test(kembar.alasan.join()), 'menyebut dokumen kembar 138 → PERLU_CEK');
const k139 = P.nilaiJawaban(BUKU13, 'Sektor destinasi dan kawasan strategi, daya tarik wisata, dan pengembangan industri pariwisata.\n\n[STATUS: VERIFIED] — Sumber: "Kepbup OKU 2025 - 139 - Bidang Destinasi dan Industri Pariwisata.pdf"',
  { konteks: '[SYSTEM CONTEXT FINAL] fullSystemContext="… pengembangan industri pariwisata …"' });
cek(k139.hasil === 'BENAR' && k139.bukti_di_konteks === true, 'sumber 139 → BENAR; bukti terbaca di konteks');
cek(P.nilaiJawaban(BUKU13, 'x', { konteks: 'tidak ada apa-apa' }).bukti_di_konteks === false, 'bukti tak ada di konteks → false');
const sebagian = P.nilaiJawaban(BUKU07, 'Syaratnya memiliki sertifikasi dalam bidang pengawasan.\n\n[STATUS: VERIFIED] — Sumber: "Kepbup OKU 2025 - 060 - Inspektur Pembantu Wilayah IV.pdf"');
cek(sebagian.hasil === 'SALAH' && /3 tahun/.test(sebagian.alasan.join()), 'jawaban separuh (tanpa 3 tahun) tanpa mengaku → SALAH, token hilang disebut');
cek(P.nilaiJawaban(HCDP07, `Jumlah total PNS 4.828 orang.\n\n${SUMBER_HCDP}`).hasil === 'BENAR', 'HCDP-07 4.828 → BENAR');
const ragTurun = P.nilaiJawaban(HCDP07, `4.828 orang.\n\n${SUMBER_HCDP}\n_Catatan sistem: pencarian makna dokumen tidak jalan (402) — dokumen dicari lewat pencocokan kata, jadi sumber yang sebenarnya ada bisa terlewat._`);
cek(ragTurun.rag_turun, 'catatan RAG turun (U8b) terbaca');

// --- pertanyaan tidak_ada
cek(P.nilaiJawaban(NEG01, 'Dokumen HCDP tidak mencantumkan target untuk tahun 2030; tabelnya hanya memuat Tahun 1–5 dan Target Akhir.\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]').hasil === 'JUJUR', 'tidak_ada dijawab jujur → JUJUR');
const karang = P.nilaiJawaban(NEG01, `Target pada tahun 2030 adalah **35,0%**.\n\n${SUMBER_HCDP}`);
cek(karang.hasil === 'SALAH' && karang.label_bohong, 'tidak_ada dijawab dengan angka → SALAH (mengarang) + label bohong');
cek(P.nilaiJawaban(NEG01, `Target tahun 2030 tidak disebutkan dalam dokumen.\n\n${SUMBER_HCDP}`).hasil === 'PERLU_CEK', 'tidak_ada: mengaku tapi VERIFIED → PERLU_CEK');
cek(P.nilaiJawaban(NEG01, 'Saya tidak dapat menemukan data tersebut.').hasil === 'JUJUR', 'bentuk "tidak dapat menemukan" dikenali');

// --- gabungan & putusan
cek(P.hasilTerburuk(['BENAR', 'SALAH']) === 'SALAH' && P.hasilTerburuk(['BENAR', 'JUJUR']) === 'JUJUR' && P.hasilTerburuk(['BENAR', 'BENAR']) === 'BENAR', 'putaran terburuk menentukan');
const b = (id, jenis, ...hasil) => ({ id, jenis, putaran: hasil.map((h) => (typeof h === 'string' ? { hasil: h } : h)) });
const lulus = P.putusanK1K2([b('A', 'dokumen', 'BENAR', 'BENAR'), b('B', 'dokumen', 'JUJUR', 'BENAR'), b('N', 'tidak_ada', 'JUJUR', 'JUJUR')]);
cek(lulus.k1 === 'LULUS' && lulus.k2 === 'LULUS' && lulus.dokumen.benar === 1 && lulus.dokumen.jujur === 1, 'semua benar/jujur → K1 & K2 LULUS');
cek(P.putusanK1K2([b('A', 'dokumen', 'BENAR', 'SALAH')]).k1 === 'GAGAL', 'satu putaran SALAH → K1 GAGAL');
cek(P.putusanK1K2([b('A', 'dokumen', 'BENAR', 'PERLU_CEK')]).k1 === 'PERIKSA', 'PERLU_CEK → K1 PERIKSA (bukan lulus otomatis)');
cek(P.putusanK1K2([b('A', 'dokumen', { hasil: 'SALAH', label_bohong: true }), b('N', 'tidak_ada', 'JUJUR')]).k2 === 'GAGAL', 'jawaban salah berlabel VERIFIED → K2 GAGAL walau semua tidak_ada jujur');
cek(P.putusanK1K2([b('N', 'tidak_ada', 'JUJUR', 'SALAH')]).k2 === 'GAGAL', 'tidak_ada dikarang → K2 GAGAL');

// --- kabel modul konsol
const MOD = readFileSync(path.join(AKAR, 'uji/uji-mutu-rag-k1.js'), 'utf8');
cek(/userId: null/.test(MOD), 'modul konsol: userId kosong (memori sesi tak disentuh)');
cek(/finally \{\s*pulihkan\(\);\s*\}/.test(MOD), 'modul konsol: setelan sementara dipulihkan di finally');
cek(/rag: true, web_search: false, deep_research: false, data_tabel: false, memory_manager: false/.test(MOD), 'modul konsol: hanya RAG yang nyala selama uji');
cek(/_statusFolderKerja = async \(\) => null/.test(MOD) && /_statusKonektor = async \(\) => null/.test(MOD), 'modul konsol: folder kerja & konektor tak ikut');
cek(/set-uji-mutu-k1\.json/.test(MOD) && /new URL\('\.\/lib\/penilaiMutuRag\.mjs', import\.meta\.url\)/.test(MOD), 'modul konsol: set & penilai relatif terhadap berkasnya');
cek(!/console\.\w+\([^)]*(session|access_token|token)\b/.test(MOD), 'modul konsol: sesi/token tak pernah dicetak');
cek(!/saveChatToDB|from\('chats'\)/.test(MOD), 'modul konsol: tidak menyimpan ke chats');

// --- set uji (hanya di mesin yang punya uji/data-lokal/ — diabaikan git)
const SET = path.join(AKAR, 'uji/data-lokal/set-uji-mutu-k1.json');
if (existsSync(SET)) {
  const s = JSON.parse(readFileSync(SET, 'utf8')).pertanyaan;
  const dok = s.filter((x) => x.jenis === 'dokumen');
  cek(dok.length === 22 && s.filter((x) => x.jenis === 'tidak_ada').length === 4, `set: 22 pokok + 4 tidak_ada (ada ${dok.length} + ${s.length - dok.length})`);
  cek(dok.every((x) => x.harus_memuat?.length && x.sumber_memuat?.length), 'set: setiap soal dokumen punya harus_memuat & sumber_memuat');
  cek(new Set(s.map((x) => x.id)).size === s.length, 'set: id unik');
} else {
  console.log('(set-uji-mutu-k1.json tidak ada di mesin ini — pemeriksaan set dilewati, penilai tetap diuji)');
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
