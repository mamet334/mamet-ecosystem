// UJI 2026-10-23 — klien MCP di proses utama (Item 129 Tahap B): electron/konektorMcp.cjs.
//
// Yang dijaga (keputusan Owner, docs/roadmap/ROADMAP-KONEKTOR-MCP.md):
//   K3  per workspace — Assistant & Engineer punya proses server sendiri; mematikan satu tidak menyentuh yang lain.
//   K2  belum ada jalur dari layar ke tools/call — gerbang persetujuan dibangun Tahap D di proses utama.
//   —   kunci API di proses Electron tidak sampai ke server konektor (lingkungan daftar putih).
// Bagian 3 menyalakan server crawler sungguhan; tanpa .venv crawler (tidak masuk repo) seluruh berkas DILEWATI.

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(AKAR, 'frontend', 'package.json'));
const K = require(path.join(AKAR, 'frontend', 'electron', 'konektorMcp.cjs'));

console.log('uji-konektor-mcp v1');
const PY = path.join(AKAR, 'capability', 'ecosystem-crawler', '.venv', 'Scripts', 'python.exe');
if (!existsSync(PY)) {
  console.log(`DILEWATI — ${path.relative(AKAR, PY)} tidak ada di mesin ini (.venv tidak masuk repo)`);
  process.exit(0);
}

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 500)}` : ''}`);
  if (!ok) gagal++;
};
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
const hidup = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// ── 1. Peluncuran: alamat absolut, Python milik konektor, lingkungan tanpa rahasia ────────────────────────────────
console.log('\n-- 1. peluncuran --');
process.env.MAMET_UJI_API_KEY = 'rahasia-uji';
process.env.OPENROUTER_API_KEY_UJI = 'rahasia-uji';
const p = K.peluncuran(AKAR, 'ecosystem-crawler');
cek(p.ok, 'crawler bisa diluncurkan dari capability/ecosystem-crawler/', p);
cek(p.command === PY && path.isAbsolute(p.command), 'program = python.exe di .venv konektor (alamat absolut, bukan dicari di PATH)', p.command);
cek(JSON.stringify(p.args) === JSON.stringify(['-m', 'crawler.wajah.mcp_server']), 'dijalankan `python -m` — paket dimuat dari folder kerja', p.args);
cek(p.cwd === path.join(AKAR, 'capability', 'ecosystem-crawler'), 'folder kerja = folder konektor', p.cwd);
const bocor = Object.keys(p.env).filter((k) => /KEY|TOKEN|SECRET|OPENROUTER|SUPABASE/i.test(k));
cek(bocor.length === 0, 'tak ada variabel rahasia di lingkungan server (MAMET_UJI_API_KEY ditanam di proses ini)', bocor);
cek(!('MAMET_UJI_API_KEY' in p.env) && ('PATH' in p.env || 'Path' in p.env), 'lingkungan daftar putih: PATH ada, kunci tidak', Object.keys(p.env));
cek(!K.peluncuran(AKAR, 'tak-dikenal').ok, 'konektor tak dikenal ditolak');
const tanpaVenv = mkdtempSync(path.join(os.tmpdir(), 'konektor-'));
mkdirSync(path.join(tanpaVenv, 'capability', 'ecosystem-crawler', 'crawler', 'wajah'), { recursive: true });
writeFileSync(path.join(tanpaVenv, 'capability', 'ecosystem-crawler', 'crawler', 'wajah', 'mcp_server.py'), '');
const pt = K.peluncuran(tanpaVenv, 'ecosystem-crawler');
cek(!pt.ok && /Python konektor tidak ada/.test(pt.alasan), 'tanpa .venv: ditolak dengan alasan jelas, tidak jatuh ke Python di PATH', pt);

// ── 2. Hasil alat berbatas ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. hasil berbatas --');
const panjang = K.teksHasil({ content: [{ type: 'text', text: 'x'.repeat(K.BATAS.hasilHuruf + 10) }] });
cek(panjang.terpotong && panjang.teks.length === K.BATAS.hasilHuruf, `hasil > ${K.BATAS.hasilHuruf} huruf dipotong & ditandai`, { ...panjang, teks: undefined });
cek(!K.teksHasil({ content: [{ type: 'text', text: 'pendek' }] }).terpotong, 'hasil pendek utuh');

