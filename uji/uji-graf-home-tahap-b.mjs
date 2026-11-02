// UJI 2026-11-02 — Item 130 Tahap B (graf Home): GRATIS & lampu JUJUR.
//
// Dulu: `functions.invoke('ping')` tiap buka Home, `select('*')` pada agent_logs/api_usage/ai_system_logs; lampu
// menebak — agent-process DOWN dari satu permintaan gagal (SYSTEM STATUS: DOWN sejak 30 Okt), penyedia selalu hijau
// (dibaca dari tabel 0 baris), embedding hijau karena potongan lama ada, Realtime tak pernah diisi, UNKNOWN digambar
// merah, dan graf disusun dengan `vitals` state awal (simpul layanan selalu abu-abu bergaris merah).

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const AKAR = fileURLToPath(new URL('..', import.meta.url));
const G = await import(pathToFileURL(join(AKAR, 'frontend/src/core/runtime/hooks/grafHome.js')).href);
const { barisTiruan } = await import(pathToFileURL(join(AKAR, 'uji/lib/simulasiGrafHome.mjs')).href);
console.warn = () => {};

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
const baca = (p) => readFileSync(join(AKAR, p), 'utf8');
console.log('uji-graf-home-tahap-b v1');

// ── 1. Lampu dari sinyal nyata (nilaiLampu) ─────────────────────────────────────────────────────
const SEKARANG = Date.parse('2026-11-02T05:00:00Z');
// Keadaan sungguhan Owner, diukur 2 Nov (hanya tanggal): heartbeat DOWN 30 Okt 18:25, panggilan berhasil terakhir
// 27 Okt, PROVIDER_ERROR terakhir 30 Okt 14:47 (saldo OpenRouter minus).
const owner = G.nilaiLampu({
  heartbeat: { status: 'DOWN', last_heartbeat_at: '2026-10-30T18:25:18Z' },
  suksesTerakhir: '2026-10-27T08:06:47Z', galatPenyediaTerakhir: '2026-10-30T14:47:32Z', sekarang: SEKARANG,
});
cek(owner.status.agentProcess === 'DEGRADED' && /gagal/.test(owner.keterangan.agentProcess),
  'heartbeat DOWN = "permintaan terakhir gagal" (kuning), BUKAN fungsi mati', owner);
cek(owner.status.edge === 'HEALTHY', 'Edge hijau: agent-process sendiri yang menulis heartbeat 3 hari lalu (tanpa ping)', owner.status);
cek(owner.status.provider === 'DEGRADED' && /gagal terakhir/.test(owner.keterangan.provider) && /berhasil terakhir/.test(owner.keterangan.provider),
  'penyedia kuning: kegagalan (30 Okt) lebih baru dari keberhasilan terakhir (27 Okt) — saldo minus terlihat', owner.keterangan.provider);
cek(owner.status.embedding === 'UNKNOWN', 'embedding UNKNOWN: tak ada sinyal (tak tercatat di api_usage) — tidak dikarang hijau');
const panel = (st) => (Object.values(st).includes('DOWN') ? 'DOWN' : Object.values(st).includes('DEGRADED') ? 'DEGRADED' : 'lain');
cek(panel(owner.status) === 'DEGRADED', 'SYSTEM STATUS keadaan Owner = DEGRADED (dulu DOWN)');

const sehat = G.nilaiLampu({ heartbeat: { status: 'HEALTHY', last_heartbeat_at: '2026-11-02T04:50:00Z' }, suksesTerakhir: '2026-11-02T04:50:00Z', galatPenyediaTerakhir: '2026-10-30T14:47:32Z', sekarang: SEKARANG });
cek(sehat.status.agentProcess === 'HEALTHY' && sehat.status.provider === 'HEALTHY', 'berhasil sesudah gagal → hijau lagi', sehat.status);
const kosong = G.nilaiLampu({ sekarang: SEKARANG });
cek(['agentProcess', 'edge', 'provider', 'embedding'].every((k) => kosong.status[k] === 'UNKNOWN'), 'tanpa sinyal apa pun → semua UNKNOWN (bukan hijau, bukan merah)', kosong.status);
const lama = G.nilaiLampu({ heartbeat: { status: 'HEALTHY', last_heartbeat_at: '2026-10-20T00:00:00Z' }, suksesTerakhir: '2026-09-01T00:00:00Z', galatPenyediaTerakhir: '2026-09-02T00:00:00Z', sekarang: SEKARANG });
cek(lama.status.edge === 'UNKNOWN' && lama.status.provider === 'UNKNOWN', 'sinyal basi (heartbeat > 7 hari, penyedia > 30 hari) → UNKNOWN', lama.status);
const galatSaja = G.nilaiLampu({ galatPenyediaTerakhir: '2026-11-01T00:00:00Z', sekarang: SEKARANG });
cek(galatSaja.status.provider === 'DEGRADED', 'hanya pernah gagal → kuning');

// ── 2. Warna & Realtime ─────────────────────────────────────────────────────────────────────────
cek(G.warnaStatus('UNKNOWN') === '#94a3b8' && G.warnaStatus(undefined) === '#94a3b8' && G.warnaStatus('DOWN') === '#ef4444'
  && G.warnaStatus('DEGRADED') === '#eab308' && G.warnaStatus('HEALTHY') === '#22c55e', 'UNKNOWN abu-abu; merah hanya untuk DOWN');
