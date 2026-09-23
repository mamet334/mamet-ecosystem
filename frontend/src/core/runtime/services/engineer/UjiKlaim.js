/**
 * UjiKlaim.js — mesin uji klaim Engineer (ROADMAP-ENGINEER-MANDIRI Tahap 2, 2026-09-23).
 *
 * Masalahnya terbukti berulang: analisis Engineer terdengar meyakinkan dan SEBAGIAN BESAR benar, tetapi selalu ada
 * yang meleset — TUGAS-04 gabungan tiga putaran: 14 dari 16 klaim terbukti, 2 meleset di langkah penelusuran
 * terakhir. Yang menangkap kedua kesalahan itu adalah saya (Claude) yang menjalankan fungsinya satu per satu.
 * Tanpa mesin, tidak ada yang tahu mana yang salah — dan itulah yang membuat otonomi berbahaya.
 *
 * Mesin ini membuat klaim BISA DIBANTAH: Engineer menulis blok klaim yang bisa dijalankan, sistem menjalankannya
 * terhadap kode nyata di repo, lalu menempelkan hasilnya di bawah jawaban ("9/12 klaim terbukti, 3 meleset").
 * Klaim yang meleset TIDAK menghapus jawaban — ia ditandai, supaya Owner tahu bagian mana yang perlu diperiksa.
 *
 * Modul ini murni: mengurai blok, menyusun skrip uji, dan menyusun laporan. Menjalankannya dilakukan proses utama
 * di proses node terpisah (IPC `engineer:uji-klaim`), bukan di dalam aplikasi — bila modul yang diuji punya efek
 * samping, efeknya mati bersama proses itu.
 */

export const MAKS_KASUS = 30;
export const POLA_BLOK = /<uji_klaim\s+berkas="([^"]+)"\s+fungsi="([A-Za-z_$][\w$]*)"\s*>([\s\S]*?)<\/uji_klaim>/gi;

/** Alamat berkas yang boleh diuji: relatif, di dalam repo, berkas JS/MJS. */
export function alamatSah(alamat) {
  const a = String(alamat || '').trim().replace(/\\/g, '/');
  if (!a || a.startsWith('/') || /^[A-Za-z]:/.test(a)) return null;   // absolut
  if (a.split('/').includes('..')) return null;                        // keluar repo
  if (!/\.(js|mjs)$/i.test(a)) return null;                            // hanya modul JS
  if (!/^frontend\/src\//i.test(a)) return null;                       // hanya kode aplikasi
  return a;
}

/**
 * Ambil blok klaim dari jawaban Engineer.
 *
 * Bentuk yang dikenali (satu kasus per baris, argumen JSON => hasil yang diklaim):
 *   <uji_klaim berkas="frontend/src/…/IntentClassifier.js" fungsi="detectIntent">
 *   {"title":"Perbaiki laporan analisis"} => MODIFY_CODE
 *   </uji_klaim>
 *
 * @returns {{blok: Array<{berkas, fungsi, kasus: Array<{argumen: any[], diklaim: string, baris: string}>}>, galat: string[]}}
 */
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

/**
 * Skrip yang dijalankan proses node terpisah. Semua nilai ditanam lewat JSON.stringify — tidak ada teks model yang
 * masuk sebagai kode. Keluaran modul yang diuji dibungkam supaya JSON hasil tidak tercampur log.
 */
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

// Klaim perilaku bergaya "masukan → HASIL": panah/=> diikuti kata BESAR (MODIFY_CODE, ANALYSIS, CLARIFICATION, …)
// atau angka. Sengaja sempit: butuh ≥2 kemunculan supaya kalimat biasa berpanah tidak ikut tertangkap.
const POLA_KLAIM_PERILAKU = /(?:=>|→|->)\s*`?([A-Z][A-Z_]{3,}|\d+(?:[.,]\d+)?)`?/g;

/**
 * Peringatan bila jawaban memuat klaim perilaku TETAPI tidak ada blok <uji_klaim> — jadi tidak ada yang mengujinya.
 * Kalimatnya selalu benar saat dipasang: bloknya memang tidak ada, dan klaimnya memang belum diuji mesin.
 *
 * Live 2026-09-23: aturan 0.2b sudah sampai ke model (terbukti di jejak pemrosesan), tetapi model tetap menulis
 * klaim dalam tabel prosa. Tanpa penanda ini, Owner tidak punya cara tahu bahwa angka-angka itu belum diperiksa.
 * @returns {string|null}
 */
export function peringatanKlaimTakTeruji(teks) {
  const t = String(teks ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  if (t.includes('<uji_klaim')) return null;
  POLA_KLAIM_PERILAKU.lastIndex = 0;
  const jumlah = (t.match(POLA_KLAIM_PERILAKU) || []).length;
  if (jumlah < 2) return null;
  return `⚠️ **Peringatan sistem:** jawaban di atas memuat ${jumlah} klaim perilaku ("masukan → hasil") tetapi TIDAK ada blok \`<uji_klaim>\`, jadi tidak ada satu pun yang dijalankan terhadap kode. Klaim seperti ini pernah meleset 2 dari 16 kali (TUGAS-04) dan hanya ketahuan karena dijalankan manual. Minta Engineer menulis ulang klaimnya sebagai blok \`<uji_klaim berkas="…" fungsi="…">\` agar diuji mesin.`;
}

/** Satu baris hasil untuk laporan. */
function barisHasil(k, h) {
  const nyata = h?.galat ? `galat: ${h.galat}` : String(h?.nyata ?? '');
  const cocok = !h?.galat && nyata === k.diklaim;
  return { cocok, teks: `| ${cocok ? '✅' : '❌'} | \`${k.baris.replace(/\|/g, '\\|')}\` | ${nyata.replace(/\|/g, '\\|').slice(0, 80)} |` };
}

/**
 * Laporan yang ditempel di bawah jawaban Engineer.
 * @param {Array<{blok: object, hasil: object}>} jalan hasil per blok dari proses utama
 * @param {string[]} galat galat penguraian
 */
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
