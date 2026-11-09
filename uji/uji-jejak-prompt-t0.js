const VERSI = 't0-1';

export const SKENARIO = [
  { teks: 'Apa yang kamu ketahui tentang Mamet Ecosystem dari dokumen sejarah aplikasi saya?', menguji: 'RAG di space besar' },
  { teks: 'Kapan diputuskan memakai satu set ikon Material, dan apa alasannya?', menguji: 'RAG satu dokumen tertentu' },
  { teks: 'Apa isi changelog paling awal yang ada di dokumen saya?', menguji: 'RAG tanpa alat menelusuri (Tahap B)' },
  { teks: 'Bandingkan keputusan ikon tadi dengan keputusan tema aplikasi sesudahnya.', menguji: 'pertanyaan lanjutan + RAG' },
  { teks: 'Ringkas tiga jawabanmu sebelumnya dalam satu paragraf.', menguji: 'riwayat utuh' },
  { teks: 'Lihat daftar berkas di folder kerja, lalu baca berkas README-nya.', menguji: 'alat folder (pilih folder 📁 dulu)' },
  { teks: 'Jangan dicari kembali: dari berkas yang tadi kamu baca, apa judul bagian pertamanya dan berapa barisnya?', menguji: 'hasil alat terbawa (C4)' },
  { teks: 'Jelaskan apa arti kata bypass dalam konteks keamanan aplikasi.', menguji: 'blokir kata kunci (Tahap D)' },
  { teks: 'Apa yang kamu jawab di pertanyaan pertama tadi? Sebutkan poin-poinnya.', menguji: 'riwayat paling awal' },
  { teks: 'Dari dokumen saya, apa yang berubah pada rilis 4.4.1?', menguji: 'RAG' },
  { teks: 'Hubungkan jawaban rilis 4.4.1 itu dengan keputusan ikon di awal percakapan.', menguji: 'riwayat panjang' },
  { teks: 'Apa saja keputusan Owner yang tercatat tentang RAG di dokumen saya?', menguji: 'RAG' },
  { teks: 'Dari semua yang sudah kita bahas, mana yang paling sering muncul?', menguji: 'riwayat utuh (> 15 pesan)' },
  { teks: 'Ulangi isi README yang kamu baca tadi, tanpa membacanya lagi.', menguji: 'hasil alat terbawa jauh (C4)' },
  { teks: 'Sebutkan semua dokumen yang kamu kutip sepanjang percakapan ini.', menguji: 'riwayat + sumber' },
  { teks: 'Terakhir: apa pertanyaan kedua saya di percakapan ini, persis kata-katanya?', menguji: 'riwayat paling awal (> 15 pesan)' },
];

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

function asisten() {
  const sm = window.__mamet?.serviceManager;
  if (!sm) throw new Error('window.__mamet tidak ada — jalankan dari `npm run desktop` (mode dev).');
  const a = sm.get('AssistantService');
  if (!a || !Array.isArray(a.riwayatJejak)) throw new Error('AssistantService belum membawa riwayatJejak — muat ulang aplikasi sesudah kode Tahap 0 terpasang.');
  return a;
}

export function mulai() {
  console.log(`[uji-jejak-t0] versi skrip ${VERSI}`);
  const a = asisten();
  a.riwayatJejak.length = 0;
  console.log('[uji-jejak-t0] catatan jejak dikosongkan. Buka PERCAKAPAN BARU di Assistant, pilih folder kerja 📁 bila ingin menguji alat, lalu:');
  console.log('  • otomatis: await t0.jalankan()   • manual: ketik pertanyaan t0.SKENARIO satu per satu, lalu await t0.laporan()');
  return SKENARIO.map((s, i) => `${i + 1}. ${s.teks}`).join('\n');
}

function kotakKetik() {
  const t = document.querySelector('textarea[placeholder^="Ketik instruksi"]');
  if (!t) throw new Error('kotak ketik chat tidak ditemukan — buka Assistant.');
  return t;
}

