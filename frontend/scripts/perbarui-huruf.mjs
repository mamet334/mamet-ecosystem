import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TUJUAN = path.join(AKAR, 'src/assets/fonts');

const HURUF = [
  {
    nama: 'Inter',
    berkas: 'inter-latin-wght-normal.woff2',
    alamat: 'https://cdn.jsdelivr.net/npm/@fontsource-variable/inter@5.2.5/files/inter-latin-wght-normal.woff2',
  },
];

fs.mkdirSync(TUJUAN, { recursive: true });
for (const h of HURUF) {
  const r = await fetch(h.alamat);
  if (!r.ok) throw new Error(`Gagal mengunduh ${h.nama}: HTTP ${r.status} — ${h.alamat}`);
  const isi = Buffer.from(await r.arrayBuffer());
  if (isi.length < 5000) throw new Error(`Berkas ${h.nama} mencurigakan: hanya ${isi.length} byte`);
  const tujuan = path.join(TUJUAN, h.berkas);
  const lama = fs.existsSync(tujuan) ? fs.statSync(tujuan).size : 0;
  fs.writeFileSync(tujuan, isi);
  console.log(`${h.nama}: ${h.berkas} — ${(isi.length / 1024).toFixed(1)} KB${lama ? ` (sebelumnya ${(lama / 1024).toFixed(1)} KB)` : ''}`);
}
console.log('Selesai. Pastikan @font-face di src/index.css menunjuk berkas yang sama.');
