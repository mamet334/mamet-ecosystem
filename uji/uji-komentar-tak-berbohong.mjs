import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');

console.log('uji-komentar-tak-berbohong v2');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

console.log('\n-- TMN-0002: pemanggilan supabase.from di ConversationEngine --');
{
  const isi = baca('frontend/src/components/workbench/ConversationEngine.jsx');
  const baris = isi.split('\n');

  const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\/\*|\*)/.test(b)).join('\n');
  const kode = tanpaKomentar(isi);

  const nyata = {};
  for (const b of kode.split('\n')) {
    const m = b.match(/supabase\.from\('([a-z_]+)'\)/);
    if (m) nyata[m[1]] = (nyata[m[1]] || 0) + 1;
  }

  cek(nyata['chats'] === 2,
    `supabase.from('chats') dipanggil 2x di kode (nyata: ${nyata['chats']})`, nyata);
  cek(nyata['project_memory_entries'] === 1,
    `supabase.from('project_memory_entries') dipanggil 1x di kode (nyata: ${nyata['project_memory_entries']})`, nyata);

  const tabelDitemukan = Object.keys(nyata);
  cek(tabelDitemukan.length === 2,
    `tepat 2 tabel dipanggil lewat supabase.from (${tabelDitemukan.join(', ')})`, tabelDitemukan);
}

console.log('\n-- TMN-0003: logCommand ada dan terpanggil --');
{
  const isi = baca('frontend/src/core/runtime/services/AuditLogService.js');

  cek(!existsSync(join(AKAR, 'frontend/src/core/runtime/services/CommandRegistry.js')),
    'CommandRegistry.js memang tidak ada');

  cek(/async logCommand\(/.test(isi), 'fungsi logCommand ada di AuditLogService');

  const semua = [];
  const jelajah = (d) => {
    for (const nama of readdirSync(join(AKAR, d))) {
      const p = `${d}/${nama}`;
      if (statSync(join(AKAR, p)).isDirectory()) jelajah(p);
      else if (/\.(js|jsx)$/.test(nama)) semua.push(p);
    }
  };
  jelajah('frontend/src');

  const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');
  const pemakai = semua.filter((p) => /\blogCommand\b/.test(tanpaKomentar(baca(p))));
  cek(semua.length > 100, `berkas frontend/src terbaca (${semua.length})`);
  cek(pemakai.length === 2, `dua berkas menyebutnya dalam kode: rumahnya + pemanggilnya (${pemakai.length})`, pemakai);
  cek(pemakai.some((p) => p.endsWith('AuditLogService.js')), 'rumahnya ada di daftar', pemakai);
  cek(pemakai.some((p) => p.endsWith('AssistantService.js')),
    'pemanggilnya benar AssistantService', pemakai);
  cek(pemakai.length <= 2, 'tak ada pemanggil lain yang belum disebut', pemakai);
}

console.log('\n-- catatan temuan --');
{
  const T = baca('docs/project-memory/temuan-engineer/TEMUAN-ENGINEER.md');

  const JUDUL_SAH = /^## (TMN-\d{4}) — (TERBUKA|DITUTUP)[ \t]*$/gm;
  const semuaJudul = (T.match(/^## TMN-\d{4}.*$/gm) || []);
  const judulSah = [...T.matchAll(JUDUL_SAH)];

  cek(semuaJudul.length > 0, `berkas temuan memuat entri (${semuaJudul.length})`, semuaJudul.length);
  cek(judulSah.length === semuaJudul.length,
    `SEMUA judul bisa diurai IngatanTemuan.js (${judulSah.length}/${semuaJudul.length})`,
    semuaJudul.filter((j) => !/^## TMN-\d{4} — (TERBUKA|DITUTUP)[ \t]*$/.test(j)));

  for (const id of ['TMN-0001', 'TMN-0002', 'TMN-0003', 'TMN-0004']) {
    const judul = (T.match(new RegExp(`^## ${id} — (TERBUKA|DITUTUP)`, 'm')) || [])[1] || '(tidak ada)';
    cek(judul === 'DITUTUP', `${id} tetap tercatat DITUTUP`, judul);
  }

  for (const m of [...T.matchAll(/^## (TMN-\d{4}) — DITUTUP[ \t]*$/gm)]) {
    const badan = T.slice(m.index, T.indexOf('\n## ', m.index + 1) + 1 || T.length);
    cek(/^- \*\*Ditutup:\*\*/m.test(badan) || /^- \*\*Penutupan:\*\*/m.test(badan),
      `${m[1]} menyebut sebab penutupannya`);
  }

  const nT = (T.match(/^## TMN-\d{4} — TERBUKA[ \t]*$/gm) || []).length;
  const nD = (T.match(/^## TMN-\d{4} — DITUTUP[ \t]*$/gm) || []).length;
  cek(new RegExp(`\\*\\*${nT} terbuka · ${nD} ditutup\\*\\*`).test(T),
    `penghitung kepala cocok dengan isinya (${nT} terbuka, ${nD} ditutup)`,
    (T.match(/\*\*\d+ terbuka · \d+ ditutup\*\*/) || [])[0]);
  cek(/lahir sudah tertutup/.test(T), 'pelajaran TMN-0001 (lahir sudah tertutup) ikut dicatat');
  cek(/BERTAMBAH salah|bertambah salah/.test(T), 'pelajaran TMN-0002 (sempat bertambah salah) ikut dicatat');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
