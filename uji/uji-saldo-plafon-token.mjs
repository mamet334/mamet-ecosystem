
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');


console.log('uji-saldo-plafon-token v2');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const PESAN_402 = JSON.stringify({
  error: {
    code: 402,
    message: 'This request requires more credits, or fewer max_tokens. You requested up to 8192 tokens, but can only afford 1234.',
  },
});

const PESAN_402_NYATA = JSON.stringify({
  error: {
    message: 'This request requires more credits, or fewer max_tokens. You requested up to 8192 tokens, but can only afford 779. To increase, visit https://openrouter.ai/settings/credits and add more credits',
    code: 402,
    metadata: {
      limit_source: 'openrouter_credits',
      remedy_hint: 'Add credits at https://openrouter.ai/settings/credits, or lower max_tokens / prompt size to fit your remaining balance.',
      provider_name: null,
      previous_errors: [
        { code: 402, message: 'This request requires more credits, or fewer max_tokens. You requested up to 8192 tokens, but can only afford 734. To increase, visit https://openrouter.ai/settings/credits and add more credits' },
        { code: 402, message: 'This request requires more credits, or fewer max_tokens. You requested up to 8192 tokens, but can only afford 1558. To increase, visit https://openrouter.ai/settings/credits and add more credits' },
        { code: 402, message: 'This request requires more credits, or fewer max_tokens. You requested up to 8192 tokens, but can only afford 1558. To increase, visit https://openrouter.ai/settings/credits and add more credits' },
      ],
    },
  },
});

