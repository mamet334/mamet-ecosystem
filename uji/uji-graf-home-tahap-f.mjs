// UJI 2026-11-03 — Item 130 Tahap F (graf Home): TATA SURYA. Posisi dihitung & dipaku `tataSurya` — bintang ganda MAMET,
// planet kemampuan di satu orbit, bulan data dalam cincin, fondasi di orbit luar, satelit lapisan Kemampuan, pesan =
// bulan dari percakapannya. Tanpa garis orbit; garis relasi = jaring laba-laba yang selalu tampil (menyala untuk simpul
// terpilih); planet diseret → seluruh sistemnya ikut. Menggantikan gaya fisika yang memantul (Owner 3 Nov: "seharusnya
// seperti tata surya — matahari, planet beserta bulannya").

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const AKAR = fileURLToPath(new URL('..', import.meta.url));
const imp = (p) => import(pathToFileURL(join(AKAR, p)).href);
const G = await imp('frontend/src/core/runtime/hooks/grafHome.js');
const { SUBAGEN } = await imp('shared/daftarSubagen.js');
const { ALAT_SEMUA } = await imp('shared/folderKerjaAlat.js');
const { KONEKTOR_DIKENAL } = await imp('shared/konektorAlat.js');
const { barisTiruan, SEBARAN_OWNER } = await imp('uji/lib/simulasiGrafHome.mjs');
console.warn = () => {};

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
const baca = (p) => readFileSync(join(AKAR, p), 'utf8');
const kode = (p) => baca(p).split(/\r?\n/).filter((b) => !/^\s*(\/\/|\*)/.test(b)).join('\n');
const jarak = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const r = G.jariSimpul, E = 1e-6;
console.log('uji-graf-home-tahap-f v1');

// Graf penuh: data Owner + ukuran percakapan + lapisan Kemampuan (konektor menyala) + ekor percakapan terpanjang.
const baris = barisTiruan();
const pesanPerChat = Object.fromEntries(baris.chats.map((c, i) => [c.id, i === 0 ? 138 : (i % 30) + 1]));
const dasar = G.susunGrafHome({ ...baris, vitals: {}, pesanPerChat });
const lap = G.susunLapisanKemampuan({ alatChat: ['web_search', 'memory_manager', 'deep_research', 'data_tabel', 'word_to_pdf'].map((name) => ({ name, aktif: true })),
  alatFolder: ALAT_SEMUA, konektorDikenal: KONEKTOR_DIKENAL, subagen: SUBAGEN,
  konektor: [{ id: 'ecosystem-crawler', nama: 'Ecosystem Crawler', workspace: 'ws-assistant', diaktifkan: true, menyala: true, alat: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }] });
const chatId = `chat-${baris.chats[0].id}`;
const idAda = new Set([...dasar.nodes, ...lap.nodes].map((n) => n.id));
const ekor = G.susunEkorPesan(chatId, Array.from({ length: 138 }, (_, i) => ({ urutan: i + 1, peran: i % 2 ? 'model' : 'user', cuplikan: 'c', alat: i % 5 === 1 ? ['rag'] : [] })), idAda);
const graf = G.gabungGraf(dasar, lap, ekor);
const U = G.tataSurya(graf);
const by = Object.fromEntries(graf.nodes.map((n) => [n.id, n]));

// ── 1. Bintang ganda & planet ───────────────────────────────────────────────────────────────────
cek(by['mamet-desktop'].fx === -G.ORBIT.jarakBintang && by['mamet-server'].fx === G.ORBIT.jarakBintang && by['mamet-desktop'].fy === 0 && by['mamet-server'].fy === 0,
  'bintang ganda: Desktop & Server mendatar, sejarak 2 × jarakBintang');
const planet = G.URUTAN_PLANET.map((id) => by[id]);
cek(planet.every((p, i) => Math.abs(Math.hypot(p.fx, p.fy) - U.jariOrbit) < E
  && Math.abs(Math.atan2(p.fy, p.fx) - Math.atan2(Math.sin(-Math.PI / 2 + i * 2 * Math.PI / 5), Math.cos(-Math.PI / 2 + i * 2 * Math.PI / 5))) < E),
  `planet di satu orbit (jari ${U.jariOrbit.toFixed(0)}), berselang 72°, mulai dari atas: ${G.URUTAN_PLANET.join(' → ')}`);
