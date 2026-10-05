// UJI 2026-10-05 — tiga kebocoran token yang ditemukan dari SATU sesi nyata (5 Okt 01:33).
//
// ── Apa yang terjadi di sesi itu ────────────────────────────────────────────────────────────
// Giliran 1 berhasil (item 121 bekerja: diulang dengan 399 token). Engineer menjalankan
//   git grep -n -B2 -A4 "402" -- frontend/src supabase/functions mametlite/src
// yang mengembalikan 15.671 huruf, dan SELURUHNYA dikirim balik ke model. Giliran 2:
//   [PROMPT_KOMPOSISI] ... | riwayat=4 pesan/3064 huruf | pesan=15769 | total=49993
// lalu 402 varian prompt kebesaran: 12.910 token dikirim, saldo menanggung 1.682.
//
// Tiga cacat terbaca dari satu sesi itu:
//   1. keluaran perintah TIDAK punya anggaran (batas 20 KB yang ada itu batas TERMINAL)
//   2. varian 402 "in-flight requests" jatuh ke cabang "tak terbaca" -> saran yang menyesatkan
//   3. BRAIN 1 dikirim DUA KALI di mode Engineer (format barisnya identik huruf demi huruf)
//
// ── Caranya diuji ───────────────────────────────────────────────────────────────────────────
// Modul .js/.ts ASLINYA ditransformasi dengan esbuild lalu dijalankan di Node — perilaku yang
// diuji, bukan salinan logika yang ditulis ulang di sini.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-anggaran-keluaran v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const dir = mkdtempSync(join(tmpdir(), 'uji-anggaran-'));
const muat = async (sumber, nama, loader) => {
  const { code } = await esbuild.transform(baca(sumber), { loader, format: 'esm' });
  writeFileSync(join(dir, nama), code);
  return import(pathToFileURL(join(dir, nama)).href);
};

