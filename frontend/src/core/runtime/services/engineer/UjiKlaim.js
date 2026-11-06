
export const MAKS_KASUS = 30;
export const POLA_BLOK = /<uji_klaim\s+berkas="([^"]+)"\s+fungsi="([A-Za-z_$][\w$]*)"\s*>([\s\S]*?)<\/uji_klaim>/gi;

export function alamatSah(alamat) {
  const a = String(alamat || '').trim().replace(/\\/g, '/');
  if (!a || a.startsWith('/') || /^[A-Za-z]:/.test(a)) return null;
  if (a.split('/').includes('..')) return null;
  if (!/\.(js|mjs)$/i.test(a)) return null;
  if (!/^frontend\/src\//i.test(a)) return null;
  return a;
}

export function ambilBlokKlaim(teks) {
  const blok = [];
  const galat = [];
  const sumber = String(teks ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  POLA_BLOK.lastIndex = 0;
  let m;
  while ((m = POLA_BLOK.exec(sumber)) !== null) {
    const berkas = alamatSah(m[1]);
    if (!berkas) { galat.push(`alamat tidak diizinkan: ${m[1]} (harus relatif di dalam frontend/src dan berakhiran .js/.mjs)`); continue; }
    const kasus = [];
    for (const baris of m[3].split('\n')) {
      const b = baris.trim();
      if (!b || b.startsWith('#') || b.startsWith('//')) continue;
      const pisah = b.indexOf('=>');
      if (pisah === -1) { galat.push(`baris tanpa "=>" dilewati: ${b.slice(0, 80)}`); continue; }
      const kiri = b.slice(0, pisah).trim();
      const diklaim = b.slice(pisah + 2).trim().replace(/^[`"']|[`"']$/g, '');
      let argumen;
      try { argumen = JSON.parse(kiri); } catch { galat.push(`argumen bukan JSON: ${kiri.slice(0, 80)}`); continue; }
      if (!diklaim) { galat.push(`hasil yang diklaim kosong: ${b.slice(0, 80)}`); continue; }
      kasus.push({ argumen: Array.isArray(argumen) ? argumen : [argumen], diklaim, baris: b });
      if (kasus.length >= MAKS_KASUS) { galat.push(`lebih dari ${MAKS_KASUS} kasus — sisanya dilewati`); break; }
    }
    if (kasus.length) blok.push({ berkas, fungsi: m[2], kasus });
    else galat.push(`blok untuk ${berkas} tidak punya kasus yang sah`);
  }
  return { blok, galat };
}

export function susunSkripUji({ berkas, fungsi, kasus }, akarRepo) {
  const alamat = `${String(akarRepo).replace(/\\/g, '/')}/${berkas}`;
  return [
    "import { pathToFileURL } from 'node:url';",
    `const ALAMAT = ${JSON.stringify(alamat)};`,
    `const NAMA = ${JSON.stringify(fungsi)};`,
    `const KASUS = ${JSON.stringify(kasus.map((k) => k.argumen))};`,
    'const asli = { log: console.log, warn: console.warn, error: console.error, info: console.info };',
    'const bungkam = () => { console.log = console.warn = console.error = console.info = () => {}; };',
    'const pulih = () => Object.assign(console, asli);',
    'let hasil;',
    'try {',
    '  bungkam();',
    '  const modul = await import(pathToFileURL(ALAMAT).href);',
    '  const f = modul[NAMA];',
    '  if (typeof f !== "function") { pulih(); asli.log(JSON.stringify({ galat: `fungsi ${NAMA} tidak diekspor dari berkas itu` })); process.exit(0); }',
    '  hasil = [];',
    '  for (const arg of KASUS) {',
    '    try { hasil.push({ nyata: String(await f(...arg)) }); }',
    '    catch (e) { hasil.push({ galat: String(e && e.message || e) }); }',
    '  }',
    '} catch (e) {',
    '  pulih();',
    '  asli.log(JSON.stringify({ galat: String(e && e.message || e) }));',
    '  process.exit(0);',
    '}',
    'pulih();',
    'asli.log(JSON.stringify({ hasil }));',
  ].join('\n');
}

const POLA_KLAIM_PERILAKU = /(?:=>|→|->)\s*`?([A-Z][A-Z_]{3,}|\d+(?:[.,]\d+)?)`?/g;

export function peringatanKlaimTakTeruji(teks) {
  const t = String(teks ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  if (t.includes('<uji_klaim')) return null;
  POLA_KLAIM_PERILAKU.lastIndex = 0;
  const jumlah = (t.match(POLA_KLAIM_PERILAKU) || []).length;
  if (jumlah < 2) return null;
  return `⚠️ **Peringatan sistem:** jawaban di atas memuat ${jumlah} klaim perilaku ("masukan → hasil") tetapi TIDAK ada blok \`<uji_klaim>\`, jadi tidak ada satu pun yang dijalankan terhadap kode. Klaim seperti ini pernah meleset 2 dari 16 kali (TUGAS-04) dan hanya ketahuan karena dijalankan manual. Minta Engineer menulis ulang klaimnya sebagai blok \`<uji_klaim berkas="…" fungsi="…">\` agar diuji mesin.`;
}

function barisHasil(k, h) {
  const nyata = h?.galat ? `galat: ${h.galat}` : String(h?.nyata ?? '');
  const cocok = !h?.galat && nyata === k.diklaim;
  return { cocok, teks: `| ${cocok ? '✅' : '❌'} | \`${k.baris.replace(/\|/g, '\\|')}\` | ${nyata.replace(/\|/g, '\\|').slice(0, 80)} |` };
}

export function susunLaporanKlaim(jalan, galat = []) {
  const baris = [];
  let cocok = 0;
  let total = 0;
  for (const { blok, hasil } of jalan || []) {
    if (hasil?.galat) {
      baris.push(`| ⚠️ | \`${blok.berkas}#${blok.fungsi}\` | tidak bisa diuji: ${String(hasil.galat).slice(0, 120)} |`);
      continue;
    }
    baris.push(`| | **${blok.berkas}#${blok.fungsi}** | |`);
    blok.kasus.forEach((k, i) => {
      const b = barisHasil(k, (hasil?.hasil || [])[i]);
      total++;
      if (b.cocok) cocok++;
      baris.push(b.teks);
    });
  }
  if (!baris.length && !galat.length) return null;

  const judul = total
    ? `🧪 **Uji klaim: ${cocok}/${total} terbukti**${cocok < total ? ` — ${total - cocok} meleset` : ''}`
    : '🧪 **Uji klaim tidak bisa dijalankan**';
  const catatan = total && cocok < total
    ? '\n\nKlaim yang meleset TIDAK membatalkan jawaban di atas — tetapi bagian itu belum terbukti dan perlu diperiksa sendiri.'
    : '';
  const tabel = baris.length ? `\n\n| | klaim | hasil sebenarnya |\n|---|---|---|\n${baris.join('\n')}` : '';
  const pesanGalat = galat.length ? `\n\n_Catatan penguraian: ${galat.slice(0, 3).join('; ')}._` : '';
  return `${judul}${tabel}${catatan}${pesanGalat}\n\n_Dijalankan proses utama terhadap kode di repo, bukan klaim model._`;
}