function sedangMenunggu() {
  const t = kotakKetik();
  const form = t.closest('form') || t.parentElement?.closest('form') || document;
  return !form.querySelector('button[type="submit"]');
}

async function kirim(teks) {
  const t = kotakKetik();
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  setter.call(t, teks);
  t.dispatchEvent(new Event('input', { bubbles: true }));
  await tunggu(150);
  t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
}

export async function jalankan({ dari = 1, sampai = SKENARIO.length, batasDetik = 240 } = {}) {
  console.log(`[uji-jejak-t0] versi skrip ${VERSI} — menjalankan pertanyaan ${dari}–${sampai}`);
  const a = asisten();
  for (let i = dari - 1; i < sampai; i++) {
    const sebelum = a.riwayatJejak.length;
    await kirim(SKENARIO[i].teks);
    const mulaiMs = Date.now();
    while (a.riwayatJejak.length === sebelum && Date.now() - mulaiMs < 30000) await tunggu(300);
    while (sedangMenunggu() && Date.now() - mulaiMs < batasDetik * 1000) await tunggu(500);
    if (sedangMenunggu()) { console.warn(`[uji-jejak-t0] pertanyaan ${i + 1} melewati ${batasDetik} s — dihentikan di sini`); break; }
    console.log(`[uji-jejak-t0] ${i + 1}/${SKENARIO.length} selesai (${Math.round((Date.now() - mulaiMs) / 1000)} s) — ${SKENARIO[i].menguji}`);
    await tunggu(1500);
  }
  return laporan();
}

export async function laporan() {
  const G = await import(new URL('./lib/gerbangJejak.mjs', import.meta.url).href);
  const a = asisten();
  const giliran = G.kelompokkanGiliran(a.riwayatJejak);
  const nilai = G.nilaiGiliran(giliran);
  const baris = giliran.map((g) => {
    const p = g.pasangan[0];
    const s = p.server, k = p.klien;
    const utama = s?.panggilanModel?.filter((m) => m.utama).at(-1);
    const merah = nilai.temuan.filter((t) => t.giliran === g.nomor && t.tingkat === 'MERAH').map((t) => t.kode);
    return {
      giliran: g.nomor,
      kiriman: g.pasangan.length,
      jalur: k?.jalur ?? '?',
      riwayatKlien: k ? `${k.riwayatTersedia.pesan}→${k.dikirim.pesan} pesan` : '-',
      diterimaServer: s ? `${s.riwayatDiterima.pesan}/${s.riwayatDiterima.huruf}` : '-',
      keModel: utama ? `${utama.riwayat.pesan}/${utama.riwayat.huruf}` : '-',
      sistem: utama?.sistemHuruf ?? '-',
      rag: s?.rag?.diminta ? `${s.rag.ditemukan ?? '×'}→${s.rag.dikirim}${s.rag.datangTerlambat ? ` (+${s.rag.datangTerlambat.potongan} terlambat)` : ''}${s.rag.habisWaktu ? ' ⏱' : ''}` : '-',
      kebijakan: s?.kebijakan?.keputusan ?? '-',
      merah: [...new Set(merah)].join(', ') || '—',
    };
  });
  console.table(baris);
  console.log(`[uji-jejak-t0] ${nilai.hijau ? 'HIJAU' : 'MERAH'} — ${nilai.merah} merah, ${nilai.kuning} kuning, ${nilai.info} info · per kode:`, nilai.perKode);
  const bagi = { versi: VERSI, gerbang: nilai.versi, waktu: new Date().toISOString(), hijau: nilai.hijau, merah: nilai.merah, kuning: nilai.kuning, perKode: nilai.perKode, giliran: baris, temuan: nilai.temuan };
  console.log('[uji-jejak-t0] SALIN BARIS DI BAWAH UNTUK DILAPORKAN (hanya angka, tanpa isi pesan):');
  console.log(JSON.stringify(bagi));
  return bagi;
}
