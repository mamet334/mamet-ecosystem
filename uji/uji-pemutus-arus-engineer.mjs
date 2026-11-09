
import { Engineer, BATAS_PATCH_PER_MENIT, JENDELA_PEMUTUS_MS } from '../frontend/src/core/runtime/services/engineer.js';

console.log('uji-pemutus-arus-engineer v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const bikinEngineer = () => {
  const dipancar = [];
  const kosong = new Proxy(function () {}, {
    get: (_t, k) => (k === 'then' ? undefined : kosong),
    apply: () => kosong,
  });
  const eventBus = {
    emit: (nama, muatan) => { dipancar.push({ nama, muatan }); },
    on: () => {},
    off: () => {},
  };
  const serviceManager = { get: (nama) => (nama === 'EventBus' ? eventBus : kosong) };
  const eng = new Engineer(serviceManager);
  return { eng, dipancar };
};

const jalankan = async (eng, n) => {
  for (let i = 0; i < n; i++) await eng._handlePatchTask({ id: `t${i}` });
};
const majukanWaktu = (eng) => { eng._lastApiReset -= JENDELA_PEMUTUS_MS + 1000; };
const pancaran = (dipancar, nama) => dipancar.filter((e) => e.nama === nama);

console.log('\n-- A. keadaan awal --');
{
  const { eng } = bikinEngineer();
  cek(eng.capability === 'IMPLEMENTER', 'mulai sebagai IMPLEMENTER', eng.capability);
  cek(eng._sebabDemosi === null, 'belum ada sebab demosi', eng._sebabDemosi);
  cek(BATAS_PATCH_PER_MENIT === 5 && JENDELA_PEMUTUS_MS === 60000,
    'ambangnya konstanta bernama, bukan angka mati di tengah kode', { BATAS_PATCH_PER_MENIT, JENDELA_PEMUTUS_MS });
}

console.log('\n-- B. masih memutus --');
{
  const { eng, dipancar } = bikinEngineer();
  eng.capability = 'REVIEWER';

  await jalankan(eng, BATAS_PATCH_PER_MENIT);
  cek(eng.capability === 'REVIEWER' && eng._sebabDemosi === null,
    `${BATAS_PATCH_PER_MENIT} patch dalam semenit BELUM memutus`, { cap: eng.capability, sebab: eng._sebabDemosi });

  await jalankan(eng, 1);
  cek(eng.capability === 'OBSERVER', `patch ke-${BATAS_PATCH_PER_MENIT + 1} memutus ke OBSERVER`, eng.capability);
  cek(eng._sebabDemosi === 'laju', 'sebabnya dicatat sebagai laju', eng._sebabDemosi);

  const putus = pancaran(dipancar, 'Engineer:CircuitBreaker');
  cek(putus.length === 1 && putus[0].muatan.aktif === true, 'memancarkan Engineer:CircuitBreaker aktif', putus);

  const saran = pancaran(dipancar, 'Engineer:Recommendation');
  const terakhir = saran.at(-1)?.muatan?.message || '';
  cek(/pemutus arus/i.test(terakhir), 'Owner diberi tahu pemutus arusnya, bukan dibiarkan menebak', terakhir);
  cek(/detik/.test(terakhir), 'disebut kapan bisa dicoba lagi', terakhir);
}

console.log('\n-- C. hukumannya tidak permanen --');
{
  const { eng, dipancar } = bikinEngineer();
  eng.capability = 'REVIEWER';
  await jalankan(eng, BATAS_PATCH_PER_MENIT + 1);
  cek(eng.capability === 'OBSERVER', 'prasyarat: sudah terputus', eng.capability);

  majukanWaktu(eng);
  await jalankan(eng, 1);

  cek(eng.capability === 'REVIEWER',
    'sesudah jendelanya habis, kapabilitas KEMBALI — bukan OBSERVER selamanya', eng.capability);
  cek(eng._sebabDemosi === null, 'sebab demosinya dibersihkan', eng._sebabDemosi);
  cek(eng._kapabilitasSebelumDemosi === null, 'kapabilitas simpanan dibersihkan', eng._kapabilitasSebelumDemosi);

  const pulih = pancaran(dipancar, 'Engineer:CircuitBreaker').filter((e) => e.muatan.aktif === false);
  cek(pulih.length === 1, 'pemulihannya ikut dipancarkan', pulih);
  cek(pancaran(dipancar, 'Engineer:CapabilityUpdated').some((e) => e.muatan.otomatis === true),
    'pemulihan otomatis ditandai otomatis:true, bisa dibedakan dari angkatan Owner');
}

