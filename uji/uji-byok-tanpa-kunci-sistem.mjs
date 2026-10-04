// UJI 2026-10-04 — BYOK: tak ada satu pun kunci sistem yang menyusup jadi cadangan.
//
// ── Asalnya ─────────────────────────────────────────────────────────────────────────────────
// Keputusan Owner 2026-09-10 menutup cadangan kunci sistem untuk provider chat, dengan dua
// alasan yang ditulis sendiri di request_pipeline.ts:
//   1. belanja pengguna eksternal ditanggung Owner tanpa jejak kepemilikan;
//   2. ketika kunci sistem mati (terbukti 401 "User not found"), SETIAP pengguna tanpa BYOK
//      tertutup total — dan tak ada yang tahu, karena Owner selalu punya kunci sendiri.
//
// Gemini, Groq, dan OpenRouter ditutup. OPENAI TERLEWAT: `openAI` masih diisi kunci server bagi
// setiap pengguna yang penyedianya BUKAN openai, sampai 2026-10-04.
//
// Ditelusuri sampai habis sebelum diperbaiki: hari itu TIDAK ada yang memakainya — `getAdapter()`
// nol pemanggil, satu-satunya kaskade memakai ['openrouter','gemini','groq'], dan
// `env.OPENAI_API_KEY` yang dititipkan ke sub-agent tidak pernah dibaca. Jadi pistol terisi tanpa
// pelatuk: satu nama ditambahkan ke satu daftar preferredOrder sudah cukup untuk melepaskannya.
//
// ── Kenapa penjaganya DIBUAT UMUM ───────────────────────────────────────────────────────────
// Memeriksa "openAI tidak memakai kunci sistem" hanya menutup penyedia yang kebetulan ketahuan
// hari ini. Yang diuji di bawah adalah bentuk invariannya: DI SELURUH blok `keys:`, tak satu pun
// nilai boleh berasal dari `Deno.env`. Penyedia kelima yang ditambahkan nanti ikut terjaga tanpa
// menyentuh berkas ini.

import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-byok-tanpa-kunci-sistem v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const RP = tanpaKomentar(baca('supabase/functions/agent-process/lib/request/request_pipeline.ts'));
const RC = baca('supabase/functions/agent-process/lib/runtime_context.ts');

// ── 1. Blok `keys:` tidak boleh menyentuh Deno.env — untuk penyedia APA PUN ─────────────────
console.log('\n-- blok keys: bebas kunci sistem --');
{
  const m = RP.match(/\n    keys: \{\n([\s\S]*?)\n    \},\n/);
  cek(!!m, 'blok keys: ditemukan (kalau gagal, polanya berubah — perbarui uji ini)');
  const blok = m ? m[1] : '';

  // Jumlahnya diperiksa supaya blok kosong tidak membuat asersi di bawah hijau secara hampa.
  const medan = [...blok.matchAll(/^\s{6}(\w+):/gm)].map((x) => x[1]);
  cek(medan.length >= 6, `semua medan kunci terbaca (${medan.length})`, medan);
  for (const wajib of ['openRouter', 'openRouterByok', 'gemini', 'allGemini', 'groq', 'openAI']) {
    cek(medan.includes(wajib), `medan ${wajib} ada`, medan);
  }

  cek(!/Deno\.env/.test(blok), 'TAK ADA Deno.env di dalam blok keys:', (blok.match(/.*Deno\.env.*/g) || []));

  // Penjaga lapis kedua: kunci sistem dulu masuk lewat variabel perantara (`openAIKey`), bukan
  // lewat Deno.env langsung di blok ini. Jadi identifier ber-akhiran Key pun dibatasi.
  const identifierKey = [...blok.matchAll(/\b(\w*[Kk]ey)\b/g)].map((x) => x[1]);
  const asing = [...new Set(identifierKey)].filter((n) => n !== 'finalApiKey' && n !== 'byokProviderKey');
  cek(asing.length === 0, 'tak ada variabel kunci perantara selain finalApiKey', asing);

  // Sumber yang sah hanya dua: kunci pengguna terpilih, atau header BYOK.
  cek(/request\.headers\.get\('x-byok-openrouter'\)/.test(blok),
    'OpenRouter jatuh ke HEADER pengguna, bukan kunci sistem');
}

// ── 2. Cadangan OpenAI yang terlewat itu benar-benar tertutup ────────────────────────────────
console.log('\n-- cadangan OpenAI --');
{
  cek(/openAI: finalProvider === 'openai' \? finalApiKey : '',/.test(RP),
    "openAI kosong bila penyedia pengguna bukan openai", (RP.match(/.*openAI:.*/g) || []));
  cek(!/openAIKey/.test(RP), 'variabel openAIKey dicabut seluruhnya');
}

// ── 3. Tak satu pun rahasia penyedia dibaca untuk PEKERJAAN ─────────────────────────────────
// index.ts:59 masih membaca tiga di antaranya, tetapi HANYA untuk mencetak 'CONFIGURED'/'MISSING'
// pada muatan status — tidak pernah dipakai memanggil model. Itu dibiarkan, dan dipisahkan di sini
// supaya bedanya tidak kabur.
console.log('\n-- rahasia penyedia di seluruh agent-process --');
{
  const berkas = [];
  const jelajah = (d) => {
    for (const nama of readdirSync(join(AKAR, d))) {
      const p = `${d}/${nama}`;
      if (statSync(join(AKAR, p)).isDirectory()) jelajah(p);
      else if (/\.ts$/.test(nama)) berkas.push(p);
    }
  };
  jelajah('supabase/functions/agent-process');
  cek(berkas.length > 30, `berkas .ts terbaca (${berkas.length})`);

  for (const rahasia of ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY']) {
    const pembaca = berkas.filter((p) => baca(p).includes(`Deno.env.get('${rahasia}')`));
    const diluarStatus = pembaca.filter((p) => !p.endsWith('agent-process/index.ts'));
    cek(diluarStatus.length === 0,
      `${rahasia} tidak dibaca di luar muatan status index.ts`, diluarStatus);
    if (rahasia === 'OPENAI_API_KEY') {
      cek(pembaca.length === 0, 'OPENAI_API_KEY tidak dibaca SAMA SEKALI', pembaca);
    }
  }
}

// ── 4. Komentar basi yang nyaris menyesatkan laporan ────────────────────────────────────────
// Kalimat lama di runtime_context.ts menyatakan `openRouter` jatuh ke OPENROUTER_API_KEY sistem.
// Perilaku itu dihapus 2026-09-15; komentarnya tertinggal, dan membaca komentar alih-alih kode
// nyaris membuat cadangan yang sudah tidak ada dilaporkan sebagai masih hidup.
console.log('\n-- komentar basi --');
{
  cek(!/jatuh ke OPENROUTER_API_KEY sistem bila provider/.test(RC),
    'kalimat basi tentang cadangan OPENROUTER_API_KEY dibuang');
  cek(/KOREKSI 2026-10-04/.test(RC), 'koreksinya dicatat, bukan hanya dihapus jejaknya');
  cek(/Tak ada cadangan kunci sistem/.test(RC), 'medan openAI diberi keterangan yang benar');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
