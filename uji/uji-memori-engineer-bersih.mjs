
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { readFileSync } from 'node:fs';

const AKAR = AKAR_REPO;
const baca = (p) => readFileSync(`${AKAR}/${p}`, 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-memori-engineer-bersih v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const ENG = tanpaKomentar(baca('frontend/src/core/runtime/services/engineer.js'));
const PA = tanpaKomentar(baca('frontend/src/core/runtime/services/engineer/PatchApplier.js'));

console.log('\n-- tulisan otomatis hilang --');

cek(!/storeMemory\(/.test(ENG), 'engineer.js tidak lagi memanggil storeMemory', (ENG.match(/.*storeMemory.*/g) || []));
cek(!/storeMemory\(/.test(PA), 'PatchApplier.js tidak lagi memanggil storeMemory', (PA.match(/.*storeMemory.*/g) || []));
cek(!/source_type: 'engineer_session'/.test(ENG), "metadata 'engineer_session' tidak lagi dibuat");
cek(!/source_type: 'engineer_patch'/.test(PA), "metadata 'engineer_patch' tidak lagi dibuat");
cek(!/Engineering session \$\{/.test(ENG), 'kalimat "Engineering session …" tidak lagi disusun');
cek(!/Patch \$\{patch\.id\} applied/.test(PA), 'kalimat "Patch … applied" tidak lagi disusun');

console.log('\n-- yang bukan sasaran tetap hidup --');

cek(/verifyEngineeringSession\(this\.sessionArtifact\)/.test(ENG), 'finalisasi & verifikasi sesi tetap berjalan');
cek(/MemoryGovernorService/.test(ENG), 'MemoryGovernorService tetap dipakai');
cek(/sessionArtifact/.test(ENG), 'SessionArtifact tetap ada — catatan sesi di dalam sesi tidak dihapus');

cek(/putusanVerifikasi/.test(PA) && /laporanVerifikasi/.test(PA), 'verifikasi Tahap 6 tetap ada di PatchApplier');
cek(/Engineer:PatchApplied/.test(PA), 'peristiwa PatchApplied tetap dipancarkan');
cek(/checkpointRef/.test(PA), 'checkpoint tetap dibuat');

console.log('\n-- rumah yang benar tetap tersambung --');
{
  const IT = baca('frontend/src/core/runtime/services/engineer/IngatanTemuan.js');
  cek(/ALAMAT_BERKAS = 'docs\/project-memory\/temuan-engineer\/TEMUAN-ENGINEER\.md'/.test(IT),
    'ingatan temuan tetap disimpan sebagai berkas DI DALAM repo', (IT.match(/.*ALAMAT_BERKAS.*/g) || []));

  const CE = tanpaKomentar(baca('frontend/src/components/workbench/ConversationEngine.jsx'));
  cek(/ringkasanTemuan\]/.test(CE) || /ringkasanTemuan,/.test(CE),
    'ringkasan temuan tetap ikut sebagai sisipan tiap kiriman', (CE.match(/const sisipan = [^\n]*/g) || []));
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
