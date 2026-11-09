
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const AKAR = fileURLToPath(new URL('..', import.meta.url));
const { rampingkanPesan, pesanUntukServer, VERSI_PESAN_RAMPING } =
  await import(pathToFileURL(join(AKAR, 'frontend/src/core/runtime/services/pesanRamping.js')).href);
const { langkahPenting } = await import(pathToFileURL(join(AKAR, 'frontend/src/components/workbench/langkahPenting.js')).href);

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
console.log(`uji-pesan-ramping v1 — ${VERSI_PESAN_RAMPING}`);

const konteks = `[SYSTEM CONTEXT FINAL] fullSystemContext="${'[BLOK 4: KNOWLEDGE] potongan dokumen '.repeat(600)}"`;
const langkahServer = ['Menganalisis permintaan…', '📋 Rencana: cari dokumen', konteks];
const jsonData = {
  message: 'Jawaban', processingSteps: langkahServer, toolExecution: { status: 'ok' },
  groundingSources: [{ title: 'Dok A' }], toolsUsed: ['rag'], terpotong: true, bahanLanjutan: { sisa: 1 },
};
const jawaban = {
  role: 'model', content: 'Jawaban', steps: ['🔍 Dicari (web): harga', ...langkahServer], metadata: jsonData, traceId: 't1',
};

const r = rampingkanPesan(jawaban);
cek(!('processingSteps' in r.metadata), 'disimpan: metadata.processingSteps (salinan) dibuang');
cek(JSON.stringify(r.steps) === JSON.stringify(jawaban.steps) && r.steps.includes(konteks),
  'disimpan: steps UTUH, termasuk [SYSTEM CONTEXT FINAL] (bukti verifikasi RAG & set uji mutu)');
cek(['message', 'toolExecution', 'groundingSources', 'toolsUsed', 'terpotong', 'bahanLanjutan'].every((k) => k in r.metadata)
  && r.traceId === 't1' && r.content === 'Jawaban', 'disimpan: kunci metadata lain (alat, sumber, lanjutan) & traceId tetap ada');
cek(JSON.stringify(langkahPenting(r.steps)) === JSON.stringify(langkahPenting(jawaban.steps)) && langkahPenting(r.steps).length === 2,
  'tampilan: baris "🔍 Dicari"/"📋 Rencana" di gelembung sama seperti sebelum dirampingkan');
const sebelum = JSON.stringify(jawaban).length, sesudah = JSON.stringify(r).length;
cek(sesudah < sebelum * 0.55, `ukuran tersimpan turun ±separuh (${sebelum} → ${sesudah} huruf)`);
cek('processingSteps' in jawaban.metadata, 'pesan asli (state layar) tidak diubah');

const beda = { role: 'model', content: 'x', steps: ['a', 'b'], metadata: { processingSteps: ['a', 'c'] } };
cek(rampingkanPesan(beda) === beda, 'langkah metadata yang BUKAN ekor steps tidak dibuang');
const tanpaSteps = { role: 'model', content: 'x', metadata: { processingSteps: ['a'] } };
cek(rampingkanPesan(tanpaSteps) === tanpaSteps, 'pesan tanpa steps (satu-satunya salinan) tidak dibuang');
const pengguna = { role: 'user', content: 'halo' };
cek(rampingkanPesan(pengguna) === pengguna && rampingkanPesan(null) === null, 'pesan pengguna & nilai kosong lewat apa adanya');

const kirim = pesanUntukServer(jawaban);
cek(!('steps' in kirim) && !('processingSteps' in kirim.metadata), 'dikirim: steps & metadata.processingSteps tidak ikut');
cek(kirim.metadata.terpotong === true && kirim.metadata.bahanLanjutan?.sisa === 1 && kirim.role === 'model' && kirim.content === 'Jawaban',
  'dikirim: role, content, metadata.terpotong/bahanLanjutan (dibaca batas_waktu.ts untuk "lanjutkan") tetap ikut');
const patok = { role: 'user', content: 'peta repo', _patok: true };
cek(pesanUntukServer(patok)._patok === true, 'dikirim: penanda patok sisipan tetap ikut (pemangkas riwayat server membacanya)');
cek(Array.isArray(jawaban.steps) && 'processingSteps' in jawaban.metadata, 'dikirim: pesan asli tidak diubah');

const AS = readFileSync(join(AKAR, 'frontend/src/core/runtime/services/AssistantService.js'), 'utf8');
cek(/messages:\s*messages\.map\(rampingkanPesan\)/.test(AS), 'saveChatToDB menyimpan messages.map(rampingkanPesan)');
const barisHistory = AS.split(/\r?\n/).filter((b) => /^\s*history:\s*(konteks(Lookup|Skill)?\.dikirim|history\.slice)/.test(b));
cek(barisHistory.length === 3 && barisHistory.every((b) => /\.map\(pesanUntukServer\)/.test(b)),
  `setiap payload history ke server lewat pesanUntukServer (${barisHistory.length} jalur)`, barisHistory);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
