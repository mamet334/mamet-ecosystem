// UJI 2026-10-04 — 402 "can only afford N": plafon diturunkan, bukan permintaan dibuang.
//
// ── Cacatnya ────────────────────────────────────────────────────────────────────────────────
// `max_tokens: 8192` dipaku di ENAM tempat `ai_adapter.ts`. Angka itu PLAFON, bukan kebutuhan
// jawaban — tetapi OpenRouter memutuskan keterjangkauan dari plafon yang DIMINTA. Jadi saldo yang
// masih cukup untuk jawaban pendek pun ditolak, hanya karena yang diminta 8192.
//
// Jalur embedding sudah menangani 402 sejak lama (`vector_utils.ts`). Jalur CHAT belum sama
// sekali: badan jawabannya — yang MENYEBUTKAN berapa yang terjangkau — langsung dilempar sebagai
// galat mentah dan dibuang.
//
// Keadaan yang menjadikannya mendesak: saldo Owner boleh minus dan OpenRouter tetap melayani
// sebagian, jadi menurunkan plafon bisa mengembalikan kemampuan chat tanpa isi ulang.
//
// ── Caranya diuji ───────────────────────────────────────────────────────────────────────────
// `kirimOpenRouterDenganReasoning` menerima fungsi `kirim` yang disuntik, jadi modul ASLINYA
// dijalankan di Node (tanpa impor apa pun, cukup ditransformasi dari .ts) dan panggilannya
// DIHITUNG beserta badan yang dikirim ulang. Bukan salinan logika yang ditulis ulang di sini.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-saldo-plafon-token v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// Pesan 402 OpenRouter yang sebenarnya — bentuk inilah yang diurai.
const PESAN_402 = JSON.stringify({
  error: {
    code: 402,
    message: 'This request requires more credits, or fewer max_tokens. You requested up to 8192 tokens, but can only afford 1234.',
  },
});

