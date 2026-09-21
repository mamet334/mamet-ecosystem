/**
 * OCR HALAMAN PDF BERTABEL VIA MISTRAL-OCR (Item 76b, riset 2026-09-14)
 *
 * `documentTextExtractor.js` (`deteksiTabelHalaman`) menandai halaman PDF yang tampak bertabel —
 * pdf.js meratakan kolom tabel jadi baris tunggal tanpa jeda, tak ada cara merapikannya dari teks
 * saja. Untuk halaman itu SAJA (bukan seluruh buku, sengaja dibatasi Item 76b), halaman dipisah
 * jadi PDF satu halaman lalu dikirim ke OpenRouter dengan plugin `file-parser` (`engine:
 * 'mistral-ocr'`) — ditagih ke kunci OpenRouter pengguna sendiri (BYOK, sama seperti embedding di
 * Item 63), ~$0,002/halaman ($2/1.000 halaman).
 *
 * TEKS DIAMBIL DARI `annotations`, BUKAN DARI BALASAN MODEL. Plugin menaruh hasil mistral-ocr di
 * `choices[0].message.annotations[].file.content[]`; model penerima hanya perlu membalas "OK"
 * (`max_tokens` kecil). Versi pertama meminta model "menyalin ulang" lalu membaca `message.content` —
 * padahal riset membuktikan model mengubah teks saat menyalin (`start|startservice` →
 * `start startservice`), dan tanpa `max_tokens` halaman panjang bisa terpotong. Di uji riset
 * `content` hanya berisi "OK" sedangkan 94 baris tabel ada di annotations.
 *
 * Riset (changelog 2026-09-14-tabel-docx-jadi-markdown.md): `mistral-ocr` jauh lebih baik dari
 * pdf.js untuk tabel, tapi punya pola cacat TETAP yang dibersihkan `bersihkanHasilOcr`. Kesalahan
 * baca kata asli (4 dari 30 halaman uji) TIDAK bisa dibersihkan otomatis — diwariskan.
 *
 * Biaya parser ditagih ke MODEL PENERIMA, bukan tampil sebagai model Mistral di dashboard OpenRouter
 * — dibuktikan lewat `cost_details.upstream_inference_cost` di riset (cost $0,06133 − upstream
 * $0,00133 = $0,06000 = 30 halaman × $0,002).
 *
 * SALINAN: mametlite/src/lib/pdfOcrService.js memuat logika yang sama. Ubah keduanya bersamaan.
 */

// Model penerima termurah yang terbukti bekerja dengan plugin file-parser di uji riset. Ia hanya
// membalas "OK" — hasil OCR tidak melewati model.
const MODEL_PENERIMA = 'google/gemini-2.5-flash-lite';
const DOLAR_PER_HALAMAN_OCR = 0.002; // $2 / 1.000 halaman (mistral-ocr via OpenRouter)

export class GagalOcr extends Error {
  constructor(status, detail) {
    super(`OCR gagal (${status}): ${detail}`);
    this.status = status;
  }
}

/** Perkiraan biaya OCR untuk sejumlah halaman, dalam dolar. */
export function perkiraanOcr(jumlahHalaman) {
  return jumlahHalaman * DOLAR_PER_HALAMAN_OCR;
}

/** Jumlah halaman PDF (pdf-lib, di perangkat) — untuk perkiraan biaya sebelum OCR seluruh halaman (Item 92 Tahap 5). */
export async function hitungHalamanPdf(bytes) {
  const { PDFDocument } = await import('pdf-lib');
  return (await PDFDocument.load(bytes)).getPageCount();
}

/** Potong satu halaman (1-based) dari PDFDocument pdf-lib yang SUDAH dimuat menjadi PDF tersendiri. */
export async function pisahHalamanPdf(asal, nomorHalaman) {
  const { PDFDocument } = await import('pdf-lib');
  const baru = await PDFDocument.create();
  const [halaman] = await baru.copyPages(asal, [nomorHalaman - 1]);
  baru.addPage(halaman);
  return baru.save();
}

function bytesKeBase64(bytes) {
  let biner = '';
  for (let i = 0; i < bytes.length; i++) biner += String.fromCharCode(bytes[i]);
  return btoa(biner);
}

const ENTITAS = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

// Elemen HTML yang wajar muncul sebagai isi asli buku teknis (payload, contoh markup). Tag penutup
// dengan nama ini TIDAK dianggap palsu.
const ELEMEN_HTML = new Set(('a abbr address article aside audio b body br button canvas code div dl dt dd em '
  + 'embed footer form frame h1 h2 h3 h4 h5 h6 head header html i iframe img input label li link main '
  + 'meta nav object ol option p pre script section select small source span strong style sub sup svg '
  + 'table tbody td textarea tfoot th thead title tr u ul video xml').split(' '));

