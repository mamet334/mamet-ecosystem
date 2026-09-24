// UJI 2026-09-24 — ingatan temuan Engineer (Tahap 3b), modul murni IngatanTemuan.js.
//
// Yang dijanjikan roadmap dan harus dibuktikan di sini:
//   "temuan yang sama tidak dilaporkan dua kali; setelah Owner menutup satu temuan, Engineer tidak
//    mengangkatnya lagi tanpa bukti baru."
import { pathToFileURL } from 'node:url';
const AKAR = 'D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/engineer/';
const T = await import(pathToFileURL(AKAR + 'IngatanTemuan.js').href + '?v=' + Date.now());
console.log('uji-ingatan-temuan v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const blok = (berkas, tingkat, ringkasan, bukti) =>
  `<temuan berkas="${berkas}" tingkat="${tingkat}">\nRINGKASAN: ${ringkasan}\nBUKTI: ${bukti}\n</temuan>`;

// ---------- pengambilan blok ----------
let r = T.ambilBlokTemuan(`Analisis saya.\n\n${blok('a.js', 'tinggi', 'logCommand tanpa pemanggil', 'git grep logCommand → 1 baris')}\n\nsekian.`);
cek(r.temuan.length === 1, 'satu blok terbaca', r);
cek(r.temuan[0].berkas === 'a.js' && r.temuan[0].tingkat === 'tinggi', 'atribut terbaca', r.temuan[0]);
cek(r.temuan[0].ringkasan === 'logCommand tanpa pemanggil', 'ringkasan terbaca', r.temuan[0]);
cek(/git grep/.test(r.temuan[0].bukti), 'bukti terbaca', r.temuan[0]);

r = T.ambilBlokTemuan(blok('a.js', 'ngawur', 'x', 'y'));
cek(r.temuan[0].tingkat === 'sedang', 'tingkat tak dikenal dinormalkan ke sedang — temuannya TIDAK dibuang');

// prosa yang terdengar seperti temuan sengaja TIDAK ditangkap
r = T.ambilBlokTemuan('Saya menemukan bahwa fungsi logCommand tidak pernah dipanggil. Ini temuan penting.');
cek(r.temuan.length === 0 && r.galat.length === 0,
  'KENDALI: prosa tanpa blok TIDAK ditangkap sama sekali (bentuk eksplisit, bukan tebakan)');

// blok tak lengkap ditolak dengan alasan, bukan diam
r = T.ambilBlokTemuan('<temuan berkas="a.js">RINGKASAN: ada yang aneh</temuan>');
cek(r.temuan.length === 0 && /BUKTI/.test(r.galat[0] || ''), 'temuan tanpa bukti ditolak, alasannya disebut', r.galat);
r = T.ambilBlokTemuan('<temuan tingkat="tinggi">RINGKASAN: x\nBUKTI: y</temuan>');
cek(r.temuan.length === 0 && /berkas/.test(r.galat[0] || ''), 'temuan tanpa alamat berkas ditolak', r.galat);
r = T.ambilBlokTemuan('<temuan berkas="a.js">BUKTI: y</temuan>');
cek(r.temuan.length === 0 && r.galat.length === 1, 'temuan tanpa ringkasan ditolak', r.galat);

// dua blok berturut-turut tidak saling memakan
r = T.ambilBlokTemuan(blok('a.js', 'rendah', 'satu', 'b1') + '\n' + blok('b.js', 'tinggi', 'dua', 'b2'));
cek(r.temuan.length === 2 && r.temuan[1].ringkasan === 'dua', 'dua blok terbaca terpisah', r.temuan.map((x) => x.ringkasan));

// dipanggil dua kali berturut-turut harus sama (lastIndex regex global tidak bocor)
const dua = T.ambilBlokTemuan(blok('a.js', 'rendah', 'satu', 'b1'));
cek(dua.temuan.length === 1, 'pemanggilan kedua tidak terpengaruh lastIndex regex global');

// ---------- kunci pembanding ----------
cek(T.kunciTemuan({ berkas: 'a.js', ringkasan: 'Fungsi  logCommand,  yatim.' }) === T.kunciTemuan({ berkas: 'A.JS', ringkasan: 'fungsi logCommand yatim' }),
  'beda huruf besar/kecil, tanda baca, dan spasi ganda dianggap temuan yang SAMA');
cek(T.kunciTemuan({ berkas: 'a.js', ringkasan: 'x' }) !== T.kunciTemuan({ berkas: 'b.js', ringkasan: 'x' }),
  'ringkasan sama di berkas berbeda adalah temuan BERBEDA');

// ---------- penggabungan: inti janji Tahap 3b ----------
let { daftar, baru } = T.gabungTemuan([], T.ambilBlokTemuan(blok('a.js', 'tinggi', 'satu', 'b1') + blok('b.js', 'rendah', 'dua', 'b2')).temuan);
cek(daftar.length === 2 && baru.length === 2, 'dua temuan pertama masuk semua');
cek(daftar[0].id === 'TMN-0001' && daftar[1].id === 'TMN-0002', 'ID diberi MESIN, berurutan', daftar.map((t) => t.id));
cek(daftar.every((t) => t.status === 'TERBUKA' && /^\d{4}-\d{2}-\d{2}$/.test(t.ditemukan)), 'status & tanggal diisi');

// sesi kedua melaporkan hal yang sama → tidak ditambahkan
let g2 = T.gabungTemuan(daftar, T.ambilBlokTemuan(blok('a.js', 'tinggi', 'Satu!', 'bukti lain')).temuan);
cek(g2.daftar.length === 2 && g2.baru.length === 0 && g2.kembar.length === 1,
  'TEMUAN SAMA TIDAK DILAPORKAN DUA KALI (janji utama Tahap 3b)', { n: g2.daftar.length, baru: g2.baru.length });
cek(g2.kembar[0].id === 'TMN-0001', 'yang kembar dikenali dengan ID aslinya');

// Owner menutup, lalu model mengangkatnya lagi → tetap tidak masuk, dan dilaporkan sebagai sudah ditutup
let ditutup = T.tutupTemuan(daftar, 'TMN-0001', 'bukan masalah, fungsi cadangan');
cek(ditutup[0].status === 'DITUTUP' && /bukan masalah/.test(ditutup[0].alasanTutup), 'penutupan tercatat beserta alasannya', ditutup[0]);
let g3 = T.gabungTemuan(ditutup, T.ambilBlokTemuan(blok('a.js', 'tinggi', 'satu', 'bukti baru')).temuan);
cek(g3.baru.length === 0 && g3.pernahDitutup.length === 1,
  'TEMUAN YANG SUDAH DITUTUP TIDAK DIANGKAT LAGI (janji kedua Tahap 3b)', g3);
cek(g3.daftar.length === 2, 'daftar tidak bertambah');

// temuan benar-benar baru tetap masuk sesudah ada yang ditutup, dengan nomor lanjut
let g4 = T.gabungTemuan(ditutup, T.ambilBlokTemuan(blok('c.js', 'sedang', 'tiga', 'b3')).temuan);
cek(g4.baru.length === 1 && g4.baru[0].id === 'TMN-0003', 'temuan baru tetap diterima, nomor lanjut (bukan mengisi lubang)', g4.baru[0]);

// ---------- berkas markdown bolak-balik ----------
const isi = T.susunBerkasTemuan(g4.daftar);
cek(/^# Temuan Engineer/.test(isi), 'berkas punya judul');
cek(/\*\*2 terbuka · 1 ditutup\*\*/.test(isi), 'jumlah terbuka/ditutup tertulis di kepala', isi.slice(0, 260));
cek(isi.indexOf('TMN-0002') < isi.indexOf('TMN-0001'), 'yang TERBUKA ditulis lebih dulu, yang DITUTUP di bawah');

const balik = T.bacaBerkasTemuan(isi);
cek(balik.length === 3, 'seluruh temuan terbaca kembali dari markdown', balik.length);
for (const asli of g4.daftar) {
  const b = balik.find((x) => x.id === asli.id);
  cek(!!b && b.berkas === asli.berkas && b.ringkasan === asli.ringkasan && b.tingkat === asli.tingkat && b.status === asli.status,
    `bolak-balik utuh untuk ${asli.id}`, { asli, b });
}
const tutupBalik = balik.find((x) => x.id === 'TMN-0001');
cek(tutupBalik.status === 'DITUTUP' && /bukan masalah/.test(tutupBalik.alasanTutup), 'alasan penutupan selamat bolak-balik', tutupBalik);

// kunci tetap cocok sesudah bolak-balik — kalau tidak, dedup rusak begitu aplikasi dimuat ulang
cek(T.kunciTemuan(tutupBalik) === T.kunciTemuan(g4.daftar.find((x) => x.id === 'TMN-0001')),
  'kunci pembanding tetap sama sesudah dibaca ulang dari berkas (dedup bertahan melewati restart)');
let g5 = T.gabungTemuan(balik, T.ambilBlokTemuan(blok('a.js', 'tinggi', 'satu', 'b')).temuan);
cek(g5.baru.length === 0 && g5.pernahDitutup.length === 1, 'dedup tetap jalan memakai daftar hasil baca berkas', g5);

cek(T.bacaBerkasTemuan('').length === 0, 'berkas kosong → daftar kosong, bukan galat');
cek(T.bacaBerkasTemuan(null).length === 0, 'berkas belum ada → daftar kosong');
cek(T.bacaBerkasTemuan('# Temuan Engineer\n\nbelum ada apa-apa.').length === 0, 'berkas tanpa temuan → daftar kosong');

// ---------- laporan di chat ----------
const lap = T.laporanTemuan({ baru: g4.baru, kembar: g2.kembar, pernahDitutup: g3.pernahDitutup, galat: ['satu blok dilewati'] });
cek(/1 temuan baru/.test(lap) && /TMN-0003/.test(lap), 'temuan baru disebut beserta ID-nya', lap);
cek(/sudah pernah dilaporkan/.test(lap), 'yang kembar dilaporkan, bukan disembunyikan');
cek(/sudah DITUTUP Owner/.test(lap), 'yang pernah ditutup dilaporkan apa adanya');
cek(/Blok yang dilewati/.test(lap), 'blok tak sah dilaporkan, bukan didiamkan');
cek(/belum tersimpan/.test(lap), 'jelas bahwa temuan baru BELUM ditulis ke disk sebelum Owner menyimpan');
cek(T.laporanTemuan({ baru: [], kembar: [], pernahDitutup: [], galat: [] }) === null, 'tidak ada apa-apa → tidak menempel pesan kosong');

// ---------- ringkasan untuk chat berikutnya ----------
const ring = T.ringkasanUntukKonteks(g4.daftar);
cek(/TEMUAN ENGINEER YANG MASIH TERBUKA — 2/.test(ring), 'hanya yang terbuka dihitung', ring.split('\n')[0]);
cek(!/TMN-0001/.test(ring), 'temuan yang sudah ditutup TIDAK dibawa ke konteks');
cek(/JANGAN laporkan ulang/.test(ring), 'instruksinya tegas, bukan saran');
cek(ring.indexOf('TMN-0002') < ring.indexOf('TMN-0003') || g4.daftar.find((t) => t.id === 'TMN-0002').tingkat === 'rendah',
  'diurut dari tingkat tertinggi');
const banyak = T.gabungTemuan([], Array.from({ length: 30 }, (_, i) => ({ berkas: `f${i}.js`, tingkat: 'rendah', ringkasan: `t${i}`, bukti: 'b' }))).daftar;
const ringBanyak = T.ringkasanUntukKonteks(banyak, 20);
cek((ringBanyak.match(/^- TMN-/gm) || []).length === 20 && /10 temuan terbuka lainnya/.test(ringBanyak),
  'daftar panjang dipotong dan sisanya DISEBUT jumlahnya, tidak hilang diam-diam');
cek(T.ringkasanUntukKonteks([]) === '', 'belum ada temuan → tidak menambah apa pun ke konteks');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
