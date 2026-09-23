// ALAT JALANKAN FOLDER KERJA (Item 85 Tahap 3, 2026-09-22) — folder_run.
//
// KENYATAAN YANG MENENTUKAN RANCANGAN: pagar folder hanya menjaga alamat yang disentuh ALAT Mamet. Program yang
// dijalankan (python app.py, npm run build) TIDAK terpagar — ia bisa membaca/mengubah apa pun di laptop. Maka penjaga
// utama di sini adalah DIALOG IZIN yang menampilkan perintah persis (dan isi skrip/script npm yang akan jalan);
// pemeriksaan lain adalah penahan kecerobohan, bukan pengaman mutlak. Prinsip:
//   - TANPA SHELL: program + argumen sebagai daftar (spawn shell:false) — & | ; > tidak bisa menyisipkan perintah
//     kedua. Kebalikan dari CommandRegistry lama yang merakit kalimat PowerShell (T8).
//   - Program hanya dari DAFTAR IZIN, dicari sendiri di PATH sebagai alamat absolut .exe. Folder kerja & isinya
//     TIDAK ikut dicari: Windows (libuv) mencari folder asal lebih dulu, jadi "python.exe" palsu di folder kerja akan
//     terjalankan bila nama pendek diserahkan ke spawn.
//   - npm/npx (berupa .cmd) dijalankan lewat node + npm-cli.js/npx-cli.js — .cmd butuh shell.
//   - Sub-perintah yang menerbitkan/masuk akun (npm publish, git push, cargo publish, …) ditolak; yang mengunduh dari
//     internet diberi peringatan di dialog.
//   - Argumen berupa alamat absolut atau ".." ditolak (termasuk nilai --opsi=nilai).
//   - Lingkungan dibersihkan dari variabel rahasia (KEY/TOKEN/SECRET/…): skrip di folder tak bisa membaca kunci API
//     dari proses Electron.
//   - Batas waktu (bawaan 60 s, maks 300 s) → seluruh pohon proses dimatikan; keluaran maks 20 KB; stdin ditutup;
//     satu perintah pada satu waktu.

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { alamatDalamPagar } = require('./pagarFolder.cjs');

const BATAS_JALAN = {
  keluaranByte: 20 * 1024,
  waktuBawaanS: 60,
  waktuMaksS: 300,
  argumenMaks: 40,
  argumenHurufMaks: 4000,
  pratinjauHuruf: 1200,
};

// tolak = sub-perintah (argumen pertama) yang tidak boleh; internet = diberi peringatan "mengunduh dari internet";
// izinSub = HANYA sub-perintah ini yang boleh (git: dibatasi ke kerja lokal).
const PROGRAM = {
  python: { exe: 'python' },
  py: { exe: 'py' },
  pip: { exe: 'pip', internet: ['install', 'download', 'wheel'], tolak: ['config'] },
  node: { exe: 'node' },
  npm: {
    lewatNode: 'npm-cli.js',
    tolak: ['publish', 'unpublish', 'login', 'logout', 'adduser', 'token', 'owner', 'access', 'deprecate', 'dist-tag',
      'team', 'org', 'profile', 'hook', 'star', 'unstar', 'config', 'set'],
    internet: ['install', 'i', 'ci', 'add', 'update', 'up', 'upgrade', 'exec', 'x', 'create', 'init', 'audit', 'outdated'],
  },
  npx: { lewatNode: 'npx-cli.js', internetSelalu: true },
  git: {
    exe: 'git',
    izinSub: ['status', 'log', 'diff', 'show', 'blame', 'grep', 'ls-files', 'rev-parse', 'branch', 'init', 'add', 'commit', 'shortlog', 'describe'],
  },
  go: { exe: 'go', internet: ['get', 'install', 'mod'], tolak: ['env'] },
  cargo: { exe: 'cargo', internet: ['install', 'add', 'update', 'fetch', 'build', 'run', 'test', 'check'], tolak: ['publish', 'login', 'logout', 'owner', 'yank'] },
  rustc: { exe: 'rustc' },
  deno: { exe: 'deno', tolak: ['publish', 'upgrade'] },
  bun: { exe: 'bun', internet: ['install', 'add', 'x', 'create'], tolak: ['publish', 'upgrade'] },
  php: { exe: 'php' },
  ruby: { exe: 'ruby' },
  java: { exe: 'java' },
  javac: { exe: 'javac' },
  dotnet: { exe: 'dotnet', internet: ['add', 'restore', 'new', 'tool', 'build', 'run'], tolak: ['nuget'] },
  gcc: { exe: 'gcc' },
  'g++': { exe: 'g++' },
  make: { exe: 'make' },
  cmake: { exe: 'cmake' },
};
const DAFTAR_PROGRAM = Object.keys(PROGRAM);