{
  const { eng } = bikinEngineer();
  eng.capability = 'ARCHITECT';
  await jalankan(eng, BATAS_PATCH_PER_MENIT + 1);
  majukanWaktu(eng);
  await jalankan(eng, 1);
  cek(eng.capability === 'ARCHITECT',
    'pulih ke kapabilitas sebelumnya (ARCHITECT), tidak naik diam-diam ke IMPLEMENTER', eng.capability);
}

console.log('\n-- D. demosi keamanan tetap lengket --');
{
  const { eng } = bikinEngineer();
  eng._kapabilitasSebelumDemosi = 'IMPLEMENTER';
  eng._sebabDemosi = 'keamanan';
  eng.capability = 'OBSERVER';

  majukanWaktu(eng);
  await jalankan(eng, 1);
  cek(eng.capability === 'OBSERVER', 'lewatnya satu menit TIDAK mengangkat demosi keamanan', eng.capability);
  cek(eng._sebabDemosi === 'keamanan', 'sebabnya tetap keamanan', eng._sebabDemosi);

  cek(eng.upgradeCapability('IMPLEMENTER', { otomatis: true }) === false,
    'jalur otomatis ditolak terang-terangan (mengembalikan false)');
  cek(eng.upgradeCapability('IMPLEMENTER') === true,
    'Owner/kode TETAP boleh mengangkatnya secara sengaja');
  cek(eng.capability === 'IMPLEMENTER', 'angkatan sengaja berlaku', eng.capability);
}

{
  const { eng } = bikinEngineer();
  eng._sebabDemosi = 'keamanan';
  eng.capability = 'OBSERVER';
  eng._kapabilitasSebelumDemosi = 'IMPLEMENTER';

  await jalankan(eng, BATAS_PATCH_PER_MENIT + 1);
  cek(eng._sebabDemosi === 'keamanan',
    'pemutus arus tidak menurunkan derajat sebab keamanan jadi laju', eng._sebabDemosi);
  cek(eng._kapabilitasSebelumDemosi === 'IMPLEMENTER',
    'kapabilitas asli sebelum penguncian keamanan tidak ikut tertimpa', eng._kapabilitasSebelumDemosi);

  majukanWaktu(eng);
  await jalankan(eng, 1);
  cek(eng.capability === 'OBSERVER', 'dan karenanya tetap tidak pulih sendiri', eng.capability);
}

console.log('\n-- E. hitungan kecurigaan tidak kena imbas --');
{
  const { eng } = bikinEngineer();
  eng.capability = 'REVIEWER';
  eng.suspiciousAttempts = 2;

  await jalankan(eng, BATAS_PATCH_PER_MENIT + 1);
  majukanWaktu(eng);
  await jalankan(eng, 1);

  cek(eng.suspiciousAttempts === 2,
    'pulihnya pembatas laju TIDAK menghapus 2 percobaan berkas inti', eng.suspiciousAttempts);
}
{
  const { eng } = bikinEngineer();
  eng.suspiciousAttempts = 2;
  eng.upgradeCapability('IMPLEMENTER');
  cek(eng.suspiciousAttempts === 0,
    'angkatan sengaja oleh Owner tetap menihilkannya (perilaku lama dipertahankan)', eng.suspiciousAttempts);
}

console.log('\n-- F. masukan ngawur --');
{
  const { eng } = bikinEngineer();
  eng.capability = 'REVIEWER';
  cek(eng.upgradeCapability('RAJA') === false, 'kapabilitas tak dikenal ditolak');
  cek(eng.capability === 'REVIEWER', 'dan kapabilitasnya tidak berubah', eng.capability);
}

console.log('\n-- G. pesan bisa ditindaklanjuti --');
{
  const { eng } = bikinEngineer();
  eng.capability = 'OBSERVER';

  eng._sebabDemosi = 'laju';
  cek(/sebentar|menit/i.test(eng._alasanKapabilitasKurang()), 'sebab laju -> suruh menunggu', eng._alasanKapabilitasKurang());

  eng._sebabDemosi = 'keamanan';
  const pesanKeamanan = eng._alasanKapabilitasKurang();
  cek(/berkas inti/i.test(pesanKeamanan), 'sebab keamanan -> sebut berkas inti', pesanKeamanan);
  cek(/tidak pulih sendiri/i.test(pesanKeamanan), 'dan katakan terus terang bahwa ini tidak pulih sendiri', pesanKeamanan);

  eng._sebabDemosi = null;
  cek(/OBSERVER/.test(eng._alasanKapabilitasKurang()),
    'tanpa demosi -> sebut kapabilitas yang sedang berlaku', eng._alasanKapabilitasKurang());
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
