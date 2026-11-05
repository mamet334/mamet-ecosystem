/**
 * CACHE OCR DI PERANGKAT (K1 langkah 2, 2026-11-05 — keputusan Owner: pilihan A; cache di server = Parkir).
 *
 * Kenapa wajib untuk unggah bertahap: hasil OCR bisa sedikit berbeda setiap kali, jadi teks — dan sidiknya di
 * `rag-process` — berubah, dan unggahan lanjutan ditolak sebagai "isi berbeda". Dengan cache, membaca ulang berkas
 * yang sama di perangkat yang sama memberi teks yang sama persis, dan halaman yang sudah di-OCR tidak dibayar lagi
 * (buku Kepbup 1.004 halaman: 939 halaman bertabel ≈ $1,9).
 *
 * Kunci = SHA-256 isi berkas + nomor halaman. Disimpan di IndexedDB (per asal aplikasi, per perangkat). Tidak bisa
 * dibuka / ditulis (mode privat, kuota) → bekerja tanpa cache, bukan gagal. Isinya teks OCR saja (±1–3 KB/halaman).
 *
 * SALINAN dari frontend/src/core/runtime/services/cacheOcr.js — mametlite proyek terpisah
 * (di-deploy sendiri ke mametlite.vercel.app). Ubah keduanya bersamaan.
 */

const NAMA_DB = 'mamet-cache-ocr';
const TOKO = 'halaman';

/** SHA-256 isi berkas (hex). */
export async function sidikBerkas(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bukaDb(idb) {
  return new Promise((selesai, gagal) => {
    const r = idb.open(NAMA_DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(TOKO)) r.result.createObjectStore(TOKO); };
    r.onsuccess = () => selesai(r.result);
    r.onerror = () => gagal(r.error);
  });
}

function permintaan(db, mode, kerja) {
  return new Promise((selesai, gagal) => {
    const tx = db.transaction(TOKO, mode);
    const r = kerja(tx.objectStore(TOKO));
    tx.oncomplete = () => selesai(r?.result);
    tx.onerror = () => gagal(tx.error);
    tx.onabort = () => gagal(tx.error);
  });
}

/**
 * Cache untuk satu berkas → { ambil(n), simpan(n, teks) } untuk `terapkanOcrHalaman(..., { cache })`.
 * Setiap galat IndexedDB ditelan (dicatat sekali): tanpa cache unggahan tetap jalan, hanya membayar OCR lagi.
 * @param idb  IndexedDB (bawaan: globalThis.indexedDB) — disuntikkan untuk uji
 */
export function buatCacheOcr(sidik, { idb = globalThis.indexedDB } = {}) {
  let db = null;
  let mati = !idb || !sidik;
  const matikan = (e) => {
    if (!mati) console.warn(`[cacheOcr] cache OCR tidak tersedia — OCR berjalan tanpa cache: ${e?.message || e}`);
    mati = true;
  };
  const pakai = async () => {
    if (mati) return null;
    try { db ??= await bukaDb(idb); return db; } catch (e) { /* dicatat sekali di matikan(); tanpa cache, tidak gagal */ matikan(e); return null; }
  };
  return {
    async ambil(n) {
      const d = await pakai();
      if (!d) return undefined;
      try {
        const v = await permintaan(d, 'readonly', (s) => s.get(`${sidik}:${n}`));
        return typeof v === 'string' ? v : undefined;
      } catch (e) { /* dicatat sekali di matikan(); dianggap tak ada di cache */ matikan(e); return undefined; }
    },
    async simpan(n, teks) {
      const d = await pakai();
      if (!d || typeof teks !== 'string') return;
      try { await permintaan(d, 'readwrite', (s) => s.put(teks, `${sidik}:${n}`)); } catch (e) { /* dicatat sekali di matikan(); hasil OCR tetap dipakai */ matikan(e); }
    },
  };
}
