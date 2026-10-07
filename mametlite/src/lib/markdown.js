// URAIAN MARKDOWN MAMETLITE (2026-10-07) — menghasilkan DATA, bukan HTML.
//
// Sebelum ini, `parseMarkdown` di `App.jsx` membangun satu string HTML lalu menyuntikkannya dengan
// `dangerouslySetInnerHTML`. Pelolosannya memakai daftar putih:
//
//     .replace(/<(?!div|\/div|img|a|\/a|strong|\/strong|em|\/em|br\/?)([^>]+)>/g, '&lt;$1&gt;')
//
// Alternatif `a` di daftar itu panjangnya SATU HURUF, jadi setiap tag yang namanya mulai dengan "a"
// lolos tanpa di-escape — `<audio src=x onerror=…>`, `<animate>` — dan karena polanya `([^>]+)`,
// atributnya ikut lolos utuh. Di origin yang sama, `localStorage` menyimpan kunci OpenRouter
// pengguna dan sesi Supabase, dan Mametlite tidak punya CSP.
//
// ARAHAN OWNER 7 Okt: *"jangan hanya di tambal. tapi digunakan logikanya dengan semestinya."*
// Jadi daftar putihnya TIDAK ditambal — kelas cacatnya dihapus:
//
//   1. Berkas ini hanya MENGURAI, hasilnya data biasa (objek & teks). Nol string HTML.
//   2. React yang merender, dan React meloloskan teks dengan sendirinya.
//   3. Tanpa `dangerouslySetInnerHTML`, tidak ada yang bisa disuntikkan — jadi tidak ada daftar
//      putih yang perlu dijaga benar, sekarang maupun nanti.
//
// Efek sampingnya: uraian ini bisa diuji TANPA React dan tanpa DOM (lihat `uji/uji-uraian-markdown.mjs`).
//
// Parser tangan DIPERTAHANKAN, bukan diganti `react-markdown`. Alasannya sudah tertulis di kode
// lama: *"Custom lightweight Markdown parser to avoid React 19 crashes with react-markdown"*.
// `react-markdown` & `remark-gfm` memang masih terpasang di `package.json` tanpa dipakai — itu
// perkara kerapian dependency (M8), bukan alasan membalik keputusan ini.

export const VERSI_URAIAN = 'uraian-markdown v1 (2026-10-07)';

/** Skema yang boleh jadi tautan/gambar. Sisanya ditampilkan sebagai TEKS, bukan dibuang diam-diam. */
const SKEMA_AMAN = ['http:', 'https:', 'mailto:'];

/**
 * Alamat yang aman dipakai, atau `null`.
 *
 * Sengaja TANPA alamat dasar: `new URL(x, dasar)` akan membuat alamat relatif ("foo.png") jadi
 * absolut terhadap dasar karangan, yaitu menulis ulang maksud penulisnya diam-diam. Alamat relatif
 * karena itu ditolak dan jatuh ke teks — pengguna tetap melihat tulisannya apa adanya.
 *
 * `javascript:`, `data:`, `vbscript:`, `file:` tertolak oleh daftar skema, bukan oleh pencocokan
 * kata — jadi selubung seperti `JaVaScRiPt:` atau `java\tscript:` ikut tertolak, karena `URL`
 * sendiri yang menormalkannya sebelum dibandingkan.
 */
export function alamatAman(mentah) {
  const teks = String(mentah ?? '').trim();
  if (!teks) return null;
  let u;
  try {
    u = new URL(teks);
  } catch {
    return null;
  }
  return SKEMA_AMAN.includes(u.protocol) ? u.href : null;
}

/**
 * Siapkan teks mentah: samakan penulisan `<think>`, dan tutup blok nalar yang belum tertutup.
 *
 * Nalar memang DITAMPILKAN di Mametlite (gaya DeepSeek) — ini bukan kebocoran yang perlu
 * disembunyikan. Perilakunya dipertahankan apa adanya dari kode lama, termasuk dua kelonggaran
 * yang sengaja ada supaya nalar tetap terbaca saat jawaban masih mengalir:
 *   - teks yang dimulai "think " / "think\n" tanpa kurung sudut tetap dianggap membuka nalar
 *   - `<think>` tanpa penutup ditutup di `\n\n` pertama, atau di salam bila tak ada baris kosong
 */