// ── 3. Server sungguhan: per workspace (K3) ───────────────────────────────────────────────────────────────────
console.log('\n-- 3. server crawler sungguhan, per workspace --');
const log = [];
const m = K.buatPengelolaKonektor({ akarRepo: AKAR, versi: 'uji', log: (s) => log.push(s) });
try {
  const a = await m.nyalakan('ws-assistant', 'ecosystem-crawler');
  cek(a.ok && a.alat.length === 6, `Assistant: nyala, ${a.alat?.length} alat`, a);
  let st = m.status();
  const sAsis = st.find((x) => x.workspace === 'ws-assistant');
  const sEng = st.find((x) => x.workspace === 'ws-engineer');
  cek(sAsis.status === 'nyala' && sEng.status === 'mati', 'K3: menyalakan di Assistant TIDAK menghubungkan Engineer', st);

  const e = await m.nyalakan('ws-engineer', 'ecosystem-crawler');
  cek(e.ok && e.pid && e.pid !== a.pid, `Engineer disambung sendiri → proses sendiri (pid ${e.pid} ≠ ${a.pid})`, e);

  const kat = await m.panggil('ws-assistant', 'ecosystem-crawler', 'katalog', {});
  let isi = null;
  try { isi = JSON.parse(kat.teks); } catch { /* */ }
  cek(kat.ok && isi?.akses && typeof isi.akses.patuhi_robots === 'boolean', 'tools/call katalog → JSON berisi `akses` (sakelar robots/stealth)', kat);
  cek(!(await m.panggil('ws-assistant', 'ecosystem-crawler', 'hapus_semua', {})).ok, 'alat yang tidak ada di tools/list ditolak');
  cek(!(await m.panggil('ws-assistant', 'ecosystem-crawler', 'katalog', [1])).ok, 'argumen bukan objek ditolak');

  await m.matikan('ws-assistant', 'ecosystem-crawler');
  await tunggu(800);
  st = m.status();
  cek(st.find((x) => x.workspace === 'ws-assistant').status === 'mati' && st.find((x) => x.workspace === 'ws-engineer').status === 'nyala',
    'K3: mematikan Assistant tidak mematikan Engineer', st);
  cek(!(await m.panggil('ws-assistant', 'ecosystem-crawler', 'katalog', {})).ok, 'Assistant yang dimatikan tidak bisa dipanggil');
  cek(!hidup(a.pid), `proses Assistant (pid ${a.pid}) benar-benar berhenti`);
  cek((await m.panggil('ws-engineer', 'ecosystem-crawler', 'katalog', {})).ok, 'Engineer tetap bisa dipanggil');

  await m.matikanSemua();
  await tunggu(800);
  cek(m.status().every((x) => x.status === 'mati') && !hidup(e.pid), 'matikanSemua: semua sesi mati, proses Engineer berhenti');
  cek(!(await m.nyalakan('ws-lite', 'ecosystem-crawler')).ok, 'workspace di luar Assistant/Engineer ditolak');
} finally {
  await m.matikanSemua();
}

// ── 4. K2: belum ada jalur dari layar ke tools/call ───────────────────────────────────────────────────────────
console.log('\n-- 4. K2: panggil() tidak diekspos ke layar --');
const preload = readFileSync(path.join(AKAR, 'frontend', 'electron', 'preload.cjs'), 'utf8');
const main = readFileSync(path.join(AKAR, 'frontend', 'electron', 'main.cjs'), 'utf8');
cek(/konektor:status/.test(preload) && /konektor:nyalakan/.test(preload) && /konektor:matikan/.test(preload),
  'layar bisa melihat status, menyalakan, dan mematikan konektor');
cek(!/konektor:panggil/.test(preload) && !/ipcMain\.handle\('konektor:panggil'/.test(main) && !/\.panggil\(/.test(main),
  'tidak ada IPC ke tools/call — gerbang persetujuan Owner (Tahap D) belum ada, jadi jalurnya pun belum ada');
cek(/matikanSemua/.test(main) && /will-quit/.test(main), 'proses konektor dimatikan saat aplikasi keluar');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
