// UJI 2026-09-29 — alat ukur Item 93 Tahap 3 (embedding lokal).
//
// Tahap 3 bukan fitur melainkan PERCOBAAN: "uji model 768-D lokal dengan set uji Kepbup, di luar
// aplikasi, $0 — lolos baru dirancang." Artinya seluruh keputusan bergantung pada satu angka.
//
// Maka alat ukurnya yang paling berbahaya kalau salah: **alat ukur yang keliru akan meluluskan model
// yang buruk**, dan kita tidak akan pernah tahu — sama seperti uji cermin yang tetap hijau sementara
// kodenya rusak. Uji ini memeriksa alat ukurnya, bukan modelnya.

import { pathToFileURL } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const U = await import(pathToFileURL(`${AKAR}/scripts/kedaulatan/ukurRecall.mjs`).href + '?v=' + Date.now());

console.log('uji-ukur-recall v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. Pencocokan bukti persis seperti ATURAN di berkas set uji ──────────────────────────────
console.log('\n-- pencocokan bukti --');

const alt = { nama: 'Tabel 2.6 baris 5', semua: ['Rasio Jabatan Fungsional Bersertifikat Kompetensi', '5,93%'] };

cek(U.potonganCocok('… Rasio Jabatan Fungsional Bersertifikat Kompetensi 5,93% …', alt), 'kedua teks ada → cocok');
cek(!U.potonganCocok('Rasio Jabatan Fungsional Bersertifikat Kompetensi saja', alt),
  'SEMUA harus ada — satu saja tidak cukup');
cek(U.potonganCocok('rasio   jabatan\nfungsional bersertifikat  kompetensi … 5,93%', alt),
  'spasi dirapatkan & huruf besar/kecil diabaikan, persis aturannya');
cek(!U.potonganCocok('', alt) && !U.potonganCocok(null, alt), 'potongan kosong tidak pernah cocok');
cek(!U.potonganCocok('apa pun', { semua: [] }), 'alternatif kosong tidak pernah cocok — jangan meluluskan gratis');

// ── 2. Peringkat bukti ───────────────────────────────────────────────────────────────────────
console.log('\n-- peringkat bukti --');

const terurut = [
  { id: 'c1', isi: 'potongan tak relevan', skor: 0.71 },
  { id: 'c2', isi: 'Rasio Jabatan Fungsional Bersertifikat Kompetensi 5,93% tahun 1', skor: 0.68 },
  { id: 'c3', isi: 'Rasio Jabatan Fungsional Bersertifikat Kompetensi 5,93% lagi', skor: 0.60 },
];
const t = U.peringkatBukti(terurut, [alt]);
cek(t?.peringkat === 2, 'peringkat = posisi potongan PERTAMA yang cocok', t);
cek(t?.alternatif === 'Tabel 2.6 baris 5', 'nama alternatif ikut dilaporkan');
cek(U.peringkatBukti(terurut, [{ semua: ['tidak ada di mana pun'] }]) === null,
  'tak ada yang cocok → null, BUKAN 0 atau Infinity yang bisa terhitung diam-diam');
cek(U.peringkatBukti(terurut, []) === null, 'tanpa bukti (soal NEG) → null');

// ── 3. Kosinus ───────────────────────────────────────────────────────────────────────────────
console.log('\n-- kosinus --');

cek(Math.abs(U.kosinus([1, 0], [1, 0]) - 1) < 1e-12, 'vektor identik → 1');
cek(Math.abs(U.kosinus([1, 0], [0, 1])) < 1e-12, 'tegak lurus → 0');
cek(Math.abs(U.kosinus([1, 0], [2, 0]) - 1) < 1e-12, 'panjang tidak berpengaruh, hanya arah');
cek(U.kosinus([1, 0, 0], [1, 0]) === null, 'dimensi berbeda → null, bukan angka menyesatkan');
cek(U.kosinus([0, 0], [1, 1]) === null, 'vektor nol → null, bukan NaN');
for (const b of [null, 'x', [], undefined]) cek(U.kosinus([1, 1], b) === null, `masukan buruk (${JSON.stringify(b)}) → null`);

// ── 4. Penilaian: dua angka, dan kenapa ──────────────────────────────────────────────────────
// Ambang 0,55 milik model server sekarang. Skala kosinus BERBEDA antar model, jadi menilai model
// lokal dengan ambang model lain akan menjatuhkannya karena alasan yang salah.
console.log('\n-- dua angka: dengan & tanpa ambang --');

const soal = { id: 'HCDP-01', bukti: [alt] };
let n = U.nilaiPertanyaan(soal, terurut, { ambang: 0.55 });
cek(n.peringkat === 2 && n.lolos === true && n.lolosTanpaAmbang === true, 'peringkat 2, skor 0,68 → lolos keduanya', n);

const skorRendah = terurut.map((p, i) => ({ ...p, skor: [0.41, 0.40, 0.39][i] }));
n = U.nilaiPertanyaan(soal, skorRendah, { ambang: 0.55 });
cek(n.lolosTanpaAmbang === true && n.lolos === false,
  'peringkat bagus tapi skor di bawah ambang model lain → dibedakan, tidak langsung dianggap gagal', n);

const jauh = Array.from({ length: 12 }, (_, i) => ({ id: 'x' + i, isi: 'lain', skor: 0.9 - i * 0.01 }));
jauh.push({ id: 'bukti', isi: 'Rasio Jabatan Fungsional Bersertifikat Kompetensi 5,93%', skor: 0.5 });
n = U.nilaiPertanyaan(soal, jauh, { ambang: 0.55 });
cek(n.peringkat === 13 && n.lolosTanpaAmbang === false, 'peringkat di luar 8 → tidak lolos walau tanpa ambang', n);

// Soal NEG: tidak punya bukti; yang dicatat skor teratas & berapa potongan akan masuk konteks.
n = U.nilaiPertanyaan({ id: 'NEG-01', bukti: [] }, terurut, { ambang: 0.55 });
cek(n.negatif === true && n.lolos === null, 'NEG tidak dinilai lolos/gagal — ia bukan pertanyaan berjawab');
cek(n.skorTeratas === 0.71 && n.diAtasAmbang === 3, 'NEG mencatat skor ke-1 & jumlah potongan di atas ambang', n);

// ── 5. Ringkasan ─────────────────────────────────────────────────────────────────────────────
console.log('\n-- ringkasan --');

const r = U.ringkasHasil([
  { id: 'A', negatif: false, lolos: true, lolosTanpaAmbang: true },
  { id: 'B', negatif: false, lolos: false, lolosTanpaAmbang: true },
  { id: 'C', negatif: false, lolos: false, lolosTanpaAmbang: false },
  { id: 'NEG-01', negatif: true, skorTeratas: 0.3, diAtasAmbang: 0 },
]);
cek(r.total === 3 && r.lolos === 1 && r.lolosTanpaAmbang === 2, 'dua angka dihitung terpisah', r);
cek(r.gagal.join() === 'C', 'yang benar-benar gagal disebut namanya');
cek(r.kalahAmbangSaja.join() === 'B',
  'yang kalah HANYA karena ambang dipisahkan — itu tanda ambang perlu ditera ulang, bukan model buruk', r);
cek(r.negatif.length === 1 && r.negatif[0].id === 'NEG-01', 'soal NEG dilaporkan terpisah');

// ── 6. Set uji nyata ada & bentuknya sesuai ──────────────────────────────────────────────────
console.log('\n-- set uji nyata --');

const SET = `${AKAR}/uji/data-lokal/set-uji-pengambilan.json`;
if (!existsSync(SET)) {
  console.log('DILEWATI — uji/data-lokal/ tidak ada di mesin ini (data berisi NIP, di luar git; lihat uji/README.md)');
  process.exit(gagal ? 1 : 0);
}
const set = JSON.parse(readFileSync(SET, 'utf8'));
const positif = set.pertanyaan.filter((p) => Array.isArray(p.bukti) && p.bukti.length);
cek(positif.length === 14, `set uji memuat 14 pertanyaan berjawab (ditemukan ${positif.length})`);
cek(set.pertanyaan.length - positif.length === 3, 'dan 3 soal NEG');
cek(/peringkat bukti <= 8/.test(JSON.stringify(set.aturan)), 'aturan recall@8 memang tertulis di berkas setnya');
cek(/0,55/.test(JSON.stringify(set.aturan)), 'ambang 0,55 memang berasal dari berkas set, bukan dikarang modul');
// Alat ukurnya harus sanggup membaca bentuk bukti yang NYATA, bukan hanya contoh di atas.
cek(positif.every((p) => p.bukti.every((b) => Array.isArray(b.semua) && b.semua.length)),
  'semua bukti nyata berbentuk {semua:[...]} seperti yang dibaca potonganCocok');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