/**
 * Bersihkan pola cacat TETAP mistral-ocr yang ditemukan riset (bukan salah-baca kata asli):
 *  - Tag penutup palsu: placeholder seperti `<value>` dianggap tag HTML, dan mistral-ocr menambahkan
 *    penutupnya sebagai DERETAN DI AKHIR HALAMAN (`--key-name <value></value></value>`,
 *    `…--recursive</key_name></key_name></bucket_name>`). Riset: 44 tag, semuanya di akhir halaman,
 *    termasuk nama bergaris bawah. Hanya deretan di akhir halaman yang bukan elemen HTML yang dihapus
 *    — `</script>` asli di tengah halaman, atau `<p>isi</p>` di akhir, tidak disentuh.
 *  - Entitas HTML (`&amp;&amp;`, `&lt;vpc_id&gt;`) — didekode SESUDAH tag dibuang.
 *  - `$\equiv$` pengganti tanda sama dengan (`"…ConsoleLogin"=Success` → `ConsoleLogin $\equiv$ Success`).
 *  - Spasi ganda di tepi sel tabel (`|  adb shell … | … UTC  |`) — spasi di dalam isi sel tidak diubah.
 */
export function bersihkanHasilOcr(teks) {
  return String(teks || '')
    .replace(/(?:\s*<\/[a-z][a-z0-9_]*>)+\s*$/i, (deret) => {
      const nama = [...deret.matchAll(/<\/([a-z][a-z0-9_]*)>/gi)].map((m) => m[1].toLowerCase());
      return nama.some((n) => ELEMEN_HTML.has(n)) ? deret : '';
    })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, n) => ENTITAS[n.toLowerCase()])
    .replace(/[ \t]*\$\\equiv\$[ \t]*/g, '=')
    .split('\n')
    .map((baris) => (/^\s*\|/.test(baris) ? baris.replace(/\|[ \t]{2,}/g, '| ').replace(/[ \t]{2,}\|/g, ' |') : baris))
    .join('\n')
    .trim();
}

/** Teks hasil mistral-ocr dari respons OpenRouter (annotations), per halaman, tanpa pembungkus <file>. */
function teksDariAnotasi(data) {
  return (data?.choices?.[0]?.message?.annotations || [])
    .flatMap((a) => a?.file?.content || [])
    .map((c) => (c?.type === 'text' && typeof c.text === 'string' ? c.text.trim() : ''))
    .filter((t) => t && !/^<file name=/.test(t) && t !== '</file>');
}

// Galat sementara yang layak dicoba ulang. Dengan beberapa halaman dikirim serentak, 429 (batas laju)
// lebih mungkin muncul — tanpa coba ulang, satu halaman gagal membatalkan seluruh unggahan.
const STATUS_COBA_ULANG = new Set([429, 500, 502, 503, 504]);
// Batas laju mistral-ocr TIDAK selalu datang sebagai 429: OpenRouter meneruskannya sebagai 400 berisi
// "The document parsing engine is currently rate limited. Please retry shortly." (buku Kepbup 1.004
// halaman, 2026-09-16 — halaman ke-4 gagal dan SELURUH unggahan batal). Karena itu galat sementara
// dikenali dari isi pesan juga, bukan dari status saja.
const POLA_BATAS_LAJU = /rate.?limit|too many requests|retry shortly|try again/i;
const PERCOBAAN_MAKS = 5;
const JEDA_DASAR_MS = 2000;
const JEDA_MAKS_MS = 30000;
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

const bolehCobaUlang = (status, isi) => STATUS_COBA_ULANG.has(status) || POLA_BATAS_LAJU.test(isi || '');

/** Kirim satu halaman (bytes PDF satu halaman) ke mistral-ocr via OpenRouter, kembalikan teks bersih. */
export async function ocrHalamanPdf(bytesSatuHalaman, kunci) {
  for (let percobaan = 1; ; percobaan++) {
    const res = await kirimOcr(bytesSatuHalaman, kunci);
    if (res.ok) return bacaHasilOcr(res);
    const isi = await res.text().catch(() => res.statusText);
    if (percobaan >= PERCOBAAN_MAKS || !bolehCobaUlang(res.status, isi)) throw new GagalOcr(res.status, isi);
    // Hormati Retry-After bila ada (detik), selain itu jeda berlipat + acak (2, 4, 8, 16 s; maks 30 s).
    // Acak supaya halaman-halaman yang kena batas laju bersamaan tidak mencoba ulang serentak.
    const detik = Number(res.headers?.get?.('retry-after'));
    const jeda = Number.isFinite(detik) && detik > 0
      ? Math.min(detik, 30) * 1000
      : Math.min(JEDA_DASAR_MS * 2 ** (percobaan - 1), JEDA_MAKS_MS) * (0.75 + Math.random() * 0.5);
    await tunggu(jeda);
  }
}

