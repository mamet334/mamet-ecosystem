import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const imp = (p) => import(pathToFileURL(join(AKAR, p)).href);
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');

const J = await imp('supabase/functions/agent-process/lib/jejak_prompt.ts');
const H = await imp('supabase/functions/agent-process/lib/request/history_compressor.ts');
const P = await imp('supabase/functions/agent-process/lib/request/request_parser.ts');
const K = await imp('frontend/src/core/runtime/services/JejakKlien.js');
const G = await imp('uji/lib/gerbangJejak.mjs');

console.log('uji-jejak-prompt v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

const RAHASIA = 'RAHASIA-ISI-PESAN-7731';
const panjang = (n, awal = '') => (awal + ' ' + 'kata '.repeat(n)).slice(0, n);
const percakapan = (n, opsi = {}) => Array.from({ length: n }, (_, i) => ({
  role: i % 2 ? 'model' : 'user',
  content: `${i % 2 ? '<think>nalar lama</think> ' : ''}${RAHASIA} ${panjang(opsi.huruf ?? 1200, `pesan ${i}`)}${i % 2 && opsi.tag ? ' <call:folder_list>' : ''}`,
}));

const terimaParser = async (body) => P.parseRequestParams(new Request('http://uji/', { method: 'POST', body: JSON.stringify(body) }), { user_metadata: {} });

console.log('\n-- ukuran riwayat (shared, dipakai klien & server) --');
{
  const folder = '[HASIL ALAT FOLDER] putaran 1/4\nisi';
  const konektor = '  [HASIL ALAT KONEKTOR] putaran 1/6';
  const r = J.ukurRiwayat([
    { role: 'user', content: 'abc' },
    { role: 'user', content: folder },
    { role: 'user', content: konektor },
    { role: 'model', content: 'jawab', _patok: true },
    { role: 'model', content: null },
    { role: 'user', content: 'teks yang menyebut [HASIL ALAT FOLDER] di tengah' },
  ]);
  const tengah = 'teks yang menyebut [HASIL ALAT FOLDER] di tengah'.length;
  cek(r.pesan === 6 && r.huruf === 3 + folder.length + konektor.length + 5 + tengah, `pesan & huruf dihitung (${r.pesan}/${r.huruf})`, r);
  cek(r.hasilAlatPesan === 2 && r.hasilAlatHuruf === folder.length + konektor.length, `hasil alat folder & konektor dikenali, penyebutan di tengah teks tidak (${r.hasilAlatPesan})`, r);
  cek(r.patok === 1, 'sisipan berpatok dihitung', r);
  const kl = K.susunJejakKlien({ jalur: 'CONVERSATION', traceId: 't1', riwayatTersedia: percakapan(4), dikirim: percakapan(3), konteksRag: { sebelum: 9000, sesudah: 4040 }, cmg: 'ALLOW', anggaran: { token: 6000, terpakai: 5000, dilewati: 1 } });
  cek(kl.riwayatTersedia.pesan === 4 && kl.dikirim.pesan === 3 && kl.konteksRag.sesudah === 4040 && kl.anggaran.dilewati === 1, 'jejak klien memakai pengukur yang sama', kl);
  cek(!JSON.stringify(kl).includes(RAHASIA), 'jejak klien tidak membawa isi pesan');
}

console.log('\n-- parser: riwayat asli, tag call, batas 15 pesan --');
{
  const riwayat = percakapan(20, { huruf: 300, tag: true });
  const p = await terimaParser({ message: 'halo', tools: [], history: riwayat });
  cek(p.riwayatAsli.length === 20 && p.riwayatSesudahTag.length === 20, 'riwayat asli & sesudah tag tetap 20 pesan');
  cek(p.riwayatAsli[1].content.includes('<call:folder_list>'), 'riwayat asli tidak ikut diubah (tak dimutasi di tempat)');
  cek(!p.riwayatSesudahTag[1].content.includes('<call:'), 'tag <call:…> dibuang sesudah tag');
  cek(p.history.length === 12 && p.healerDisisipkan === true, `riwayat > 15 pesan dipangkas ke 12 dengan catatan sisipan (${p.history.length})`);
  const jp = J.buatJejak({ riwayatDiterima: J.ukurRiwayat(p.riwayatAsli) });
  J.catatLapis(jp, 'parser_15_pesan', p.riwayatSesudahTag, p.history, { pesanDisisipkan: 1 });
  cek(jp.lapisRiwayat[0].pesanDipotong === 0, `parser membuang & menyisipkan, tidak memendekkan — tak salah hitung karena urutan bergeser (${jp.lapisRiwayat[0].pesanDipotong})`);
  const geser = [{ content: 'a'.repeat(50) }, { content: 'b'.repeat(900) }, { content: 'c'.repeat(900) }, { content: 'd'.repeat(10) }];
  const jg = J.buatJejak({ riwayatDiterima: J.ukurRiwayat(geser) });
  J.catatLapis(jg, 'uji', geser, [geser[0], geser[2]]);
  cek(jg.lapisRiwayat[0].pesanDipotong === 0, 'pesan yang dibuang tidak dihitung sebagai dipendekkan');
  const pendek = await terimaParser({ message: 'halo', tools: [], history: percakapan(4, { huruf: 50 }) });
  cek(pendek.history.length === 4 && pendek.healerDisisipkan === false, 'riwayat pendek tidak disentuh parser');
}

console.log('\n-- siapkanRiwayatUntukModel: lapis yang benar-benar dijalankan --');
{
  const jejak = J.buatJejak({ riwayatDiterima: J.ukurRiwayat([]) });
  const nip = 'Ada 2 pejabat.\n\n---\n**Data Tabel — 2 orang** · tiruan\n| 1 | Budi | 197601012000011001 |';
  const riwayat = [
    ...percakapan(6, { huruf: 1500 }),
    { role: 'model', content: nip },
    { role: 'user', content: 'pertanyaan sekarang' },
  ];
  const hasil = H.siapkanRiwayatUntukModel(riwayat, 'pertanyaan sekarang', jejak);
  const nama = jejak.lapisRiwayat.map((l) => l.nama);
  cek(nama.join(',') === 'buang_think,rapikan_riwayat,bersihkan_data_tabel', `tiga lapis tercatat berurutan (${nama.join(', ')})`);
  const [think, rapi, bersih] = jejak.lapisRiwayat;
  cek(think.hurufThinkDibuang === 3 * '<think>nalar lama</think> '.length, `huruf nalar yang dibuang dihitung (${think.hurufThinkDibuang})`, think);
  cek(rapi.duplikatPesanSaatIni === true && rapi.sesudah.pesan === rapi.sebelum.pesan - 1, 'pesan saat ini yang terkirim ganda dibuang & ditandai', rapi);
  cek(rapi.pesanDipotong === 5, `pesan lama yang dipendekkan ke 800 huruf dihitung (${rapi.pesanDipotong})`, rapi);
  cek(bersih.melindungi === true && !hasil.some((m) => /\d{18}/.test(m.content)), 'tabel ber-NIP dibuang dari riwayat & lapisnya ditandai melindungi', bersih);
  cek(JSON.stringify(hasil) === JSON.stringify(H.siapkanRiwayatUntukModel(riwayat, 'pertanyaan sekarang', null)), 'hasilnya sama dengan atau tanpa jejak (pencatat tidak mengubah riwayat)');
}

console.log('\n-- RAG: hasil yang datang sesudah batas waktu --');
{
  const jejak = J.buatJejak({ riwayatDiterima: J.ukurRiwayat([]) });
  let selesaikan;
  const berjalan = new Promise((r) => { selesaikan = r; });
  let jam = 1000;
  J.catatRagGagal(jejak.rag, new Error('Tier 1 RAG timeout after 5003ms'), 5000, berjalan, 1000, () => jam);
  cek(jejak.rag.habisWaktu === true && jejak.rag.galat === null && jejak.rag.batasWaktuMs === 5000, 'batas waktu dikenali sebagai habis waktu, bukan galat');
  jam = 8200;
  selesaikan({ chunks: [1, 2, 3, 4, 5, 6, 7, 8] });
  await berjalan; await new Promise((r) => setTimeout(r, 0));
  cek(jejak.rag.datangTerlambat?.potongan === 8 && jejak.rag.datangTerlambat?.ms === 7200, 'potongan yang datang terlambat ikut tercatat (ketemu tetapi dibuang)', jejak.rag.datangTerlambat);
  const j2 = J.buatJejak({ riwayatDiterima: J.ukurRiwayat([]) });
  J.catatRagGagal(j2.rag, new Error('statement timeout'), 5000, Promise.reject(new Error('x')), 0);
  await new Promise((r) => setTimeout(r, 0));
  cek(j2.rag.habisWaktu === false && j2.rag.galat === 'statement timeout' && j2.rag.datangTerlambat === null, 'galat lain dicatat sebagai galat', j2.rag);
}

console.log('\n-- panggilan model & privasi --');
{
  const jejak = J.buatJejak({ traceId: 'tr-1', riwayatDiterima: J.ukurRiwayat(percakapan(2)) });
  for (let i = 0; i < 14; i++) J.catatPanggilanModel(jejak, { utama: i === 0, sistemHuruf: 100, pesanHuruf: 5, riwayat: percakapan(2), segmen: { blok4_rag: 40 } });
  cek(jejak.panggilanModel.length === 12 && jejak.panggilanTakTercatat === 2, 'catatan panggilan dibatasi & kelebihannya dihitung, bukan dibuang diam-diam');
  J.catatPenolakan(jejak, 'evidence_gate', 'x'.repeat(500));
  cek(jejak.penolakan[0].sebab.length === 120, 'sebab penolakan dipendekkan');
  const baris = J.barisLogJejak(jejak);
  cek(baris.startsWith('[JEJAK_PROMPT] {') && JSON.parse(baris.slice(15)).traceId === 'tr-1', 'baris log satu JSON yang bisa diurai');
  cek(!baris.includes(RAHASIA) && !baris.includes('nalar lama'), 'baris log tidak membawa isi pesan');
  const salin = J.salinJejak(jejak);
  salin.rag.dikirim = 99;
  cek(jejak.rag.dikirim === 0, 'salinan yang dikirim ke klien terpisah dari jejak hidup');
}

const susunJejakPipeline = async (riwayat, pesan, kebijakan = { keputusan: 'ALLOW', skorRisiko: 0, alatDimatikan: false, webDimatikan: false, ragTopK: 8 }) => {
  const p = await terimaParser({ message: pesan, tools: [], history: riwayat });
  const jejak = J.buatJejak({ traceId: 't', riwayatDiterima: J.ukurRiwayat(p.riwayatAsli) });
  J.catatLapis(jejak, 'buang_tag_call', p.riwayatAsli, p.riwayatSesudahTag);
  J.catatLapis(jejak, 'parser_15_pesan', p.riwayatSesudahTag, p.history, { pesanDisisipkan: p.healerDisisipkan ? 1 : 0 });
  jejak.kebijakan = kebijakan;
  const keModel = H.siapkanRiwayatUntukModel(p.history, pesan, jejak);
  J.catatPanggilanModel(jejak, { utama: true, sistemHuruf: 9000, pesanHuruf: pesan.length, riwayat: keModel, segmen: {} });
  return jejak;
};

console.log('\n-- gerbang: keadaan sekarang harus MERAH di percakapan panjang --');
{
  const riwayat = percakapan(20, { huruf: 1500 });
  const server = await susunJejakPipeline(riwayat, 'lanjutkan');
  const klien = K.susunJejakKlien({ jalur: 'CONVERSATION', traceId: 't', riwayatTersedia: riwayat, dikirim: riwayat });
  const n = G.nilaiGiliran([{ nomor: 16, pasangan: [{ klien, server }] }]);
  cek(!n.hijau, `percakapan 20 pesan tidak hijau (${n.merah} merah)`, n.perKode);
  cek(n.perKode.catatan_palsu === 1, 'catatan palsu "diringkas" terdeteksi', n.perKode);
  cek(n.perKode.pesan_dibuang >= 1 && n.temuan.some((t) => t.kode === 'pesan_dibuang' && /parser_15_pesan .*9 pesan/.test(t.rinci)), 'parser membuang 9 pesan terdeteksi', n.temuan.filter((t) => t.kode === 'pesan_dibuang'));
  cek(n.temuan.some((t) => t.kode === 'pesan_dipotong' && /rapikan_riwayat/.test(t.rinci)), 'pemotongan 800 huruf terdeteksi', n.perKode);
  cek(!n.perKode.riwayat_berubah_sebelum_model, 'yang sampai ke model sama dengan lapis terakhir (tak ada pemangkas tak tercatat)', n.perKode);

  const pendek = percakapan(3, { huruf: 200 });
  const s2 = await susunJejakPipeline(pendek, 'tanya');
  const k2 = K.susunJejakKlien({ jalur: 'CONVERSATION', traceId: 't', riwayatTersedia: pendek, dikirim: pendek });
  const n2 = G.nilaiGiliran([{ nomor: 1, pasangan: [{ klien: k2, server: s2 }] }]);
  cek(n2.hijau, `percakapan pendek tanpa pemangkas: hijau (${n2.merah} merah)`, n2.temuan);
}

console.log('\n-- gerbang: setiap sebab merah dikenali --');
{
  const dasar = async () => susunJejakPipeline(percakapan(3, { huruf: 200 }), 'tanya');
  const kl = (o = {}) => ({ ...K.susunJejakKlien({ jalur: 'CONVERSATION', traceId: 't', riwayatTersedia: percakapan(3, { huruf: 200 }), dikirim: percakapan(3, { huruf: 200 }) }), ...o });
  const kode = async (ubahServer, ubahKlien = (k) => k, harapan) => {
    const s = await dasar(); ubahServer(s);
    return G.nilaiGiliran([{ nomor: 1, pasangan: [{ klien: ubahKlien(kl()), server: s }], harapan }]).perKode;
  };
  cek((await kode((s) => { s.kebijakan = { keputusan: 'ALLOW_WITH_LIMIT', skorRisiko: 2, alatDimatikan: true, webDimatikan: true, ragTopK: 2 }; })).kebijakan_membatasi === 1, 'ALLOW_WITH_LIMIT (alat dimatikan diam-diam) merah');
  cek((await kode((s) => { J.catatPenolakan(s, 'kebijakan_eksekusi', 'BLOCK skor 4'); })).ditolak_kebijakan_eksekusi === 1, 'BLOCK merah');
  const rag = await kode((s) => { Object.assign(s.rag, { diminta: true, habisWaktu: true, batasWaktuMs: 5000, ditemukan: null, datangTerlambat: { potongan: 8, ms: 7100 } }); });
  cek(rag.rag_habis_waktu === 1 && rag.rag_ketemu_dibuang === 1, 'RAG habis waktu & hasil terlambat yang dibuang merah', rag);
  cek((await kode((s) => { Object.assign(s.rag, { diminta: true, ditemukan: 8, dikirim: 3 }); })).rag_tak_terkirim === 1, 'potongan ditemukan tetapi tak dikirim merah');
  cek(!(await kode((s) => { Object.assign(s.rag, { diminta: true, ditemukan: 8, dikirim: 0, dataTabelMenggantikan: true }); })).rag_tak_terkirim, 'data tabel menggantikan RAG tidak dihitung merah');
  cek((await kode(() => {}, (k) => ({ ...k, dikirim: { ...k.dikirim, pesan: k.dikirim.pesan + 1 } }))).riwayat_hilang_di_jalan === 1, 'riwayat klien ≠ yang diterima server merah');
  cek((await kode(() => {}, (k) => ({ ...k, konteksRag: { sebelum: 9000, sesudah: 4040 } }))).konteks_dipotong_klien === 1, 'pemotong konteks 4.000 huruf di klien merah');
  cek((await kode(() => {}, (k) => ({ ...k, cmg: 'REJECT' }))).cmg_menolak === 1, 'penjaga memori lama menolak merah');
  cek((await kode(() => {}, (k) => ({ ...k, jalur: 'LOOKUP', riwayatTersedia: { ...k.riwayatTersedia, pesan: 9 } }))).jalur_memotong_riwayat === 1, 'jalur LOOKUP memotong ke 3 pesan merah');
  cek((await kode((s) => { s.panggilanModel[0].riwayat = { ...s.panggilanModel[0].riwayat, huruf: 1 }; })).riwayat_berubah_sebelum_model === 1, 'pemangkas tak tercatat sebelum model merah');
  cek((await kode((s) => { s.panggilanModel = []; s.lapisRiwayat = []; }, (k) => k)).tanpa_panggilan_utama === 1, 'tanpa panggilan utama dilaporkan');
  cek(G.nilaiGiliran([{ pasangan: [{ klien: kl(), server: null }] }]).perKode.tanpa_jejak_server === 1, 'jawaban tanpa jejak server merah');
}

console.log('\n-- gerbang: hasil alat antar giliran --');
{
  const alat = [{ role: 'user', content: 'baca folder' }, { role: 'model', content: 'membaca' }, { role: 'user', content: '[HASIL ALAT FOLDER] putaran 1/4\n' + 'x'.repeat(3000) }];
  const s1 = await susunJejakPipeline(alat, 'lanjut');
  const g1 = { nomor: 1, pasangan: [{ klien: K.susunJejakKlien({ jalur: 'CONVERSATION', riwayatTersedia: alat, dikirim: alat, traceId: 't' }), server: s1 }] };
  const tanpa = [{ role: 'user', content: 'baca folder' }, { role: 'model', content: 'isinya begini' }];
  const s2 = await susunJejakPipeline(tanpa, 'jangan dicari lagi, apa isi berkas tadi?');
  const g2 = { nomor: 2, harapan: { pakaiHasilAlatSebelumnya: true }, pasangan: [{ klien: K.susunJejakKlien({ jalur: 'CONVERSATION', riwayatTersedia: tanpa, dikirim: tanpa, traceId: 't' }), server: s2 }] };
  cek(G.nilaiGiliran([g1, g2]).perKode.hasil_alat_hilang === 1, 'hasil alat yang tak terbawa ke giliran berikutnya merah');
  const s3 = await susunJejakPipeline(alat, 'apa isi berkas tadi?');
  const g3 = { nomor: 2, harapan: { pakaiHasilAlatSebelumnya: true }, pasangan: [{ klien: K.susunJejakKlien({ jalur: 'CONVERSATION', riwayatTersedia: alat, dikirim: alat, traceId: 't' }), server: s3 }] };
  cek(!G.nilaiGiliran([g1, g3]).perKode.hasil_alat_hilang, 'hasil alat yang terbawa tidak merah');

  const hasilSaatIni = '[HASIL ALAT FOLDER] putaran 1/4\n' + 'y'.repeat(500);
  const putaran = [{ role: 'user', content: 'baca folder' }, { role: 'model', content: 'membaca' }, { role: 'user', content: hasilSaatIni }];
  const sp = await susunJejakPipeline(putaran, hasilSaatIni);
  const np = G.nilaiGiliran([{ pasangan: [{ klien: K.susunJejakKlien({ jalur: 'CONVERSATION', putaranAlat: true, riwayatTersedia: putaran, dikirim: putaran, traceId: 't' }), server: sp }] }]);
  cek(!np.perKode.hasil_alat_dibuang && !np.perKode.pesan_dibuang, 'hasil alat yang dikirim sebagai pesan saat ini (salinan gandanya dibuang) tidak merah', np.temuan);
  const putaranTerpotong = [...putaran.slice(0, 2), { role: 'user', content: hasilSaatIni.replace('y', 'z') }, { role: 'model', content: 'lanjut' }, { role: 'user', content: hasilSaatIni }];
  const sq = await susunJejakPipeline(putaranTerpotong, hasilSaatIni);
  sq.lapisRiwayat.find((l) => l.nama === 'rapikan_riwayat').sesudah.hasilAlatPesan = 0;
  cek(G.nilaiGiliran([{ pasangan: [{ klien: null, server: sq }] }]).perKode.hasil_alat_dibuang === 1, 'hasil alat lain yang ikut hilang tetap merah');

  const kl = (putaranAlat, riwayat = tanpa) => K.susunJejakKlien({ jalur: 'CONVERSATION', traceId: 't', putaranAlat, riwayatTersedia: riwayat, dikirim: riwayat });
  const urutan = [
    { klien: kl(false), server: s2 },
    { klien: kl(true), server: s2 },
    { klien: kl(true), server: s2 },
    { klien: kl(false), server: s2 },
    { klien: kl(false), server: s2 },
  ];
  const gil = G.kelompokkanGiliran(urutan);
  cek(gil.length === 3 && gil[0].pasangan.length === 3 && gil[1].pasangan.length === 1, `putaran alat digabung ke giliran pertanyaannya (${gil.map((g) => g.pasangan.length).join('+')})`);
  cek(gil[1].harapan?.pakaiHasilAlatSebelumnya === true && !gil[2].harapan && !gil[0].harapan, 'hanya giliran sesudah pemakaian alat yang diharapkan membawa hasil alat');
  cek(G.nilaiGiliran(gil).perKode.hasil_alat_hilang === 1, 'urutan nyata (alat dipakai lalu tak terbawa) merah');
}

console.log('\n-- alat uji skenario (uji-jejak-prompt-t0.js) dengan aplikasi tiruan --');
{
  const panjang16 = percakapan(20, { huruf: 1500 });
  const server = await susunJejakPipeline(panjang16, 'lanjutkan');
  const riwayatJejak = [{ klien: K.susunJejakKlien({ jalur: 'CONVERSATION', traceId: 't', riwayatTersedia: panjang16, dikirim: panjang16 }), server }];
  globalThis.window = { __mamet: { serviceManager: { get: (n) => (n === 'AssistantService' ? { riwayatJejak } : null) } } };
  const T0 = await imp('uji/uji-jejak-prompt-t0.js');
  const asliTable = console.table, asliLog = console.log;
  const tertangkap = [];
  console.table = () => {}; console.log = (...a) => tertangkap.push(a.map(String).join(' '));
  let lap;
  try { lap = await T0.laporan(); } finally { console.table = asliTable; console.log = asliLog; }
  cek(T0.SKENARIO.length >= 15, `skenario ≥ 15 giliran (${T0.SKENARIO.length})`);
  cek(lap && lap.hijau === false && lap.perKode.catatan_palsu === 1 && lap.giliran[0].merah.includes('pesan_dibuang'), 'laporan menilai jejak dengan gerbang yang sama', lap?.perKode);
  const keluar = tertangkap.join('\n');
  cek(!keluar.includes(RAHASIA) && !JSON.stringify(lap).includes(RAHASIA), 'laporan yang disalin Owner tidak membawa isi pesan');
  delete globalThis.window;
}

console.log('\n-- sambungan di kode sungguhan --');
{
  const RP = baca('supabase/functions/agent-process/lib/request/request_pipeline.ts');
  cek(/buatJejak\(\{[^}]*riwayatDiterima: ukurRiwayat\(parsed\.riwayatAsli\)/.test(RP), 'pipeline mengukur riwayat ASLI dari klien');
  cek(RP.indexOf('ctx.state.jejakPrompt = jejakPrompt') > 0 && RP.indexOf('ctx.state.jejakPrompt = jejakPrompt') < RP.indexOf('enforcePolicy(ctx'), 'jejak dibuat sebelum keputusan kebijakan (BLOCK ikut terukur)');
  cek(/ctx\.request\.history = siapkanRiwayatUntukModel\(ctx\.request\.history \|\| \[\], parsed\.message, jejakPrompt\)/.test(RP), 'pipeline memakai siapkanRiwayatUntukModel yang diuji di atas');
  cek(/tasks: backgroundTasks,\s*jejakPrompt/.test(RP), 'rctx membawa jejak yang sama');
  const PM = baca('supabase/functions/agent-process/lib/request/policy_middleware.ts');
  cek(/JSON\.stringify\(\{ message: blockMsg, jejakPrompt: salinJejak\(ctx\.state\.jejakPrompt\) \}\)/.test(PM), 'jawaban BLOCK membawa jejak');
  const SC = baca('supabase/functions/agent-process/lib/streaming/stream_controller.ts');
  cek(/jejakPrompt: salinJejak\(rctx\.jejakPrompt\)/.test(SC) && (SC.match(/barisLogJejak\(rctx\?\.jejakPrompt\)/g) || []).length === 2, 'jawaban DIRECT membawa jejak; DIRECT & STREAM mencatat log');
  const LO = baca('supabase/functions/agent-process/lib/llm_orchestrator.ts');
  cek((LO.match(/catatKomposisiPrompt\(promptText, systemPromptText, chatHistory, rctx\?\.jejakPrompt\)/g) || []).length === 2, 'kedua jalur model (biasa & stream) mencatat ukuran prompt');
  const CB = baca('supabase/functions/agent-process/lib/orchestration/handlers/context_builder.ts');
  cek(/catatRagGagal\(jejakRag, err, tenggatTier1 - mulaiTier1, tier1Berjalan, mulaiTier1\)/.test(CB) && /tier1Berjalan = executeTier1\(\);/.test(CB), 'RAG yang gagal/terlambat dicatat dengan janji yang benar-benar berjalan');
  cek(/jejakRagAkhir\.dikirim = /.test(CB) && /catatPenolakan\(ctx\.state\.jejakPrompt, 'evidence_gate'/.test(CB), 'potongan yang dikirim & penolakan evidence gate dicatat');
  const AS = baca('frontend/src/core/runtime/services/AssistantService.js');
  cek(/const \{ jejakPrompt: jejakServer, \.\.\.jsonTanpaJejak \}/.test(AS) && /this\._catatJejakServer\(jejakServer\)/.test(AS)
    && /const jsonData = jsonMentah && typeof jsonMentah === 'object' \? jsonTanpaJejak : jsonMentah;/.test(AS)
    && (AS.match(/const jsonData = /g) || []).length === 1,
    'klien memisahkan jejak dari metadata pesan (tak ikut tersimpan di chats)');
  cek((AS.match(/this\._catatJejakKlien\(susunJejakKlien\(\{/g) || []).length === 3, 'ketiga jalur kirim klien (percakapan, LOOKUP, skill) mencatat jejak');
  cek(/jalur: 'CONVERSATION',\s*traceId: requestTraceId,\s*putaranAlat: pesanHasilMesin,/.test(AS), 'putaran alat ditandai dari penanda yang sama dengan yang mematikan RAG di putaran itu');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
