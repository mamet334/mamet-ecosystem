
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { readFileSync } from 'node:fs';

const AKAR = AKAR_REPO;
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

console.log('\n-- nama medan bertemu --');

cek(/name: attachedFile\.name,\s*type: attachedFile\.type,/.test(AS),
  'klien tetap mengirim medan `type` (tidak diubah — ia yang dipakai sejak awal)', (AS.match(/.*attachedFile\.type.*/g) || []));
cek(!/file\.mimeType && file\.mimeType\.startsWith/.test(RP),
  'server tidak lagi HANYA membaca mimeType yang tak pernah ada');
cek(/file\.mimeType \|\| file\.type/.test(RP),
  'server menerima KEDUANYA — `type` dari klien, `mimeType` untuk pemanggil lama', (RP.match(/.*mimeType \|\|.*/g) || []));

console.log('\n-- gambar --');

cek(/mime\.startsWith\('image\/'\) \|\| akhiranGambar/.test(RP),
  'gambar dikenali dari mime ATAU akhiran berkas', (RP.match(/.*akhiranGambar.*/g) || []));
cek(/\\\.\(png\|jpe\?g\|gif\|webp\|bmp\)\$/.test(RP) || /png\|jpe\?g\|gif\|webp\|bmp/.test(RP),
  'akhiran gambar yang lazim dikenali');
cek(/extractedImage = \{ mimeType:/.test(RP), 'hasilnya tetap diisi ke extractedImage (jalur vision yang sudah ada)');

console.log('\n-- dokumen teknis --');
{
  const pola = (RP.match(/const TEKS = \/[^/]+\//) || [])[0] || '';
  for (const ext of ['txt', 'csv', 'md', 'json', 'sql', 'tsx', 'ps1']) {
    cek(pola.includes(ext), `akhiran .${ext} ikut dibaca isinya`, pola);
  }
  cek(/Isi Dokumen:/.test(RP), 'isinya ditempel ke pesan dengan penanda yang jelas');
  cek(/substring\(0, 50000\)/.test(RP), 'batas 50.000 huruf dipertahankan — bukan dibuka lebar diam-diam');
}

console.log('\n-- yang tak didukung tidak berjanji --');

cek(!/PDF akan dibaca secara ringkas/.test(RP), 'janji lama yang tak pernah ditepati dibuang');
cek(/ISINYA TIDAK DIBACA/.test(RP), 'dikatakan tegas bahwa isinya tidak sampai');
cek(/Jangan menebak isinya/.test(RP), 'model dilarang menebak isi dari nama berkas', (RP.match(/.*Jangan menebak.*/g) || []));

console.log('\n-- tombol lampiran --');

cek(/isEngineerWorkspace \|\| workspaceManager\?\.activeWorkspaceId === 'ws-lite'/.test(CE),
  'Engineer ikut, dan dua ruang lama TIDAK dicabut', (CE.match(/.*ws-lite.*/g) || []).slice(0, 2));
cek(/isEngineerWorkspace \? 'Lampirkan tangkapan layar atau dokumen teknis/.test(CE),
  'judul tombolnya menjelaskan gunanya di Engineer');
cek(/isinya ikut ke penyedia model/.test(CE),
  'T12 disebut di tempat Owner menekannya — bukan hanya di dokumen', (CE.match(/.*penyedia model.*/g) || []).slice(0, 1));

console.log('\n-- model diberi tahu --');

cek(/\[0\.2e\] THE OWNER CAN ATTACH SCREENSHOTS AND DOCUMENTS/.test(EC), 'langkah 0.2e ditambahkan');
cek(/You cannot derive that from source code/.test(EC), 'ditegaskan tata letak tak bisa diturunkan dari kode');
cek(/describe what you SEE before explaining it/.test(EC), 'disuruh menyebut yang DILIHAT sebelum menafsirkan');
cek(/ISINYA TIDAK DIBACA/.test(EC), 'diajari mengenali penanda berkas yang tak terbaca');
cek(/do NOT guess from the filename/.test(EC), 'dilarang menebak dari nama berkas');
cek(!/\[0\.2e\][\s\S]{0,900}?`/.test(EC), 'tidak ada backtick di dalam langkah 0.2e');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
