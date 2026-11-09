
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const AKAR = fileURLToPath(new URL('..', import.meta.url));
const G = await import(pathToFileURL(join(AKAR, 'frontend/src/core/runtime/hooks/grafHome.js')).href);
const { simulasikan, barisTiruan, SEBARAN_OWNER } = await import(pathToFileURL(join(AKAR, 'uji/lib/simulasiGrafHome.mjs')).href);
console.warn = () => {};

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
const baca = (p) => readFileSync(join(AKAR, p), 'utf8');
const kode = (p) => baca(p).split(/\r?\n/).filter((b) => !/^\s*(\/\/|\*)/.test(b)).join('\n');
console.log('uji-graf-home-tahap-c v1');

const baris = barisTiruan();
baris.memories[0].metadata = { chat_id: baris.chats[0].id };
baris.memories[1].metadata = { document_id: baris.documents[0].id };
const { nodes, links } = G.susunGrafHome({ ...baris, vitals: {} });
const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
const id = (x) => x?.id ?? x;
const garis = links.map((l) => `${id(l.source)}->${id(l.target)}`);
const ada = (s, t) => garis.includes(`${s}->${t}`);

const D = G.PUSAT.desktop, S = G.PUSAT.server;
cek(byId[D]?.group === 'pusat' && byId[S]?.group === 'pusat' && byId[D].fx < 0 && byId[S].fx > 0 && byId[D].fy === 0,
  'pusat = MAMET dua belahan (Desktop kiri, Server kanan, posisi dipaku)');
cek(ada(D, S) && links.find((l) => l.jalurPesan)?.statusKeys?.[0] === 'agentProcess', 'kedua belahan disambung jalur pesan berlampu');
cek(!nodes.some((n) => /SUPABASE KERNEL/.test(n.name) || /^(core-|cat-|subcat-|pipe-)/.test(n.id)),
  'susunan lama hilang: tanpa SUPABASE KERNEL, cluster, sub-cluster label kosong, simpul layanan');

const harapBelahan = { 'kem-chat': [D, S], 'kem-rag': [S], 'kem-tabel': [D], 'kem-engineer': [D, S], 'kem-memori': [S] };
for (const [k, bel] of Object.entries(harapBelahan)) {
  const nyata = [D, S].filter((b) => ada(k, b));
  cek(byId[k]?.group === 'kemampuan' && JSON.stringify(nyata) === JSON.stringify(bel), `${byId[k]?.name}: bergaris ke ${bel.map((b) => b.split('-')[1]).join(' & ')}`, nyata);
}
cek(/data_tabel/.test(baca('tools/data_tabel.js')) && /match_documents|rag/i.test(baca('supabase/functions/agent-process/lib/orchestration/handlers/context_builder.ts')),
  'belahan kemampuan berpijak pada kode: tools/data_tabel.js (desktop), context_builder.ts RAG (server)');

const ekor = (k) => links.filter((l) => id(l.target) === k).map((l) => byId[id(l.source)]).filter((n) => ['memory', 'rag', 'chat'].includes(n?.group));
cek(ekor('kem-rag').length === SEBARAN_OWNER.dokumen && ekor('kem-rag').every((n) => n.group === 'rag'), `RAG Dokumen berekor ${SEBARAN_OWNER.dokumen} dokumen`);
cek(ekor('kem-memori').length === SEBARAN_OWNER.memori, `Memori berekor ${SEBARAN_OWNER.memori} memori — tak ada lagi memori melayang`);
cek(ekor('kem-engineer').length === SEBARAN_OWNER.engineer && ekor('kem-chat').length === SEBARAN_OWNER.assistant + SEBARAN_OWNER.lite,
  `percakapan menurut workspace: Engineer ${SEBARAN_OWNER.engineer}, Chat ${SEBARAN_OWNER.assistant + SEBARAN_OWNER.lite}`);
cek(['OWNER', 'ws-owner', 'ws-engineer'].every((w) => G.kemampuanPercakapan(w) === 'kem-engineer')
  && ['ws-assistant', 'ws-lite', 'ws-agent-forge', null].every((w) => G.kemampuanPercakapan(w) === 'kem-chat'), 'nama workspace lama (OWNER, ws-owner, agent-forge) dipetakan benar');
cek(ada(`chat-${baris.chats[0].id}`, `mem-${baris.memories[0].id}`) && ada(`doc-${baris.documents[0].id}`, `mem-${baris.memories[1].id}`),
  'relasi data tetap: memori ↔ percakapan/dokumen asalnya');
const tanpaGaris = nodes.filter((n) => !links.some((l) => id(l.source) === n.id || id(l.target) === n.id));
cek(tanpaGaris.length === 0, 'setiap simpul bergaris (tak ada yang melayang)', tanpaGaris.map((n) => n.id).slice(0, 5));

cek(['fon-supabase', 'fon-openrouter', 'fon-electron'].every((f) => byId[f]?.group === 'fondasi' && Array.isArray(byId[f].statusKeys))
  && ada('fon-supabase', D) && ada('fon-supabase', S) && ada('fon-openrouter', S) && !ada('fon-openrouter', D) && ada('fon-electron', D) && !ada('fon-electron', S),
  'fondasi: Supabase ke kedua belahan (ingatan bersama), OpenRouter ke server, Electron ke desktop');