const S = (id) => U.sistem.get(id);
cek(planet.every((p, i) => { const q = planet[(i + 1) % 5]; return jarak(p, q) >= S(p.id) + S(q.id) + G.ORBIT.jedaSistem - E; }),
  'sistem planet bertetangga tak bersentuhan (≥ jedaSistem)');
cek(planet.every((p) => U.jariOrbit - S(p.id) >= G.ORBIT.ruangBintang - E), 'tak satu pun sistem planet masuk ruang bintang');
// Data Owner kini: ruang bintang yang menentukan jari orbit. Bila dua planet bertetangga sama-sama besar, syarat tali
// busur yang harus mengikat — tanpa skenario ini syarat itu bisa dibuang tanpa ada uji yang gagal (diukur dengan mutasi).
const besar = { nodes: G.URUTAN_PLANET.map((id) => ({ id, val: 40 })), links: [] };
['kem-chat', 'kem-memori'].forEach((pid) => { for (let i = 0; i < 900; i++) { besar.nodes.push({ id: `${pid}-m${i}`, group: 'memory', val: 3 + (i % 5) }); besar.links.push({ source: `${pid}-m${i}`, target: pid }); } });
const UB = G.tataSurya(besar), pb = Object.fromEntries(besar.nodes.map((n) => [n.id, n]));
const dCM = jarak(pb['kem-chat'], pb['kem-memori']), perluCM = UB.sistem.get('kem-chat') + UB.sistem.get('kem-memori') + G.ORBIT.jedaSistem;
cek(UB.jariOrbit > G.ORBIT.ruangBintang + Math.max(...UB.sistem.values()) + 1 && dCM >= perluCM - E && dCM < perluCM + 1e-3,
  `dua planet besar bertetangga (Chat & Memori, 900 bulan): orbit melebar (${UB.jariOrbit.toFixed(0)}) tepat agar sistemnya berjarak jedaSistem`);

// ── 2. Bulan ────────────────────────────────────────────────────────────────────────────────────
const induk = (n) => graf.links.find((l) => l.source === n.id && String(l.target).startsWith('kem-'))?.target;
const data = graf.nodes.filter((n) => G.GRUP_DATA.includes(n.group));
cek(data.every((n) => n.fx !== undefined && induk(n)), `setiap simpul data (${data.length}) dipaku sebagai bulan planetnya`);
cek(data.every((n) => { const p = by[induk(n)]; const d = jarak(n, p); return d + r(n) <= S(p.id) + E && d >= r(p) + r(n) - E; }),
  'setiap bulan di dalam sistem planetnya dan tak menembus planetnya');
let tindihBulan = 0;
for (const p of planet) {
  const b = data.filter((n) => induk(n) === p.id);
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (jarak(b[i], b[j]) < r(b[i]) + r(b[j]) - E) tindihBulan++;
}
cek(tindihBulan === 0, `tak ada dua bulan yang bertindih (${data.length} bulan diperiksa berpasangan)`, tindihBulan);
const kRag = data.filter((n) => induk(n) === 'kem-rag').length, kChat = data.filter((n) => induk(n) === 'kem-chat').length;
cek(kRag === SEBARAN_OWNER.dokumen && kChat === SEBARAN_OWNER.assistant + SEBARAN_OWNER.lite, `bulan RAG Dokumen ${kRag}, Chat ${kChat} (= data Owner)`);
const bulanChat = data.filter((n) => induk(n) === 'kem-chat').sort((a, b) => jarak(a, by['kem-chat']) - jarak(b, by['kem-chat']));
cek(r(bulanChat[0]) >= r(bulanChat[bulanChat.length - 1]), 'bulan terbesar di cincin terdalam');

// ── 3. Fondasi & satelit ────────────────────────────────────────────────────────────────────────
const fon = ['fon-supabase', 'fon-openrouter', 'fon-electron'].map((id) => by[id]);
cek(fon.every((f) => Math.abs(Math.hypot(f.fx, f.fy) - U.jariLuar) < E) && U.jariLuar >= U.jariOrbit + Math.max(...planet.map((p) => S(p.id))) + G.ORBIT.jedaFondasi - E,
  `fondasi di orbit luar (jari ${U.jariLuar.toFixed(0)}), di luar sistem planet terbesar`);
