
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const AKAR = fileURLToPath(new URL('..', import.meta.url));
const imp = (p) => import(pathToFileURL(join(AKAR, p)).href);
const G = await imp('frontend/src/core/runtime/hooks/grafHome.js');
const { SUBAGEN } = await imp('shared/daftarSubagen.js');
const { ALAT_SEMUA } = await imp('shared/folderKerjaAlat.js');
const { KONEKTOR_DIKENAL } = await imp('shared/konektorAlat.js');
const { simulasikan, barisTiruan } = await imp('uji/lib/simulasiGrafHome.mjs');
console.warn = () => {};

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
const baca = (p) => readFileSync(join(AKAR, p), 'utf8');
const kode = (p) => baca(p).split(/\r?\n/).filter((b) => !/^\s*(\/\/|\*)/.test(b)).join('\n');
console.log('uji-graf-home-tahap-e v1');

const MIG = baca('supabase/migrations/20261102000000_graf_home_hitungan_pesan.sql').replace(/--[^\n]*/g, '');
const fungsi = (nama) => MIG.match(new RegExp(`create or replace function public\\.${nama}\\([\\s\\S]*?\\$\\$;`))?.[0] || '';
for (const f of ['hitungan_graf_home', 'pesan_percakapan_graf']) {
  const t = fungsi(f);
  cek(/security invoker/.test(t) && !/security definer/i.test(t) && /set search_path = ''/.test(t) && /\(select auth\.uid\(\)\)/.test(t),
    `${f}: SECURITY INVOKER, search_path kosong, menyaring auth.uid() sendiri`);
  cek(new RegExp(`revoke execute on function public\\.${f}\\([^)]*\\) from public, anon;`).test(MIG)
    && new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to authenticated;`).test(MIG)
    && !new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to[^;]*\\b(anon|public)\\b`).test(MIG), `${f}: EXECUTE dicabut dari public/anon, hanya authenticated`);
}
const ekorSql = fungsi('pesan_percakapan_graf');
cek(/left\(btrim\(regexp_replace\(regexp_replace\(coalesce\(t\.m->>'content', ''\), '<think>\.\*\?<\/think>'/.test(ekorSql) && /, 80\)/.test(ekorSql) && /limit 300/.test(ekorSql),
  'ekor: cuplikan isi pesan dibatasi 80 huruf (nalar <think> dibuang), maksimal 300 pesan');
const keluar = ekorSql.match(/returns table \(([^)]*)\)/)?.[1] || '';
cek(keluar === 'urutan integer, peran text, cuplikan text, alat text[]' && !/SYSTEM CONTEXT FINAL|memoryPrompt/.test(ekorSql.replace(/'\[MEMORY PROMPT GENERATED\]%'/, '')),
  'ekor hanya mengembalikan urutan, peran, cuplikan, kode alat — tak menyentuh konteks/teks memori', keluar);
cek(/'\^\\\[RAG CONTEXT GENERATED\\\] ragArray size=\(\\d\+\) \\\(termasuk \(\\d\+\)'/.test(ekorSql) && /'memoryArray size=\(\\d\+\)\\s\*\$'/.test(ekorSql),
  'kode rag/web/memori diturunkan dari ANGKA baris langkah (format dari context_builder.ts)');
cek(/ragArray size=\$\{ctx\.state\.ragArray\.length\} \(termasuk \$\{externalDocs\.length\} web\/external chunks\)/.test(baca('supabase/functions/agent-process/lib/orchestration/handlers/context_builder.ts'))
  && /memoryArray size=\$\{projectMemResult\.memoryArray\.length\}`\)/.test(baca('supabase/functions/agent-process/lib/orchestration/handlers/context_builder.ts')),
  'format baris langkah yang dibaca migrasi masih sama dengan yang ditulis server');

const h = G.bacaHitunganGraf([{ jenis: 'pesan', id: 'c1', jumlah: 138 }, { jenis: 'potongan', id: 'd1', jumlah: 12 }, { jenis: 'pemakaian_model', id: null, jumlah: 1255 }, { jenis: 'pesan', id: 'c2', jumlah: 'x' }]);
cek(h.pesanPerChat.c1 === 138 && !('c2' in h.pesanPerChat) && h.docChunkCounts.d1 === 12 && h.pemakaianModel === 1255, 'bacaHitunganGraf memetakan pesan, potongan, pemakaian model', h);
cek(G.ukuranPercakapan(undefined) === 8 && G.ukuranPercakapan(0) === 4 && G.ukuranPercakapan(138) === 24 && G.ukuranPercakapan(20) === 10, 'ukuran percakapan 4–24 menurut jumlah pesan; tanpa angka tetap 8');
const tiruan = barisTiruan();
const id0 = tiruan.chats[0].id;
const graf = G.susunGrafHome({ ...tiruan, vitals: {}, pesanPerChat: { [id0]: 50 } });
const c0 = graf.nodes.find((n) => n.id === `chat-${id0}`), c1 = graf.nodes.find((n) => n.id === `chat-${tiruan.chats[1].id}`);
cek(c0.val === G.ukuranPercakapan(50) && c0.data.pesan === 50 && c1.val === 8 && !('pesan' in c1.data), 'simpul percakapan berukuran & membawa jumlah pesannya');

const alatChat = ['web_search', 'memory_manager', 'deep_research', 'data_tabel', 'word_to_pdf'].map((name) => ({ name, aktif: true }));
const lapisan = G.susunLapisanKemampuan({ alatChat, alatFolder: ALAT_SEMUA, konektorDikenal: KONEKTOR_DIKENAL, konektor: [], subagen: SUBAGEN });
const baris = [
  { urutan: 1, peran: 'user', cuplikan: 'pertanyaan', alat: [] },
  { urutan: 2, peran: 'model', cuplikan: 'jawaban', alat: ['memori', 'rag', 'web'] },
  { urutan: 3, peran: 'model', cuplikan: 'riset', alat: ['deep_research', 'knowledge_manager', 'researcher'] },
];
const idDasar = new Set(graf.nodes.map((n) => n.id));
const idPenuh = new Set([...idDasar, ...lapisan.nodes.map((n) => n.id)]);
const tanpaLap = G.susunEkorPesan(`chat-${id0}`, baris, idDasar), denganLap = G.susunEkorPesan(`chat-${id0}`, baris, idPenuh);
const garis = (e) => e.links.map((l) => `${l.source}->${l.target}`);
cek(tanpaLap.nodes.length === 3 && tanpaLap.links.filter((l) => l.target === `chat-${id0}`).length === 3 && tanpaLap.nodes.every((n) => n.group === 'pesan'),
  'ekor: satu simpul per pesan, masing-masing bergaris ke percakapannya');
cek(JSON.stringify(garis(tanpaLap).filter((g) => !g.endsWith(`chat-${id0}`))) === JSON.stringify([`pesan-chat-${id0}-2->kem-memori`, `pesan-chat-${id0}-2->kem-rag`]),
  'lapisan Kemampuan mati: hanya rag → RAG Dokumen & memori → Memori (web & alat tak punya simpul)', garis(tanpaLap));
cek(garis(denganLap).includes(`pesan-chat-${id0}-2->alat-chat-web_search`) && garis(denganLap).includes(`pesan-chat-${id0}-3->alat-chat-deep_research`)
  && garis(denganLap).includes(`pesan-chat-${id0}-3->alat-sub-researcher`) && !garis(denganLap).some((g) => /knowledge_manager/.test(g)),
  'lapisan menyala: web → alat Web, deep_research & researcher → simpulnya; knowledge_manager (dihapus T9) tak bergaris');
const n3 = denganLap.nodes.find((n) => n.id.endsWith('-3'));
cek(/^Mamet · riset \[deep_research, knowledge_manager, researcher\]$/.test(n3.name) && /^Anda · /.test(tanpaLap.nodes[0].name) && denganLap.links.filter((l) => l.jalurAlat).length === 5,
  'nama pesan: peran · cuplikan [kode alat]; garis alat ditandai jalurAlat', n3.name);
cek(G.labelTooltipAman({ name: 'Anda · <img src=x onerror=alert(1)>' }).includes('&lt;img'), 'cuplikan di tooltip tetap di-escape (teks, bukan HTML)');
cek(G.simpulDirektori(G.gabungGraf(graf, tanpaLap).nodes).length === G.simpulDirektori(graf.nodes).length, 'pesan tak masuk Knowledge Directory');

const terpakai = [];
cek(G.bolehLabel([0, 0, 10, 10], terpakai) && !G.bolehLabel([5, 5, 15, 15], terpakai) && G.bolehLabel([10, 0, 20, 10], terpakai) && terpakai.length === 2,
  'bolehLabel: yang menindih dilewati, yang bersentuhan tepi boleh');
cek(JSON.stringify(G.kotakLabel(100, 0, 40, 10)) === '[80,0,120,10]' && JSON.stringify(G.kotakLabel(100, 0, 40, 10, 'kiri')) === '[60,0,100,10]'
  && JSON.stringify(G.kotakLabel(100, 0, 40, 10, 'kanan')) === '[100,0,140,10]', 'kotakLabel: tengah / rata kiri / rata kanan');
cek(G.prioritasLabel({ group: 'pusat' }) < G.prioritasLabel({ group: 'kemampuan' }) && G.prioritasLabel({ group: 'fondasi' }) < G.prioritasLabel({ group: 'lapisan' })
  && G.prioritasLabel({ group: 'lapisan' }) < G.prioritasLabel({ group: 'memory', isConflict: true }) && G.prioritasLabel({ group: 'memory', isConflict: true }) < G.prioritasLabel({ group: 'chat' }),
  'prioritas: pusat < kemampuan < fondasi < lapisan < konflik < data');
const belahan = graf.nodes.filter((n) => n.group === 'pusat').map((n) => `${n.id}:${n.labelArah}`).sort();
cek(JSON.stringify(belahan) === '["mamet-desktop:kiri","mamet-server:kanan"]', 'label belahan diratakan ke luar (Desktop kiri, Server kanan)');

const ekorPanjang = Array.from({ length: 138 }, (_, i) => ({ urutan: i + 1, peran: i % 2 ? 'model' : 'user', cuplikan: `c${i}`, alat: i % 4 === 1 ? [['rag'], ['rag', 'memori'], ['web'], ['deep_research']][i % 4] : [] }));
const ekorF = (lp) => (dasar) => G.susunEkorPesan(`chat-${id0}`, ekorPanjang, new Set([...dasar.nodes, ...(lp ? lp.nodes : [])].map((n) => n.id)));
for (const [nama, opsi] of [['layar Owner', {}], ['1920×1080', { layar: { lebar: 1600, tinggi: 980 } }], ['768×900', { layar: { lebar: 768, tinggi: 600 } }]]) {
  for (const [kasus, lp] of [['ekor 138 pesan', [ekorF(null)]], ['ekor + Kemampuan', [lapisan, ekorF(lapisan)]]]) {
    const s = simulasikan({ ...opsi, lapisan: lp });
    const intiHilang = s.tersembunyi.filter((l) => ['pusat', 'kemampuan', 'fondasi'].includes(l.group)).map((l) => l.teks);
    cek(intiHilang.length === 0 && s.atasSimpul >= G.RUANG_ATAS - 0.5,
      `${nama}, ${kasus}: 0 label inti tersembunyi, pita legenda bersih (tumpang mentah ${s.tumpang.length}, disembunyikan ${s.tersembunyi.length})`, intiHilang);
  }
}

const AG = kode('frontend/src/components/dashboard/ActivityGraph.jsx');
cek((AG.match(/fillText\(/g) || []).length === 1 && /onRenderFramePost=\{[\s\S]*bolehLabel\(kotakLabel\([\s\S]*fillText\(/.test(AG) && /onRenderFramePre=\{\(\) => \{ antreanLabelRef\.current = \[\]; \}\}/.test(AG),
  'label dilukis SEKALI di akhir bingkai (onRenderFramePost) lewat bolehLabel/kotakLabel; antrean dikosongkan tiap bingkai');
const HD = kode('frontend/src/components/dashboard/HomeDashboard.jsx');
cek(/supabase\.rpc\('pesan_percakapan_graf', \{ p_chat: chatId\.replace\(\/\^chat-\/, ''\) \}\)/.test(HD) && /if \(ekorBaris\?\.chatId === chatId\) \{ setEkorBaris\(null\); return; \}/.test(HD)
  && /idAda\.has\(ekorBaris\.chatId\)/.test(HD), 'ekor dimuat saat percakapan diklik, ditutup bila diklik lagi, dijaga bila percakapannya hilang');
cek(/selectedNode && GRUP_DATA\.includes\(selectedNode\.group\) \? \(/.test(HD), 'Node Inspector hanya untuk simpul data (alat/pesan tak lagi berlencana USER MEMORY)');
const UD = kode('frontend/src/core/runtime/hooks/useDashboardData.js');
cek(/supabase\.rpc\('hitungan_graf_home'\)/.test(UD) && /if \(hitunganRes\.error\) \{\s*chunkRes = await chunkQuery;/.test(UD)
  && /hitungan\.pemakaianModel \?\? apiUsages\.length/.test(UD) && /pesanPerChat: hitungan\.pesanPerChat/.test(UD),
  'hook: angka dari hitungan_graf_home (jalan lama bila gagal), LLM CALLS = total sebenarnya, ukuran percakapan');
const K5 = baca('uji/uji-hak-tabel-k5.mjs');
cek(/hitungan_graf_home: \{ chats: \['SELECT'\], documents: \['SELECT'\], document_chunks: \['SELECT'\], api_usage: \['SELECT'\] \}/.test(K5)
  && /pesan_percakapan_graf: \{ chats: \['SELECT'\] \}/.test(K5), 'uji K5 mengenal tabel yang disentuh kedua RPC SECURITY INVOKER baru');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