async function bacaHasilOcr(res) {
  const bagian = teksDariAnotasi(await res.json());
  if (!bagian.length) {
    throw new GagalOcr('KOSONG', 'OpenRouter tidak mengembalikan hasil mistral-ocr (annotations kosong).');
  }
  return bagian.map(bersihkanHasilOcr).join('\n\n');
}

function kirimOcr(bytesSatuHalaman, kunci) {
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${kunci}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_PENERIMA,
      temperature: 0,
      max_tokens: 16,
      plugins: [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }],
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Reply with OK.' },
          {
            type: 'file',
            file: { filename: 'halaman.pdf', file_data: `data:application/pdf;base64,${bytesKeBase64(bytesSatuHalaman)}` }
          }
        ]
      }]
    })
  });
}

// Jumlah halaman yang dikirim serentak. Uji live KATALOG-PENDAS (±130 halaman berurutan) terasa lama;
// hampir seluruh waktunya menunggu jaringan, bukan memotong PDF. Diturunkan 5 → 2 pada 2026-09-16:
// dengan 5 halaman serentak, buku Kepbup memicu batas laju mistral-ocr sejak halaman ke-4.
export const OCR_SERENTAK = 2;

// Di atas jumlah ini OCR dianggap massal: pemanggil wajib meminta konfirmasi kedua (lama + biaya).
export const OCR_BANYAK_HALAMAN = 100;

/** Perkiraan lama OCR dalam menit: ±5 detik per halaman, dibagi jumlah halaman yang dikirim serentak. */
export function perkiraanMenitOcr(jumlahHalaman, serentak = OCR_SERENTAK) {
  return Math.max(1, Math.ceil((jumlahHalaman / Math.max(1, serentak)) * 5 / 60));
}

/**
 * Jalankan OCR untuk sejumlah halaman terdeteksi bertabel, hingga `serentak` halaman sekaligus. PDF
 * sumber dimuat SEKALI — versi pertama memuat ulang seluruh berkas untuk setiap halaman (Operator
 * Handbook: 152× berkas 436 halaman di browser).
 *
 * Sejak 2026-09-16 satu halaman yang tetap gagal (sesudah coba ulang) TIDAK lagi membatalkan seluruh
 * unggahan: halaman itu dilewati — teks pdf.js untuk halaman tersebut tetap dipakai — dan nomornya
 * dikembalikan lewat `halamanGagal` supaya pemanggil bisa memberitahu pengguna apa adanya.
 * `onProgress` dipanggil tiap halaman SELESAI; `ke` = jumlah yang selesai, bukan urutan halaman.
 * @returns {Promise<{ peta: Map<number, string>, halamanGagal: number[] }>} peta: nomor halaman (1-based) → teks bersih
 */
export async function terapkanOcrHalaman(fileBytes, nomorHalamanList, kunci, onProgress, { serentak = OCR_SERENTAK } = {}) {
  const { PDFDocument } = await import('pdf-lib');
  const asal = await PDFDocument.load(fileBytes);
  const teks = new Array(nomorHalamanList.length);
  const halamanGagal = [];
  let berikut = 0; let selesai = 0;

  const pekerja = async () => {
    while (berikut < nomorHalamanList.length) {
      const i = berikut++;
      const n = nomorHalamanList[i];
      try {
        teks[i] = await ocrHalamanPdf(await pisahHalamanPdf(asal, n), kunci);
      } catch (e) {
        console.warn(`[OCR] Halaman ${n} dilewati: ${e?.message || e}`);
        halamanGagal.push(n);
      }
      onProgress?.({ tahap: 'ocr', halaman: n, ke: ++selesai, total: nomorHalamanList.length, gagal: halamanGagal.length });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(serentak, nomorHalamanList.length)) }, pekerja));

  const peta = new Map();
  nomorHalamanList.forEach((n, i) => { if (teks[i] != null) peta.set(n, teks[i]); });
  halamanGagal.sort((a, b) => a - b);
  return { peta, halamanGagal };
}
