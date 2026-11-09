
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-cangkang-electron v2');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const M = baca('frontend/electron/main.cjs');
const Mk = tanpaKomentar(M);

console.log('\n-- sandbox --');
cek(!/^\s*app\.commandLine\.appendSwitch\('no-sandbox'\)/m.test(Mk),
  'no-sandbox TIDAK lagi dipanggil — sakelar itu mematikan sandbox RENDERER, jauh lebih luas dari kebutuhan GPU');
cek(/sandbox: true/.test(Mk), 'dan `sandbox: true` di webPreferences kini benar-benar berlaku');
cek(/appendSwitch\('disable-gpu-sandbox'\)/.test(Mk),
  'disable-gpu-sandbox DIPERTAHANKAN — itu yang sebenarnya menangani crash GPU');
cek(/disableHardwareAcceleration\(\)/.test(Mk), 'dan akselerasi perangkat keras tetap dimatikan');

{
  const P = tanpaKomentar(baca('frontend/electron/preload.cjs'));
  const req = [...P.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]);
  cek(req.length > 0 && req.every((r) => r === 'electron'),
    `preload hanya require('electron') — layak di preload ber-sandbox (${req.join(', ') || 'tak ada'})`, req);
}

console.log('\n-- penjaga navigasi --');
cek(/setWindowOpenHandler/.test(Mk), 'setWindowOpenHandler terpasang');
cek(/return \{ action: 'deny' \}/.test(Mk),
  'dan MENOLAK semua jendela baru — tanpa ini, jendela baru mewarisi preload beserta engineer.jalankan');
cek(/on\('will-navigate'/.test(Mk), "will-navigate terpasang");
cek(/e\.preventDefault\(\)/.test(Mk), 'dan navigasi ke luar benar-benar dibatalkan');
cek(/shell\.openExternal/.test(Mk),
  'tautan luar diarahkan ke peramban SISTEM — di luar cangkang, jadi tidak membawa preload');

console.log('\n-- logika asal sendiri (dijalankan) --');
{
  const m = M.match(/const asalSendiri = \(u\) => \{[\s\S]*?\n  \};/);
  cek(!!m, 'fungsi asalSendiri ditemukan untuk dijalankan');
  if (m) {
    // eslint-disable-next-line no-new-func
    const asalSendiri = new Function(`${m[0]} return asalSendiri;`)();
    const boleh = ['mamet://app/index.html', 'http://localhost:5173/', 'devtools://devtools/bundled/x.html'];
    const tolak = ['https://contoh.jahat/', 'http://localhost:9999/', 'file:///C:/Windows/system.ini',
                   'http://localhost:51730/', 'http://localhost:5173.jahat.com/',
                   'javascript:alert(1)', 'data:text/html,<b>x', ''];
    for (const u of boleh) cek(asalSendiri(u) === true, `DIIZINKAN: ${u}`);
    for (const u of tolak) cek(asalSendiri(u) === false, `DITOLAK: ${u || '(kosong)'}`);
  }
}

console.log('\n-- webSecurity sengaja dipertahankan --');
cek(/webSecurity: false/.test(Mk),
  'webSecurity TETAP false — menyalakannya memutus fetch RSS lintas-origin dari renderer');
cek(/webPreferences:\s*\{[\s\S]*?webSecurity:\s*false/.test(Mk),
  'webSecurity: false terkonfigurasi di webPreferences jendela utama');
cek(/corsEnabled: true/.test(Mk),
  'protokol mamet:// sendiri sudah benar — jadi bukan protokolnya yang menghalangi');

{
  const W = baca('frontend/src/core/runtime/services/WebComparisonService.js');
  const adaFetch = /\bfetch\(/.test(tanpaKomentar(W));
  const adaRss = /news\.google\.com|bing\.com|antaranews\.com/.test(W);
  cek(adaFetch && adaRss,
    'WebComparisonService MASIH memanggil fetch() ke RSS pihak ketiga dari renderer — dasar keputusan di atas',
    { adaFetch, adaRss });
}

cek(/on\('render-process-gone'/.test(Mk), 'render-process-gone terpasang — kematian renderer bersuara');
cek(/exitCode/.test(Mk) && /reason/.test(Mk),
  'dan yang dicatat menyebut reason + exitCode (bukan hanya "gagal")');
cek(/toString\(16\)/.test(Mk), 'kode keluarnya ikut ditulis heksadesimal — itu bentuk yang bisa dicari');
cek(/on\('did-fail-load'/.test(Mk), 'did-fail-load terpasang');
cek(/bingkaiUtama/.test(Mk) && /if \(!bingkaiUtama\) return/.test(Mk),
  'sub-bingkai yang gagal TIDAK dianggap layar putih');
cek(/kode === -3/.test(Mk), 'ERR_ABORTED (-3) tidak dihitung kegagalan — ia navigasi yang disela');

{
  const m = Mk.match(/BATAS_MUAT_ULANG\s*=\s*(\d+)/);
  cek(!!m && Number(m[1]) > 0 && Number(m[1]) <= 5,
    `pemulihan BERBATAS (${m ? m[1] : 'tak ada'}) — bukan putaran tanpa henti`, m && m[1]);
  cek(/percobaanMuat >= BATAS_MUAT_ULANG/.test(Mk), 'dan batasnya benar-benar diperiksa sebelum mencoba');
  cek(/if \(sedangPulih\) return;/.test(Mk) && /sedangPulih = true;/.test(Mk) && /sedangPulih = false;/.test(Mk),
    'satu kematian menyalakan DUA penangan — penjaganya pulang awal, menyala, lalu dilepas');
  cek(/on\('did-finish-load'/.test(Mk), 'dan pelepasannya terikat ke muatan yang BERHASIL');
  cek(/isDestroyed\(\)/.test(Mk), 'jendela yang sudah dibuang tidak dimuat ulang');
}

cek(!/appendSwitch\('no-sandbox'\)/.test(Mk),
  "`--no-sandbox` tetap TIDAK dipakai — ia melolosan muatan pertama, tetapi membatalkan TMN-0009");

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