export function siapkanNalar(mentah) {
  let teks = String(mentah)
    .replace(/(?:&lt;|<)think(?:&gt;|>)/gi, '<think>')
    .replace(/(?:&lt;|<)\/think(?:&gt;|>)/gi, '</think>');

  const dipangkas = teks.trim().toLowerCase();
  if (dipangkas.startsWith('think ') || dipangkas.startsWith('think\n')) {
    const i = teks.toLowerCase().indexOf('think');
    teks = teks.slice(0, i) + '<think>' + teks.slice(i + 5);
  }

  if (teks.includes('<think>') && !teks.includes('</think>')) {
    let potong = teks.indexOf('\n\n');
    if (potong === -1) {
      const salam = teks.match(
        /(?:\bhalo\b|\bhai\b|\bhi\b|selamat pagi|selamat siang|selamat sore|selamat malam|assalamualaikum)/i,
      );
      if (salam && salam.index > 10) potong = salam.index;
    }
    if (potong !== -1) teks = teks.slice(0, potong) + '</think>\n\n' + teks.slice(potong);
  }

  return teks;
}

// Gambar lebih dulu daripada tautan: `![a](b)` memuat `[a](b)` di dalamnya.
const POLA_INLINE =
  /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|\n/g;

/** Potongan teks biasa, digabung dengan potongan sebelumnya bila bersebelahan. */
function dorongTeks(keluar, isi) {
  if (!isi) return;
  const akhir = keluar[keluar.length - 1];
  if (akhir && akhir.jenis === 'teks') akhir.isi += isi;
  else keluar.push({ jenis: 'teks', isi });
}

/**
 * Urai satu potong teks (tanpa nalar) jadi daftar simpul inline.
 *
 * Jenis simpul: `teks`, `tebal`, `miring`, `tautan`, `gambar`, `baris`.
 * Tidak ada simpul yang memuat HTML. Alamat yang tidak lolos `alamatAman` jatuh jadi `teks`
 * berisi tulisan Markdown aslinya — supaya penolakannya TERLIHAT, bukan senyap.
 */
export function uraikanInline(teks) {
  const keluar = [];
  let akhirSebelumnya = 0;
  POLA_INLINE.lastIndex = 0;

  for (let m; (m = POLA_INLINE.exec(teks)) !== null; ) {
    dorongTeks(keluar, teks.slice(akhirSebelumnya, m.index));
    akhirSebelumnya = m.index + m[0].length;

    const [utuh, altGambar, alamatGambar, teksTautan, alamatTautan, tebal, miring] = m;

    if (alamatGambar !== undefined) {
      const aman = alamatAman(alamatGambar);
      if (aman) keluar.push({ jenis: 'gambar', alamat: aman, alt: altGambar || '' });
      else dorongTeks(keluar, utuh);
    } else if (alamatTautan !== undefined) {
      const aman = alamatAman(alamatTautan);
      if (aman) keluar.push({ jenis: 'tautan', alamat: aman, teks: teksTautan });
      else dorongTeks(keluar, utuh);
    } else if (tebal !== undefined) {
      keluar.push({ jenis: 'tebal', isi: tebal });
    } else if (miring !== undefined) {
      keluar.push({ jenis: 'miring', isi: miring });
    } else {
      keluar.push({ jenis: 'baris' });
    }
  }

  dorongTeks(keluar, teks.slice(akhirSebelumnya));
  return keluar;
}

/**
 * Urai jawaban model jadi daftar simpul tingkat atas.
 *
 * @returns {Array<{jenis: 'nalar', anak: Array} | {jenis: string, [k: string]: any}>}
 *   `nalar` memuat `anak` berisi simpul inline; sisanya simpul inline langsung.
 *   Selalu array — teks kosong menghasilkan `[]`, bukan `null`.
 */
export function uraikanMarkdown(mentah) {
  if (!mentah) return [];
  const teks = siapkanNalar(mentah);
  const keluar = [];
  let akhirSebelumnya = 0;

  const polaNalar = /<think>([\s\S]*?)(?:<\/think>|$)/g;
  for (let m; (m = polaNalar.exec(teks)) !== null; ) {
    keluar.push(...uraikanInline(teks.slice(akhirSebelumnya, m.index)));
    keluar.push({ jenis: 'nalar', anak: uraikanInline(m[1]) });
    akhirSebelumnya = m.index + m[0].length;
    if (polaNalar.lastIndex === m.index) polaNalar.lastIndex++; // jaga-jaga terhadap cocok kosong
  }

  keluar.push(...uraikanInline(teks.slice(akhirSebelumnya)));
  return keluar;
}
