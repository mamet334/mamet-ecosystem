
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = AKAR_REPO;
const J = await import(pathToFileURL(`${AKAR}/frontend/src/core/runtime/services/jejakSisipan.js`).href + '?v=' + Date.now());
const { jejakSisipan } = J;

console.log('uji-jejak-sisipan v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

console.log('\n-- diam bila bukan Engineer --');
cek(jejakSisipan({ engineer: false, catatanAkar: 'x' }) === '', 'bukan Engineer → tidak mencatat apa pun');
cek(jejakSisipan() === '', 'tanpa argumen → tidak meledak, tidak mencatat');

console.log('\n-- keadaan sehat --');
{
  const t = jejakSisipan({
    engineer: true, akarRepo: 'D:/repo', petaMentah: 'p'.repeat(15493),
    catatanAkar: 'a'.repeat(1180), catatanKons: 'k'.repeat(900), catatanPeta: 'q'.repeat(15742), catatanPerintah: 'c'.repeat(1400), ringkasanTemuan: 't'.repeat(300),
    mulaiDari: 0, jumlahPesan: 4,
  });
  cek(t.startsWith('[Sisipan]'), 'berawalan penanda yang mudah dicari di konsol', t);
  cek(/akarRepo=ADA/.test(t), 'menyebut akar repo ada');
  cek(/petaMentah=15493/.test(t), 'menyebut ukuran peta MENTAH dari proses utama');
  cek(/akar=1180 konstitusi=900 peta=15742 perintah=1400 temuan=300/.test(t), 'ukuran tiap sisipan disebut terpisah', t);
  cek(/5 sisipan \/ 19522 huruf/.test(t), 'jumlah & total huruf dihitung', t);
  cek(!/KOSONG/.test(t), 'tidak ada peringatan kosong saat semuanya ada', t);
}

console.log('\n-- membedakan dua kerusakan --');
{
  const a = jejakSisipan({ engineer: true, akarRepo: 'D:/repo', petaMentah: '', catatanPeta: '', catatanAkar: 'a'.repeat(1180) });
  cek(/petaMentah=0/.test(a) && /peta=0/.test(a), '(a) jembatan kosong → petaMentah=0 DAN peta=0', a);

  const b = jejakSisipan({ engineer: true, akarRepo: 'D:/repo', petaMentah: 'p'.repeat(15493), catatanPeta: '', catatanAkar: 'a'.repeat(1180) });
  cek(/petaMentah=15493/.test(b) && /peta=0/.test(b), '(b) jembatan berisi tetapi catatan kosong → terbedakan', b);

  cek(a !== b, 'dua kerusakan itu menghasilkan baris yang BERBEDA — itu gunanya instrumen ini');
}

console.log('\n-- menyebut yang hilang --');
{
  const t = jejakSisipan({ engineer: true, akarRepo: 'D:/repo', catatanAkar: 'a'.repeat(100), catatanPeta: '', ringkasanTemuan: '' });
  cek(/KOSONG: konstitusi, peta, perintah, temuan/.test(t), 'menyebut nama sisipan yang kosong, bukan sekadar jumlahnya', t);
  cek(/1 sisipan/.test(t), 'jumlah sisipan ikut benar', t);
}

console.log('\n-- penanda konteks --');
{
  const t = jejakSisipan({ engineer: true, akarRepo: 'D:/r', catatanAkar: 'a', mulaiDari: 7, jumlahPesan: 12 });
  cek(/mulaiDari=7 dari 12 pesan/.test(t), 'penanda "mulai dari" & jumlah pesan ikut dicatat', t);
}

console.log('\n-- tidak membocorkan isi --');
{
  const t = jejakSisipan({
    engineer: true, akarRepo: 'D:/rahasia/proyek', petaMentah: 'ISI-PETA-RAHASIA',
    catatanAkar: 'ALAMAT-RAHASIA', catatanPeta: 'DAFTAR-BERKAS', ringkasanTemuan: 'TEMUAN-SENSITIF',
  });
  for (const bocor of ['ISI-PETA-RAHASIA', 'ALAMAT-RAHASIA', 'DAFTAR-BERKAS', 'TEMUAN-SENSITIF', 'D:/rahasia/proyek']) {
    cek(!t.includes(bocor), `isi "${bocor}" TIDAK ikut tercatat`, t);
  }
  cek(/akarRepo=ADA/.test(t), 'tetapi keberadaan akar repo tetap dilaporkan (ADA/KOSONG, bukan alamatnya)', t);
}

console.log('\n-- terpasang --');
{
  const CE = readFileSync(`${AKAR}/frontend/src/components/workbench/ConversationEngine.jsx`, 'utf8').replace(/\r\n/g, '\n');
  const KODE = CE.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

  cek(/import \{ jejakSisipan \} from '\.\.\/\.\.\/core\/runtime\/services\/jejakSisipan\.js';/.test(KODE), 'diimpor komponen');
  cek(/const jejak = jejakSisipan\(\{/.test(KODE), 'dipanggil di handleSend');
  cek(/if \(jejak\) console\.log\(jejak\);/.test(KODE), 'dicetak hanya bila ada isinya');
  cek(/engineer: isEngineerWorkspace,/.test(KODE), 'memakai penanda Engineer yang sama dengan jalur kirim');
  cek(/petaMentah: peta,/.test(KODE), 'peta MENTAH ikut dilaporkan, bukan hanya catatannya');

  const iSisipan = KODE.indexOf('const sisipan = [catatanAkar');
  const iJejak = KODE.indexOf('const jejak = jejakSisipan({');
  const iKirim = KODE.indexOf('await assistantService.processMessage(');
  cek(iSisipan > 0 && iJejak > iSisipan && iKirim > iJejak,
    'urutannya: sisipan disusun → dicatat → baru dikirim', { iSisipan, iJejak, iKirim });
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