// BADAN NYATA dari produksi 4 Okt 2026 (ditangkap Owner sebelum deploy). Bukan karangan: ia
// memuat BEBERAPA kutipan sekaligus karena OpenRouter sudah mencoba beberapa PENYEDIA untuk nama
// model yang sama, dan harga tiap penyedia berbeda — 779, 734, 1558, 1558 dalam satu badan.
//
// Inilah yang menjatuhkan percobaan pertama di produksi: `.match()` tanpa /g mengambil 779, lalu
// permintaan diulang dengan angka yang masih lebih besar daripada batas penyedia termurahnya.
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

  // Respons palsu secukupnya: `ok`, `status`, `text()`, `clone()`.
  const resp = (status, teks = '') => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => teks,
    clone() { return this; },
  });

  // ── 1. Pengurai ───────────────────────────────────────────────────────────────────────────
  console.log('\n-- pengurai "can only afford" --');
  cek(tokenTerjangkau(PESAN_402) === 1234, 'angka terjangkau terbaca dari pesan 402 yang sebenarnya', tokenTerjangkau(PESAN_402));
  cek(tokenTerjangkau('can only afford 1,234.') === 1234, 'koca ribuan ditoleransi', tokenTerjangkau('can only afford 1,234.'));
  cek(tokenTerjangkau('CAN ONLY AFFORD 99') === 99, 'tidak peka huruf besar-kecil');
  // Kalau OpenRouter mengubah kalimatnya, hasilnya null dan perilaku kembali seperti semula —
  // tebakan yang salah tidak merugikan, ia hanya tidak menolong.
  cek(tokenTerjangkau('Insufficient credits.') === null, 'kalimat lain -> null, bukan angka karangan');
  cek(tokenTerjangkau('') === null, 'kosong -> null');
  cek(tokenTerjangkau('can only afford 0') === null, 'nol bukan angka yang berguna -> null');

  // ── 1b. KEGAGALAN PRODUKSI 4 Okt — badan nyata dengan banyak kutipan ─────────────────────
  // Percobaan pertama memakai `.match()` tanpa /g, jadi ia mengambil 779 (yang pertama) dan
  // mengulang dengan angka yang masih di atas batas penyedia termurahnya (734). Tetap 402.
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

  // ── 1c. VARIAN 402 KEDUA — kendalanya PINDAH ke prompt ───────────────────────────────────
  // Teramati di produksi 4 Okt sesudah perbaikan pertama ter-deploy:
  //   "Prompt tokens limit exceeded: 14250 > 3621"
  // Tidak ada "can only afford" sama sekali, jadi jalur lama jatuh ke cabang "tak terbaca" dan
  // menyuruh "isi ulang saldo" — menyesatkan, karena saldo 3.621 token itu CUKUP; prompt-nyalah
  // yang 14.250. Menurunkan max_tokens tidak menolong sedikit pun di sini.
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

    // Tidak boleh ada pengulangan: plafon keluaran bukan yang bermasalah.
    const d = [];
    await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: MAKS_TOKEN_JAWABAN }, undefined, async (x) => { d.push(x); return resp(402, PROMPT_402); });
    cek(d.length === 1, 'tidak diulang — mengecilkan max_tokens tak mengubah ukuran prompt', d.length);
  }

  // ── 2. Ulang-coba DIJALANKAN dan DIHITUNG ─────────────────────────────────────────────────
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
    // Diturunkan DARI angka OpenRouter, bukan ditebak — dan dengan kelonggaran, karena meminta
    // tepat sebesar batas sudah terbukti ditolak di produksi 4 Okt.
    cek(dikirim[1].max_tokens === Math.floor(1234 * MARGIN_SALDO),
      `percobaan kedua = angka OpenRouter × margin (${Math.floor(1234 * MARGIN_SALDO)}), bukan tebakan`, dikirim[1]);
    cek(dikirim[1].max_tokens < 1234, 'dan tegas di bawah batas yang dikutip, bukan tepat di batasnya', dikirim[1]);
    cek(dikirim[1].model === 'm', 'badan lainnya tidak berubah — hanya plafonnya', dikirim[1]);
    cek(res.ok === true, 'hasil akhirnya respons yang berhasil');
  }

  // ── 3. Lantai kelayakan: jawaban terpotong lebih buruk daripada galat terang ──────────────
  console.log('\n-- lantai kelayakan --');
  {
    const kecil = JSON.stringify({ error: { message: 'can only afford 180.' } });
    const dikirim = [];
    const kirim = async (b) => { dikirim.push(b); return resp(402, kecil); };
    const res = await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: MAKS_TOKEN_JAWABAN }, undefined, kirim);
    cek(dikirim.length === 1, `180 token (< ${MIN_TOKEN_LAYAK}) TIDAK diulang — jawaban terpotong menyesatkan`, dikirim.length);
    cek(res.status === 402, 'respons 402-nya dipulangkan apa adanya untuk dijadikan pesan');

    const pesan = pesanSaldoTakCukup(kecil, MAKS_TOKEN_JAWABAN);
    cek(/180 token/.test(pesan), 'pesannya menyebut angka yang sebenarnya terjangkau', pesan);
    cek(new RegExp(String(MIN_TOKEN_LAYAK)).test(pesan), 'dan menyebut lantainya, jadi angkanya bisa dinilai Owner', pesan);
    cek(/[Ii]si ulang saldo/.test(pesan), 'dan mengatakan apa yang harus dilakukan', pesan);
    cek(!/\{"error"/.test(pesan), 'badan JSON mentah tidak diteruskan ke Owner', pesan);
  }

  // ── 4. Tidak mengulang bila tak ada gunanya ───────────────────────────────────────────────
  console.log('\n-- tidak mengulang sia-sia --');
  {
    // Pesan tak terbaca → satu panggilan saja.
    const d1 = [];
    await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: 8192 }, undefined, async (b) => { d1.push(b); return resp(402, 'Insufficient credits.'); });
    cek(d1.length === 1, 'pesan 402 yang tak terbaca tidak memicu pengulangan buta', d1.length);

    // Plafon yang diminta SUDAH lebih kecil dari yang terjangkau → mengulang tak mengubah apa pun.
    const d2 = [];
    await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: 600 }, undefined, async (b) => { d2.push(b); return resp(402, PESAN_402); });
    cek(d2.length === 1, 'plafon diminta (600) sudah < terjangkau (1234) -> tidak diulang', d2.length);

    // Tetap 402 sesudah diulang → berhenti.
    const d3 = [];
    await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: 8192 }, undefined, async (b) => { d3.push(b); return resp(402, PESAN_402); });
    cek(d3.length === 2, 'tetap 402 sesudah diulang -> berhenti', d3.length);

    // YANG SEBENARNYA MENJAMIN IA BERHENTI adalah syarat `diminta > n`, bukan bentuk panggilannya.
    // Uji mutasi membuktikannya: menukar pengulangan menjadi rekursi TIDAK menghasilkan putaran
    // tak berujung, karena pengulangan menyetel plafon tepat ke `n` sehingga pada putaran kedua
    // `1234 > 1234` sudah salah. Klaim "tidak berputar" yang semula ditulis di sini karena itu
    // menyesatkan — yang dijaga adalah plafonnya MENGECIL TEGAS, dan itulah jaminannya.
    cek(d3[1].max_tokens < d3[0].max_tokens,
      'plafon pengulangan mengecil tegas — inilah yang menjamin ia tidak bisa berputar',
      { pertama: d3[0].max_tokens, kedua: d3[1].max_tokens });
  }

  // ── 5. Jalur sukses & cabang 400 lama tidak terganggu ────────────────────────────────────
  console.log('\n-- yang lama tidak rusak --');
  {
    const d = [];
    const res = await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: 8192 }, undefined, async (b) => { d.push(b); return resp(200); });
    cek(d.length === 1 && res.ok, 'permintaan yang berhasil tetap satu panggilan');

    // 400 "Reasoning is mandatory" — perilaku lama: diulang SEKALI tanpa parameter reasoning.
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

// ── 6. Keenam plafon yang dipaku sudah jadi satu sumber ─────────────────────────────────────
console.log('\n-- satu sumber plafon --');
{
  const AD = tanpaKomentar(baca('supabase/functions/agent-process/lib/adapters/ai_adapter.ts'));
  cek(!/max_tokens: 8192/.test(AD), 'tak ada lagi 8192 yang dipaku di ai_adapter');
  const pakai = (AD.match(/max_tokens: MAKS_TOKEN_JAWABAN/g) || []).length;
  cek(pakai === 6, `keenam titik panggil memakai konstanta yang sama (${pakai})`);
  cek(/pesanSaldoTakCukup\(teks, MAKS_TOKEN_JAWABAN\)/.test(AD), 'pesan 402 yang bisa ditindaklanjuti dipakai');
  const jumlah402 = (AD.match(/if \(res\.status === 402\) throw new Error\(pesanSaldoTakCukup/g) || []).length;
  cek(jumlah402 === 2, `kedua jalur OpenRouter (stream & non-stream) memakainya (${jumlah402})`);
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
