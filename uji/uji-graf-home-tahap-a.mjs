// UJI 2026-11-02 — Item 130 Tahap A (graf Home): Directory & Menu tertutup di awal, Directory hanya berisi data
// (dulu 481 = 458 data + 23 simpul bukan-data berlencana MEMORI), label kategori tak menumpuk, dan nama simpul di
// tooltip tak pernah dijalankan sebagai HTML (K5: float-tooltip menulis lewat innerHTML; desktop tanpa CSP).
//
// Tata letak diukur dengan mesin yang SAMA dengan Home (d3-force-3d, setelan force-graph) dan penyusun simpul yang
// SAMA (`susunGrafHome`) pada sebaran data Owner — lihat uji/lib/simulasiGrafHome.mjs.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const AKAR = fileURLToPath(new URL('..', import.meta.url));
const grafHome = await import(pathToFileURL(join(AKAR, 'frontend/src/core/runtime/hooks/grafHome.js')).href);
const { simulasikan, barisTiruan, SEBARAN_OWNER } = await import(pathToFileURL(join(AKAR, 'uji/lib/simulasiGrafHome.mjs')).href);
const { susunGrafHome, simpulDirektori, labelTooltipAman, pasangGayaGraf, gayaGravitasi } = grafHome;
console.warn = () => {};   // safeLink memperingatkan simpul tiruan yang memang tak bertautan — bukan hasil uji

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
const baca = (p) => readFileSync(join(AKAR, p), 'utf8');
console.log('uji-graf-home-tahap-a v1');

// ── 1. Label kategori tak menumpuk (simulasi) ───────────────────────────────────────────────────
// Pembanding = setelan bawaan force-graph pada susunan YANG SAMA (sejak Tahap C: dua belahan; dulu 7 pasang di bintang
// SUPABASE KERNEL). Membuktikan simulasi memang bisa melihat tumpang — bukan selalu 0.
const lama = simulasikan({ ambangLabel: 0.75 });
cek(lama.tumpang.length >= 3, `pembanding: setelan bawaan memang menumpuk di layar Owner (${lama.tumpang.length} pasang, skala ${lama.skala.toFixed(3)})`);
const kasus = [
  ['layar Owner 1366×768', {}],
  ['layar 1920×1080', { layar: { lebar: 1600, tinggi: 980 } }],
  // Skala pas di antara ambang lama (0,75) dan baru — yang membuktikan AMBANG_LABEL_DATA memang bekerja.
  ['layar 2560×1440', { layar: { lebar: 2240, tinggi: 1340 } }],
  ['data dua kali lipat', { sebaran: { assistant: 260, engineer: 170, lite: 10, dokumen: 460, memori: 20 } }],
  ['120 memori tanpa relasi', { sebaran: { ...SEBARAN_OWNER, memori: 120 } }],
];
for (const [nama, opsi] of kasus) {
  const h = simulasikan({ ...opsi, pasangGaya: pasangGayaGraf });
  cek(h.tumpang.length === 0 && h.label.length <= 12,
    `${nama}: 0 label bertumpuk, hanya label kategori saat dibuka (${h.label.length} label, skala ${h.skala.toFixed(3)})`, h.tumpang.slice(0, 4));
}
const owner = simulasikan({ pasangGaya: pasangGayaGraf });
cek(owner.skala > lama.skala * 1.1, `tata letak lebih lega daripada setelan bawaan (skala ${lama.skala.toFixed(3)} → ${owner.skala.toFixed(3)})`);

// Gravitasi dipasang & lebih kuat bagi simpul yang tak bertambat (sejak Tahap C semua data bertambat pada kemampuannya,
// jadi dijaga langsung pada gaya yang dipasang — bukan lewat simulasi).
const gaya = {};
const simPalsu = { force: (nama, f) => { if (f === undefined) return null; gaya[nama] = f; return simPalsu; } };
pasangGayaGraf(simPalsu, [{ source: 'a', target: 'b' }]);
const uji = [{ id: 'a', x: 100, y: 0, vx: 0, vy: 0 }, { id: 'yatim', x: 100, y: 0, vx: 0, vy: 0 }];
gaya.gravitasi?.initialize?.(uji); gaya.gravitasi?.(1);
cek(typeof gaya.gravitasi === 'function' && uji[0].vx === -2 && Math.abs(uji[1].vx + 12) < 1e-9,
  'pasangGayaGraf memasang gravitasi: 0,02 bagi yang bertambat, 0,12 bagi yang tak bertambat', uji.map((n) => n.vx));

