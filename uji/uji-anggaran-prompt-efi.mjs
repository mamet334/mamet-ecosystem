import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const imp = (p) => import(pathToFileURL(path.join(AKAR, p)).href);
const baca = (p) => readFileSync(path.join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const esbuild = path.join(AKAR, 'frontend/node_modules/esbuild/bin/esbuild');
const bundel = (masuk, nama) => {
  const keluar = path.join(os.tmpdir(), `${nama}-${Date.now()}.mjs`);
  execFileSync(process.execPath, [esbuild, path.join(AKAR, masuk), '--bundle', '--format=esm', '--platform=neutral', `--outfile=${keluar}`, '--log-level=error']);
  return import(pathToFileURL(keluar).href);
};

console.log('uji-anggaran-prompt-efi v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

const AA = await imp('shared/anggaranAlat.js');
const F = await imp('shared/folderKerjaAlat.js');
const RA = await imp('shared/ragAlat.js');
const KA = await imp('shared/konektorAlat.js');
const KU = await imp('shared/konektorUmum.js');
const KC = await imp('frontend/src/core/runtime/services/KonteksChat.js');
const KM = await imp('supabase/functions/agent-process/lib/adapters/kemampuan_model.ts');
const RO = await imp('supabase/functions/agent-process/lib/adapters/reasoning_openrouter.ts');
const CJ = await imp('supabase/functions/agent-process/lib/catatan_jujur.ts');
const PD = await imp('supabase/functions/agent-process/lib/request/prompt_dasar.ts');
const UC = await bundel('supabase/functions/agent-process/lib/verification/universal_contract.ts', 'uji-efi-kontrak');

console.log('\n-- E1/E2: satu anggaran putaran alat dari Settings --');
{
  cek(AA.putaranAlatAman(undefined) === AA.PUTARAN_ALAT_BAWAAN && AA.putaranAlatAman('12') === 12 && AA.putaranAlatAman(0) === AA.PUTARAN_ALAT_BAWAAN && AA.putaranAlatAman(999) === AA.PAGAR_PUTARAN_ALAT && AA.putaranAlatAman(2.5) === AA.PUTARAN_ALAT_BAWAAN, 'setelan: bawaan bila kosong/tak sah, pagar tinggi bila berlebihan');
  const lama = AA.anggaranAlatAman({ putaran: 3 }, 4);
  cek(lama.maks === 4 && lama.sisa === 1 && lama.putaran === 3, 'klien lama (tanpa maks/sisa) tetap memakai angka lamanya', lama);
  const baru = AA.anggaranAlatAman({ putaran: 1, maks: 12, sisa: 7 }, 4);
  cek(baru.maks === 12 && baru.sisa === 7, 'klien baru: maks & sisa dari setelan pengguna', baru);
  cek(AA.anggaranAlatAman({ putaran: 0, maks: 12, sisa: 99 }, 4).sisa === 12 && AA.anggaranAlatAman({ maks: -3, sisa: -1 }, 6).maks === 6, 'sisa tak boleh melebihi maks; maks tak sah → angka lama');
  const pf = F.blokPromptFolder('proyek', 2, { maks: 12, sisa: 5 });
  cek(/Paling banyak 12 putaran alat per pertanyaan \(sisa 5\)\./.test(pf) && !/SUDAH HABIS/.test(pf), 'prompt folder menyebut anggaran & sisa yang sebenarnya');
  cek(/\(sisa 0\) — putaran alat SUDAH HABIS/.test(F.blokPromptFolder('proyek', 1, { maks: 12, sisa: 0 })), 'habis ditentukan oleh sisa anggaran bersama, bukan hitungan per jenis alat');
  cek(/Paling banyak 9 putaran alat per pertanyaan \(sisa 2\)/.test(RA.blokPromptRag({ putaran: 0, maks: 9, sisa: 2 })) && /SUDAH HABIS/.test(RA.blokPromptRag({ putaran: 0, maks: 9, sisa: 0 })), 'prompt alat RAG memakai anggaran yang sama');
  const kr = KA.infoKonektorAman({ id: 'ecosystem-crawler', putaran: 1, maks: 9, sisa: 3 });
  cek(kr.maks === 9 && kr.sisa === 3 && /Paling banyak 9 putaran alat per pertanyaan \(sisa 3\)/.test(KA.blokPromptKonektor(kr)), 'konektor crawler memakai anggaran yang sama', kr);
  const ku = KU.muatanKonektorUmumAman({ putaran: 1, maks: 9, sisa: 0, daftar: [{ id: 'srv', alat: [{ name: 'a' }] }] });
  cek(ku.maks === 9 && ku.sisa === 0 && /\(sisa 0\) — putaran alat SUDAH HABIS/.test(KU.blokPromptKonektorUmum(ku)), 'konektor umum memakai anggaran yang sama', ku);
  cek(F.susunPesanHasil([], { putaran: 7, pertanyaanAsli: 'q', maks: 12 }).startsWith('[HASIL ALAT FOLDER] putaran 7/12') && /sisa 5 putaran/.test(F.susunPesanHasil([], { putaran: 7, pertanyaanAsli: 'q', maks: 12 })) && /TERAKHIR/.test(RA.susunPesanHasilRag([], { putaran: 12, pertanyaanAsli: 'q', maks: 12 })) && KA.susunPesanHasilKonektor([], { putaran: 2, pertanyaanAsli: 'q', maks: 12 }).startsWith('[HASIL ALAT KONEKTOR] putaran 2/12'), 'pesan hasil alat menyebut nomor putaran dari anggaran bersama');
  cek(F.MAKS_ALAT_PER_PUTARAN === AA.ALAT_PER_PUTARAN && KA.MAKS_ALAT_KONEKTOR_PER_PUTARAN === AA.ALAT_PER_PUTARAN && RA.MAKS_ALAT_RAG_PER_PUTARAN === AA.ALAT_PER_PUTARAN, 'alat per putaran satu angka untuk semua jenis');
  cek(KA.BATAS_HASIL_KONEKTOR_HURUF === 60000, 'hasil konektor tidak lagi dipotong dua kali (20.000 di atas 60.000)');
  const pot = KA.uraiHasilKonektor({ ok: true, konektor: 'github', alat: 'get_file_contents', teks: 'z'.repeat(60000), terpotong: true, huruf: 90000 });
  cek(/dipotong 60000 huruf dari 90000/.test(pot) && !/kursor/.test(pot), 'pemotongan hasil konektor umum menyebut ukuran asli, tanpa menjanjikan kursor yang tak ada', pot.slice(-200));

  const AS = baca('frontend/src/core/runtime/services/AssistantService.js');
  cek(/const putaranAlatTerpakai = _folderPutaran \+ _konektorPutaran \+ _ragPutaran;\n\s*const sisaPutaranAlat = Math\.max\(0, maksPutaranAlat - putaranAlatTerpakai\);/.test(AS), 'klien: sisa = setelan − putaran semua jenis alat');
  cek((AS.match(/sisaPutaranAlat > 0\) \{/g) || []).length === 4 && !/MAKS_PUTARAN/.test(AS), 'klien: keempat gerbang putaran (konektor, folder, koreksi, RAG) memakai sisa bersama');
  cek((AS.match(/onDone: onDoneAwal,/g) || []).length === 4 && (AS.match(/_ragPutaran, _ragPertanyaan, _ragCatatan: catatanRag,/g) || []).length === 3 && (AS.match(/_konektorPutaran, _konektorPertanyaan, _konektorCatatan,/g) || []).length === 3, 'klien: setiap putaran membawa hitungan semua jenis alat (anggaran tidak ter-reset saat berganti alat)');
  cek(/user\?\.user_metadata\?\.putaran_alat/.test(AS) && /putaranAlatAman\(/.test(AS), 'klien membaca setelan putaran alat pengguna');
  cek(!/FOLDER_BATAS_BACA_BYTE/.test(AS) && /byte >= batasBacaHuruf/.test(AS) && /anggaranKonteks\(await this\.bahanAnggaranKonteks\(cfg\.model \|\| ''\)\)\.token \* 4/.test(AS), 'batas baca folder per pertanyaan = anggaran konteks Settings (bukan 150 KB tersembunyi)');
  const ST = baca('frontend/src/components/Settings.jsx');
  cek(/updateUser\(\{ data: \{ putaran_alat: kosong \? null : angkaPutaran \} \}\)/.test(ST) && /angkaPutaran > PAGAR_PUTARAN_ALAT/.test(ST) && /Putaran alat per pertanyaan/.test(ST), 'Settings: kolom putaran alat disimpan ke akun, ditolak bila di luar 1–pagar');
  const RP = baca('supabase/functions/agent-process/lib/request/request_parser.ts');
  cek(/return \{ nama, \.\.\.anggaranAlatAman\(f, MAKS_PUTARAN\) \};/.test(RP), 'server memeriksa anggaran yang dikirim klien');
}

console.log('\n-- E3: plafon jawaban dari kemampuan model --');
{
  KM.kosongkanIngatanKemampuan();
  const katalog = { data: { endpoints: [{ max_completion_tokens: 64000 }, { max_completion_tokens: 32768 }, { max_completion_tokens: null }] } };
  cek(KM.maksKeluaranDariEndpoint(katalog) === 32768 && KM.maksKeluaranDariEndpoint({}) === null, 'batas keluaran = terkecil di antara penyedia model itu (aman untuk semua rute)');
  cek(KM.plafonJawaban(32768) === 32768 && KM.plafonJawaban(4096) === RO.MAKS_TOKEN_JAWABAN && KM.plafonJawaban(null) === RO.MAKS_TOKEN_JAWABAN, 'plafon naik mengikuti model; tak pernah turun di bawah bawaan; katalog tak ada → bawaan');
  cek(KM.plafonJawaban(32768, 1200) === 1200 && KM.plafonJawaban(32768, 50000) === 32768, 'plafon yang terjangkau saldo dipakai bila lebih kecil');
  let panggilan = 0;
  const ambil = async (url) => { panggilan++; return new Response(JSON.stringify(katalog), { status: 200 }); };
  const p1 = await KM.plafonUntukPermintaan('deepseek/deepseek-v3.2', 'sk-or-kunci-uji-0001', ambil, 1000);
  const p2 = await KM.plafonUntukPermintaan('deepseek/deepseek-v3.2', 'sk-or-kunci-uji-0001', ambil, 2000);
  cek(p1 === 32768 && p2 === 32768 && panggilan === 1, 'katalog dibaca sekali lalu diingat', { p1, p2, panggilan });
  const gagalAmbil = await KM.plafonUntukPermintaan('x/model-lain', 'k', async () => { throw new Error('putus'); }, 1000);
  const http404 = await KM.plafonUntukPermintaan('x/model-404', 'k', async () => new Response('tak ada', { status: 404 }), 1000);
  cek(gagalAmbil === RO.MAKS_TOKEN_JAWABAN && http404 === RO.MAKS_TOKEN_JAWABAN, 'katalog gagal/404 → plafon bawaan, permintaan tetap jalan');
  cek(await KM.maksKeluaranModel('bukan id model', async () => { throw new Error('tak boleh dipanggil'); }) === null, 'id model tak berbentuk penyedia/nama tidak dikirim ke katalog');
  KM.ingatPlafonTerjangkau('sk-or-kunci-uji-0001', 900, 32768, 5000);
  cek(await KM.plafonUntukPermintaan('deepseek/deepseek-v3.2', 'sk-or-kunci-uji-0001', ambil, 6000) === 900, 'sesudah 402, permintaan berikutnya langsung memakai plafon yang terjangkau');
  cek(await KM.plafonUntukPermintaan('deepseek/deepseek-v3.2', 'sk-or-kunci-lain-9999', ambil, 6000) === 32768, 'ingatan plafon terjangkau tidak bocor ke kunci pengguna lain');
  cek(await KM.plafonUntukPermintaan('deepseek/deepseek-v3.2', 'sk-or-kunci-uji-0001', ambil, 5000 + KM.UMUR_PLAFON_TERJANGKAU_MS + 1) === 32768, 'ingatan plafon terjangkau kedaluwarsa (saldo bisa sudah diisi)');
  KM.ingatPlafonTerjangkau('sk-or-kunci-uji-0001', 32768, 32768, 9000);
  cek(KM.plafonTerjangkauTerakhir('sk-or-kunci-uji-0001', 9001) === null, 'plafon yang tidak diturunkan tidak dicatat sebagai "terjangkau"');
  cek(/Saldo OpenRouter sedang tipis/.test(RO.pesanTerpotongPlafon(399)) && !/[Ss]aldo OpenRouter sedang tipis/.test(RO.pesanTerpotongPlafon(32768, false)) && /BUKAN saldo habis/.test(RO.pesanTerpotongPlafon(32768, false)) && /lanjutkan/.test(RO.pesanTerpotongPlafon(32768, false)), 'pesan terpotong menyebut sebab yang benar: saldo hanya bila plafon memang diturunkan');
  KM.kosongkanIngatanKemampuan();
  const penuh = async () => new Response(JSON.stringify({ data: { endpoints: [{ max_completion_tokens: 262144, context_length: 262144 }, { max_completion_tokens: 262144, context_length: 300000 }] } }), { status: 200 });
  const pendek = await KM.plafonUntukPermintaan('deepseek/deepseek-v4-pro-0813', 'k1', penuh, 1000, 30000);
  const panjang = await KM.plafonUntukPermintaan('deepseek/deepseek-v4-pro-0813', 'k1', penuh, 1000, 600000);
  cek(pendek === 262144 - 10000 - KM.CADANGAN_TOKEN_JENDELA && panjang === 262144 - 200000 - KM.CADANGAN_TOKEN_JENDELA && pendek + 10000 < 262144 && panjang + 200000 < 262144, 'plafon + prompt selalu muat di jendela model (kasus live: batas keluaran = seluruh jendela)', { pendek, panjang });
  cek(await KM.plafonUntukPermintaan('deepseek/deepseek-v4-pro-0813', 'k1', penuh, 1000, 900000) === RO.MAKS_TOKEN_JAWABAN, 'prompt hampir memenuhi jendela → plafon tak turun di bawah bawaan (bukan nol/negatif)');
  cek(KM.plafonDalamJendela(32768, null, 999999) === 32768 && KM.plafonDalamJendela(32768, 200000, 3000) === 32768, 'jendela tak diketahui / ruang cukup → plafon tak diubah');
  const AD = baca('supabase/functions/agent-process/lib/adapters/ai_adapter.ts');
  cek((AD.match(/plafonUntukPermintaan\((openRouterModel|orModel), this\.rctx\.keys\.openRouter, fetch, Date\.now\(\), JSON\.stringify\(messages \|\| \[\]\)\.length\)/g) || []).length === 2, 'kedua jalur OpenRouter mengirim ukuran prompt ke penghitung plafon');
  cek((AD.match(/pesanTerpotongPlafon\(plafon, plafon < plafonDiminta(Stream)?\)/g) || []).length === 2 && (AD.match(/ingatPlafonTerjangkau\(this\.rctx\.keys\.openRouter, jejakPlafon(Stream)?\.plafonDipakai, plafonDiminta(Stream)?\)/g) || []).length === 2, 'kedua jalur OpenRouter memakai plafon model, mengingat yang terjangkau, dan memberi sebab terpotong yang benar');
}

console.log('\n-- E4/H: sub-agen yang berhenti disebut apa adanya --');
{
  const w = CJ.catatanSubagenBerhenti('researcher', 'waktu', '12 detik');
  cek(/^\[CATATAN SISTEM\] Sub-agent "researcher" dihentikan karena melewati batas waktu 12 detik\./.test(w) && /Hasilnya TIDAK ADA/.test(w) && /jangan mengarang/.test(w), 'batas waktu: sebab, dan perintah tidak mengarang hasil', w);
  cek(/gagal \(HTTP 500\)/.test(CJ.catatanSubagenBerhenti('scraper', 'gagal', 'HTTP 500')) && /batas waktu total sub-agent \(24 detik\)/.test(CJ.catatanSubagenBerhenti('a, b', 'waktu-total', '24 detik')), 'gagal & batas waktu total punya kalimat sendiri');
  cek(!/[\r\n`]/.test(CJ.catatanSubagenBerhenti('x`\ny', 'gagal', 'baris1\nbaris2`')), 'nama & sebab dibersihkan dari baris baru/backtick');
  cek(/3 tugas sub-agent tidak dijalankan karena batas 5 tugas/.test(CJ.catatanTugasSubagenDilewati(3, 5)), 'tugas yang dilewati disebut jumlahnya');
  const berkas = [];
  const jelajah = (d) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) { if (n !== 'node_modules') jelajah(p); } else if (/\.ts$/.test(n)) berkas.push(p); } };
  jelajah(path.join(AKAR, 'supabase/functions'));
  const sisa = berkas.filter((p) => /MAMET HEALER|Mamet Healer|Hard Timeout Gated|gagal terisolasi/.test(readFileSync(p, 'utf8'))).map((p) => path.relative(AKAR, p));
  cek(sisa.length === 0, 'tak ada lagi label "MAMET HEALER" / istilah pemasaran di server', sisa);
  const EH = baca('supabase/functions/agent-process/lib/orchestration/handlers/execution_handler.ts');
  cek(/accumulatedContext \+= catatanTugasSubagenDilewati\(lewat, MAKS_TUGAS_SUBAGEN\);/.test(EH) && /accumulatedContext \+= catatanSubagenBerhenti\(sisaTugas\.join\(', '\), 'waktu-total'/.test(EH), 'tugas yang dilewati & batas waktu total sampai ke model (bukan hanya log)');
  const TS = baca('supabase/functions/agent-process/lib/event/subscribers/tool_subscriber.ts');
  cek(/subagentResText = catatanSubagenBerhenti\(subagent, 'waktu', `\$\{batasWaktuMs \/ 1000\} detik`\);/.test(TS) && /subagentResText = catatanSubagenBerhenti\(subagent, 'gagal'/.test(TS), 'hasil sub-agen yang berhenti berisi catatan jujur');
}

console.log('\n-- F: hasil web tidak diringkas ulang --');
{
  const CB = baca('supabase/functions/agent-process/lib/orchestration/handlers/context_builder.ts');
  cek(!/summarizeWebDoc|WEB_CONTEXT_|runLLM|diringkas\]/.test(CB) && /const processedExternalDocs = externalDocs;/.test(CB), 'server: tak ada panggilan LLM peringkas & tak ada pemotongan artikel web');
  const artikel = (n, huruf) => `--- Konteks ${n} [Sumber: Berita Web — https://contoh.id/${n}] ---\nJudul: Artikel ${n}\n${String(n).repeat(huruf)}\n\n`;
  const awalan = '[DOKUMEN PENGETAHUAN & REFERENSI BERITA/WEB]:\n';
  const teks = awalan + artikel(1, 3000) + artikel(2, 3000) + artikel(3, 3000) + artikel(4, 3000);
  const utuh = KC.bagiAnggaranKonteks(100000, teks);
  cek(utuh.teks === teks && utuh.hurufDipotong === 0 && utuh.artikelDilewati === 0, 'anggaran cukup → semua artikel utuh');
  const sempit = KC.bagiAnggaranKonteks(4000, teks);
  cek(sempit.artikelDilewati === 2 && sempit.teks.includes('1'.repeat(3000)) && sempit.teks.includes('2'.repeat(3000)) && !sempit.teks.includes('--- Konteks 3') && !/3{20}/.test(sempit.teks), 'anggaran sempit → artikel pertama (paling relevan) utuh, sisanya dilewati per artikel — tak ada artikel terpotong di tengah', { dilewati: sempit.artikelDilewati, huruf: sempit.teks.length });
  cek(/2 artikel\/konteks terakhir \([\d.]+ huruf\) tidak dikirim karena anggaran konteks di Settings; 2 artikel pertama dikirim utuh/.test(sempit.teks), 'model diberi tahu berapa artikel yang tidak dikirim');
  const satuBesar = KC.bagiAnggaranKonteks(1000, awalan + artikel(1, 9000));
  cek(satuBesar.artikelDilewati === 0 && satuBesar.hurufDipotong > 0 && /huruf konteks dokumen\/web\/memori tidak dikirim/.test(satuBesar.teks), 'artikel pertama pun tak muat → dipotong dengan catatan (bukan dibuang seluruhnya)');
  cek(KC.bagiAnggaranKonteks(8000, 'y'.repeat(50000)).hurufDipotong === 50000 - 16000, 'teks tanpa penanda artikel: perilaku lama tetap');
}

console.log('\n-- G: isi resource konektor (bentuk balasan server GitHub: get_file_contents) --');
const KMcp = (await imp('frontend/electron/konektorMcp.cjs')).default;
{
  const isiReadme = '# Mamet Ecosystem\n\nBaris kedua README dengan angka 12345.';
  const github = KMcp.teksHasil({ content: [
    { type: 'text', text: 'successfully downloaded text file (SHA: 3f2a9c1)' },
    { type: 'resource', resource: { uri: 'repo://mamet334/mamet-ecosystem/sha/3f2a9c1/contents/README.md', mimeType: 'text/plain; charset=utf-8', text: isiReadme } },
  ] });
  cek(github.teks.includes(isiReadme) && github.teks.includes('successfully downloaded text file') && github.teks.includes('contents/README.md'), 'isi berkas dari resource tertanam sampai ke teks hasil, beserta alamatnya', github.teks);
  cek(!/\[isi resource\]/.test(github.teks), 'tidak ada lagi penanda kosong "[isi resource]"', github.teks);
  const blobTeks = KMcp.teksHasil({ content: [{ type: 'resource', resource: { uri: 'repo://x/y/contents/INIT.md', mimeType: 'text/markdown', blob: Buffer.from('# INIT\nperintah 0: baca konstitusi — é', 'utf8').toString('base64') } }] });
  cek(blobTeks.teks.includes('perintah 0: baca konstitusi — é'), 'resource teks berbentuk blob (base64) didekode utuh, termasuk huruf non-ASCII', blobTeks.teks);
  const blobJson = KMcp.teksHasil({ content: [{ type: 'resource', resource: { uri: 'repo://x/y/contents/package.json', mimeType: 'application/json', blob: Buffer.from('{"name":"mamet"}').toString('base64') } }] });
  cek(blobJson.teks.includes('{"name":"mamet"}'), 'blob JSON dikenali sebagai teks', blobJson.teks);
  const biner = KMcp.teksHasil({ content: [{ type: 'resource', resource: { uri: 'repo://x/y/contents/logo.png', mimeType: 'image/png', blob: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]).toString('base64') } }] });
  cek(/resource biner .*logo\.png .*image\/png .*8 byte/.test(biner.teks) && /tidak diteruskan/.test(biner.teks) && !biner.teks.includes('\u0000'), 'resource biner disebut apa adanya (alamat, jenis, ukuran), bukan diam atau sampah', biner.teks);
  const binerMengakuTeks = KMcp.teksHasil({ content: [{ type: 'resource', resource: { uri: 'repo://x/y/contents/a.bin', mimeType: 'text/plain', blob: Buffer.from([0xff, 0xfe, 0, 0x41]).toString('base64') } }] });
  cek(/resource biner/.test(binerMengakuTeks.teks), 'blob berlabel teks tetapi berisi byte biner tidak diteruskan sebagai teks', binerMengakuTeks.teks);
  const arsip = KMcp.teksHasil({ content: [{ type: 'resource', resource: { uri: 'repo://x/y/contents/rilis.zip', mimeType: 'application/zip', blob: Buffer.from('PK-ISI-ARSIP-ASCII').toString('base64') } }] });
  cek(/resource biner .*rilis\.zip .*application\/zip/.test(arsip.teks) && !arsip.teks.includes('PK-ISI-ARSIP-ASCII'), 'blob berjenis bukan-teks tidak diteruskan walau byte-nya kebetulan terbaca sebagai huruf', arsip.teks);
  const tanpaJenis = KMcp.teksHasil({ content: [{ type: 'resource', resource: { uri: 'repo://x/y/contents/CATATAN', blob: Buffer.from('catatan tanpa jenis').toString('base64') } }] });
  cek(tanpaJenis.teks.includes('catatan tanpa jenis'), 'blob tanpa keterangan jenis yang isinya teks tetap diteruskan', tanpaJenis.teks);
  const tautan = KMcp.teksHasil({ content: [{ type: 'resource_link', uri: 'repo://x/y/contents/docs', name: 'docs', description: 'folder dokumen' }] });
  cek(/tautan resource repo:\/\/x\/y\/contents\/docs · docs — folder dokumen/.test(tautan.teks) && /belum dibaca/.test(tautan.teks), 'tautan resource disebut sebagai tautan yang belum dibaca', tautan.teks);
  const gambar = KMcp.teksHasil({ content: [{ type: 'image', mimeType: 'image/png', data: 'AAAA' }, { type: 'aneh' }] });
  cek(/isi image · image\/png — bukan teks/.test(gambar.teks) && /jenis ini tidak dikenali/.test(gambar.teks) && !gambar.teks.includes('AAAA'), 'gambar & jenis tak dikenal diberi keterangan, datanya tidak ikut', gambar.teks);
  const panjangResource = KMcp.teksHasil({ content: [{ type: 'resource', resource: { uri: 'repo://x/y/contents/besar.md', mimeType: 'text/markdown', text: 'y'.repeat(KMcp.BATAS.hasilHuruf + 500) } }] });
  cek(panjangResource.terpotong && panjangResource.teks.length === KMcp.BATAS.hasilHuruf && panjangResource.huruf > KMcp.BATAS.hasilHuruf, 'resource panjang ikut batas hasil & ditandai terpotong', { ...panjangResource, teks: undefined });
}

console.log('\n-- I: prompt sistem ramping & benar secara harfiah --');
{
  const waktu = 'KONTEKS WAKTU (DATA SISTEM): Senin, 10 November 2026 pukul 08.00 WIB (zona Asia/Jakarta).';
  const ada = PD.susunPromptDasar({ konteksWaktu: waktu, adaPengetahuanDisuntik: true, model: 'deepseek/deepseek-v3.2', memoryEnabled: true });
  const tanpa = PD.susunPromptDasar({ konteksWaktu: waktu, adaPengetahuanDisuntik: false, model: '', memoryEnabled: false });
  cek(ada.length < 1900 && tanpa.length < 1900, `prompt dasar < 1.900 huruf (dulu ±3.500): ${ada.length} / ${tanpa.length}`);
  cek(ada.includes(waktu) && /Anda "Mamet"/.test(ada) && /deepseek\/deepseek-v3\.2/.test(ada) && /<think>\.\.\.<\/think>/.test(ada) && /Bahasa Indonesia/.test(ada) && /\[BLOK 6: OUTPUT FORMAT & STATUS LABEL\]/.test(ada) && /[Jj]angan pernah mengarang fakta/.test(ada) && /Memory Governor/.test(ada), 'yang mengarahkan tetap ada: waktu, identitas, model, nalar tampil, label, kejujuran, memori');
  cek(!/2024|2025/.test(ada + tanpa) && !/hak paten|Google|OpenAI|gemini-2\.5-flash/.test(ada + tanpa) && /Model yang sedang menggerakkan Anda: tidak diketahui/.test(tanpa), 'tak ada klaim yang bisa salah: batas pengetahuan bertanggal, "hak paten", model bawaan palsu');
  cek(/SEDANG DIMATIKAN/.test(tanpa) && !/SEDANG DIMATIKAN/.test(ada) && /Tools → Memory/.test(tanpa), 'memori mati/nyala tetap dibedakan');
  cek(!/Tidak ada dokumen RAG\/Web/.test(tanpa) && /Bila konteks di bawah tidak memuat dokumen/.test(tanpa), 'tanpa dokumen dari klien: kalimatnya bersyarat (RAG server bisa menemukan dokumen sesudahnya)');
  cek((ada.match(/\[STATUS: /g) || []).length === 0, 'aturan label tidak diulang di prompt dasar (satu sumber: BLOK 6)');
  cek(/xml_zip/.test(PD.petunjukZip('tolong buatkan ZIP berisi halaman html')) && PD.petunjukZip('bandingkan dua changelog') === '', 'petunjuk ZIP hanya bila pengguna menyebut zip');
  cek(PD.petunjukZip('[HASIL ALAT RAG] putaran 1/8\nisi dokumen menyebut zip') === '' && PD.petunjukZip('[HASIL ALAT FOLDER] putaran 1/8\narsip.zip') === '' && PD.petunjukZip('[TERMINAL OUTPUT for: dir]\na.zip') === '' && PD.petunjukZip('berkas unzipped') === '', 'kata "zip" di hasil alat / keluaran perintah / potongan kata tidak memicu petunjuk ZIP (temuan live 10 Nov)');
  const PL = baca('supabase/functions/agent-process/lib/request/request_pipeline.ts');
  cek(!/PERINTAH SANGAT PENTING DARI SISTEM/.test(PL) && !/finalMessage \+= /.test(PL) && /agentIdentityPrompt \+= petunjukZip\(parsed\.message\);/.test(PL), 'pipeline tak lagi menyisipkan "perintah sistem" ke pesan pengguna');

  const dasar = {
    appSource: 'assistant', userId: 'u', brain1Entries: [], brain2Tasks: [], brain2Gaps: [], brain2Verifications: [],
    ragArray: [], memoryArray: [], memoryContextText: '', brain1ContextText: '', brain2ContextText: '', ragContextText: '',
    policyConstraints: [], policyForbidden: [], systemBasePrompt: '',
    evidenceReport: { verdict: 'PASSED', totalEvidence: 1, isValid: true, requestId: 'uji', items: [], evidenceItems: [] },
    confidenceReport: { score: 70, grade: 'B', sourceTrace: [], signals: { versionStatus: 'CURRENT' } },
  };
  const asisten = UC.buildUniversalContract({ ...dasar, mode: 'ASSISTANT' }).asSystemPromptText();
  const engineer = UC.buildUniversalContract({ ...dasar, mode: 'ENGINEER', appSource: 'engineer' }).asSystemPromptText();
  const lite = UC.buildUniversalContract({ ...dasar, mode: 'LITE', appSource: 'mametlite' }).asSystemPromptText();
  cek(!/═/.test(asisten + engineer) && asisten.includes('[UNIVERSAL EVIDENCE CONTRACT v2.0]'), 'garis hias dibuang; penanda kontrak tetap (dipakai pengukur Tahap 0)');
  cek(!/git baca|KODE|ADR|Brain 1: KOSONG|Brain 2: KOSONG|Kapabilitas:/.test(asisten), 'Assistant: tak ada larangan/keterangan khusus Engineer, tak ada klaim kapabilitas yang belum tentu benar', asisten.slice(0, 900));
  cek(/Menyebut dokumen, judul, atau sumber yang tidak ada di BLOK 4/.test(asisten) && /\(tidak ada dokumen yang disertakan pada pesan ini\)/.test(asisten) && /\[BLOK 6: OUTPUT FORMAT & STATUS LABEL\]/.test(asisten) && /\[STATUS: VERIFIED\]/.test(asisten), 'Assistant: larangan umum, keterangan tanpa dokumen, dan aturan label tetap ada');
  cek(/git baca/.test(engineer) && /Brain 1: KOSONG/.test(engineer) && /Kapabilitas:/.test(engineer) && /SOURCE TRACE/.test(engineer), 'Engineer: aturan & keterangannya tidak berubah');
  cek(/Kapabilitas: Menjawab pertanyaan umum, RAG retrieval dari Knowledge Base/.test(lite) && /Tidak boleh membaca\/menulis User Memory/.test(lite), 'Mametlite (LITE): kapabilitas & batasannya tetap');
  const denganRag = UC.buildUniversalContract({ ...dasar, mode: 'ASSISTANT', ragArray: [{}], ragContextText: '[DOC-0001] isi' }).asSystemPromptText();
  cek(/<RAG>\n\[DOC-0001\] isi\n<\/RAG>/.test(denganRag) && /ATURAN KUTIPAN PERSIS/.test(denganRag) && !/tidak ada dokumen yang disertakan/.test(denganRag), 'dengan dokumen: blok RAG & aturan kutipan persis tetap');
  cek(asisten.length < 2300, `kontrak Assistant tanpa dokumen ${asisten.length} huruf`);
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