// Semua "badan" (bintang, sistem planet, fondasi, sistem satelit) — tak boleh ada dua yang bersentuhan.
const sistemSatelit = (hubId) => { const anak = graf.nodes.filter((n) => graf.links.some((l) => l.source === n.id && l.target === hubId) && n.group === 'alat');
  return Math.max(r(by[hubId]), ...anak.map((a) => jarak(a, by[hubId]) + r(a))); };
const badan = [
  ...['mamet-desktop', 'mamet-server'].map((id) => ({ id, x: by[id].fx, y: by[id].fy, j: r(by[id]) })),
  ...planet.map((p) => ({ id: p.id, x: p.fx, y: p.fy, j: S(p.id) })),
  ...fon.map((f) => ({ id: f.id, x: f.fx, y: f.fy, j: r(f) })),
  ...['lap-alat-chat', 'lap-alat-folder', 'lap-mcp', 'lap-subagen', 'lap-konektor-ecosystem-crawler'].map((id) => ({ id, x: by[id].fx, y: by[id].fy, j: sistemSatelit(id) })),
];
const sentuh = [];
for (let i = 0; i < badan.length; i++) for (let j = i + 1; j < badan.length; j++) if (jarak(badan[i], badan[j]) < badan[i].j + badan[j].j - E) sentuh.push([badan[i].id, badan[j].id]);
cek(sentuh.length === 0, `${badan.length} badan (bintang, sistem planet, fondasi, sistem satelit) tak ada yang bersentuhan`, sentuh);
cek(['lap-alat-chat', 'lap-alat-folder'].every((h) => { const p = by[{ 'lap-alat-chat': 'kem-chat', 'lap-alat-folder': 'kem-engineer' }[h]];
  return jarak(by[h], p) >= S(p.id) + G.ORBIT.jedaSatelit - E; }), 'satelit alat chat & alat folder di luar sistem planet induknya');
cek(graf.nodes.every((n) => n.fx !== undefined && n.x === n.fx && n.y === n.fy), `SEMUA ${graf.nodes.length} simpul dipaku (fx/fy = x/y) — tak ada yang dicari gaya fisika`);

// ── 4. Pesan = bulan dari percakapannya ─────────────────────────────────────────────────────────
const pesan = graf.nodes.filter((n) => n.group === 'pesan');
const ch = by[chatId];
let tindihPesan = 0;
for (let i = 0; i < pesan.length; i++) for (let j = i + 1; j < pesan.length; j++) if (jarak(pesan[i], pesan[j]) < r(pesan[i]) + r(pesan[j]) - E) tindihPesan++;
cek(pesan.length === 138 && pesan.every((m) => jarak(m, ch) >= r(ch) + r(m) - E) && tindihPesan === 0, '138 pesan mengitari percakapannya dalam cincin, tak bertindih');

// ── 4b. Bulan ikut planetnya saat diseret ───────────────────────────────────────────────────────
const pos0 = new Map(graf.nodes.map((n) => [n.id, [n.x, n.y]]));
const T = G.keturunanSistem(graf);
const sisChat = new Set(T.get('kem-chat').map((n) => n.id));
const harusIkut = [...data.filter((n) => induk(n) === 'kem-chat'), ...pesan, by['lap-alat-chat'], ...graf.nodes.filter((n) => graf.links.some((k) => k.source === n.id && k.target === 'lap-alat-chat'))];
cek(harusIkut.every((n) => sisChat.has(n.id)) && sisChat.size === harusIkut.length,
  `sistem Chat = ${kChat} bulan + 138 pesan (bulan dari bulan) + satelit Alat chat beserta alatnya — tak lebih, tak kurang`, [sisChat.size, harusIkut.length]);