const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const dir = mkdtempSync(join(tmpdir(), 'uji-saldo-'));
try {
  const { code } = await esbuild.transform(baca('supabase/functions/agent-process/lib/adapters/reasoning_openrouter.ts'), {
    loader: 'ts', format: 'esm',
  });
  writeFileSync(join(dir, 'ro.mjs'), code);
  const M = await import(pathToFileURL(join(dir, 'ro.mjs')).href);
  const { kirimOpenRouterDenganReasoning, tokenTerjangkau, plafonUlang, pesanSaldoTakCukup, MAKS_TOKEN_JAWABAN, MIN_TOKEN_LAYAK, MARGIN_SALDO } = M;

  const resp = (status, teks = '') => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => teks,
    clone() { return this; },
  });

  console.log('\n-- pengurai "can only afford" --');
  cek(tokenTerjangkau(PESAN_402) === 1234, 'angka terjangkau terbaca dari pesan 402 yang sebenarnya', tokenTerjangkau(PESAN_402));
  cek(tokenTerjangkau('can only afford 1,234.') === 1234, 'koca ribuan ditoleransi', tokenTerjangkau('can only afford 1,234.'));
  cek(tokenTerjangkau('CAN ONLY AFFORD 99') === 99, 'tidak peka huruf besar-kecil');
  cek(tokenTerjangkau('Insufficient credits.') === null, 'kalimat lain -> null, bukan angka karangan');
  cek(tokenTerjangkau('') === null, 'kosong -> null');
  cek(tokenTerjangkau('can only afford 0') === null, 'nol bukan angka yang berguna -> null');

  console.log('\n-- badan 402 NYATA dari produksi --');
  cek(tokenTerjangkau(PESAN_402_NYATA) === 734,
    'mengambil yang TERKECIL (734), bukan yang pertama (779) — inilah yang gagal di produksi',
    tokenTerjangkau(PESAN_402_NYATA));
  cek(plafonUlang(PESAN_402_NYATA) === Math.floor(734 * MARGIN_SALDO),
    `plafon ulang = terkecil × margin ${MARGIN_SALDO} = ${Math.floor(734 * MARGIN_SALDO)}`,
    plafonUlang(PESAN_402_NYATA));
  cek(plafonUlang(PESAN_402_NYATA) < 734,
    'ada KELONGGARAN — meminta tepat sebesar batas sudah terbukti ditolak di produksi');
  cek(plafonUlang(PESAN_402_NYATA) >= MIN_TOKEN_LAYAK,
    'dan masih di atas lantai, jadi pengulangannya tetap layak dicoba', plafonUlang(PESAN_402_NYATA));

  console.log('\n-- varian 402 kedua: prompt kebesaran --');
  {
    const PROMPT_402 = JSON.stringify({
      error: {
        message: 'Prompt tokens limit exceeded: 14250 > 3621. To increase, visit https://openrouter.ai/settings/credits and add more credits',
        code: 402,
        metadata: { limit_source: 'openrouter_credits' },
      },
    });
    const b = M.batasPrompt(PROMPT_402);
    cek(b?.dipakai === 14250 && b?.batas === 3621, 'kedua angka terbaca', b);
    cek(tokenTerjangkau(PROMPT_402) === null, 'varian ini TIDAK punya "can only afford" — jadi jangan dipaksakan');

    const pesan = pesanSaldoTakCukup(PROMPT_402, MAKS_TOKEN_JAWABAN);
    cek(/14250/.test(pesan) && /3621/.test(pesan), 'pesannya menyebut kedua angka', pesan);
    cek(/10629/.test(pesan), 'dan kelebihannya dihitungkan, bukan disuruh menghitung sendiri', pesan);
    cek(/TIDAK menolong/.test(pesan), 'dikatakan tegas bahwa menurunkan panjang jawaban tak menolong', pesan);
    cek(/PROMPT_KOMPOSISI/.test(pesan), 'menunjuk ke tempat angkanya bisa dilihat', pesan);
    cek(!/percakapan BARU/i.test(pesan), 'TIDAK menyuruh mulai percakapan baru — sisipan peta repo dikirim ulang tiap pesan, jadi itu tak berpengaruh', pesan);
    cek(!/\{"error"/.test(pesan), 'badan JSON mentah tidak lagi diteruskan untuk varian ini', pesan);

    const d = [];
    await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: MAKS_TOKEN_JAWABAN }, undefined, async (x) => { d.push(x); return resp(402, PROMPT_402); });
    cek(d.length === 1, 'tidak diulang — mengecilkan max_tokens tak mengubah ukuran prompt', d.length);
  }

  console.log('\n-- ulang-coba dijalankan --');
  {
    const dikirim = [];
    const kirim = async (b) => {
      dikirim.push(b);
      return dikirim.length === 1 ? resp(402, PESAN_402) : resp(200);
    };
    const res = await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: MAKS_TOKEN_JAWABAN }, undefined, kirim);
    cek(dikirim.length === 2, 'dikirim DUA kali: yang pertama 402, yang kedua dengan plafon turun', dikirim.length);
    cek(dikirim[0].max_tokens === MAKS_TOKEN_JAWABAN, `percobaan pertama memakai plafon penuh (${MAKS_TOKEN_JAWABAN})`, dikirim[0]);
    cek(dikirim[1].max_tokens === Math.floor(1234 * MARGIN_SALDO),
      `percobaan kedua = angka OpenRouter × margin (${Math.floor(1234 * MARGIN_SALDO)}), bukan tebakan`, dikirim[1]);
    cek(dikirim[1].max_tokens < 1234, 'dan tegas di bawah batas yang dikutip, bukan tepat di batasnya', dikirim[1]);
    cek(dikirim[1].model === 'm', 'badan lainnya tidak berubah — hanya plafonnya', dikirim[1]);
    cek(res.ok === true, 'hasil akhirnya respons yang berhasil');
  }

  console.log('\n-- lantai kelayakan (arah dibalik) --');
  {
    const NYATA_444 = JSON.stringify({ error: { message: 'can only afford 444.' } });
    cek(plafonUlang(NYATA_444) === 399, 'kutipan nyata 444 -> plafon ulang 399', plafonUlang(NYATA_444));
    cek(399 >= MIN_TOKEN_LAYAK, `399 kini DI ATAS lantai (${MIN_TOKEN_LAYAK}) — dulu 512 menolaknya`, MIN_TOKEN_LAYAK);

    const d444 = [];
    await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: MAKS_TOKEN_JAWABAN }, undefined, async (b) => {
      d444.push(b);
      return d444.length === 1 ? resp(402, NYATA_444) : resp(200);
    });
    cek(d444.length === 2, 'permintaan 5 Okt yang dulu ditolak di gerbang kini DIULANG', d444.length);
    cek(d444[1].max_tokens === 399, 'dan diulang dengan 399, angka dari OpenRouter bukan tebakan', d444[1]);

    const kecil = JSON.stringify({ error: { message: 'can only afford 100.' } });
    cek(plafonUlang(kecil) < MIN_TOKEN_LAYAK, '100 -> 90, masih di bawah lantai', plafonUlang(kecil));
    const dikirim = [];
    const res = await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: MAKS_TOKEN_JAWABAN }, undefined, async (b) => { dikirim.push(b); return resp(402, kecil); });
    cek(dikirim.length === 1, `100 token (< ${MIN_TOKEN_LAYAK}) tetap TIDAK diulang — lantainya turun, tidak hilang`, dikirim.length);
    cek(res.status === 402, 'respons 402-nya dipulangkan apa adanya untuk dijadikan pesan');

    const pesan = pesanSaldoTakCukup(kecil, MAKS_TOKEN_JAWABAN);
    cek(/100 token/.test(pesan), 'pesannya menyebut angka yang sebenarnya terjangkau', pesan);
    cek(new RegExp(String(MIN_TOKEN_LAYAK)).test(pesan), 'dan menyebut lantainya, jadi angkanya bisa dinilai Owner', pesan);
    cek(/[Ii]si ulang saldo/.test(pesan), 'dan mengatakan apa yang harus dilakukan', pesan);
    cek(!/\{"error"/.test(pesan), 'badan JSON mentah tidak diteruskan ke Owner', pesan);
  }

  console.log('\n-- terpotong karena plafon: dibaca & diberi label --');
  {
    const { terpotongKarenaPlafon, pesanTerpotongPlafon, bacaSseOpenRouter } = M;

    const sse = (sebab) => {
      const b = [
        `data: ${JSON.stringify({ provider: 'uji', choices: [{ delta: { content: 'Saya cari dulu' }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: ' lokasinya di' }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: ' repo' }, finish_reason: sebab }], usage: { completion_tokens: 399 } })}`,
        'data: [DONE]', '',
      ].join('\n\n');
      const bita = new TextEncoder().encode(b);
      let habis = false;
      return { body: { getReader: () => ({
        read: async () => (habis ? { done: true } : (habis = true, { done: false, value: bita })),
        cancel: async () => {},
      }) } };
    };

    const putus = await bacaSseOpenRouter(sse('length'));
    cek(putus.sebabSelesai === 'length', 'finish_reason bingkai terakhir terbaca dari aliran', putus.sebabSelesai);
    cek(terpotongKarenaPlafon(putus) === true, 'dan dikenali sebagai terpotong karena plafon');
    cek(putus.terpotong !== true, 'TAPI bukan `terpotong` lama — itu batas waktu dinding, sebab yang berbeda', putus.terpotong);
    cek(putus.choices[0].message.content === 'Saya cari dulu lokasinya di repo', 'isi yang sudah terkirim tetap utuh, tidak dibuang', putus.choices[0].message.content);

    const selesai = await bacaSseOpenRouter(sse('stop'));
    cek(terpotongKarenaPlafon(selesai) === false, 'finish_reason "stop" TIDAK dianggap terpotong — labelnya tak boleh muncul sembarangan');

    cek(terpotongKarenaPlafon({ choices: [{ finish_reason: 'length' }] }) === true, 'bentuk non-stream choices[0].finish_reason ikut terbaca');
    cek(terpotongKarenaPlafon({ choices: [{ finish_reason: 'stop' }] }) === false, 'dan "stop" non-stream juga tidak');
    cek(terpotongKarenaPlafon({}) === false, 'tanpa sebab -> bukan terpotong, bukan tebakan');

    const label = pesanTerpotongPlafon(399);
    cek(/TERPOTONG/.test(label), 'labelnya menyebut terpotong dengan terang', label);
    cek(/399/.test(label), 'dan menyebut plafon yang sebenarnya dipakai, bukan 8192', label);
    cek(/BUKAN model gagal/.test(label), 'dan menyangkal tafsir yang salah — inilah yang dulu ditakutkan lantai 512', label);
  }

  console.log('\n-- plafon yang dipakai terlacak --');
  {
    const jejak = {};
    await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: MAKS_TOKEN_JAWABAN }, undefined, async () => resp(200), jejak);
    cek(jejak.plafonDipakai === MAKS_TOKEN_JAWABAN, 'tanpa 402: plafon penuh yang tercatat', jejak.plafonDipakai);

    const jejak2 = {};
    const NYATA_444 = JSON.stringify({ error: { message: 'can only afford 444.' } });
    let n = 0;
    await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: MAKS_TOKEN_JAWABAN }, undefined, async () => (++n === 1 ? resp(402, NYATA_444) : resp(200)), jejak2);
    cek(jejak2.plafonDipakai === 399, 'sesudah 402 diulang: yang tercatat plafon BARU (399), bukan 8192', jejak2.plafonDipakai);
  }

  console.log('\n-- tidak mengulang sia-sia --');
  {
    const d1 = [];
    await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: 8192 }, undefined, async (b) => { d1.push(b); return resp(402, 'Insufficient credits.'); });
    cek(d1.length === 1, 'pesan 402 yang tak terbaca tidak memicu pengulangan buta', d1.length);

    const d2 = [];
    await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: 600 }, undefined, async (b) => { d2.push(b); return resp(402, PESAN_402); });
    cek(d2.length === 1, 'plafon diminta (600) sudah < terjangkau (1234) -> tidak diulang', d2.length);

    const d3 = [];
    await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: 8192 }, undefined, async (b) => { d3.push(b); return resp(402, PESAN_402); });
    cek(d3.length === 2, 'tetap 402 sesudah diulang -> berhenti', d3.length);

    cek(d3[1].max_tokens < d3[0].max_tokens,
      'plafon pengulangan mengecil tegas — inilah yang menjamin ia tidak bisa berputar',
      { pertama: d3[0].max_tokens, kedua: d3[1].max_tokens });
  }

  console.log('\n-- yang lama tidak rusak --');
  {
    const d = [];
    const res = await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: 8192 }, undefined, async (b) => { d.push(b); return resp(200); });
    cek(d.length === 1 && res.ok, 'permintaan yang berhasil tetap satu panggilan');

    const d400 = [];
    await kirimOpenRouterDenganReasoning({ model: 'm-wajib-nalar', max_tokens: 8192 }, false, async (b) => {
      d400.push(b);
      return d400.length === 1 ? resp(400, 'Reasoning is mandatory for this endpoint') : resp(200);
    });
    cek(d400.length === 2, 'cabang 400 lama masih mengulang sekali', d400.length);
    cek(d400[0].reasoning?.enabled === false, 'percobaan pertama memang mengirim reasoning: enabled false', d400[0]);
    cek(d400[1].reasoning === undefined, 'percobaan kedua tanpa parameter reasoning — perilaku lama utuh', d400[1]);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('\n-- satu sumber plafon --');
{
  const AD = tanpaKomentar(baca('supabase/functions/agent-process/lib/adapters/ai_adapter.ts'));
  cek(!/max_tokens: 8192/.test(AD), 'tak ada lagi 8192 yang dipaku di ai_adapter');
  const pakai = (AD.match(/max_tokens: MAKS_TOKEN_JAWABAN/g) || []).length;
  const pakaiKatalog = (AD.match(/max_tokens: plafonDiminta(Stream)?[,} ]/g) || []).length;
  cek(pakai === 4 && pakaiKatalog === 2, `empat titik non-OpenRouter memakai konstanta, dua jalur OpenRouter memakai plafon dari katalog model (${pakai} + ${pakaiKatalog})`);
  cek((AD.match(/pesanSaldoTakCukup\(teks, plafonDiminta(Stream)?\)/g) || []).length === 2, 'pesan 402 yang bisa ditindaklanjuti dipakai, dengan plafon yang benar-benar diminta');
  const jumlah402 = (AD.match(/if \(res\.status === 402\) throw new Error\(pesanSaldoTakCukup/g) || []).length;
  cek(jumlah402 === 2, `kedua jalur OpenRouter (stream & non-stream) memakainya (${jumlah402})`);

  const pasang = (AD.match(/answer \+= pesanTerpotongPlafon|accumulatedText \+= label/g) || []).length;
  cek(pasang === 2, `label terpotong dipasang di kedua jalur OpenRouter (${pasang})`);
  cek(/terpotongKarenaPlafon\(data\)/.test(AD), 'jalur non-stream memeriksa finish_reason dari respons');
  cek(/terpotongKarenaPlafon\(infoStream\)/.test(AD), 'jalur stream memeriksanya dari bingkai terakhir aliran');
  cek(/yield label/.test(AD), 'dan di jalur stream labelnya IKUT DIALIRKAN ke layar, bukan hanya ditambahkan ke variabel');
  cek(/info\.sebabSelesai = fr/.test(AD), 'processOpenAIStream merekam finish_reason — tanpa ini jalur stream buta');
  const jejakDipakai = (AD.match(/jejakPlafon(Stream)?\.plafonDipakai \|\| plafonDiminta(Stream)?;/g) || []).length;
  cek(jejakDipakai === 2, `kedua label memakai plafon yang sebenarnya dipakai (${jejakDipakai})`);
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
