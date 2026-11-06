
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

const GIT_BACA = ['status', 'log', 'diff', 'show', 'blame', 'grep', 'ls-files', 'rev-parse', 'branch', 'shortlog', 'describe'];
const PROFIL = {
  assistant: { nama: 'assistant', tempat: 'folder kerja', waktuBawaanS: BATAS_JALAN.waktuBawaanS, gitSub: PROGRAM.git.izinSub, tanpaInternet: false },
  engineer: { nama: 'engineer', tempat: 'repo Mamet', waktuBawaanS: 180, gitSub: GIT_BACA, tanpaInternet: true },
};

const GIT_BRANCH_UBAH = new Set(['-d', '-D', '--delete', '-m', '-M', '--move', '-c', '-C', '--copy', '-f', '--force', '--set-upstream-to', '-u', '--unset-upstream']);
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

function cariExe(nama, akar, env = process.env) {
  const jalur = String(env.PATH || env.Path || '').split(path.delimiter).map((d) => d.trim().replace(/^"|"$/g, '')).filter(Boolean);
  let akarAsli = akar;
  try { akarAsli = fs.realpathSync.native(akar); } catch {  }
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

function periksaSub(program, argumen, profil = PROFIL.assistant) {
  const def = PROGRAM[program];
  const sub = (argumen.find((x) => !x.startsWith('-')) || '').toLowerCase();
  if (def.izinSub) {
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

function pratinjau(akar, program, argumen, sub) {
  const bagian = [];
  if (program === 'npm') {
    const pkgAlamat = path.join(akar, 'package.json');
    let scripts = null;
    try { scripts = JSON.parse(fs.readFileSync(pkgAlamat, 'utf8')).scripts || {}; } catch {  }
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

const TANDA_TULIS = [
  [/writefile|appendfile|createwritestream|\bftruncate\b/i, 'menulis berkas'],
  [/\bunlink|\brmdir|\brm\b|\brmtree|shutil\.rmtree|os\.remove/i, 'menghapus berkas'],
  [/\brename\b|\bcopyfile|shutil\.copy|shutil\.move/i, 'memindah/menyalin berkas'],
  [/\bmkdir\b|makedirs/i, 'membuat folder'],
  [/open\s*\([^)]*['"][wax]/i, 'membuka berkas untuk ditulis'],
  [/child_process|execsync|spawnsync|subprocess|os\.system/i, 'menjalankan program lain'],
  [/\bfetch\s*\(|https?:\/\/|urllib|requests\.|axios/i, 'menghubungi jaringan'],
];

function peringatanSkripSebaris(argumen) {
  const i = argumen.findIndex((a) => /^-(e|c|p|ep|pe)$/.test(a));
  if (i === -1) return '';
  const skrip = argumen.slice(i + 1).join(' ');
  if (!skrip) return '';
  const temuan = TANDA_TULIS.filter(([pola]) => pola.test(skrip)).map(([, nama]) => nama);
  if (!temuan.length) return '';
  return `⚠️ SKRIP SEBARIS INI TAMPAK: ${[...new Set(temuan)].join(', ')}. Skrip berjalan dengan hak penuh Anda dan TIDAK dibatasi pagar folder — perubahan di luar repo tidak terlihat di git. Baca skripnya di bawah sebelum mengizinkan.`;
}

function skripSebarisPenuh(argumen) {
  const i = argumen.findIndex((a) => /^-(e|c|p|ep|pe)$/.test(a));
  if (i === -1) return '';
  const skrip = argumen.slice(i + 1).join(' ');
  return skrip ? `Isi skrip yang akan dijalankan (${skrip.length} huruf):\n${potong(skrip, 1200)}` : '';
}

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
  try { execFile(taskkill, ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {}); } catch {  }
}

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
  sedangJalan = true;
  try {
    return await izinLaluJalankan(akar, { program, argumen, teks, s, r, env, waktuS, profil }, deps);
  } finally {
    sedangJalan = false;
  }
}

function tanpaPersetujuan({ program, argumen, profil }) {
  if (program !== 'git') return false;
  if (!profil || profil.nama !== 'engineer') return false;

  const bagian = (argumen || []).map(String);
  const sub = bagian.find((a) => !a.startsWith('-'));
  if (!sub || !GIT_BACA.includes(sub)) return false;

  if (bagian.length && bagian[0] !== sub) return false;
  if (bagian.some((a) => OPSI_TERLARANG.test(a))) return false;
  if (sub === 'branch' && bagian.some((a) => GIT_BRANCH_UBAH.has(a))) return false;

  return true;
}

async function izinLaluJalankan(akar, { program, argumen, teks, s, r, env, waktuS, profil }, deps) {
  if (tanpaPersetujuan({ program, argumen, profil })) {
    return jalankanSesudahIzin(akar, { program, argumen, teks, s, r, env, waktuS, profil, tanpaIzin: true });
  }
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

  return jalankanSesudahIzin(akar, { program, argumen, teks, s, r, env, waktuS, profil, tanpaIzin: false });
}

async function jalankanSesudahIzin(akar, { argumen, teks, r, env, waktuS, tanpaIzin = false }) {
  const h = await jalankanProses(r.exe, [...r.awal, ...argumen], { cwd: akar, env, waktuS });
  if (h.galat) return gagal(teks, h.galat);
  return { ok: true, alat: 'folder_run', alamat: teks, perintah: teks, waktuBatasS: waktuS, ...h, tanpaIzin };
}

function pecahPerintah(teks) {
  const t = String(teks ?? '').trim();
  if (!t) return { galat: 'perintah kosong' };
  if (t.length > 2000) return { galat: 'perintah lebih dari 2000 huruf' };
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

module.exports = { jalankanAlatJalan, pecahPerintah, PROFIL, DAFTAR_PROGRAM, BATAS_JALAN, cariExe, envBersih, periksaArgumen, jalankanProses, tanpaPersetujuan };
