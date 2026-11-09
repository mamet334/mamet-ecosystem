
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const berkasGudang = (akar) => path.join(akar, 'data', 'gudang.db');

export function idMisi(berkas) {
  if (!existsSync(berkas)) return [];
  const db = new DatabaseSync(berkas, { readOnly: true });
  try { return db.prepare('SELECT id FROM misi').all().map((r) => r.id); }
  finally { db.close(); }
}

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
