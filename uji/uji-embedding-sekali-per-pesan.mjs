
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-embedding-sekali-per-pesan v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const CB = tanpaKomentar(baca('supabase/functions/agent-process/lib/orchestration/handlers/context_builder.ts'));
const RP = tanpaKomentar(baca('supabase/functions/agent-process/lib/request/request_pipeline.ts'));

console.log('\n-- ekspresi asli dijalankan --');
let putuskan;
{
  const m = CB.match(/const queryEmbedding: number\[\] =([\s\S]*?);\n/);
  cek(!!m, 'ekspresi keputusan ditemukan di context_builder (kalau gagal, polanya berubah)');
  if (!m) { console.log('\n1 GAGAL'); process.exit(1); }

  const ekspresi = m[1].trim();
  cek(!/\bas\b|<[A-Za-z]+>/.test(ekspresi), 'ekspresinya murni JavaScript — bisa dijalankan apa adanya', ekspresi);

  putuskan = new Function(
    'vektorSiap', 'ctx', 'gagalDiHulu', 'generateEmbedding', 'pesan', 'rctx', 'jejakVektor',
    `return (async () => (${ekspresi}))();`
  );
}

const jalankan = async ({ vektorSiap, gagalDiHulu, vektorTersimpan }) => {
  let panggilan = 0;
  const generateEmbedding = async () => { panggilan++; return []; };
  const ctx = { request: { queryEmbedding: vektorTersimpan } };
  const hasil = await putuskan(vektorSiap, ctx, gagalDiHulu, generateEmbedding, 'pesan', {}, {});
  return { panggilan, hasil };
};

const v768 = new Array(768).fill(0.1);

console.log('\n-- tiga keadaan --');
{
  const a = await jalankan({ vektorSiap: true, gagalDiHulu: undefined, vektorTersimpan: v768 });
  cek(a.panggilan === 0, 'vektor hulu BERHASIL -> pintu embedding tidak dipanggil lagi', a);
  cek(a.hasil.length === 768, 'dan vektor hulu itu yang dipakai', a.hasil.length);
}
{
  const b = await jalankan({ vektorSiap: false, gagalDiHulu: { sebab: 'galat', pesan: '402: habis' }, vektorTersimpan: undefined });
  cek(b.panggilan === 0, 'vektor hulu GAGAL -> TIDAK dipanggil kedua kali (dulu: 2 panggilan)', b);
  cek(Array.isArray(b.hasil) && b.hasil.length === 0, 'hasilnya array kosong, bukan undefined', b.hasil);
}
{
  const c = await jalankan({ vektorSiap: false, gagalDiHulu: undefined, vektorTersimpan: undefined });
  cek(c.panggilan === 1, 'hulu tak pernah mencoba (mis. RAG mati di hulu) -> boleh mencoba SEKALI', c);
}
{
  const d = await jalankan({ vektorSiap: false, gagalDiHulu: undefined, vektorTersimpan: [1, 2, 3] });
  cek(d.panggilan === 1, 'vektor pakai-ulang cacat -> tetap satu percobaan, bukan nol', d);
}

console.log('\n-- sebabnya tetap sampai --');
{
  cek(/const jejakVektor = \{ \.\.\.\(gagalDiHulu \|\| \{\}\) \}/.test(CB),
    'jejak diisi dari sebab hulu, jadi kalimat ⚠️ tetap menyebut sebab yang nyata',
    (CB.match(/.*jejakVektor = .*/g) || []));
  cek(/kalimatSebabEmbedding\(jejakVektor\)/.test(CB), 'kalimat sebab tetap dibangun dari jejak itu');
  cek(/sudah gagal di hulu — TIDAK diulang/.test(CB), 'log server mengatakan bahwa ia sengaja tidak diulang');
}

console.log('\n-- galat non-embedding tidak merusak --');
{
  const m = RP.match(/if \(jejakVektorMemori\.sebab\) \{([\s\S]*?)\n    \} else \{([\s\S]*?)\n    \}/);
  cek(!!m, 'kedua cabang catch ditemukan');
  const cabangEmbedding = m ? m[1] : '';
  const cabangLain = m ? m[2] : '';

  cek(/embeddingGagal = \{/.test(cabangEmbedding),
    'embeddingGagal disetel HANYA di cabang kegagalan embedding', cabangEmbedding.slice(0, 160));
  cek(!/embeddingGagal/.test(cabangLain),
    'cabang galat lain TIDAK menyetelnya — vektor yang baik tidak dibuang', cabangLain.slice(0, 160));
  cek(/sebab: jejakVektorMemori\.sebab/.test(cabangEmbedding), 'sebabnya diteruskan apa adanya');
}

console.log('\n-- jalur tulis ulang tetap hidup --');
{
  cek(/const vektorUlang = await generateEmbedding\(ulang\.teks, rctx\)/.test(CB),
    'embedding untuk pertanyaan tulis-ulang masih ada');
  const dalamBlokSukses = CB.indexOf('vektorUlang') > CB.indexOf('queryEmbedding.length === EMBEDDING_DIMENSIONS');
  cek(dalamBlokSukses, 'dan ia berada SESUDAH penjaga dimensi — hanya jalan bila vektor pertama berhasil');
}

console.log('\n-- bertipe --');
{
  const T = baca('supabase/functions/agent-process/lib/request/types.ts');
  cek(/queryEmbedding\?: number\[\];/.test(T), 'queryEmbedding dideklarasikan di types.ts');
  cek(/embeddingGagal\?: \{ sebab\?: string; pesan\?: string \};/.test(T), 'embeddingGagal dideklarasikan di types.ts');
  cek(!/as any\)\.queryEmbedding|as any\)\.embeddingGagal/.test(RP), 'tak ada lagi cast `as any` untuk keduanya');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