cek(G.statusRealtime('SUBSCRIBED') === 'HEALTHY' && G.statusRealtime('CHANNEL_ERROR') === 'DOWN' && G.statusRealtime('TIMED_OUT') === 'DEGRADED'
  && G.statusRealtime('CLOSED') === 'UNKNOWN', 'status Realtime dari callback langganan');

// ── 3. Graf disusun dengan vitals yang diberikan ────────────────────────────────────────────────
// Sejak Tahap C lampu ada di FONDASI (gabungan) & jalur pesan — bukan 11 simpul layanan.
const vitals = { supabase: 'HEALTHY', realtime: 'UNKNOWN', provider: 'DEGRADED', embedding: 'UNKNOWN', agentProcess: 'DOWN', electron: 'UNKNOWN' };
const { nodes, links } = G.susunGrafHome({ ...barisTiruan(), vitals });
const fon = Object.fromEntries(nodes.filter((n) => n.group === 'fondasi').map((n) => [n.id, n]));
cek(fon['fon-supabase']?.color === '#22c55e' && fon['fon-openrouter']?.color === '#eab308' && fon['fon-electron']?.color === '#94a3b8'
  && Array.isArray(fon['fon-supabase']?.statusKeys), 'simpul fondasi berwarna dari vitals & membawa statusKeys (UNKNOWN tak menggelapkan yang diketahui)',
  Object.fromEntries(Object.entries(fon).map(([k, n]) => [k, n.color])));
cek(G.statusGabungan(['realtime', 'embedding'], vitals) === 'UNKNOWN' && G.statusGabungan(['supabase', 'agentProcess'], vitals) === 'DOWN',
  'statusGabungan: semua UNKNOWN → UNKNOWN; yang terburuk menang');
const jalur = links.find((l) => l.jalurPesan);
cek(JSON.stringify(jalur?.statusKeys) === '["agentProcess"]', 'jalur pesan berlampu = permintaan terakhir agent-process', jalur);

// ── 4. agent_logs dipangkas, bentuk lama utuh ───────────────────────────────────────────────────
const logs = G.bentukLogAgen([{ event_type: 'PROVIDER_ERROR', provider: 'openrouter', created_at: 'x', latency_ms: 12, trace_id: 't1', traceId: null, execution_time_ms: null, duration_ms: null }]);
cek(logs[0]?.metadata?.latency_ms === 12 && logs[0]?.metadata?.trace_id === 't1' && logs[0]?.event_type === 'PROVIDER_ERROR' && !('latency_ms' in (logs[0] || {})),
  'bentukLogAgen memulihkan l.metadata?.… untuk pembaca lama', logs[0]);
cek(!/message|metadata\s*(,|$)/.test(G.KOLOM_LOG_AGEN) && /trace_id:metadata->>trace_id/.test(G.KOLOM_LOG_AGEN),
  'kolom agent_logs tanpa message & metadata utuh', G.KOLOM_LOG_AGEN);

// ── 5. GRATIS: tak ada panggilan berbayar/berulang di Home ──────────────────────────────────────
const berkasHome = ['frontend/src/core/runtime/hooks/useDashboardData.js', 'frontend/src/core/runtime/hooks/grafHome.js',
  ...readdirSync(join(AKAR, 'frontend/src/components/dashboard')).filter((n) => /\.jsx?$/.test(n)).map((n) => `frontend/src/components/dashboard/${n}`)];
const kode = (p) => baca(p).split(/\r?\n/).filter((b) => !/^\s*(\/\/|\*)/.test(b)).join('\n');
const pola = [['functions.invoke', /functions\.invoke\(/], ["select('*')", /select\(\s*['"]\*['"]\s*\)/], ['setInterval', /setInterval\(/],
  ['agent-process / model', /AGENT_ENDPOINT|openrouter\.ai|\/functions\/v1\//i]];
const langgar = berkasHome.flatMap((p) => pola.filter(([, re]) => re.test(kode(p))).map(([n]) => `${p.split('/').pop()}: ${n}`));
cek(langgar.length === 0, `Home gratis: tanpa Edge Function, select('*'), polling, atau panggilan model (${berkasHome.length} berkas)`, langgar);

// ── 6. Terpasang ────────────────────────────────────────────────────────────────────────────────
const H = kode('frontend/src/core/runtime/hooks/useDashboardData.js');
cek(/susunGrafHome\(\{[^}]*vitals: vitalsBaru[,\s}]/.test(H) && /setVitals\(vitalsBaru\)/.test(H), 'graf & panel memakai vitals TERKINI yang sama');
cek(/nilaiLampu\(\{/.test(H) && /select\(KOLOM_LOG_AGEN\)/.test(H) && /from\('api_usage'\)\.select\('created_at'\)/.test(H), 'hook memakai nilaiLampu, KOLOM_LOG_AGEN, api_usage seperlunya');
const HD = kode('frontend/src/components/dashboard/HomeDashboard.jsx');
cek(/laporRealtime\(status\)/.test(HD) && /node\.statusKeys \? warnaLampu\(node\.statusKeys\)/.test(HD) && /warnaStatus\(statusGabungan\(kunci, vitals\)\)/.test(HD),
  'Realtime dilaporkan dari langganan; warna simpul berlampu dari vitals terkini');
cek(/link\.statusKeys && warnaLampu\) return warnaLampu\(link\.statusKeys\)/.test(kode('frontend/src/components/dashboard/ActivityGraph.jsx')), 'garis berlampu ikut status terkini');
cek(/title=\{keteranganLampu\[key\]/.test(kode('frontend/src/components/dashboard/ObservabilityPanel.jsx')), 'alasan lampu tampil saat disorot di panel');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
