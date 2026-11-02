// Simulasi graf Home di Node (Item 130 Tahap A, 2 Nov 2026) — mesin yang SAMA dengan Home (`d3-force-3d` lewat
// `force-graph`), penyusun simpul yang SAMA (`susunGrafHome`), sebaran data Owner yang diukur 2 Nov (hanya hitungan):
// chat 131 Assistant / 84 Engineer / 4 Lite, 229 dokumen ber-potongan, 10 memori tanpa relasi.
//
// Setelan meniru `force-graph` 1.x + ActivityGraph: forceLink (jarak 30) + forceManyBody (-30) + forceCenter,
// alphaDecay 0.02, velocityDecay 0.3, ±900 detak (cooldownTime 15 dtk ≈ 60 fps), lalu `tataPas` (padding 50 + pita atas
// RUANG_ATAS — pengganti zoomToFit sejak Tahap C). Koordinat label = piksel layar mutlak.
// Label kategori digambar 12px di layar (`ActivityGraph` nodeCanvasObject), simpul lain hanya bila skala ≥ ambang
// (`ambangLabel`: bawaan = AMBANG_LABEL_DATA dari grafHome.js, yang juga dipakai ActivityGraph; 0,75 = setelan lama).

import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const AKAR = fileURLToPath(new URL('../..', import.meta.url));
const d3 = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/d3-force-3d/src/index.js')).href);
const { susunGrafHome, AMBANG_LABEL_DATA, tataPas } = await import(pathToFileURL(join(AKAR, 'frontend/src/core/runtime/hooks/grafHome.js')).href);

export const SEBARAN_OWNER = Object.freeze({ assistant: 131, engineer: 84, lite: 4, dokumen: 229, memori: 10 });
export const LAYAR_OWNER = Object.freeze({ lebar: 1046, tinggi: 690 }); // 1366×768 dikurangi panel kanan & bilah

/** Baris tiruan berbentuk persis seperti hasil kueri `useDashboardData` (tanpa isi pribadi apa pun). */
export function barisTiruan(s = SEBARAN_OWNER) {
  const chats = [];
  const ws = [['ws-assistant', s.assistant], ['ws-engineer', s.engineer], ['ws-lite', s.lite]];
  ws.forEach(([w, n]) => { for (let i = 0; i < n; i++) chats.push({ id: `${w}-${i}`, title: `Chat ${i}`, workspace_type: w }); });
  const documents = Array.from({ length: s.dokumen }, (_, i) => ({ id: `d${i}`, title: `Dokumen ${i}` }));
  const docChunkCounts = Object.fromEntries(documents.map((d, i) => [d.id, 3 + (i % 20)]));
  const memories = Array.from({ length: s.memori }, (_, i) => ({ id: `m${i}`, summary: `Memori ${i}`, metadata: {}, memory_hits: 0 }));
  return { memories, documents, chats, docChunkCounts };
}

function acakBerbenih(benih) {
  let a = benih >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const lebarTeks = (s) => [...s].reduce((n, c) => n + (c >= 'A' && c <= 'Z' ? 8.4 : 7.2), 0);

/**
 * @param {(sim: object, links: Array) => void} [pasangGaya] — mis. `pasangGayaGraf` dari grafHome.js; kosong = setelan lama.
 * @returns {{ skala: number, label: Array, tumpang: Array<[string,string]>, simpul: Array, garis: Array }}
 */
export function simulasikan({ pasangGaya, benih = 1, layar = LAYAR_OWNER, detak = 900, sebaran = SEBARAN_OWNER, ambangLabel = AMBANG_LABEL_DATA } = {}) {
  const asli = Math.random;
  Math.random = acakBerbenih(benih);
  try {
    const { nodes, links } = susunGrafHome({ ...barisTiruan(sebaran), vitals: {} });
    const sim = d3.forceSimulation(nodes, 2)
      .force('link', d3.forceLink(links).id((n) => n.id))
      .force('charge', d3.forceManyBody())
      .force('center', d3.forceCenter())
      .alphaDecay(0.02).velocityDecay(0.3).stop();
    if (pasangGaya) pasangGaya(sim, links);
    for (let i = 0; i < detak; i++) sim.tick();

    const r = (n) => Math.sqrt(Math.max(0, n.val || 1));
    const xs = nodes.map((n) => [n.x - r(n), n.x + r(n)]).flat(), ys = nodes.map((n) => [n.y - r(n), n.y + r(n)]).flat();
    const bx = [Math.min(...xs), Math.max(...xs)], by = [Math.min(...ys), Math.max(...ys)];
    // Kamera = tataPas (pengganti zoomToFit di HomeDashboard, Tahap C): pita atas untuk judul & legenda disisakan.
    const kamera = tataPas({ bbox: { x: bx, y: by }, lebar: layar.lebar, tinggi: layar.tinggi });
    const k = kamera.k;
    const keLayar = (gx, gy) => [(gx - kamera.x) * k + layar.lebar / 2, (gy - kamera.y) * k + layar.tinggi / 2];
    // Titik teratas simpul mana pun di layar (px) — harus di bawah pita legenda.
    const atasSimpul = Math.min(...nodes.map((n) => keLayar(n.x, n.y - r(n))[1]));

    const label = nodes.filter((n) => n.name && (n.isCategory || n.group === 'core' || k >= ambangLabel)).map((n) => {
      const kategori = n.isCategory || n.group === 'core';
      const teks = n.name.length > (kategori ? 26 : 18) ? n.name.slice(0, kategori ? 26 : 18) + '…' : n.name;
      const lebar = lebarTeks(teks) * (kategori ? 1 : 9.5 / 12), tinggi = kategori ? 14 : 11;
      const [x, yPusat] = keLayar(n.x, n.y + Math.min(n.val || 5, 8));
      const y = yPusat + 2.5;
      return { id: n.id, teks, kotak: [x - lebar / 2, y, x + lebar / 2, y + tinggi] };
    });
    const tumpang = [];
    for (let i = 0; i < label.length; i++) for (let j = i + 1; j < label.length; j++) {
      const a = label[i].kotak, b = label[j].kotak;
      if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) tumpang.push([label[i].teks, label[j].teks]);
    }
    return { skala: k, label, tumpang, simpul: nodes, garis: links, atasSimpul };
  } finally {
    Math.random = asli;
  }
}
