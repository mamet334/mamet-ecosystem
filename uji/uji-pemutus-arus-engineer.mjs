// UJI 2026-10-02 — TMN-0004: pemutus arus yang hukumannya tak pernah habis.
//
// ── Cacatnya ────────────────────────────────────────────────────────────────────────────────
// `_handlePatchTask` menghitung penerapan patch per menit. Pencacahnya adalah pembatas LAJU —
// jendelanya mereset tiap 60 detik. Tetapi hukumannya TIDAK: sekali `capability` turun ke
// OBSERVER, satu-satunya jalan pulih adalah `upgradeCapability()`, dan method itu NOL pemanggil
// di seluruh repo. Jadi enam patch dalam semenit = Engineer berhenti menambal sampai aplikasi
// ditutup. Senyap pula — hanya console.warn, tanpa satu pun emit.
//
// ── Yang paling mudah salah saat memperbaikinya ──────────────────────────────────────────────
// Ada demosi KEDUA yang memakai 'OBSERVER' yang sama (3 percobaan menyentuh berkas inti). Yang
// itu SENGAJA lengket. Pemulihan otomatis yang tidak membedakan sebab akan mengangkat demosi
// keamanan satu menit kemudian — memperbaiki satu cacat sambil membuka lubang yang lebih buruk.
// Uji D & H menjaga justru itu.
//
// Uji ini MENJALANKAN kelas Engineer yang asli, bukan mencocokkan teks kodenya.

import { Engineer, BATAS_PATCH_PER_MENIT, JENDELA_PEMUTUS_MS } from '../frontend/src/core/runtime/services/engineer.js';

console.log('uji-pemutus-arus-engineer v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ── Perancah: serviceManager palsu yang menjawab apa pun tanpa efek ─────────────────────────
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

// Menjalankan N tugas patch. `capability` disetel bukan-IMPLEMENTER supaya tiap panggilan
// berhenti di gerbang kapabilitas dan tidak menyentuh pekerjaan patch yang sungguhan —
// pencacah pemutus arusnya tetap bertambah, karena ia dihitung SEBELUM gerbang itu.
const jalankan = async (eng, n) => {
  for (let i = 0; i < n; i++) await eng._handlePatchTask({ id: `t${i}` });
};
const majukanWaktu = (eng) => { eng._lastApiReset -= JENDELA_PEMUTUS_MS + 1000; };
const pancaran = (dipancar, nama) => dipancar.filter((e) => e.nama === nama);

// ── A. Keadaan awal ─────────────────────────────────────────────────────────────────────────
console.log('\n-- A. keadaan awal --');
{
  const { eng } = bikinEngineer();
  cek(eng.capability === 'IMPLEMENTER', 'mulai sebagai IMPLEMENTER', eng.capability);
  cek(eng._sebabDemosi === null, 'belum ada sebab demosi', eng._sebabDemosi);
  cek(BATAS_PATCH_PER_MENIT === 5 && JENDELA_PEMUTUS_MS === 60000,
    'ambangnya konstanta bernama, bukan angka mati di tengah kode', { BATAS_PATCH_PER_MENIT, JENDELA_PEMUTUS_MS });
}

// ── B. Pemutusnya masih memutus (jangan sampai perbaikan melumpuhkan penjaganya) ────────────
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

  // Dulu bagian ini hanya console.warn — Owner tak pernah diberi tahu kenapa Engineer berhenti.
  const saran = pancaran(dipancar, 'Engineer:Recommendation');
  const terakhir = saran.at(-1)?.muatan?.message || '';
  cek(/pemutus arus/i.test(terakhir), 'Owner diberi tahu pemutus arusnya, bukan dibiarkan menebak', terakhir);
  cek(/detik/.test(terakhir), 'disebut kapan bisa dicoba lagi', terakhir);
}

// ── C. INTI TMN-0004: hukumannya ikut habis bersama jendelanya ──────────────────────────────
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

// Pulihnya harus kembali ke kapabilitas SEBELUMNYA, bukan dipaksa ke IMPLEMENTER.
{
  const { eng } = bikinEngineer();
  eng.capability = 'ARCHITECT';
  await jalankan(eng, BATAS_PATCH_PER_MENIT + 1);
  majukanWaktu(eng);
  await jalankan(eng, 1);
  cek(eng.capability === 'ARCHITECT',
    'pulih ke kapabilitas sebelumnya (ARCHITECT), tidak naik diam-diam ke IMPLEMENTER', eng.capability);
}

// ── D. Demosi KEAMANAN tidak boleh ikut pulih ───────────────────────────────────────────────
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

// ── H. Pemutus arus tidak boleh MENIMPA sebab keamanan ──────────────────────────────────────
// Kalau ia menimpanya jadi 'laju', demosi keamanan akan pulih sendiri semenit kemudian.
{
  const { eng } = bikinEngineer();
  eng._sebabDemosi = 'keamanan';
  eng.capability = 'OBSERVER';
  eng._kapabilitasSebelumDemosi = 'IMPLEMENTER';

  await jalankan(eng, BATAS_PATCH_PER_MENIT + 1);
  cek(eng._sebabDemosi === 'keamanan',
    'pemutus arus tidak menurunkan derajat sebab keamanan jadi laju', eng._sebabDemosi);
  // Tanpa asersi ini, M4 (pemutus menimpa sebab keamanan) lolos lewat kebetulan: ia menyimpan
  // 'OBSERVER' sebagai kapabilitas-sebelum-demosi, jadi "pulih" pun hasilnya tetap OBSERVER.
  cek(eng._kapabilitasSebelumDemosi === 'IMPLEMENTER',
    'kapabilitas asli sebelum penguncian keamanan tidak ikut tertimpa', eng._kapabilitasSebelumDemosi);

  majukanWaktu(eng);
  await jalankan(eng, 1);
  cek(eng.capability === 'OBSERVER', 'dan karenanya tetap tidak pulih sendiri', eng.capability);
}

// ── E. Pemulihan otomatis tidak menihilkan penjaga keamanan ─────────────────────────────────
console.log('\n-- E. hitungan kecurigaan tidak kena imbas --');
{
  const { eng } = bikinEngineer();
  eng.capability = 'REVIEWER';
  eng.suspiciousAttempts = 2; // satu langkah lagi sebelum penguncian keamanan

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

// ── F. Nama kapabilitas ngawur tetap ditolak ────────────────────────────────────────────────
console.log('\n-- F. masukan ngawur --');
{
  const { eng } = bikinEngineer();
  eng.capability = 'REVIEWER';
  cek(eng.upgradeCapability('RAJA') === false, 'kapabilitas tak dikenal ditolak');
  cek(eng.capability === 'REVIEWER', 'dan kapabilitasnya tidak berubah', eng.capability);
}

// ── G. Pesan ke Owner menyebut SEBABNYA ─────────────────────────────────────────────────────
// Pesan lama "Engineer belum memiliki kapabilitas IMPLEMENTER" benar, tetapi tidak bisa
// ditindaklanjuti: Owner tak tahu harus menunggu, memeriksa tugasnya, atau mengangkat kembali.
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
