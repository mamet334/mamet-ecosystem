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

/** Kirim satu halaman (bytes PDF satu halaman) ke mistral-ocr via OpenRouter, kembalikan teks bersih. */
export async function ocrHalamanPdf(bytesSatuHalaman, kunci) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
  if (!res.ok) throw new GagalOcr(res.status, await res.text().catch(() => res.statusText));
  const bagian = teksDariAnotasi(await res.json());
  if (!bagian.length) {
    throw new GagalOcr('KOSONG', 'OpenRouter tidak mengembalikan hasil mistral-ocr (annotations kosong).');
  }
  return bagian.map(bersihkanHasilOcr).join('\n\n');
}

/**
 * Jalankan OCR untuk sejumlah halaman terdeteksi bertabel, satu per satu. PDF sumber dimuat SEKALI —
 * versi pertama memuat ulang seluruh berkas untuk setiap halaman (Operator Handbook: 152× berkas 436
 * halaman di browser).
 * @returns {Promise<Map<number, string>>} nomor halaman (1-based) → teks bersih
 */
export async function terapkanOcrHalaman(fileBytes, nomorHalamanList, kunci, onProgress) {
  const { PDFDocument } = await import('pdf-lib');
  const asal = await PDFDocument.load(fileBytes);
  const hasil = new Map();
  for (let i = 0; i < nomorHalamanList.length; i++) {
    const n = nomorHalamanList[i];
    const satuHalaman = await pisahHalamanPdf(asal, n);
    hasil.set(n, await ocrHalamanPdf(satuHalaman, kunci));
    onProgress?.({ tahap: 'ocr', halaman: n, ke: i + 1, total: nomorHalamanList.length });
  }
  return hasil;
}
