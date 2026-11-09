
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = AKAR_REPO;
const P = await import(pathToFileURL(AKAR + '/frontend/src/components/workbench/pengirimanChat.js').href + '?v=' + Date.now());

console.log('uji-kiriman-percakapan v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

console.log('\n-- identitas --');
const pesanAwal = [{ role: 'user', content: 'Menurut dokumen HCDP, berapa pegawai yang diintervensi?' }];
const penanda = P.buatPenandaKiriman({ seq: 7, chatId: null, pesan: pesanAwal });

cek(P.masihPercakapanSama(penanda, 7), 'nomor urut sama → masih percakapan yang sama');
cek(!P.masihPercakapanSama(penanda, 8), 'nomor urut naik → Owner sudah berpindah');
cek(P.tujuanTulis(penanda, 7) === 'layar' && P.tujuanTulis(penanda, 8) === 'terlantar', 'tujuan tulis mengikuti nomor urut');

const pesanBerubah = [...pesanAwal];
const penanda2 = P.buatPenandaKiriman({ seq: 1, chatId: null, pesan: pesanBerubah });
pesanBerubah.length = 0;
pesanBerubah.push({ role: 'user', content: 'pesan percakapan LAIN' });
cek(penanda2.pesan.length === 1 && penanda2.pesan[0].content.includes('HCDP'),
  'pesan disalin saat kirim — tidak ikut berubah ketika percakapan berpindah', penanda2.pesan);

console.log('\n-- chatId null bukan penanda yang sah --');
const baruA = P.buatPenandaKiriman({ seq: 3, chatId: null, pesan: pesanAwal });
const baruB = P.buatPenandaKiriman({ seq: 4, chatId: null, pesan: [{ role: 'user', content: 'lain' }] });
cek(baruA.chatId === baruB.chatId, 'dua percakapan baru punya chatId yang SAMA (null) — id tidak bisa membedakannya');
cek(!P.masihPercakapanSama(baruA, baruB.seq), 'nomor urut tetap membedakannya');

console.log('\n-- penyelamatan jawaban terlantar --');
const selamat = P.pesanTerlantar(penanda, { content: '591 pegawai.', steps: [], metadata: { a: 1 } });
cek(selamat.length === 2, 'pertanyaan + jawaban, dua pesan');
cek(selamat[0].role === 'user' && selamat[0].content.includes('HCDP'), 'PERTANYAAN ikut tersimpan — inilah yang hilang pada bug');
cek(selamat[1].role === 'model' && selamat[1].content === '591 pegawai.', 'jawaban tersimpan sebagai pesan model');
cek(selamat[1].metadata?.a === 1, 'metadata jawaban ikut terbawa');
cek(P.pesanTerlantar(penanda, 'teks biasa')[1].content === 'teks biasa', 'jawaban berupa string juga diterima');

cek(P.layakSimpanTerlantar(penanda, { content: 'ada isinya' }), 'jawaban berisi → disimpan');
cek(!P.layakSimpanTerlantar(penanda, { content: '   ' }), 'jawaban kosong → TIDAK disimpan (jangan lahirkan percakapan setengah jadi)');
cek(!P.layakSimpanTerlantar(P.buatPenandaKiriman({ seq: 1, chatId: null, pesan: [] }), 'x'), 'tanpa pertanyaan → tidak disimpan');

console.log('\n-- peragaan: bertanya di chat baru, lalu membuka riwayat lain --');

function jalankan({ pakaiPenjaga }) {
  let seq = 0;
  let messages = [];
  let chatId = null;
  const tersimpan = [];
  const simpan = (id, isi) => tersimpan.push({ chatId: id, messages: [...isi] });

  messages = [...messages, { role: 'user', content: 'pertanyaan Owner' }];
  const tanda = P.buatPenandaKiriman({ seq, chatId, pesan: messages });
  const diLayar = () => P.tujuanTulis(tanda, seq) === 'layar';

  seq += 1;
  messages = [{ role: 'user', content: 'tanya lama' }, { role: 'model', content: 'jawab lama' }];
  chatId = 'chat-lama';

  const jawaban = { content: 'jawaban untuk pertanyaan Owner' };
  if (pakaiPenjaga && !diLayar()) {
    if (P.layakSimpanTerlantar(tanda, jawaban)) simpan(tanda.chatId, P.pesanTerlantar(tanda, jawaban));
  } else {
    messages = [...messages, { role: 'model', ...jawaban }];
    simpan(chatId, messages);
  }
  return { messages, tersimpan };
}

const lama = jalankan({ pakaiPenjaga: false });
const barisLama = lama.tersimpan[0];
cek(barisLama.chatId === 'chat-lama', 'KENDALI: tanpa penjaga, jawaban tersimpan ke percakapan LAIN', barisLama.chatId);
cek(barisLama.messages.some((m) => m.content === 'jawaban untuk pertanyaan Owner'), 'KENDALI: jawaban mendarat di sana');
cek(!barisLama.messages.some((m) => m.content === 'pertanyaan Owner'),
  'KENDALI: pertanyaan Owner TIDAK ada di sana — persis yang dilaporkan Owner');

const baru = jalankan({ pakaiPenjaga: true });
cek(baru.tersimpan.length === 1, 'sesudah perbaikan: tepat satu penyimpanan');
const barisBaru = baru.tersimpan[0];
cek(barisBaru.chatId === null, 'disimpan ke percakapan ASAL (null = chat baru, id lahir saat menyimpan)', barisBaru.chatId);
cek(barisBaru.messages[0].content === 'pertanyaan Owner' && barisBaru.messages[1].content === 'jawaban untuk pertanyaan Owner',
  'pertanyaan DAN jawaban lengkap di percakapan asal', barisBaru.messages);
cek(!baru.messages.some((m) => m.content === 'jawaban untuk pertanyaan Owner'),
  'percakapan yang sedang dibuka Owner TIDAK tersentuh');
cek(baru.messages.length === 2 && baru.messages[1].content === 'jawab lama', 'isi percakapan lain tetap utuh', baru.messages);

console.log('\n-- terpasang di ConversationEngine --');
const src = readFileSync(AKAR + '/frontend/src/components/workbench/ConversationEngine.jsx', 'utf8');
cek(src.includes("from './pengirimanChat.js'"), 'modul diimpor komponen');
cek((src.match(/percakapanSeqRef\.current \+= 1/g) || []).length === 2,
  'nomor urut dinaikkan di KEDUA tempat berpindah (handleNewChat & handleLoadChat)',
  (src.match(/percakapanSeqRef\.current \+= 1/g) || []).length);
for (const cb of ['onNalar', 'onChunk']) {
  const potongan = src.slice(src.indexOf(`${cb}:`), src.indexOf(`${cb}:`) + 220);
  cek(potongan.includes('if (!diLayar()) return;'), `${cb} dijaga sebelum menyentuh messages`);
}
const potonganDone = src.slice(src.indexOf('onDone:'), src.indexOf('onDone:') + 420);
cek(potonganDone.includes('if (!diLayar())') && potonganDone.includes('simpanTerlantar('),
  'onDone menyelamatkan jawaban ke percakapan asal');
const potonganError = src.slice(src.indexOf('onError:'), src.indexOf('onError:') + 900);
cek(potonganError.includes('if (!diLayar())') && potonganError.includes('simpanTerlantar('), 'onError ikut dijaga');
cek(potonganError.includes('blokGalat(galat)'), 'dan galatnya diterjemahkan dulu, bukan teks server mentah');
cek(src.includes('onNewChatId: () => {}'), 'penyimpanan terlantar TIDAK memindahkan Owner ke percakapan itu');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