// PROFIL PERAN (T8, keputusan Owner 2026-09-22): MESIN satu (spawn tanpa shell, cariExe, envBersih, batas waktu,
// dialog) — KUASA per peran. Assistant bekerja di folder pilihan; Engineer bekerja di repo Mamet SENDIRI, jadi lebih
// sempit: git hanya baca (perubahan kode lewat jalur patch dengan checkpoint & rollback, commit di tangan Owner) dan
// tanpa perintah yang mengunduh dari internet (npm/pip install, npx — cukup diusulkan, Owner yang menjalankan).
const GIT_BACA = ['status', 'log', 'diff', 'show', 'blame', 'grep', 'ls-files', 'rev-parse', 'branch', 'shortlog', 'describe'];
const PROFIL = {
  assistant: { nama: 'assistant', tempat: 'folder kerja', waktuBawaanS: BATAS_JALAN.waktuBawaanS, gitSub: PROGRAM.git.izinSub, tanpaInternet: false },
  engineer: { nama: 'engineer', tempat: 'repo Mamet', waktuBawaanS: 180, gitSub: GIT_BACA, tanpaInternet: true },
};

// git branch hanya untuk melihat daftar.
const GIT_BRANCH_UBAH = new Set(['-d', '-D', '--delete', '-m', '-M', '--move', '-c', '-C', '--copy', '-f', '--force', '--set-upstream-to', '-u', '--unset-upstream']);
// Opsi yang menulis ke berkas di luar keluaran biasa / menjalankan alat luar.
const OPSI_TERLARANG = /^--(output|ext-diff|exec|upload-pack|receive-pack|config-env|git-dir|work-tree)\b/i;

const RAHASIA_ENV = /(KEY|TOKEN|SECRET|PASSW|CREDENTIAL|AUTH|COOKIE|SESSION|SUPABASE|OPENROUTER|APIFY|MISTRAL|GROQ|GEMINI|ANTHROPIC|OPENAI)/i;
const ENV_BUANG = /^(ELECTRON_|NODE_OPTIONS$|NODE_PATH$|VITE_|npm_)/i;

