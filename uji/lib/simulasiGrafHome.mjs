
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const AKAR = fileURLToPath(new URL('../..', import.meta.url));
const { susunGrafHome, ambangLabelData, tataPas, gabungGraf, prioritasLabel, bolehLabel, kotakLabel, tataSurya, jangkarLabel, jariSimpul } =
  await import(pathToFileURL(join(AKAR, 'frontend/src/core/runtime/hooks/grafHome.js')).href);

export const SEBARAN_OWNER = Object.freeze({ assistant: 131, engineer: 84, lite: 4, dokumen: 229, memori: 10 });
export const LAYAR_OWNER = Object.freeze({ lebar: 1046, tinggi: 690 });

export function barisTiruan(s = SEBARAN_OWNER) {
  const chats = [];
  const ws = [['ws-assistant', s.assistant], ['ws-engineer', s.engineer], ['ws-lite', s.lite]];
  ws.forEach(([w, n]) => { for (let i = 0; i < n; i++) chats.push({ id: `${w}-${i}`, title: `Chat ${i}`, workspace_type: w }); });
  const documents = Array.from({ length: s.dokumen }, (_, i) => ({ id: `d${i}`, title: `Dokumen ${i}` }));
  const docChunkCounts = Object.fromEntries(documents.map((d, i) => [d.id, 3 + (i % 20)]));
  const memories = Array.from({ length: s.memori }, (_, i) => ({ id: `m${i}`, summary: `Memori ${i}`, metadata: {}, memory_hits: 0 }));
  return { memories, documents, chats, docChunkCounts };
}

const lebarTeks = (s) => [...s].reduce((n, c) => n + (c >= 'A' && c <= 'Z' ? 8.4 : 7.2), 0);

export function simulasikan({ layar = LAYAR_OWNER, sebaran = SEBARAN_OWNER, ambangLabel = null, lapisan = null, pesanPerChat = {} } = {}) {
  const dasar = susunGrafHome({ ...barisTiruan(sebaran), vitals: {}, pesanPerChat });
  const daftar = (Array.isArray(lapisan) ? lapisan : [lapisan]).map((l) => (typeof l === 'function' ? l(dasar) : l));
  const graf = gabungGraf(dasar, ...daftar);
  const ukuran = tataSurya(graf);
  const { nodes, links } = graf;

  const r = (n) => jariSimpul(n);
  const xs = nodes.map((n) => [n.x - r(n), n.x + r(n)]).flat(), ys = nodes.map((n) => [n.y - r(n), n.y + r(n)]).flat();
  const bx = [Math.min(...xs), Math.max(...xs)], by = [Math.min(...ys), Math.max(...ys)];
  const kamera = tataPas({ bbox: { x: bx, y: by }, lebar: layar.lebar, tinggi: layar.tinggi });
  const k = kamera.k;
  const keLayar = (gx, gy) => [(gx - kamera.x) * k + layar.lebar / 2, (gy - kamera.y) * k + layar.tinggi / 2];
  const atasSimpul = Math.min(...nodes.map((n) => keLayar(n.x, n.y - r(n))[1]));

  const ambang = ambangLabel ?? ambangLabelData(k);
  const label = nodes.filter((n) => n.name && (n.isCategory || k >= ambang)).map((n) => {
    const kategori = !!n.isCategory;
    const teks = n.name.length > (kategori ? 26 : 18) ? n.name.slice(0, kategori ? 26 : 18) + '…' : n.name;
    const lebar = lebarTeks(teks) * (kategori ? 1 : 9.5 / 12), tinggi = kategori ? 14 : 11;
    const j = jangkarLabel(n, Math.min(n.val || 5, 8), 2.5 / k);
    const [x, y] = keLayar(j.x, j.y);
    return { id: n.id, group: n.group, teks, prioritas: prioritasLabel(n), kotak: kotakLabel(x, y, lebar, tinggi, j.arah, j.atas) };
  });
  const tumpang = [];
  for (let i = 0; i < label.length; i++) for (let j = i + 1; j < label.length; j++) {
    const a = label[i].kotak, b = label[j].kotak;
    if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) tumpang.push([label[i].teks, label[j].teks]);
  }
  const terpakai = [];
  const tampil = [], tersembunyi = [];
  [...label].sort((a, b) => a.prioritas - b.prioritas).forEach((l) => (bolehLabel([...l.kotak], terpakai) ? tampil : tersembunyi).push(l));
  return { skala: k, label, tumpang, tampil, tersembunyi, simpul: nodes, garis: links, atasSimpul, ukuran };
}