// Seretan seperti force-graph: posisi awal di __initialDragPos, simpul SUDAH dipindah melewati ambang seret sebelum
// onNodeDrag pertama dipanggil, lalu tiap gerakan memanggil ikutSeret.
const planetChat = by['kem-chat'];
planetChat.__initialDragPos = { x: planetChat.x, y: planetChat.y };
let seret = null;
for (const [mx, my] of [[3, 1], [40, -20], [120, 75]]) {
  planetChat.x = planetChat.fx = pos0.get('kem-chat')[0] + mx; planetChat.y = planetChat.fy = pos0.get('kem-chat')[1] + my;
  if (!seret) seret = G.mulaiSeret(graf, planetChat);
  G.ikutSeret(seret, planetChat);
}
delete planetChat.__initialDragPos;
const pindah = (n) => [n.x - pos0.get(n.id)[0], n.y - pos0.get(n.id)[1]];
cek(harusIkut.every((n) => { const [dx, dy] = pindah(n); return Math.abs(dx - 120) < E && Math.abs(dy - 75) < E && n.fx === n.x && n.fy === n.y; }),
  'planet Chat diseret (120, 75): seluruh sistemnya ikut tepat sejauh itu & tetap dipaku');
cek(graf.nodes.filter((n) => n.id !== 'kem-chat' && !sisChat.has(n.id)).every((n) => pindah(n).every((d) => Math.abs(d) < E)), 'simpul di luar sistem Chat tak bergerak');
// Graf disusun ulang (data baru / ekor dibuka / lapisan dinyalakan): geseran Owner diterapkan lagi → tetap di tempat baru.
G.tataSurya(graf);
G.terapkanGeser(graf, new Map([['kem-chat', [120, 75]]]));
cek(graf.nodes.every((n) => { const [dx, dy] = pindah(n); const ikut = n.id === 'kem-chat' || sisChat.has(n.id);
  return ikut ? Math.abs(dx - 120) < E && Math.abs(dy - 75) < E : Math.abs(dx) < E && Math.abs(dy) < E; }), 'sesudah disusun ulang, planet Chat & sistemnya tetap di tempat barunya');
G.tataSurya(graf);
cek(graf.nodes.every((n) => pindah(n).every((d) => Math.abs(d) < E)), 'tanpa geseran, tata surya kembali rapi');
const percak = by[chatId];
percak.__initialDragPos = { x: percak.x, y: percak.y };
const s2 = G.mulaiSeret(graf, percak); percak.x += 10; percak.y -= 4; G.ikutSeret(s2, percak); delete percak.__initialDragPos;
cek(pesan.every((m) => { const [dx, dy] = pindah(m); return Math.abs(dx - 10) < E && Math.abs(dy + 4) < E; }) && pindah(by['kem-chat']).every((d) => Math.abs(d) < E),
  'percakapan diseret: pesannya ikut, planetnya diam');
G.tataSurya(graf);

// ── 5. Unit: cincinBulan, garis, label, ambang ──────────────────────────────────────────────────
const acak = Array.from({ length: 300 }, (_, i) => ({ val: 2 + ((i * 37) % 23) }));
const cb = G.cincinBulan(acak, 5);
const pos = [...cb.posisi];
let t2 = 0;
for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
  const [a, pa] = pos[i], [b, pb] = pos[j];
  if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < r(a) + r(b) - E) t2++;
}
cek(pos.length === 300 && t2 === 0 && pos.every(([n, p]) => Math.hypot(...p) + r(n) <= cb.jari + E && Math.hypot(...p) >= 5 + r(n) - E),
  'cincinBulan: 300 bulan beragam ukuran — tak bertindih, di dalam jari sistem, tak menembus inti');
const l = (s, t, x = {}) => ({ source: s, target: t, ...x });
cek(!G.garisMenyala(l('doc-1', 'kem-rag'), null) && G.garisMenyala(l('doc-1', 'kem-rag'), 'doc-1') && G.garisMenyala(l('doc-1', 'kem-rag'), 'kem-rag')
  && !G.garisMenyala(l('doc-1', 'kem-rag'), 'doc-2') && G.garisMenyala(l('pesan-chat-x-3', 'alat-chat-web_search'), 'chat-x')
  && G.garisMenyala(l({ id: 'doc-1' }, { id: 'kem-rag' }), 'kem-rag'),
  'garisMenyala: garis simpul terpilih (sumber/tujuan, juga objek force-graph) & pesan → alat percakapan terpilih; tanpa pilihan tak ada yang menyala');
