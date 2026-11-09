
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-rag-turun-bersuara v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const dir = mkdtempSync(join(tmpdir(), 'uji-embed-'));
let generateEmbedding, kalimatSebabEmbedding;
try {
  writeFileSync(join(dir, 'vektor-palsu.mjs'), `
export const EMBED_DIMENSI = 768;
export async function embedLewatOpenRouter() {
  const p = globalThis.__palsu;
  if (p.lempar) { const e = new Error(p.lempar); e.kode = p.kode; throw e; }
  return p.kembalikan;
}
`);
  const { code } = await esbuild.transform(baca('supabase/functions/agent-process/lib/rag/embedding.ts'), {
    loader: 'ts', format: 'esm',
  });
  cek(/vector_utils\.ts/.test(code), 'prasyarat: hanya satu impor yang perlu ditukar');
  writeFileSync(join(dir, 'embedding.mjs'), code.replace('../vector_utils.ts', './vektor-palsu.mjs'));
  ({ generateEmbedding, kalimatSebabEmbedding } = await import(pathToFileURL(join(dir, 'embedding.mjs')).href));

  const vektorBenar = new Array(768).fill(0.1);
  const rctxBerkunci = { keys: { openRouterByok: 'sk-palsu' } };

  console.log('\n-- A. jalan normal --');
  {
    globalThis.__palsu = { kembalikan: [vektorBenar] };
    const jejak = {};
    const v = await generateEmbedding('halo', rctxBerkunci, jejak);
    cek(v.length === 768, 'vektor 768 dimensi dikembalikan', v.length);
    cek(jejak.sebab === undefined, 'tidak ada sebab yang dicatat saat berhasil', jejak);
  }

  console.log('\n-- B. sebab kegagalan dibedakan --');
  {
    globalThis.__palsu = { kembalikan: [vektorBenar] };
    const jejak = {};
    const v = await generateEmbedding('halo', { keys: {} }, jejak);
    cek(v.length === 0, 'tanpa kunci -> array kosong (kontrak lama dipertahankan)', v);
    cek(jejak.sebab === 'tanpa-kunci', 'tanpa kunci -> sebab tanpa-kunci', jejak);
  }
  {
    globalThis.__palsu = { lempar: 'insufficient credits', kode: 402 };
    const jejak = {};
    const v = await generateEmbedding('halo', rctxBerkunci, jejak);
    cek(v.length === 0, 'OpenRouter gagal -> array kosong', v);
    cek(jejak.sebab === 'galat', 'OpenRouter gagal -> sebab galat', jejak);
    cek(/insufficient credits/.test(jejak.pesan || ''), 'pesan aslinya dibawa, bukan dibuang', jejak.pesan);
    cek(/402/.test(jejak.pesan || ''), 'kodenya ikut — 402 saldo habis bisa dibedakan dari galat jaringan', jejak.pesan);
  }
  {
    globalThis.__palsu = { kembalikan: [[1, 2, 3]] };
    const jejak = {};
    const v = await generateEmbedding('halo', rctxBerkunci, jejak);
    cek(jejak.sebab === 'dimensi', 'dimensi salah -> sebab dimensi', jejak);
    cek(/3 dimensi/.test(jejak.pesan || '') && /768/.test(jejak.pesan || ''),
      'disebut dapat berapa dan perlu berapa', jejak.pesan);
    cek(v.length === 3, 'nilai kembaliannya TIDAK diubah — pemanggil yang memeriksa dimensi', v);
  }

  console.log('\n-- C. daftar kosong dituduh dengan benar --');
  {
    globalThis.__palsu = { kembalikan: [] };
    const jejak = {};
    const v = await generateEmbedding('halo', rctxBerkunci, jejak);
    cek(Array.isArray(v) && v.length === 0, 'tetap array kosong (sama seperti versi lama)', v);
    cek(jejak.sebab === 'dimensi', 'disebut sebagai 0 dimensi, BUKAN dituduh galat OpenRouter', jejak);
    cek(!/undefined/.test(jejak.pesan || ''),
      'tak ada TypeError internal yang menyamar sebagai sebab', jejak.pesan);
  }

  console.log('\n-- D. tambahan, bukan perubahan --');
  {
    for (const [nama, palsu, rctx] of [
      ['tanpa kunci', { kembalikan: [vektorBenar] }, { keys: {} }],
      ['galat', { lempar: 'boom' }, rctxBerkunci],
      ['dimensi salah', { kembalikan: [[1]] }, rctxBerkunci],
      ['berhasil', { kembalikan: [vektorBenar] }, rctxBerkunci],
    ]) {
      globalThis.__palsu = palsu;
      let aman = true;
      try { await generateEmbedding('halo', rctx); } catch { aman = false; }
      cek(aman, `pemanggil tanpa argumen jejak tetap aman (${nama})`);
    }
  }

  console.log('\n-- E. kalimat untuk Owner --');
  {
    cek(/BYOK|kunci/i.test(kalimatSebabEmbedding({ sebab: 'tanpa-kunci' })),
      'tanpa-kunci -> menyebut kuncinya', kalimatSebabEmbedding({ sebab: 'tanpa-kunci' }));
    const k = kalimatSebabEmbedding({ sebab: 'galat', pesan: '402: insufficient credits' });
    cek(/OpenRouter/.test(k) && /insufficient credits/.test(k), 'galat -> menyebut OpenRouter & pesan aslinya', k);
    cek(/skema/i.test(kalimatSebabEmbedding({ sebab: 'dimensi', pesan: 'x' })),
      'dimensi -> menyebut skema database', kalimatSebabEmbedding({ sebab: 'dimensi', pesan: 'x' }));
    cek(kalimatSebabEmbedding({}).length > 0, 'tanpa sebab pun mengembalikan kalimat, bukan undefined');
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('\n-- F. sampai ke layar, bukan hanya log server --');
{
  const CB = tanpaKomentar(baca('supabase/functions/agent-process/lib/orchestration/handlers/context_builder.ts'));

  cek(/RAG TURUN KE PENCOCOKAN KATA/.test(CB), 'penurunan ke pencocokan kata ditulis ke processingSteps');
  cek(/processingSteps\.push\(\s*`⚠️ \[RAG TURUN KE PENCOCOKAN KATA\]/.test(CB),
    'ditandai ⚠️, bukan ikut tenggelam di antara penanda ✅');
  cek(/kalimatSebabEmbedding\(jejakVektor\)/.test(CB), 'sebabnya yang nyata dipakai, bukan kalimat umum');
  cek(/generateEmbedding\(pesan, rctx, jejakVektor\)/.test(CB), 'jejaknya benar-benar dikirim ke pintu embedding');
  cek(/TIDAK ditemukan/.test(CB), 'akibatnya dikatakan terus terang pada pesannya');
  cek(/vektor yang dipakai ulang tak sesuai dimensi/.test(CB),
    'vektor pakai-ulang yang cacat juga punya sebab sendiri (jejak tak terisi di jalur itu)');

  const RP = tanpaKomentar(baca('supabase/functions/agent-process/lib/request/request_pipeline.ts'));
  cek(/MEMORI DILEWATI/.test(RP), 'memori yang dilewati ditulis ke processingSteps');
  cek(/tidak punya cadangan pencocokan kata/.test(RP),
    'dibedakan dari dokumen: memori TIDAK punya cadangan', (RP.match(/.*cadangan pencocokan kata.*/g) || []));
  cek(/generateEmbeddingThroughAdapter\(parsed\.finalMessage, rctx, jejakVektorMemori\)/.test(RP),
    'jejaknya dikirim lewat pembungkus pencarian memori');
  cek(/if \(jejakVektorMemori\.sebab\)/.test(RP) && /else \{/.test(RP),
    'galat non-embedding tetap punya cabangnya sendiri');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