// ── 2. Gravitasi: menarik ke pusat, lebih kuat bagi yang tak bertambat ──────────────────────────
const g = gayaGravitasi((n) => n.k);
const s = [{ x: 100, y: -50, vx: 0, vy: 0, k: 0.1 }, { x: 100, y: 0, vx: 0, vy: 0, k: 0.02 }];
g.initialize(s); g(1);
cek(s[0].vx === -10 && s[0].vy === 5 && s[1].vx === -2, 'gayaGravitasi = rumus forceX(0)/forceY(0) d3 (v -= posisi × kekuatan × alpha)', s);

// ── 3. Knowledge Directory: hanya simpul data ───────────────────────────────────────────────────
const { nodes } = susunGrafHome({ ...barisTiruan(), vitals: {} });
const dir = simpulDirektori(nodes);
const harap = SEBARAN_OWNER.memori + SEBARAN_OWNER.dokumen + SEBARAN_OWNER.assistant + SEBARAN_OWNER.engineer + SEBARAN_OWNER.lite;
cek(dir.length === harap, `Directory = ${harap} entitas data (memori + dokumen + chat), bukan ${harap + 23}`, dir.length);
cek(!dir.some((n) => ['Sub Agents', 'Tools', 'Skills', 'Vector DB', 'Supabase (DB/Auth)', 'LLM Provider'].includes(n.name)),
  'sub-cluster statis & layanan tak lagi terdaftar sebagai entitas berlencana MEMORI');

// ── 4. Tooltip: nama sebagai TEKS ───────────────────────────────────────────────────────────────
const jahat = '<img src=x onerror="window.electronAPI.readFile(\'C:/x\')">';
const aman = labelTooltipAman({ name: jahat });
cek(!/[<>"]/.test(aman) && aman.includes('&lt;img') && aman.includes('&quot;'), 'nama ber-HTML di-escape — tak bisa menjadi elemen/atribut', aman);
cek(labelTooltipAman({ name: 'A & B \'x\'' }) === 'A &amp; B &#39;x&#39;' && labelTooltipAman({}) === '' && labelTooltipAman(null) === '',
  'teks biasa utuh (hanya karakter khusus yang diganti); nama kosong → string kosong');

// ── 5. Terpasang di komponen ────────────────────────────────────────────────────────────────────
const AG = baca('frontend/src/components/dashboard/ActivityGraph.jsx');
cek(/\[isExplorerOpen, setIsExplorerOpen\] = useState\(false\)/.test(AG), 'Knowledge Directory tertutup di awal');
cek(/nodeLabel=\{labelTooltipAman\}/.test(AG) && !/nodeLabel="name"/.test(AG), 'tooltip graf memakai labelTooltipAman (bukan nama mentah)');
cek(/simpulDirektori\(graphData\?\.nodes\)/.test(AG), 'Directory diisi simpulDirektori');
cek(/globalScale >= AMBANG_LABEL_DATA/.test(AG) && !/globalScale >= 0\.75/.test(AG), 'ambang nama simpul data = AMBANG_LABEL_DATA (sama dengan simulasi)');
const HD = baca('frontend/src/components/dashboard/HomeDashboard.jsx');
// Sejak Tahap D tata letak dipasang pada graf GABUNGAN (dasar + lapisan Kemampuan) = `grafTampil`.
cek(/pasangGayaGraf\(\{ force:[^\n]*grafTampil\.links\)/.test(HD) && /d3ReheatSimulation\(\)/.test(HD), 'HomeDashboard memasang tata letak pada graf yang ditampilkan');
const MT = baca('frontend/src/components/os/MenuTeks.jsx');
const ikuti = MT.match(/const ikutiHalaman = [^\n]*\n([\s\S]*?)\n  \};/)?.[1] || '';
cek(/setTerbuka\(false\)/.test(ikuti) && !/app:home/.test(ikuti), 'Menu tertutup di semua halaman, termasuk Home', ikuti);
const dash = readdirSync(join(AKAR, 'frontend/src/components/dashboard')).filter((n) => /\.(jsx?|tsx?)$/.test(n));
const html = dash.filter((n) => /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(baca(`frontend/src/components/dashboard/${n}`)));
cek(html.length === 0, `komponen dashboard tanpa dangerouslySetInnerHTML/innerHTML (${dash.length} berkas)`, html);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
