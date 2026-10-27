// Penjaga data crawler Owner untuk uji yang menjalankan crawler SUNGGUHAN (dibuat 2026-10-27, Item 129).
//
// Kejadian: `uji-konektor-protokol.mjs` bagian 5 menjalankan misi lewat gerbang di mode pengembangan tanpa CRAWLER_ROOT,
// jadi 27 misi "uji rantai" (22–27 Okt) tertulis ke capability/ecosystem-crawler/data/gudang.db milik Owner. Uji kini
// memakai `folderDataPengembangan` (folder sementara); berkas ini memeriksa bahwa gudang repo memang tidak bertambah.
// Bukan berkas uji (namanya tidak diawali "uji-"), jadi tidak dijalankan sendiri oleh jalankan-semua.mjs.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** gudang.db crawler untuk akar data `akar` (folder repo crawler, atau CRAWLER_ROOT). */
export const berkasGudang = (akar) => path.join(akar, 'data', 'gudang.db');

/**
 * Id semua misi di gudang. Gudang yang BELUM ADA → [] (mulai dari kosong). Gudang yang ada tapi gagal dibaca →
 * LEMPAR: "tidak ada" dan "gagal" tidak boleh dijawab sama — kalau tidak, penjaga ini lulus tanpa memeriksa apa pun.
 * Dibuka hanya-baca; tidak menulis apa pun ke gudang Owner.
 */
export function idMisi(berkas) {
  if (!existsSync(berkas)) return [];
  const db = new DatabaseSync(berkas, { readOnly: true });
  try { return db.prepare('SELECT id FROM misi').all().map((r) => r.id); }
  finally { db.close(); }
}

/**
 * Potret misi di gudang repo sebelum uji; `misiBaru()` = misi yang muncul sesudahnya.
 * Catatan jujur: bila Owner sedang menjalankan misi sungguhan di `npm run desktop` bersamaan, misi itu juga terhitung —
 * merahnya bisa palsu. Karena itu yang baru dilaporkan beserta owner_intent-nya, supaya bisa dibedakan.
 */
export function potretGudang(akarCrawler) {
  const berkas = berkasGudang(akarCrawler);
  const sebelum = new Set(idMisi(berkas));
  return {
    berkas,
    jumlahSebelum: sebelum.size,
    misiBaru() {
      const baru = idMisi(berkas).filter((id) => !sebelum.has(id));
      if (baru.length === 0) return [];
      const db = new DatabaseSync(berkas, { readOnly: true });
      try {
        const q = db.prepare("SELECT id, json_extract(spesifikasi, '$.context.owner_intent') AS owner_intent FROM misi WHERE id = ?");
        return baru.map((id) => ({ ...q.get(id) }));
      } finally { db.close(); }
    },
  };
}
