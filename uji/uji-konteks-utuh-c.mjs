import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const imp = (p) => import(pathToFileURL(join(AKAR, p)).href);
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');

const C = await imp('supabase/functions/agent-process/lib/catatan_jujur.ts');
const J = await imp('supabase/functions/agent-process/lib/jejak_prompt.ts');
const H = await imp('supabase/functions/agent-process/lib/request/history_compressor.ts');
const P = await imp('supabase/functions/agent-process/lib/request/request_parser.ts');
const KC = await imp('frontend/src/core/runtime/services/KonteksChat.js');
const K = await imp('frontend/src/core/runtime/services/JejakKlien.js');
const G = await imp('uji/lib/gerbangJejak.mjs');

console.log('uji-konteks-utuh-c v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

console.log('\n-- catatan jujur untuk model & pengguna (Tahap H) --');
{
  const r = C.catatanModelRagGagal('RAG_DB_FAIL: canceling statement due to statement timeout');
  cek(/GAGAL/.test(r) && /JANGAN menyatakan dokumen tidak ada/.test(r) && /statement timeout/.test(r), 'model diberi tahu pencarian dokumen gagal, dilarang menyebut dokumen tak ada');
  cek(C.catatanModelRagGagal('') === '' && C.catatanModelRagGagal(null) === '', 'tanpa galat → tanpa catatan');
  const denganAlat = C.catatanModelRagGagal('statement timeout', { alatRag: true });
  cek(/coba SEKALI <alat_rag>\{"alat":"rag_cari"/.test(denganAlat) && !/rag_cari/.test(r) && /JANGAN menyatakan dokumen tidak ada/.test(denganAlat), 'alat RAG aktif → model diminta mencoba rag_cari sekali sebelum menyerah (uji K1 11 Nov: putaran ulang hampir selalu berhasil)');
  cek(!/[\r\n_`]{2,}/.test(C.catatanModelRagGagal('a\n\n__``b').replace(/^\n|\n$/g, '')), 'teks galat dirapikan (tak bisa menyusupkan baris/markdown)');
  const d = C.catatanModelRiwayatDilewati(7);
  cek(/7 pesan lama/.test(d) && /anggaran konteks/.test(d) && /jangan menebak/.test(d), 'model diberi tahu jumlah pesan lama yang tidak dikirim');
  cek(C.catatanModelRiwayatDilewati(0) === '' && C.catatanModelRiwayatDilewati(-2) === '' && C.catatanModelRiwayatDilewati('x') === '', 'tanpa pesan dilewati → tanpa catatan');
  cek(/gagal/.test(C.catatanPenggunaRagGagal('x')) && C.catatanPenggunaRagGagal('') === '', 'pengguna diberi tahu pencarian dokumen gagal');
}

console.log('\n-- konteks tambahan ikut anggaran Settings (C5) --');
{
  const kecil = KC.bagiAnggaranKonteks(60000, 'x'.repeat(10000));
  cek(kecil.teks.length === 10000 && kecil.hurufDipotong === 0, 'konteks 10.000 huruf dalam anggaran 60.000 token dikirim utuh (dulu dipotong 4.000)');
  const besar = KC.bagiAnggaranKonteks(8000, 'y'.repeat(50000));
  cek(besar.hurufDipotong === 50000 - 4000 * 4 && /CATATAN SISTEM: .* huruf konteks .* tidak dikirim karena anggaran konteks di Settings/.test(besar.teks), 'melebihi separuh anggaran → dipotong dengan catatan jujur', { dipotong: besar.hurufDipotong });
  cek(besar.tokenTerpakai <= 4000 + 40, `token terpakai tetap dalam separuh anggaran (${besar.tokenTerpakai})`);
  cek(KC.bagiAnggaranKonteks(0, 'abc').hurufDipotong === 3 && KC.bagiAnggaranKonteks(10000, '').teks === '', 'anggaran nol & konteks kosong ditangani');
}

const jawabanFolder = (n) => `${'isi jawaban '.repeat(n)}\n\n---\n📂 _Dibaca dari folder **proyek** (2 putaran alat): \`README.md\`, \`app.py\`_`;

console.log('\n-- catatan kerja selamat sampai ke model (C4: keputusan Owner "catatan kerja saja") --');
{
  const u = J.ukurRiwayat([{ role: 'model', content: jawabanFolder(10) }, { role: 'user', content: jawabanFolder(1) }, { role: 'model', content: 'x (dicatat dari proses utama, bukan dari kata model) y' }]);
  cek(u.catatanKerjaPesan === 2, `catatan kerja folder & konektor dikenali di jawaban model, bukan di pesan pengguna (${u.catatanKerjaPesan})`);
  const riwayat = [{ role: 'user', content: 'baca README' }, { role: 'model', content: jawabanFolder(600) }, { role: 'user', content: 'apa judul bagian pertamanya?' }, { role: 'model', content: 'jawab' }];
  const jejak = J.buatJejak({ riwayatDiterima: J.ukurRiwayat(riwayat) });
  const keModel = H.siapkanRiwayatUntukModel(riwayat, 'jangan dicari lagi, ulangi isinya', jejak);
  cek(keModel[1].content === riwayat[1].content, `jawaban ${riwayat[1].content.length} huruf beserta catatan kerjanya sampai utuh (dulu dipotong 800 huruf, catatannya ikut hilang)`);
  cek(J.ukurRiwayat(keModel).catatanKerjaPesan === 1, 'catatan kerja terhitung di riwayat yang sampai ke model');
}

console.log('\n-- gerbang: pemberitahuan wajib ada (H) --');
{
  const riwayat = [{ role: 'user', content: 'tanya' }];
  const dasar = () => {
    const s = J.buatJejak({ traceId: 't', riwayatDiterima: J.ukurRiwayat(riwayat) });
    const m = H.siapkanRiwayatUntukModel(riwayat, 'x', s);
    J.catatPanggilanModel(s, { utama: true, sistemHuruf: 100, pesanHuruf: 1, riwayat: m, segmen: {} });
    return s;
  };
  const kl = K.susunJejakKlien({ jalur: 'CONVERSATION', traceId: 't', riwayatTersedia: riwayat, dikirim: riwayat, anggaran: { token: 8000, terpakai: 7000, dilewati: 3 } });
  const tanpa = dasar();
  cek(G.nilaiGiliran([{ pasangan: [{ klien: kl, server: tanpa }] }]).perKode.pemotongan_tanpa_pemberitahuan === 1, '3 pesan dilewati tetapi model tak diberi tahu → merah');
  const dengan = dasar();
  dengan.riwayatDilewatiKlien = 3; J.catatCatatanJujur(dengan, 'riwayat_dilewati');
  const n = G.nilaiGiliran([{ pasangan: [{ klien: kl, server: dengan }] }]);
  cek(!n.perKode.pemotongan_tanpa_pemberitahuan && n.perKode.anggaran_klien === 1 && n.hijau, 'diberi tahu → hanya INFO anggaran (keputusan Settings Owner), hijau', n.perKode);
  const ragDiam = dasar(); Object.assign(ragDiam.rag, { diminta: true, galat: 'RAG_DB_FAIL' });
  cek(G.nilaiGiliran([{ pasangan: [{ klien: null, server: ragDiam }] }]).perKode.rag_gagal_diam === 1, 'RAG gagal tanpa catatan ke model → merah');
  const ragJujur = dasar(); Object.assign(ragJujur.rag, { diminta: true, galat: 'RAG_DB_FAIL' }); J.catatCatatanJujur(ragJujur, 'rag_gagal');
  cek(!G.nilaiGiliran([{ pasangan: [{ klien: null, server: ragJujur }] }]).perKode.rag_gagal_diam, 'RAG gagal dengan catatan ke model → tidak "diam"');
  J.catatCatatanJujur(ragJujur, 'rag_gagal');
  cek(ragJujur.catatanJujur.length === 1, 'catatan jujur tidak tercatat ganda');
  const lookup = K.susunJejakKlien({ jalur: 'LOOKUP', traceId: 't', riwayatTersedia: [...riwayat, ...riwayat, ...riwayat], dikirim: riwayat });
  cek(G.nilaiGiliran([{ pasangan: [{ klien: lookup, server: dasar() }] }]).perKode.jalur_memotong_riwayat === 1, 'jalur LOOKUP yang memotong tanpa anggaran tetap merah');
}

console.log('\n-- parser meneruskan jumlah pesan yang dilewati --');
{
  const p = await P.parseRequestParams(new Request('http://uji/', { method: 'POST', body: JSON.stringify({ message: 'x', tools: [], history: [], riwayatDilewati: 4 }) }), { user_metadata: {} });
  cek(p.riwayatDilewati === 4, 'riwayatDilewati diterima parser');
}

console.log('\n-- sambungan di kode sungguhan --');
{
  const berkasServer = [];
  const jelajah = (d) => { for (const n of readdirSync(join(AKAR, d))) { const r = `${d}/${n}`; if (statSync(join(AKAR, r)).isDirectory()) jelajah(r); else if (r.endsWith('.ts')) berkasServer.push(r); } };
  jelajah('supabase/functions/agent-process');
  const healer = berkasServer.filter((f) => /Memori obrolan lama telah diringkas/.test(baca(f)));
  cek(berkasServer.length > 50 && healer.length === 0, `catatan palsu "diringkas" tidak ada lagi di ${berkasServer.length} berkas server`, healer);
  const HC = baca('supabase/functions/agent-process/lib/request/history_compressor.ts');
  cek(!/\[dipangkas\]|MAKS_HURUF_PESAN_LAMA|slice\(0, \d+\)/.test(HC), 'history_compressor tidak memangkas isi pesan');
  const RP = baca('supabase/functions/agent-process/lib/request/request_pipeline.ts');
  cek(/const catatanRiwayat = catatanModelRiwayatDilewati\(parsed\.riwayatDilewati\);\s*agentIdentityPrompt \+= catatanRiwayat;/.test(RP) && /catatCatatanJujur\(jejakPrompt, 'riwayat_dilewati'\)/.test(RP), 'pipeline memasang catatan riwayat dilewati ke prompt sistem & mencatatnya');
  const CB = baca('supabase/functions/agent-process/lib/orchestration/handlers/context_builder.ts');
  cek(/catatanModelRagGagal\(ctx\.state\.tier1Retrieval\?\.success === false \? ctx\.state\.tier1Retrieval\.error : '', \{ alatRag: \(ctx\.request as any\)\.alatRagAktif === true \}\)/.test(CB) && /\(ctx\.request as any\)\.alatRagAktif = true;\n\s*ctx\.request\.agentIdentityPrompt \+= blokPromptRag\(/.test(RP) && /systemBasePrompt \+= catatanRagGagal;/.test(CB) && /catatCatatanJujur\(ctx\.state\.jejakPrompt, 'rag_gagal'\)/.test(CB), 'RAG gagal diberitahukan di prompt sistem & dicatat');
  const SH = baca('supabase/functions/agent-process/lib/orchestration/handlers/synthesis_handler.ts');
  cek(/catatanPenggunaRagGagal\(ctx\.state\.tier1Retrieval\?\.success === false/.test(SH) && /replyMessage = `\$\{replyMessage\}\\n\\n\$\{catatanRagGagal\}`/.test(SH), 'RAG gagal diberitahukan ke pengguna di akhir jawaban');
  const AS = baca('frontend/src/core/runtime/services/AssistantService.js');
  cek(!/history\.slice\(-\d+\)/.test(AS), 'tak ada lagi history.slice(-N) di jalur kirim klien (C7)', AS.match(/history\.slice\(-\d+\)/g));
  cek((AS.match(/riwayatDilewati: konteks(Lookup|Skill)?\.dilewati,/g) || []).length === 3, 'ketiga jalur kirim mengirim jumlah pesan yang dilewati anggaran');
  cek(!/MAX_RAG_CONTEXT_CHARS|MAX_SEMANTIC_CONTEXT_CHARS|CognitiveMemoryGovernor|LEGACY_COGNITION/.test(AS), 'pemotong 4.000/2.000 huruf & penjaga memori lama dicabut (C5, C6)');
  cek(/anggaranToken: Math\.max\(0, ang\.token - tokenKonteksTambahan\)/.test(AS) && /bagiAnggaranKonteks\(ang\.token, enhancedRagContext/.test(AS), 'konteks tambahan & riwayat berbagi satu anggaran Settings');
  cek(/anggaran: \{ token: angLookup\.token/.test(AS) && /anggaran: \{ token: angSkill\.token/.test(AS), 'jejak LOOKUP & skill membawa anggarannya');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
