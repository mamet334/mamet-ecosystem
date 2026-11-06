
const MODEL_PENERIMA = 'google/gemini-2.5-flash-lite';
const DOLAR_PER_HALAMAN_OCR = 0.002;

export class GagalOcr extends Error {
  constructor(status, detail) {
    super(`OCR gagal (${status}): ${detail}`);
    this.status = status;
  }
}

export function perkiraanOcr(jumlahHalaman) {
  return jumlahHalaman * DOLAR_PER_HALAMAN_OCR;
}

export async function hitungHalamanPdf(bytes) {
  const { PDFDocument } = await import('pdf-lib');
  return (await PDFDocument.load(bytes)).getPageCount();
}

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

const ELEMEN_HTML = new Set(('a abbr address article aside audio b body br button canvas code div dl dt dd em '
  + 'embed footer form frame h1 h2 h3 h4 h5 h6 head header html i iframe img input label li link main '
  + 'meta nav object ol option p pre script section select small source span strong style sub sup svg '
  + 'table tbody td textarea tfoot th thead title tr u ul video xml').split(' '));

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

function teksDariAnotasi(data) {
  return (data?.choices?.[0]?.message?.annotations || [])
    .flatMap((a) => a?.file?.content || [])
    .map((c) => (c?.type === 'text' && typeof c.text === 'string' ? c.text.trim() : ''))
    .filter((t) => t && !/^<file name=/.test(t) && t !== '</file>');
}

const STATUS_COBA_ULANG = new Set([429, 500, 502, 503, 504]);
const POLA_BATAS_LAJU = /rate.?limit|too many requests|retry shortly|try again/i;
const PERCOBAAN_MAKS = 5;
const JEDA_DASAR_MS = 2000;
const JEDA_MAKS_MS = 30000;
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

const bolehCobaUlang = (status, isi) => STATUS_COBA_ULANG.has(status) || POLA_BATAS_LAJU.test(isi || '');

export async function ocrHalamanPdf(bytesSatuHalaman, kunci) {
  for (let percobaan = 1; ; percobaan++) {
    const res = await kirimOcr(bytesSatuHalaman, kunci);
    if (res.ok) return bacaHasilOcr(res);
    const isi = await res.text().catch(() => res.statusText);
    if (percobaan >= PERCOBAAN_MAKS || !bolehCobaUlang(res.status, isi)) throw new GagalOcr(res.status, isi);
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

export const OCR_SERENTAK = 2;

export const OCR_BANYAK_HALAMAN = 100;

export function perkiraanMenitOcr(jumlahHalaman, serentak = OCR_SERENTAK) {
  return Math.max(1, Math.ceil((jumlahHalaman / Math.max(1, serentak)) * 5 / 60));
}

export async function terapkanOcrHalaman(fileBytes, nomorHalamanList, kunci, onProgress, { serentak = OCR_SERENTAK, cache = null } = {}) {
  const { PDFDocument } = await import('pdf-lib');
  const asal = await PDFDocument.load(fileBytes);
  const teks = new Array(nomorHalamanList.length);
  const halamanGagal = [];
  let berikut = 0; let selesai = 0; let dariCache = 0;
  let saldoHabis = null;
  const halamanBelum = [];

  const pekerja = async () => {
    while (berikut < nomorHalamanList.length) {
      const i = berikut++;
      const n = nomorHalamanList[i];
      try {
        const tersimpan = cache ? await cache.ambil(n) : undefined;
        if (typeof tersimpan === 'string') {
          teks[i] = tersimpan;
          dariCache++;
        } else if (saldoHabis) {
          halamanBelum.push(n);
        } else {
          teks[i] = await ocrHalamanPdf(await pisahHalamanPdf(asal, n), kunci);
          if (cache) await cache.simpan(n, teks[i]);
        }
      } catch (e) {
        if (e?.status === 402) {
          saldoHabis ??= e.message || 'saldo OpenRouter tidak cukup (402)';
          halamanBelum.push(n);
        } else {
          console.warn(`[OCR] Halaman ${n} dilewati: ${e?.message || e}`);
          halamanGagal.push(n);
        }
      }
      onProgress?.({ tahap: 'ocr', halaman: n, ke: ++selesai, total: nomorHalamanList.length, gagal: halamanGagal.length, dariCache, saldoHabis: Boolean(saldoHabis) });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(serentak, nomorHalamanList.length)) }, pekerja));
  if (saldoHabis) console.warn(`[OCR] Berhenti: saldo OpenRouter tidak cukup — ${halamanBelum.length} halaman belum di-OCR`);

  const peta = new Map();
  nomorHalamanList.forEach((n, i) => { if (teks[i] != null) peta.set(n, teks[i]); });
  halamanGagal.sort((a, b) => a - b);
  halamanBelum.sort((a, b) => a - b);
  return { peta, halamanGagal, dariCache, saldoHabis, halamanBelum };
}
