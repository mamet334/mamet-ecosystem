// KONEKTOR AKTIF UNTUK CHAT (Item 129 Tahap G3, 2026-11-03) — satu tugas: konektor apa yang menyala di workspace ini,
// apa yang dikirim ke server, dan ke mana sebuah permintaan alat diteruskan. Dipisah dari AssistantService (berkas
// gemuk) supaya putaran alatnya cukup memanggil empat fungsi.
//
// Titik sambung S2: dulu hanya SATU konektor dikenal (crawler) yang diambil, sehingga server umum yang menyala dibuang
// diam-diam. Kini: crawler (bila menyala) + semua server umum yang menyala dengan alat yang disetujui Owner.
// Daftar alat yang boleh diminta model di klien = daftar yang SAMA dengan yang dikirim ke server (sudah disaring
// `shared/konektorUmum.js`), jadi model tak bisa meminta alat yang tak tercantum di promptnya.

import { KONEKTOR_DIKENAL, payloadKonektor } from '../../../../../shared/konektorAlat.js';
import { muatanKonektorUmumAman, petaAlatUmum } from '../../../../../shared/konektorUmum.js';

const api = () => (typeof window !== 'undefined' ? window.electronAPI : null);

/**
 * Konektor yang menyala di workspace ini — dibaca dari PROSES UTAMA setiap pesan (K3: per workspace).
 * @returns {Promise<null | {crawler: object|null, umum: {putaran: number, daftar: object[]}|null, nama: string}>}
 */
export async function bacaKonektorAktif(workspaceId) {
  const e = api();
  let crawler = null;
  let umum = null;
  if (e?.konektor?.panggil) {
    try {
      const s = (await e.konektor.status() || []).find((x) => x.workspace === workspaceId && x.status === 'nyala' && KONEKTOR_DIKENAL[x.konektor]);
      if (s) crawler = { id: s.konektor, nama: s.nama, sumberSiap: s.ringkasan?.sumberSiap || [], akses: s.ringkasan?.akses || null };
    } catch {
      crawler = null; // proses utama sibuk/galat → pesan ini berjalan tanpa crawler, sama seperti sakelar mati
    }
  }
  if (e?.konektorUmum?.aktif) {
    try {
      umum = muatanKonektorUmumAman({ putaran: 0, daftar: await e.konektorUmum.aktif(workspaceId) });
    } catch {
      umum = null; // sama: tanpa konektor umum untuk pesan ini, terlihat di Settings bila servernya bermasalah
    }
  }
  if (!crawler && !umum) return null;
  const nama = [crawler?.nama, ...(umum?.daftar || []).map((k) => k.nama)].filter(Boolean).join(', ');
  return { crawler, umum, nama };
}

/** Peta id → alat yang boleh diminta model (crawler: daftar protokol; umum: alat yang dikirim ke server). */
export function petaAlatAktif(k) {
  return {
    ...(k?.crawler ? { [k.crawler.id]: KONEKTOR_DIKENAL[k.crawler.id].alat } : {}),
    ...petaAlatUmum(k?.umum),
  };
}

/** Bidang muatan ke server: `konektor` (crawler, bentuk lama) + `konektorUmum` (G3). Putaran dibagi keduanya. */
export function muatanKonektor(info) {
  if (!info) return {};
  return {
    konektor: info.crawler ? payloadKonektor({ ...info.crawler, putaran: info.putaran || 0 }) : undefined,
    konektorUmum: info.umum ? { putaran: info.putaran || 0, daftar: info.umum.daftar } : undefined,
  };
}

/** Teruskan satu permintaan alat ke gerbang yang benar di proses utama. */
export function panggilKonektor(workspaceId, p, chatId) {
  const e = api();
  if (KONEKTOR_DIKENAL[p.konektor]) return e.konektor.panggil(workspaceId, p.konektor, p.alat, p.argumen);
  return e.konektorUmum.panggil(workspaceId, p.konektor, p.alat, p.argumen, chatId || null);
}

const LABEL_CRAWLER = {
  jalankan_misi: '🛰️ menunggu persetujuan misi Anda (lihat dialog), lalu crawler bekerja (≤ 2 menit)',
  status_misi: '⏳ memeriksa status misi',
  baca_tangkapan: '📥 membaca hasil misi',
  daftar_misi: '📋 menunggu izin Anda melihat daftar misi (lihat dialog)',
  ekspor_misi: '💾 menunggu izin Anda mengekspor hasil (lihat dialog)',
};

/** Teks progres selama alat berjalan. */
export function labelAlat(p) {
  if (KONEKTOR_DIKENAL[p.konektor]) return LABEL_CRAWLER[p.alat] || `⚙️ ${p.alat}`;
  return `🔌 ${p.konektor}·${p.alat} — menunggu izin Anda (lihat dialog)`;
}