try {
  // ── 1. ANGGARAN KELUARAN PERINTAH ─────────────────────────────────────────────────────────
  console.log('\n-- anggaran keluaran perintah --');
  const P = await muat('frontend/src/core/runtime/services/engineer/ProsedurEngineer.js', 'pe.mjs', 'js');
  const { potongKeluaranUntukModel, pesanKeluaranPerintah, BATAS_KELUARAN_MODEL, riwayatPerintahDariPesan } = P;

  cek(BATAS_KELUARAN_MODEL < 15671,
    `anggarannya (${BATAS_KELUARAN_MODEL}) di bawah keluaran yang mematahkan sesi nyata (15.671)`, BATAS_KELUARAN_MODEL);

  // Keluaran kecil TIDAK disentuh — penjaga ini yang mencegah catatan muncul di mana-mana.
  {
    const kecil = 'a\nb\nc';
    const r = potongKeluaranUntukModel(kecil);
    cek(r.teks === kecil && r.dipotong === false, 'keluaran kecil lewat apa adanya, tanpa catatan', r);
  }

  // Tepat di batas: masih utuh. Satu huruf di atasnya: dipotong. (Batas tidak meleset satu.)
  {
    const pas = 'x'.repeat(BATAS_KELUARAN_MODEL);
    cek(potongKeluaranUntukModel(pas).dipotong === false, 'tepat sebesar batas -> tidak dipotong');
    const lebih = 'x'.repeat(BATAS_KELUARAN_MODEL + 1);
    cek(potongKeluaranUntukModel(lebih).dipotong === true, 'satu huruf di atas batas -> dipotong');
  }

  // KASUS NYATA: keluaran sebesar yang benar-benar terjadi.
  {
    const baris = [];
    for (let i = 1; i <= 400; i++) baris.push(`supabase/functions/agent-process/lib/berkas${i}.ts:${i}:  if (res.status === 402) { baris ke-${i} }`);
    const nyata = baris.join('\n');
    cek(nyata.length > 15000, 'fixture menyerupai ukuran keluaran nyata', nyata.length);

    const r = potongKeluaranUntukModel(nyata);
    cek(r.dipotong === true, 'keluaran sebesar sesi nyata DIPOTONG');
    cek(r.asli === nyata.length, 'ukuran aslinya dilaporkan apa adanya', r.asli);
    cek(r.teks.length < nyata.length, 'hasilnya benar-benar lebih kecil, bukan sekadar ditandai',
      { sebelum: nyata.length, sesudah: r.teks.length });

    // KEPALA dan EKOR — ini inti rancangannya. Potong-di-ujung akan membuat model menyimpulkan
    // bahwa kecocokan berhenti di tengah repo.
    cek(r.teks.includes('berkas1.ts'), 'baris PERTAMA tetap ada (kepala)');
    cek(r.teks.includes('berkas400.ts'), 'baris TERAKHIR tetap ada (ekor) — bukan potong-di-ujung');
    cek(!r.teks.includes('berkas200.ts'), 'bagian TENGAH yang dibuang', r.teks.length);

    // Catatannya menyebut angka, bukan "terlalu panjang".
    cek(/KELUARAN DIPOTONG SISTEM/.test(r.teks), 'pemotongan dinyatakan terang-terangan');
    cek(new RegExp(nyata.length.toLocaleString('id-ID').replace('.', '\\.')).test(r.teks),
      'dan menyebut ukuran asli dengan angka', r.teks.slice(0, 50));
    cek(/jangan simpulkan bahwa kecocokan berhenti/i.test(r.teks),
      'melarang kesimpulan yang salah — ekor yang utuh tak berguna bila model mengira itu akhirnya');
    cek(/git grep -l/.test(r.teks) && /git grep -c/.test(r.teks),
      'dan memberi CARA mempersempit, bukan sekadar melarang (pola keluarga petunjuk*)');

    // Baris tidak boleh terpenggal di tengah: "supabase/func" terbaca seperti alamat yang ada.
    const barisHasil = r.teks.split('\n').filter((b) => b.startsWith('supabase/'));
    cek(barisHasil.every((b) => /berkas\d+\.ts:\d+:/.test(b)),
      'setiap baris keluaran yang tersisa UTUH — tak ada alamat berkas yang terpenggal');
  }

  // ── 2. SATU TITIK RAKIT, dan bentuknya tidak berubah ──────────────────────────────────────
  console.log('\n-- satu titik rakit --');
  {
    const pesan = pesanKeluaranPerintah('git status', 'bersih');
    cek(pesan === '[TERMINAL OUTPUT for: git status]\nbersih', 'bentuk teksnya TIDAK berubah', pesan);

    // Dan masih bisa diurai balik oleh pembaca riwayat — kalau tidak, riwayat perintah putus.
    const r = riwayatPerintahDariPesan([{ content: pesan }]);
    cek(r.length === 1 && r[0].perintah === 'git status' && r[0].keluaran === 'bersih',
      'riwayatPerintahDariPesan masih bisa menguraikannya', r);

    // Anggaran benar-benar berlaku lewat jalur ini, bukan hanya di fungsi pemotongnya.
    const besar = pesanKeluaranPerintah('git grep x', 'y\n'.repeat(BATAS_KELUARAN_MODEL));
    cek(/KELUARAN DIPOTONG SISTEM/.test(besar), 'anggaran berlaku lewat titik rakit');
  }

  // KEDUA jalur pengirim memakainya. Jalur yang terlewat akan membocorkan anggaran tanpa suara.
  {
    const CE = tanpaKomentar(baca('frontend/src/components/workbench/ConversationEngine.jsx'));
    // DUA, bukan tiga: baris impor menyebut namanya tanpa tanda kurung, jadi ia tidak ikut
    // terhitung di sini. Yang dihitung adalah PEMANGGILAN — jalur otomatis dan tombol manual.
    const pakai = (CE.match(/pesanKeluaranPerintah\(/g) || []).length;
    cek(pakai === 2, `dipanggil di kedua jalur pengirim (${pakai})`, pakai);
    cek(/import \{[^}]*pesanKeluaranPerintah[^}]*\} from/.test(CE), 'dan diimpor dari satu sumber, bukan disalin');
    cek(!/`\[TERMINAL OUTPUT for: \$\{cmd\}\]/.test(CE),
      'tak ada lagi jalur yang merakit teksnya sendiri — kalau ada, anggarannya bisa dilewati');
  }

  // ── 3. VARIAN 402 KETIGA: in-flight, bukan saldo habis ────────────────────────────────────
  console.log('\n-- 402 varian in-flight --');
  {
    const R = await muat('supabase/functions/agent-process/lib/adapters/reasoning_openrouter.ts', 'ro2.mjs', 'ts');
    const { tabrakanPermintaanSerentak, pesanSaldoTakCukup, tokenTerjangkau, batasPrompt, kirimOpenRouterDenganReasoning } = R;

    // Badan NYATA dari log 5 Okt 01:33:25.
    const INFLIGHT = JSON.stringify({
      error: {
        message: 'This request would exceed your available credits given your current in-flight requests. Retry after in-flight requests settle, or add credits.',
        code: 402,
        metadata: { reason: 'in_flight' },
      },
    });

    cek(tabrakanPermintaanSerentak(INFLIGHT) === true, 'varian in-flight dikenali');
    cek(tabrakanPermintaanSerentak('can only afford 444') === false, 'varian plafon TIDAK ikut tertangkap');
    cek(tabrakanPermintaanSerentak('') === false, 'kosong -> bukan tabrakan');

    // Ia memang tak punya penanda dua varian lain — itu sebabnya dulu jatuh ke "tak terbaca".
    cek(tokenTerjangkau(INFLIGHT) === null, 'tidak punya "can only afford"');
    cek(batasPrompt(INFLIGHT) === null, 'dan bukan varian prompt kebesaran');

    const pesan = pesanSaldoTakCukup(INFLIGHT, 8192);
    cek(/BERSAMAAN/.test(pesan), 'pesannya menyebut sebab yang sebenarnya: berjalan bersamaan', pesan);
    cek(/bukan saldo habis/i.test(pesan), 'dan menyangkal tafsir lama yang menyesatkan', pesan);
    cek(/[Tt]unggu beberapa detik/.test(pesan), 'memberi jalan keluar termurah: tunggu lalu kirim ulang', pesan);
    cek(/HAKIM_BAYANGAN/.test(pesan), 'menyebut secret yang BENAR-BENAR ada, bukan menu khayalan', pesan);
    cek(!/\{"error"/.test(pesan), 'badan JSON mentah tidak diteruskan');
    cek(!/^Saldo OpenRouter tidak cukup untuk permintaan ini/.test(pesan),
      'tidak lagi jatuh ke cabang "tak terbaca"', pesan);

    // TIDAK diulang: mengulang sekarang persis mengulangi tabrakannya.
    const d = [];
    await kirimOpenRouterDenganReasoning({ model: 'm', max_tokens: 8192 }, undefined, async (b) => {
      d.push(b);
      return { ok: false, status: 402, text: async () => INFLIGHT, clone: () => ({ text: async () => INFLIGHT }) };
    });
    cek(d.length === 1, 'tidak diulang otomatis — mengulang sekarang mengulangi tabrakannya', d.length);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// ── 4. BRAIN 1 TIDAK LAGI DIKIRIM DUA KALI (mode Engineer) ──────────────────────────────────
console.log('\n-- BRAIN 1 tidak kembar --');
{
  const UC = tanpaKomentar(baca('supabase/functions/agent-process/lib/verification/universal_contract.ts'));
  const EC = tanpaKomentar(baca('supabase/functions/agent-process/lib/rag/engineer_context.ts'));
  const CB = tanpaKomentar(baca('supabase/functions/agent-process/lib/orchestration/handlers/context_builder.ts'));

  // Ini yang membuktikan kekembarannya: string format yang SAMA PERSIS di dua berkas, dari satu
  // sumber entri yang sama. Bila salah satu berubah, uji ini jatuh dan kesimpulannya harus ditinjau.
  const FORMAT = '`[${e.entry_type}] ${e.title}: ${e.content}`';
  cek(EC.includes(FORMAT), 'engineer_context merender BRAIN 1 dengan format itu');
  cek(CB.includes(FORMAT), 'context_builder merender entri yang sama dengan format yang IDENTIK');
  cek(/ctx\.brain1Entries = engineerCtx\.brain1Entries/.test(CB),
    'dan keduanya bersumber dari satu tempat — inilah yang menjadikannya kembar, bukan kebetulan');

  cek(/mode === 'ENGINEER' && brain1Entries\.length > 0/.test(UC),
    'peringkasan dijaga mode ENGINEER — di mode lain BLOK 4 adalah satu-satunya salinan');
  cek(/brain1Summary: brain1Ringkas/.test(UC), 'dan benar-benar dipakai, bukan dihitung lalu dibuang');
  cek(/\$\{e\.entry_type\}\] \$\{e\.title\}`/.test(UC),
    'judulnya DIPERTAHANKAN — BLOK 6 menjadikan BLOK 4 rujukan label VERIFIED');
  cek(/MAMET ENGINEER CONTEXT\] di atas/.test(UC),
    'dan model diberi tahu ke mana isinya pergi, bukan dibiarkan mengira datanya hilang');
  cek(!/ketujuh entri/.test(UC), 'jumlah entri tidak dipaku — ia berubah bersama isi basis data');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