const gagal = (perintah, alasan) => ({ ok: false, alat: 'folder_run', alamat: perintah, perintah, alasan });
const potong = (s, n = BATAS_JALAN.pratinjauHuruf) => (s.length > n ? `${s.slice(0, n)}\n… (${s.length - n} huruf lagi)` : s);
const kutipArg = (a) => (a === '' ? '""' : /[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
const barisPerintah = (program, argumen) => [program, ...argumen].map(kutipArg).join(' ');
const statAtauNull = (a) => { try { return fs.statSync(a); } catch { return null; } };
const samaAtauDiDalam = (induk, anak) => {
  const i = path.resolve(induk).toLowerCase();
  const a = path.resolve(anak).toLowerCase();
  return a === i || a.startsWith(i.endsWith(path.sep) ? i : i + path.sep);
};

/** Cari .exe di PATH — hanya folder absolut, BUKAN folder kerja/isinya, bukan stub Microsoft Store. */
function cariExe(nama, akar, env = process.env) {
  const jalur = String(env.PATH || env.Path || '').split(path.delimiter).map((d) => d.trim().replace(/^"|"$/g, '')).filter(Boolean);
  let akarAsli = akar;
  try { akarAsli = fs.realpathSync.native(akar); } catch { /* akar tak ada → pagar menolak lebih dulu */ }
  for (const d of jalur) {
    if (!path.isAbsolute(d)) continue;
    if (/\\WindowsApps\\?$/i.test(d)) continue;
    if (samaAtauDiDalam(akar, d) || samaAtauDiDalam(akarAsli, d)) continue;
    const calon = path.join(d, `${nama}.exe`);
    const st = statAtauNull(calon);
    if (st?.isFile()) return calon;
  }
  return null;
}

/** Program + argumen awal yang benar-benar dijalankan. */
function rakitProgram(program, akar, env) {
  const def = PROGRAM[program];
  if (def.lewatNode) {
    const node = cariExe('node', akar, env);
    if (!node) return { galat: 'node tidak terpasang (npm/npx butuh node)' };
    const cli = path.join(path.dirname(node), 'node_modules', 'npm', 'bin', def.lewatNode);
    if (!statAtauNull(cli)) return { galat: `${def.lewatNode} tidak ditemukan di samping node.exe` };
    return { exe: node, awal: [cli] };
  }
  const exe = cariExe(def.exe, akar, env);
  if (!exe) return { galat: `program "${program}" tidak terpasang di laptop ini (tidak ada di PATH)` };
  return { exe, awal: [] };
}

/** Periksa satu argumen: bukan alamat absolut, tidak keluar lewat "..". */
function periksaArgumen(akar, a, tempat = 'folder kerja') {
  if (typeof a !== 'string') return 'argumen harus teks';
  if (a.length > BATAS_JALAN.argumenHurufMaks) return `argumen lebih dari ${BATAS_JALAN.argumenHurufMaks} huruf`;
  if (/[\x00-\x08\x0a-\x1f]/.test(a)) return 'argumen memuat karakter kendali';
  if (OPSI_TERLARANG.test(a)) return `opsi ${a.split('=')[0]} tidak diizinkan`;
  const nilai = /^--?[A-Za-z][\w-]*=/.test(a) ? a.slice(a.indexOf('=') + 1) : a;
  if (/^[A-Za-z]:/.test(nilai) || /^[\\/]{1,2}/.test(nilai) || /^~[\\/]?/.test(nilai)) return `"${a}" adalah alamat absolut — pakai alamat relatif terhadap ${tempat}`;
  if (/(^|[\\/])\.\.([\\/]|$)/.test(nilai)) {
    const p = alamatDalamPagar(akar, nilai);
    if (!p.ok) return `"${a}" keluar dari ${tempat}`;
  }
  return null;
}

/** Sub-perintah (argumen pertama yang bukan opsi) → aturan program. */
function periksaSub(program, argumen, profil = PROFIL.assistant) {
  const def = PROGRAM[program];
  const sub = (argumen.find((x) => !x.startsWith('-')) || '').toLowerCase();
  if (def.izinSub) {
    // git: argumen PERTAMA wajib sub-perintah — mencegah opsi global (-c, -C, --exec-path) yang mengubah perilaku git.
    // Daftar sub-perintah dari PROFIL (Engineer: baca saja).
    const izin = program === 'git' ? profil.gitSub : def.izinSub;
    const pertama = (argumen[0] || '').toLowerCase();
    if (!izin.includes(pertama)) return { galat: `${program} ${pertama || '(kosong)'} tidak diizinkan untuk ${profil.tempat} — yang boleh: ${izin.join(', ')}` };
    if (program === 'git' && pertama === 'branch' && argumen.slice(1).some((x) => GIT_BRANCH_UBAH.has(x) || /^--(delete|move|copy|force|set-upstream)/.test(x))) {
      return { galat: 'git branch hanya untuk melihat daftar cabang' };
    }
    return { sub: pertama, internet: false };
  }
  if (def.tolak?.includes(sub)) return { galat: `${program} ${sub} tidak diizinkan (menerbitkan/masuk akun/mengubah pengaturan global)` };
  const internet = !!def.internetSelalu || !!def.internet?.includes(sub);
  if (internet && profil.tanpaInternet) {
    return { galat: `${program}${sub ? ` ${sub}` : ''} mengunduh/menjalankan paket dari internet — tidak diizinkan untuk ${profil.tempat}; cukup diusulkan, Owner yang menjalankan sendiri` };
  }
  return { sub, internet };
}

/** Pratinjau yang ikut di dialog: isi skrip dari folder, atau script npm yang akan jalan. */
function pratinjau(akar, program, argumen, sub) {
  const bagian = [];
  if (program === 'npm') {
    const pkgAlamat = path.join(akar, 'package.json');
    let scripts = null;
    try { scripts = JSON.parse(fs.readFileSync(pkgAlamat, 'utf8')).scripts || {}; } catch { /* tak ada package.json */ }
    if (scripts && (sub === 'run' || sub === 'run-script' || sub === 'test' || sub === 'start')) {
      const nama = sub === 'test' || sub === 'start' ? sub : argumen[argumen.indexOf(argumen.find((x) => x.toLowerCase() === sub)) + 1];
      const jalan = ['pre' + nama, nama, 'post' + nama].filter((n) => scripts[n]).map((n) => `  ${n}: ${scripts[n]}`);
      bagian.push(jalan.length ? `Script package.json yang akan jalan:\n${jalan.join('\n')}` : `Script "${nama}" tidak ada di package.json.`);
    }
    if (scripts && ['install', 'i', 'ci'].includes(sub)) {
      const siklus = ['preinstall', 'install', 'postinstall', 'prepare'].filter((n) => scripts[n]).map((n) => `  ${n}: ${scripts[n]}`);
      if (siklus.length) bagian.push(`Script package.json yang ikut jalan saat install:\n${siklus.join('\n')}`);
    }
  }
  // Berkas di folder yang disebut sebagai argumen (skrip yang akan dijalankan) → cuplikan isinya.
  for (const a of argumen) {
    if (a.startsWith('-') || !/\.(py|js|mjs|cjs|ts|php|rb|go|rs|java|sh|c|cpp)$/i.test(a)) continue;
    const p = alamatDalamPagar(akar, a);
    if (!p.ok) continue;
    const st = statAtauNull(p.alamat);
    if (!st?.isFile()) continue;
    const isi = fs.readFileSync(p.alamat, 'utf8').slice(0, 4000);
    bagian.push(`Isi ${a} (${st.size} byte):\n${potong(isi, 900)}`);
    break;
  }
  return bagian.join('\n\n');
}

// Tanda skrip MENULIS/MENGHAPUS berkas atau menghubungi jaringan. Dipakai hanya untuk MENANDAI di dialog izin —
// bukan daftar larangan: daftar semacam itu selalu bisa dilewati, dan melarangnya akan memblokir pekerjaan sah
// (live 2026-09-23: `node -e` membaca berkas dengan nomor baris ditolak, padahal hanya membaca).
const TANDA_TULIS = [
  [/writefile|appendfile|createwritestream|\bftruncate\b/i, 'menulis berkas'],
  [/\bunlink|\brmdir|\brm\b|\brmtree|shutil\.rmtree|os\.remove/i, 'menghapus berkas'],
  [/\brename\b|\bcopyfile|shutil\.copy|shutil\.move/i, 'memindah/menyalin berkas'],
  [/\bmkdir\b|makedirs/i, 'membuat folder'],
  [/open\s*\([^)]*['"][wax]/i, 'membuka berkas untuk ditulis'],
  [/child_process|execsync|spawnsync|subprocess|os\.system/i, 'menjalankan program lain'],
  [/\bfetch\s*\(|https?:\/\/|urllib|requests\.|axios/i, 'menghubungi jaringan'],
];

/**
 * Skrip sebaris (`node -e`, `python -c`) isinya tidak terlihat dari nama perintah. Fungsi ini menyiapkan baris
 * peringatan untuk dialog: apa saja yang tampak dilakukan skrip itu. Kalau hanya membaca, tidak ada peringatan.
 * @returns {string} baris peringatan, atau '' bila tidak ada tanda menulis
 */
function peringatanSkripSebaris(argumen) {
  const i = argumen.findIndex((a) => /^-(e|c|p|ep|pe)$/.test(a));
  if (i === -1) return '';
  const skrip = argumen.slice(i + 1).join(' ');
  if (!skrip) return '';
  const temuan = TANDA_TULIS.filter(([pola]) => pola.test(skrip)).map(([, nama]) => nama);
  if (!temuan.length) return '';
  return `⚠️ SKRIP SEBARIS INI TAMPAK: ${[...new Set(temuan)].join(', ')}. Skrip berjalan dengan hak penuh Anda dan TIDAK dibatasi pagar folder — perubahan di luar repo tidak terlihat di git. Baca skripnya di bawah sebelum mengizinkan.`;
}

/** Isi skrip sebaris ditampilkan UTUH di dialog — Owner tidak bisa menilai apa yang tidak ia lihat. */
function skripSebarisPenuh(argumen) {
  const i = argumen.findIndex((a) => /^-(e|c|p|ep|pe)$/.test(a));
  if (i === -1) return '';
  const skrip = argumen.slice(i + 1).join(' ');
  return skrip ? `Isi skrip yang akan dijalankan (${skrip.length} huruf):\n${potong(skrip, 1200)}` : '';
}

/** Lingkungan tanpa rahasia; keluaran dipaksa UTF-8 dan tanpa pertanyaan interaktif. */
function envBersih(env = process.env) {
  const hasil = {};
  for (const [k, v] of Object.entries(env)) {
    if (RAHASIA_ENV.test(k) || ENV_BUANG.test(k)) continue;
    hasil[k] = v;
  }
  return {
    ...hasil,
    PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1',
    GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat', PAGER: 'cat', GIT_EDITOR: ':',
    NO_COLOR: '1', FORCE_COLOR: '0', CI: '1',
  };
}

function matikanPohon(pid) {
  if (!pid) return;
  const taskkill = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
  try { execFile(taskkill, ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {}); } catch { /* */ }
}

/** Jalankan dan kumpulkan keluaran (stdout+stderr berurutan kedatangan), dengan batas waktu & ukuran. */
function jalankanProses(exe, argumen, { cwd, env, waktuS }) {
  return new Promise((selesai) => {
    const mulai = Date.now();
    const potongan = [];
    let byte = 0;
    let total = 0;
    let habisWaktu = false;
    let anak;
    try {
      anak = spawn(exe, argumen, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      return selesai({ galat: `gagal memulai: ${e.code || e.message}` });
    }
    const terima = (buf) => {
      total += buf.length;
      if (byte >= BATAS_JALAN.keluaranByte) return;
      const sisa = BATAS_JALAN.keluaranByte - byte;
      const ambil = buf.length > sisa ? buf.subarray(0, sisa) : buf;
      potongan.push(ambil);
      byte += ambil.length;
    };
    anak.stdout.on('data', terima);
    anak.stderr.on('data', terima);
    const pengatur = setTimeout(() => { habisWaktu = true; matikanPohon(anak.pid); }, waktuS * 1000);
    anak.on('error', (e) => { clearTimeout(pengatur); selesai({ galat: `gagal memulai: ${e.code || e.message}` }); });
    anak.on('close', (kode, sinyal) => {
      clearTimeout(pengatur);
      selesai({
        kodeKeluar: kode, sinyal: sinyal || null, habisWaktu, waktuMs: Date.now() - mulai,
        keluaran: Buffer.concat(potongan).toString('utf8'), terpotong: total > byte, byteKeluaran: total,
      });
    });
  });
}

let sedangJalan = false;

/**
 * Satu pintu untuk IPC. permintaan = {alat:'folder_run', program:'python', argumen:['app.py'], waktu?:60}.
 * deps = { mintaIzin(permintaan) → Promise<boolean>, profil? (PROFIL.assistant bawaan | PROFIL.engineer), env? (uji) }.
 */
async function jalankanAlatJalan(akar, permintaan = {}, deps) {
  const program = typeof permintaan.program === 'string' ? permintaan.program.trim().toLowerCase().replace(/\.exe$/, '') : '';
  const argumen = Array.isArray(permintaan.argumen) ? permintaan.argumen : permintaan.argumen == null ? [] : null;
  const teks = barisPerintah(program || String(permintaan.program ?? ''), (argumen || []).map(String));
  const profil = deps?.profil || PROFIL.assistant;
  if (!akar) return gagal(teks, `${profil.tempat} belum dipilih`);
  if (!deps || typeof deps.mintaIzin !== 'function') return gagal(teks, 'dialog izin tidak tersedia — tidak ada yang dijalankan');
  if (!program) return gagal(teks, 'nama program kosong — isi "program" (mis. "python") dan "argumen" sebagai daftar');
  if (!PROGRAM[program]) return gagal(teks, `program "${program}" tidak ada di daftar izin: ${DAFTAR_PROGRAM.join(', ')}`);
  if (!argumen) return gagal(teks, '"argumen" harus daftar teks, mis. ["app.py", "--versi"]');
  if (argumen.length > BATAS_JALAN.argumenMaks) return gagal(teks, `lebih dari ${BATAS_JALAN.argumenMaks} argumen`);
  for (const a of argumen) {
    const salah = periksaArgumen(akar, a, profil.tempat);
    if (salah) return gagal(teks, salah);
  }
  const s = periksaSub(program, argumen, profil);
  if (s.galat) return gagal(teks, s.galat);
  const env = envBersih(deps.env || process.env);
  const r = rakitProgram(program, akar, env);
  if (r.galat) return gagal(teks, r.galat);
  const waktuS = Math.min(BATAS_JALAN.waktuMaksS, Math.max(1, Number.isInteger(permintaan.waktu) ? permintaan.waktu : profil.waktuBawaanS));
  if (sedangJalan) return gagal(teks, 'perintah lain masih berjalan — tunggu selesai');
  // Kunci dipasang SEBELUM dialog: dua permintaan tidak bisa sama-sama lolos selagi dialog pertama terbuka.
  sedangJalan = true;
  try {
    return await izinLaluJalankan(akar, { program, argumen, teks, s, r, env, waktuS, profil }, deps);
  } finally {
    sedangJalan = false;
  }
}

async function izinLaluJalankan(akar, { program, argumen, teks, s, r, env, waktuS, profil }, deps) {
  const setuju = await (async () => {
    try {
      return (await deps.mintaIzin({
        alat: 'folder_run', alamat: teks, berbahaya: true,
        judul: `Jalankan perintah ini di ${profil.tempat}?\n\n${teks}`,
        rincian: [
          `Program: ${r.exe}`,
          `Folder asal: ${profil.tempat} · batas waktu ${waktuS} detik · keluaran maks ${BATAS_JALAN.keluaranByte / 1024} KB`,
          'PERHATIAN: program yang dijalankan TIDAK dibatasi pagar folder — ia bisa membaca/mengubah berkas di mana pun di laptop. Izinkan hanya bila Anda paham perintah ini.',
          s.internet ? '🌐 Perintah ini bisa MENGUNDUH dan menjalankan paket dari internet.' : '',
          peringatanSkripSebaris(argumen),
        ].filter(Boolean).join('\n'),
        pratinjau: [pratinjau(akar, program, argumen, s.sub), skripSebarisPenuh(argumen)].filter(Boolean).join('\n\n'),
      })) === true;
    } catch { return false; }
  })();
  if (!setuju) return { ok: false, alat: 'folder_run', alamat: teks, perintah: teks, ditolakOwner: true, alasan: 'ditolak Owner di dialog izin — tidak ada yang dijalankan' };

  const h = await jalankanProses(r.exe, [...r.awal, ...argumen], { cwd: akar, env, waktuS });
  if (h.galat) return gagal(teks, h.galat);
  return { ok: true, alat: 'folder_run', alamat: teks, perintah: teks, waktuBatasS: waktuS, ...h };
}

/**
 * T8 (2026-09-22): tombol [MAMET_CMD: npm install] Engineer menulis perintah sebagai SATU kalimat. Dipecah di sini
 * menjadi program + argumen TANPA shell: spasi memisah, tanda kutip "…"/'…' mengelompokkan (tanpa escape).
 * Metakarakter shell ditolak — model yang menulis "&&", "|", ">" atau "$(…)" berharap shell, dan tanpa shell
 * perintahnya tidak akan berarti seperti yang dimaksud; lebih jujur ditolak dengan alasan daripada dijalankan lain.
 * @returns {{program: string, argumen: string[]} | {galat: string}}
 */
function pecahPerintah(teks) {
  const t = String(teks ?? '').trim();
  if (!t) return { galat: 'perintah kosong' };
  if (t.length > 2000) return { galat: 'perintah lebih dari 2000 huruf' };
  // Live 2026-09-22: `git log --pretty=format:"%h - %s"` ditolak karena "%" — padahal tanpa shell %, $, ^ hanya teks
  // (HEAD^, format git). Yang ditolak hanya penyambung/pengalih perintah & baris baru: tanda model berharap shell.
  //
  // Live 2026-09-23: `node -e "const fs=require('fs');const p='…';…"` ditolak karena ";" — padahal titik-koma itu ADA
  // DI DALAM tanda kutip, yaitu isi skrip yang diteruskan apa adanya sebagai SATU argumen. Karena program dijalankan
  // langsung tanpa shell, tanda di dalam kutip tidak bisa menyambung perintah apa pun; menolaknya hanya memblokir
  // pemakaian yang sah. Karena itu penyambung/pengalih diperiksa per huruf, HANYA di luar tanda kutip.
  const PENYAMBUNG = new Set(['&', '|', ';', '<', '>', '`']);
  const hasil = [];
  let kini = '';
  let adaToken = false;
  let kutip = null;
  for (const c of t) {
    if (c === '\n' || c === '\r') {
      return { galat: 'perintah memuat "baris baru" — tidak ada shell: tulis SATU program dengan argumennya (tanpa &&, |, ;, <, >)' };
    }
    if (kutip) {
      if (c === kutip) kutip = null; else kini += c;
    } else if (PENYAMBUNG.has(c)) {
      return { galat: `perintah memuat "${c}" di luar tanda kutip — tidak ada shell: tulis SATU program dengan argumennya (tanpa &&, |, ;, <, >). Bila tanda itu bagian dari isi argumen, bungkus argumennya dengan tanda kutip.` };
    } else if (c === '"' || c === "'") {
      kutip = c; adaToken = true;
    } else if (/\s/.test(c)) {
      if (adaToken) { hasil.push(kini); kini = ''; adaToken = false; }
    } else {
      kini += c; adaToken = true;
    }
  }
  if (kutip) return { galat: 'tanda kutip tidak ditutup' };
  if (adaToken) hasil.push(kini);
  const [program, ...argumen] = hasil;
  return { program, argumen };
}

module.exports = { jalankanAlatJalan, pecahPerintah, PROFIL, DAFTAR_PROGRAM, BATAS_JALAN, cariExe, envBersih, periksaArgumen, jalankanProses };
