// Pulihkan berkas cadangan Mamet (tombol "Cadangkan data", format mamet-cadangan v1) ke Postgres LOKAL.
// Item 93 Tahap 2 (2026-09-22). Hanya menyentuh database lokal yang disebut; database itu DIBUAT ULANG dari nol.
//
// Pakai:
//   node scripts/kedaulatan/pulih-cadangan.mjs --berkas <cadangan.json> --pg-bin <folder psql.exe>
//        [--port 55432] [--db mamet_pulih] [--user mamet] [--sandi-file <berkas berisi kata sandi>]
// Kata sandi dibaca dari berkas (atau PGPASSWORD) dan tidak pernah dicetak.
//
// Cara kerja: tiap tabel ditulis sebagai JSON per baris → \copy ke tabel sementara (kolom jsonb) →
// jsonb_populate_record ke tabel asli, kolom GENERATED (fts) dilewati dan dibangun ulang dari teks. Sesudah semua
// data masuk, kunci asing antar-tabel ditambahkan (menguji keutuhan) lalu jumlah baris dicocokkan dengan daftar isi.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const arg = (nama, bawaan) => { const i = process.argv.indexOf(`--${nama}`); return i > 0 ? process.argv[i + 1] : bawaan; };
const berkasPath = arg('berkas');
const pgBin = arg('pg-bin');
const port = arg('port', '55432');
const db = arg('db', 'mamet_pulih');
const user = arg('user', 'mamet');
const sandiFile = arg('sandi-file');
if (!berkasPath || !pgBin) { console.error('Wajib: --berkas dan --pg-bin'); process.exit(2); }
if (!/^[a-z_][a-z0-9_]*$/.test(db)) { console.error('Nama --db tidak sah'); process.exit(2); }

const env = { ...process.env, PGPASSWORD: sandiFile ? fs.readFileSync(sandiFile, 'utf8').trim() : (process.env.PGPASSWORD || '') };
const psql = path.join(pgBin, process.platform === 'win32' ? 'psql.exe' : 'psql');
const jalankan = (basisData, argumen) => {
  const r = spawnSync(psql, ['-h', '127.0.0.1', '-p', port, '-U', user, '-d', basisData, '-v', 'ON_ERROR_STOP=1', '-X', '-q', ...argumen], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`psql gagal (${basisData}): ${(r.stderr || r.stdout || '').trim().slice(0, 800)}`);
  return r.stdout;
};

console.log('pulih-cadangan v1');
const berkas = JSON.parse(fs.readFileSync(berkasPath, 'utf8'));
if (berkas.format !== 'mamet-cadangan' || berkas.versi !== 1) throw new Error('Bukan berkas cadangan Mamet v1');
const tabel = Object.keys(berkas.tabel);
console.log(`berkas: ${path.basename(berkasPath)} · dibuat ${berkas.dibuat} · ${tabel.length} tabel`);

// 1. Database baru + skema
const t0 = Date.now();
jalankan('postgres', ['-c', `drop database if exists ${db}`]);
jalankan('postgres', ['-c', `create database ${db}`]);
const skema = path.join(path.dirname(fileURLToPath(import.meta.url)), 'skema-pulih.sql');
jalankan(db, ['-f', skema]);

// 2. Data per tabel (urutan berkas = induk sebelum anak)
const kerja = fs.mkdtempSync(path.join(os.tmpdir(), 'mamet-pulih-'));
try {
  const baris = [];
  for (const t of tabel) {
    const f = path.join(kerja, `${t}.ndjson`);
    fs.writeFileSync(f, berkas.data[t].map((r) => JSON.stringify(r)).join('\n') + (berkas.data[t].length ? '\n' : ''), 'utf8');
    const fSql = f.replace(/\\/g, '/').replace(/'/g, "''");
    // Pemisah & kutip = karakter kendali 0x01/0x02: JSON.stringify tidak pernah menulisnya mentah.
    baris.push(String.raw`create temp table _stg_${t} (j jsonb);`);
    baris.push(String.raw`\copy _stg_${t} (j) from '${fSql}' with (format csv, delimiter E'\x02', quote E'\x01')`);
    baris.push(String.raw`select _pulih_isi('${t}');`);
  }
  const fungsi = String.raw`
create or replace function pg_temp._pulih_isi(t text) returns void language plpgsql as $$
declare kolom text; kolom_r text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position),
         string_agg('r.' || quote_ident(column_name), ', ' order by ordinal_position)
    into kolom, kolom_r
    from information_schema.columns
   where table_schema = 'public' and table_name = t and is_generated = 'NEVER';
  execute format('insert into public.%I (%s) select %s from %I s, jsonb_populate_record(null::public.%I, s.j) r',
                 t, kolom, kolom_r, '_stg_' || t, t);
end $$;
create or replace function _pulih_isi(t text) returns void language sql as $$ select pg_temp._pulih_isi(t) $$;`;
  const naskah = path.join(kerja, 'muat.sql');
  fs.writeFileSync(naskah, [fungsi, ...baris, 'drop function _pulih_isi(text);'].join('\n') + '\n', 'utf8');
  jalankan(db, ['-f', naskah]);
} finally {
  fs.rmSync(kerja, { recursive: true, force: true });
}

// 3. Kunci asing (menguji keutuhan: setiap anak punya induk di berkas)
jalankan(db, ['-c', [
  'alter table documents add foreign key (space_id) references knowledge_spaces(id)',
  'alter table document_chunks add foreign key (document_id) references documents(id)',
  'alter table workspace_summaries add foreign key (space_id) references knowledge_spaces(id)',
  'alter table asn_pegawai add foreign key (berkas_id) references asn_berkas(id)',
  'alter table asn_berkas add foreign key (digantikan_oleh) references asn_berkas(id)',
].join('; ')]);

// 4. Cocokkan jumlah
const hitung = jalankan(db, ['-At', '-c', tabel.map((t) => `select '${t}', count(*) from public.${t}`).join(' union all ')]);
const di = Object.fromEntries(hitung.trim().split(/\r?\n/).map((l) => l.split('|')).map(([t, n]) => [t, Number(n)]));
let cocok = true;
for (const t of tabel) {
  const ok = di[t] === berkas.tabel[t].jumlah;
  if (!ok) cocok = false;
  console.log(`  ${ok ? '✓' : '✗'} ${t.padEnd(24)} berkas ${String(berkas.tabel[t].jumlah).padStart(5)}  lokal ${String(di[t]).padStart(5)}`);
}
const fts = jalankan(db, ['-At', '-c', "select count(*) from document_chunks where fts is not null and fts <> ''::tsvector"]).trim();
console.log(`  indeks kata (fts) dibangun ulang: ${fts} potongan`);
console.log(`\n${cocok ? 'PULIH LENGKAP' : 'PULIH TIDAK LENGKAP'} dalam ${Math.round((Date.now() - t0) / 1000)} dtk`);
process.exit(cocok ? 0 : 1);