const kAtas = G.kotakLabel(100, 50, 40, 10, 'kanan', true);
cek(JSON.stringify(kAtas) === '[100,40,140,50]', 'kotakLabel: label di atas simpul berakhir di jangkarnya');
const pl = by['kem-chat'];
const jk = G.jangkarLabel(pl, 5, 1);
cek(pl.labelAtas === true && jk.atas === true && Math.abs(Math.hypot(jk.x - pl.x, jk.y + 1 - pl.y) - (S('kem-chat') + 3)) < E,
  'label planet di luar sistem bulannya (Chat di atas → label di atas)');
cek(G.ambangLabelData(1) === 2 && Math.abs(G.ambangLabelData(2.36) - 4.248) < E && G.ambangLabelData(0) === 2, 'ambang nama data = max(2, skala pas × 1,8)');

// ── 6. Terpasang & fisika pensiun ───────────────────────────────────────────────────────────────
const AG = kode('frontend/src/components/dashboard/ActivityGraph.jsx'), HD = kode('frontend/src/components/dashboard/HomeDashboard.jsx');
cek(!/linkVisibility/.test(AG) && /garisMenyala\(link, simpulTerpilih\) \? `rgba\([^`]*0\.9\)` : `rgba\([^`]*0\.06\)`/.test(AG)
  && /if \(garisMenyala\(link, simpulTerpilih\)\) return 2\.5;/.test(AG) && /linkCurvature=\{\(link\) => \(link\?\.jalurPesan \? ORBIT_CURVATURE : 0\)\}/.test(AG),
  'ActivityGraph: jaring selalu tampil (tanpa linkVisibility), lurus; garis simpul terpilih menyala & tebal, sisanya redup');
cek(/cooldownTicks=\{30\}/.test(AG) && /jangkarLabel\(node, size, 2\.5 \/ globalScale\)/.test(AG), 'ActivityGraph: mesin berhenti cepat, label lewat jangkarLabel');
cek(/tataSurya\(graf\);[^\n]*\n\s*terapkanGeser\(graf, geserRef\.current\);/.test(HD)
  && /if \(seretRef\.current\?\.id !== node\.id\) seretRef\.current = mulaiSeret\(grafTampil, node\);\s*ikutSeret\(seretRef\.current, node\);/.test(HD)
  && /const \[dx, dy\] = ikutSeret\(seretRef\.current, node\);[\s\S]{0,120}geserRef\.current\.set\(node\.id, \[gx \+ dx, gy \+ dy\]\)/.test(HD),
  'HomeDashboard: seretan menggeser seluruh sistem, geserannya dicatat & diterapkan ulang setiap graf disusun');
cek(/tataSurya\(graf\);/.test(HD) && /fg\.d3Force\('charge'\)\?\.strength\?\.\(0\)/.test(HD) && /fg\.d3Force\('center', null\)/.test(HD)
  && /simpulTerpilih=\{selectedNode\?\.id \?\? null\}/.test(HD) && /skalaPas=\{skalaPas\}/.test(HD), 'HomeDashboard: tataSurya, gaya fisika dimatikan, simpul terpilih & skala pas diteruskan');
cek(/if \(kunciPasRef\.current === kunci\) return;/.test(HD) && !/ekorBaris/.test(HD.match(/const kunci = `[^`]*`/)?.[0] || 'ekorBaris'),
  'kamera dipaskan ulang hanya bila isi dasar berubah — bukan saat ekor pesan dibuka');
cek(['pasangGayaGraf', 'gayaCincin', 'gayaGravitasi', 'JARI_KEMAMPUAN'].every((f) => !(f in G)), 'kode gaya fisika lama tak tersisa (pasangGayaGraf, gayaCincin, gayaGravitasi, JARI_*)');
const K = baca('constitution/23_HOME_DASHBOARD_SPEC.md');
cek(/## TATA SURYA/.test(K) && /Tanpa garis orbit/.test(K) && /dipaku/.test(K) && /bintang ganda MAMET/.test(K) && /jaring laba-laba/.test(K) && /ikut bergeser/.test(K),
  'Konstitusi 23 memuat bagian TATA SURYA (bintang ganda, dipaku, tanpa garis orbit, jaring laba-laba, sistem ikut bergeser)');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
