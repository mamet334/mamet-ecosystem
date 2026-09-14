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
 * Riset (3 halaman sulit, changelog 2026-09-14-tabel-docx-jadi-markdown.md §"Pembaca PDF
 * OpenRouter"): `mistral-ocr` jauh lebih baik dari pdf.js untuk tabel ($0,0062 untuk 3 halaman,
 * 94 baris tabel terbaca), tapi punya pola cacat TETAP — tag penutup semu dari placeholder yang
 * salah ditutup (`</value>`, `</awsents>`), entitas HTML yang lolos, dan notasi LaTeX yang
 * disisipkan (`=Success` → `$\equiv$ Success`) — `bersihkanHasilOcr` membersihkan ketiganya.
 * Kesalahan baca kata asli (4 dari 30 halaman uji) TIDAK bisa dibersihkan otomatis — diwariskan.
 *
 * Biaya sesungguhnya ditagih ke MODEL PENERIMA (`MODEL_PENERIMA`), bukan tampil sebagai model
 * Mistral di dashboard OpenRouter — dibuktikan lewat `cost_details.upstream_inference_cost` di
 * riset (cost $0,06133 − upstream $0,00133 = $0,06000 = 30 halaman × $0,002).
 *
 * SALINAN dari frontend/src/core/runtime/services/pdfOcrService.js. Ubah keduanya bersamaan.
 */

// Model termurah yang terbukti kompatibel dengan plugin file-parser di uji riset — teks tabel
// hasil mistral-ocr sudah bersih, jadi model penerima tak perlu pintar, hanya menyalin apa adanya.
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

/** Potong satu halaman (1-based) dari PDF menjadi PDF tersendiri, siap dikirim ke OCR. */
export async function pisahHalamanPdf(bytes, nomorHalaman) {
  const { PDFDocument } = await import('pdf-lib');
  const asal = await PDFDocument.load(bytes);
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

/** Bersihkan pola cacat tetap mistral-ocr yang ditemukan riset (bukan salah-baca kata asli). */
export function bersihkanHasilOcr(teks) {
  return String(teks || '')
    .replace(/<\/[a-z][a-z0-9]*>/gi, '')                          // tag penutup semu (</value>, </awsents>)
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, n) => ENTITAS[n.toLowerCase()])
    .replace(/\$\\equiv\$\s*/g, '')                                // notasi LaTeX yang disisipkan OCR
    .trim();
}

/** Kirim satu halaman (bytes PDF satu halaman) ke mistral-ocr via OpenRouter, kembalikan teks bersih. */
export async function ocrHalamanPdf(bytesSatuHalaman, kunci) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${kunci}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_PENERIMA,
      plugins: [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }],
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Salin ulang seluruh teks halaman ini apa adanya, tanpa menambah penjelasan. '
              + 'Tulis tabel sebagai baris Markdown "| kolom | kolom |" dengan baris pemisah "| --- | --- |".'
          },
          {
            type: 'file',
            file: { filename: 'halaman.pdf', file_data: `data:application/pdf;base64,${bytesKeBase64(bytesSatuHalaman)}` }
          }
        ]
      }]
    })
  });
  if (!res.ok) throw new GagalOcr(res.status, await res.text().catch(() => res.statusText));
  const data = await res.json();
  return bersihkanHasilOcr(data.choices?.[0]?.message?.content);
}

/**
 * Jalankan OCR untuk sejumlah halaman terdeteksi bertabel, satu per satu.
 * @returns {Promise<Map<number, string>>} nomor halaman (1-based) → teks bersih
 */
export async function terapkanOcrHalaman(fileBytes, nomorHalamanList, kunci, onProgress) {
  const hasil = new Map();
  for (let i = 0; i < nomorHalamanList.length; i++) {
    const n = nomorHalamanList[i];
    const satuHalaman = await pisahHalamanPdf(fileBytes, n);
    hasil.set(n, await ocrHalamanPdf(satuHalaman, kunci));
    onProgress?.({ tahap: 'ocr', halaman: n, ke: i + 1, total: nomorHalamanList.length });
  }
  return hasil;
}
