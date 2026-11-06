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

console.log('\n-- blok keys: bebas kunci sistem --');
{
  const m = RP.match(/\n    keys: \{\n([\s\S]*?)\n    \},\n/);
  cek(!!m, 'blok keys: ditemukan (kalau gagal, polanya berubah — perbarui uji ini)');
  const blok = m ? m[1] : '';

  const medan = [...blok.matchAll(/^\s{6}(\w+):/gm)].map((x) => x[1]);
  cek(medan.length >= 6, `semua medan kunci terbaca (${medan.length})`, medan);
  for (const wajib of ['openRouter', 'openRouterByok', 'gemini', 'allGemini', 'groq', 'openAI']) {
    cek(medan.includes(wajib), `medan ${wajib} ada`, medan);
  }

  cek(!/Deno\.env/.test(blok), 'TAK ADA Deno.env di dalam blok keys:', (blok.match(/.*Deno\.env.*/g) || []));

  const identifierKey = [...blok.matchAll(/\b(\w*[Kk]ey)\b/g)].map((x) => x[1]);
  const asing = [...new Set(identifierKey)].filter((n) => n !== 'finalApiKey' && n !== 'byokProviderKey');
  cek(asing.length === 0, 'tak ada variabel kunci perantara selain finalApiKey', asing);

  cek(/request\.headers\.get\('x-byok-openrouter'\)/.test(blok),
    'OpenRouter jatuh ke HEADER pengguna, bukan kunci sistem');
}

console.log('\n-- cadangan OpenAI --');
{
  cek(/openAI: finalProvider === 'openai' \? finalApiKey : '',/.test(RP),
    "openAI kosong bila penyedia pengguna bukan openai", (RP.match(/.*openAI:.*/g) || []));
  cek(!/openAIKey/.test(RP), 'variabel openAIKey dicabut seluruhnya');
}

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

console.log('\n-- antarmuka ProviderKeys --');
{
  cek(/export interface ProviderKeys/.test(RC), 'interface ProviderKeys didefinisikan');
  cek(/openAI:\s*string/.test(RC), 'medan openAI bertipe string ada di ProviderKeys');
  cek(/openRouter\?:\s*string/.test(RC) && /openRouterByok\?:\s*string/.test(RC),
    'medan openRouter dan openRouterByok terpisah di ProviderKeys');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