const L = G.nilaiLampu({ desktop: true }), W = G.nilaiLampu({ desktop: false });
cek(L.status.electron === 'HEALTHY' && W.status.electron === 'UNKNOWN' && /web/.test(W.keterangan.electron), 'lampu Electron: desktop hijau, web abu-abu dengan alasan');

const sim = simulasikan();
const jarak = (n) => Math.hypot(n.x, n.y);
const kem = sim.simpul.filter((n) => n.group === 'kemampuan'), fon = sim.simpul.filter((n) => n.group === 'fondasi');
cek(kem.every((n) => Math.abs(jarak(n) - sim.ukuran.jariOrbit) < 1e-6) && fon.every((n) => Math.abs(jarak(n) - sim.ukuran.jariLuar) < 1e-6)
  && sim.ukuran.jariLuar > sim.ukuran.jariOrbit, `kemampuan di orbit dalam (${sim.ukuran.jariOrbit.toFixed(0)}), fondasi di orbit luar (${sim.ukuran.jariLuar.toFixed(0)})`);
cek(sim.tumpang.length === 0 && sim.label.length === 10, `layar Owner: 10 label (2 belahan + 5 kemampuan + 3 fondasi), 0 tumpang (skala ${sim.skala.toFixed(3)})`, sim.tumpang);

const iKerangkaPertama = nodes.findIndex((n) => n.isCategory);
cek(iKerangkaPertama > 0 && nodes.slice(iKerangkaPertama).every((n) => n.isCategory) && nodes.slice(0, iKerangkaPertama).every((n) => !n.isCategory),
  'simpul kerangka dilukis PALING AKHIR (label "RAG Dokumen" tak tertimbun titik data)');
const p = G.tataPas({ bbox: { x: [-100, 100], y: [-50, 50] }, lebar: 1000, tinggi: 700, padding: 50, atas: 150 });
const layarY = (gy) => (gy - p.y) * p.k + 350, layarX = (gx) => (gx - p.x) * p.k + 500;
cek(p.k === 4.5 && Math.abs(layarX(-100) - 50) < 1e-9 && layarY(-50) >= 150 - 1e-9 && layarY(50) <= 650 + 1e-9,
  'tataPas memuat graf ke wilayah di bawah pita legenda (rumus layar force-graph)', { k: p.k, atas: layarY(-50), bawah: layarY(50) });
for (const [nama, layar] of [['layar Owner', undefined], ['1920×1080', { lebar: 1600, tinggi: 980 }]]) {
  const h = simulasikan(layar ? { layar } : {});
  cek(h.atasSimpul >= G.RUANG_ATAS - 0.5 && h.tumpang.length === 0, `${nama}: tak ada simpul di pita judul & legenda (teratas ${h.atasSimpul.toFixed(0)} px ≥ ${G.RUANG_ATAS}), 0 tumpang`, h.tumpang);
}
cek(/tataPas\(\{ bbox, lebar: dimensions\.width, tinggi: dimensions\.height \}\)/.test(kode('frontend/src/components/dashboard/HomeDashboard.jsx'))
  && !/zoomToFit\(/.test(kode('frontend/src/components/dashboard/HomeDashboard.jsx')), 'HomeDashboard memakai tataPas, bukan zoomToFit');

const HD = kode('frontend/src/components/dashboard/HomeDashboard.jsx');
const UD = kode('frontend/src/core/runtime/hooks/useDashboardData.js');
cek(/new Set\(\[PUSAT\.desktop, PUSAT\.server\]\)/.test(HD) && !/core-maef/.test(HD + UD) && /`\$\{PUSAT\.desktop\}->\$\{PUSAT\.server\}`/.test(UD),
  'sorotan jalur & jejak gagal memakai belahan MAMET (tanpa core-maef)');
let kini = new Set([`chat-${baris.chats[0].id}`]); const capai = new Set();
for (let i = 0; i < 3; i++) { const lanjut = new Set(); kini.forEach((c) => garis.forEach((g) => { const [s, t] = g.split('->'); if (s === c) { capai.add(t); lanjut.add(t); } })); kini = lanjut; }
cek(capai.has('kem-chat') && capai.has(S), 'telusur jalur dari percakapan mencapai kemampuan & belahan server', [...capai]);

const K = baca('constitution/23_HOME_DASHBOARD_SPEC.md');
cek(/## CENTRAL NODE[\s\S]*`MAMET`/.test(K) && !/Node pusat mutlak:\s*\n\s*`SUPABASE`/.test(K) && /Revisi 2 November 2026/.test(K),
  'Konstitusi 23: pusat MAMET, bukan lagi SUPABASE; revisi tercatat');
cek(/FREE & SAFE/.test(K) && /STATUS LIGHTS/.test(K) && /RELATIONSHIP RULE/.test(K), 'Konstitusi 23 memuat aturan gratis & aman, lampu jujur, dan garis = relasi nyata');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
