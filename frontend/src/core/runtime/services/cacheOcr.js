
const NAMA_DB = 'mamet-cache-ocr';
const TOKO = 'halaman';

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

export function buatCacheOcr(sidik, { idb = globalThis.indexedDB } = {}) {
  let db = null;
  let mati = !idb || !sidik;
  const matikan = (e) => {
    if (!mati) console.warn(`[cacheOcr] cache OCR tidak tersedia — OCR berjalan tanpa cache: ${e?.message || e}`);
    mati = true;
  };
  const pakai = async () => {
    if (mati) return null;
    try { db ??= await bukaDb(idb); return db; } catch (e) {  matikan(e); return null; }
  };
  return {
    async ambil(n) {
      const d = await pakai();
      if (!d) return undefined;
      try {
        const v = await permintaan(d, 'readonly', (s) => s.get(`${sidik}:${n}`));
        return typeof v === 'string' ? v : undefined;
      } catch (e) {  matikan(e); return undefined; }
    },
    async simpan(n, teks) {
      const d = await pakai();
      if (!d || typeof teks !== 'string') return;
      try { await permintaan(d, 'readwrite', (s) => s.put(teks, `${sidik}:${n}`)); } catch (e) {  matikan(e); }
    },
  };
}
