// Pencarian berita + pembacaan isi artikel untuk sub-agent researcher dan deep_research (2026-09-15, Pilihan A Item 82).
//
// Mengganti DuckDuckGo Lite yang dari server Supabase selalu kosong. Mesinnya sama dengan tool web desktop
// (WebComparisonService.js): Bing News RSS → Google News RSS (id, lalu en-US).
//
// Isi artikel diambil LANGSUNG dari situs beritanya lalu disaring ke paragraf <p>, bukan lewat r.jina.ai:
// uji dari komputer Owner, Kompas langsung 0,5–0,8 detik dengan teks bersih, sedangkan r.jina.ai 5–8,5 detik
// berisi menu situs — tidak muat anggaran 12 detik sub-agent. Tautan Google News (redirect JS) dan MSN (isi dimuat
// JavaScript) tidak bisa dibaca dengan cara ini, jadi dilewati; hasilnya tetap dipakai sebagai cuplikan.

export type HasilBerita = {
  title: string;
  link: string;
  snippet: string;
  sumber: string;
  tanggal: string;
  penyedia: string;
};

export type ArtikelTerbaca = { url: string; title: string; teks: string; ms: number };

type OpsiFetch = { fetchFn?: typeof fetch; signal?: AbortSignal };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const DOMAIN_TAK_TERBACA = ['msn.com', 'news.google.com', 'youtube.com', 'youtu.be'];
const MIN_HURUF_ARTIKEL = 300;

const PENYEDIA = [
  { nama: 'Bing News', url: (q: string) => `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss` },
  { nama: 'Google News ID', url: (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id` },
  { nama: 'Google News EN', url: (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en` },
];

/** Sinyal yang batal karena batas waktu ATAU karena sinyal induk (timeout sub-agent) batal. */
function sinyalBerbatas(batasMs: number, induk?: AbortSignal) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error(`batas ${batasMs} ms`)), batasMs);
  if (induk) {
    if (induk.aborted) ctrl.abort(induk.reason);
    else induk.addEventListener('abort', () => ctrl.abort(induk.reason), { once: true });
  }
  return { signal: ctrl.signal, lepas: () => clearTimeout(t) };
}

function entitas(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

// Deskripsi Google News berisi HTML yang dikodekan dua kali (&amp;nbsp;), jadi &nbsp; bisa tersisa setelah entitas().
const tanpaTag = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function domainDariUrl(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** Tautan Bing RSS berupa bing.com/news/apiclick.aspx?...&url=<asli>; ambil URL situs aslinya. */
export function urlAsliBing(link: string): string {
  try {
    const u = new URL(link);
    if (u.hostname.endsWith('bing.com') && u.pathname.toLowerCase().includes('apiclick')) {
      return u.searchParams.get('url') || link;
    }
  } catch { /* bukan URL, kembalikan apa adanya */ }
  return link;
}

export function uraiRss(xml: string, penyedia: string, maks = 8): HasilBerita[] {
  const hasil: HasilBerita[] = [];
  const pola = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = pola.exec(xml)) !== null && hasil.length < maks) {
    const item = m[1];
    const ambil = (re: RegExp) => entitas(item.match(re)?.[1] || '');
    const title = tanpaTag(ambil(/<title>([\s\S]*?)<\/title>/i));
    const link = urlAsliBing(ambil(/<link>([\s\S]*?)<\/link>/i).trim());
    const snippet = tanpaTag(ambil(/<description>([\s\S]*?)<\/description>/i));
    const sumber = tanpaTag(ambil(/<News:Source>([\s\S]*?)<\/News:Source>/i) || ambil(/<source[^>]*>([\s\S]*?)<\/source>/i));
    const tanggal = ambil(/<pubDate>([\s\S]*?)<\/pubDate>/i).trim();
    if (title && link) hasil.push({ title, link, snippet: snippet || title, sumber, tanggal, penyedia });
  }
  return hasil;
}

/**
 * Tugas dari Coordinator sering berupa kalimat perintah; RSS lebih cocok dengan kata kunci. Uji live 2026-09-15:
 * "Cari informasi dan susun laporan tentang 3 perusahaan AI terbesar pada tahun 2026" → Bing 0 hasil, sedangkan
 * "3 perusahaan AI terbesar 2026" → 5–8 hasil.
 */
export function ringkasKueri(q: string): string {
  return q
    .replace(/[“”"'`?!.,:;()\[\]]/g, ' ')
    .replace(/\b(tolong|mohon|lakukan|carikan|cari|temukan|riset|risetkan|telusuri|susun|susunkan|buat|buatkan|laporan|analisis|analisa|mendalam|lengkap|detail|informasi|info|data|berita|tentang|mengenai|terkait|seputar|apa|siapa|saja|dan|yang|pada|tahun|untuk|dengan|secara|di|ke|dari)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 8)
    .join(' ');
}

/**
 * Cari berita. Kembali pada percobaan pertama yang memberi hasil. `catatan` berisi status HTTP, jumlah hasil, dan
 * lama tiap percobaan agar kegagalan terlihat di log (kekurangan searchDuckDuckGo lama).
 *
 * Urutan (uji live 2026-09-15): Bing dengan kata kunci → Bing dengan kalimat asli → Google News ID/EN dengan kata
 * kunci. Bing dari server menjawab 0,3–2 detik; Google News dari server sempat melewati batas 4 detik, jadi cadangan.
 */
export async function cariBerita(
  query: string,
  opsi: OpsiFetch & { batasPerPermintaanMs?: number; batasTotalMs?: number; maks?: number; kueriLain?: string[] } = {},
): Promise<{ hasil: HasilBerita[]; penyedia: string | null; kueri: string; catatan: string[] }> {
  const fetchFn = opsi.fetchFn || fetch;
  const batasPer = opsi.batasPerPermintaanMs ?? 3500;
  const maks = opsi.maks ?? 8;
  const tenggat = Date.now() + (opsi.batasTotalMs ?? 7000);
  const catatan: string[] = [];
  const penuh = query.trim();
  // `kueriLain` (pesan asli pengguna) didahulukan: Coordinator sering memperluas tugas ("…berdasarkan pendapatan,
  // valuasi, atau pangsa pasar") sehingga Bing hanya memberi 1–2 hasil (live v442), sedangkan pertanyaan asli 4–8.
  const kataKunci = [...new Set([...(opsi.kueriLain || []), query].map(ringkasKueri).filter((k) => k.length >= 2))];
  if (kataKunci.length === 0) kataKunci.push(penuh);
  const [bing, googleId, googleEn] = PENYEDIA;

  const coba = async (p: typeof bing, kueri: string): Promise<HasilBerita[]> => {
    const sisa = tenggat - Date.now();
    if (sisa < 300 || opsi.signal?.aborted) {
      catatan.push(`${p.nama} "${kueri}" dilewati: waktu pencarian habis`);
      return [];
    }
    const mulai = Date.now();
    const { signal, lepas } = sinyalBerbatas(Math.min(batasPer, sisa), opsi.signal);
    try {
      const res = await fetchFn(p.url(kueri), { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' }, signal });
      const xml = res.ok ? await res.text() : '';
      const hasil = uraiRss(xml, p.nama, maks);
      catatan.push(`${p.nama} "${kueri}" HTTP ${res.status} ${hasil.length} hasil ${Date.now() - mulai} ms`);
      return hasil;
    } catch (e: any) {
      catatan.push(`${p.nama} "${kueri}" gagal ${Date.now() - mulai} ms: ${String(e?.message || e).slice(0, 80)}`);
      return [];
    } finally {
      lepas();
    }
  };

  // 1. Bing untuk semua kata kunci sekaligus (paralel), hasil digabung bergiliran tanpa duplikat.
  const gabung = gabungHasil(await Promise.all(kataKunci.map((k) => coba(bing, k))), maks);
  if (gabung.length > 0) return { hasil: gabung, penyedia: bing.nama, kueri: kataKunci.join(' | '), catatan };

  // 2. Bing dengan kalimat tugas apa adanya, lalu Google News ID/EN (dari server lebih lambat, jadi cadangan).
  const cadangan = [
    ...(penuh && !kataKunci.includes(penuh) ? [{ p: bing, kueri: penuh }] : []),
    { p: googleId, kueri: kataKunci[0] },
    { p: googleEn, kueri: kataKunci[0] },
  ];
  for (const { p, kueri } of cadangan) {
    const hasil = await coba(p, kueri);
    if (hasil.length > 0) return { hasil, penyedia: p.nama, kueri, catatan };
  }
  return { hasil: [], penyedia: null, kueri: kataKunci[0], catatan };
}

/** Gabung beberapa daftar hasil secara bergiliran (peringkat teratas tiap kueri lebih dulu), tanpa tautan ganda. */
export function gabungHasil(daftar: HasilBerita[][], maks = 8): HasilBerita[] {
  const hasil: HasilBerita[] = [];
  const terlihat = new Set<string>();
  const panjang = Math.max(0, ...daftar.map((d) => d.length));
  for (let i = 0; i < panjang && hasil.length < maks; i++) {
    for (const d of daftar) {
      const h = d[i];
      if (h && !terlihat.has(h.link) && hasil.length < maks) {
        terlihat.add(h.link);
        hasil.push(h);
      }
    }
  }
  return hasil;
}

/**
 * Paragraf panjang tanpa tanda baca adalah menu/daftar tautan, bukan prosa. Liputan6 menaruh seluruh menu situs
 * (±1.400 huruf) dalam satu <p>, sehingga jatah huruf habis sebelum isi berita (live v442). Prosa berita punya
 * ±1–3 tanda baca per 100 huruf; menu itu ±0,1.
 */
function sepertiProsa(p: string): boolean {
  if (p.length < 200) return true;
  const tanda = (p.match(/[.,!?;]/g) || []).length;
  return (tanda / p.length) * 100 >= 0.5;
}

/** Teks artikel = paragraf <p> berprosa yang cukup panjang; isi <article> didahulukan bila ada. */
export function ambilParagraf(html: string): string {
  const bersih = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, '');
  const saring = (potongan: string) => {
    const terlihat = new Set<string>();
    // `<p(?:\s[^>]*)?>` — bukan `<p[^>]*>` yang ikut menangkap <path>/<picture>; atribut ber-JavaScript di dalamnya
    // (mis. `x-on:click="… => …"`) membawa kode ke teks (live: inet.detik.com).
    return (potongan.match(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi) || [])
      .map((p) => tanpaTag(entitas(p.replace(/<[^>]+>/g, ' '))))
      .filter((p) => p.length >= 60 && sepertiProsa(p) && !/=>|[{}]|\(\)\s*;?/.test(p) && !terlihat.has(p) && terlihat.add(p))
      .join('\n');
  };
  // Situs berita menaruh isi di <article>; menu dan daftar berita lain berada di luarnya.
  const dariArtikel = (bersih.match(/<article\b[\s\S]*?<\/article>/gi) || [])
    .map(saring)
    .sort((a, b) => b.length - a.length)[0] || '';
  return dariArtikel.length >= MIN_HURUF_ARTIKEL ? dariArtikel : saring(bersih);
}

export async function bacaArtikel(
  url: string,
  opsi: OpsiFetch & { batasMs?: number; maksHuruf?: number } = {},
): Promise<{ ok: true; artikel: ArtikelTerbaca } | { ok: false; alasan: string }> {
  const domain = domainDariUrl(url);
  if (!domain) return { ok: false, alasan: 'URL tidak sah' };
  if (DOMAIN_TAK_TERBACA.some((d) => domain === d || domain.endsWith('.' + d))) return { ok: false, alasan: `${domain} dilewati` };
  const mulai = Date.now();
  const { signal, lepas } = sinyalBerbatas(opsi.batasMs ?? 4000, opsi.signal);
  try {
    const res = await (opsi.fetchFn || fetch)(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8', Accept: 'text/html' }, redirect: 'follow', signal });
    if (!res.ok) return { ok: false, alasan: `${domain} HTTP ${res.status}` };
    const jenis = res.headers.get('content-type') || '';
    if (jenis && !jenis.includes('html')) return { ok: false, alasan: `${domain} bukan HTML (${jenis})` };
    const html = await res.text();
    const teks = ambilParagraf(html);
    if (teks.length < MIN_HURUF_ARTIKEL) return { ok: false, alasan: `${domain} isi terlalu pendek (${teks.length} huruf)` };
    const title = tanpaTag(entitas(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''));
    return { ok: true, artikel: { url, title, teks: teks.slice(0, opsi.maksHuruf ?? 3000), ms: Date.now() - mulai } };
  } catch (e: any) {
    return { ok: false, alasan: `${domain} gagal ${Date.now() - mulai} ms: ${String(e?.message || e).slice(0, 80)}` };
  } finally {
    lepas();
  }
}

/**
 * Baca beberapa artikel teratas secara paralel. `kandidat` > `jumlah` agar situs yang gagal/tak terbaca diganti
 * artikel berikutnya tanpa menunggu giliran. Urutan hasil tetap mengikuti peringkat pencarian.
 */
export async function bacaBeberapaArtikel(
  hasil: HasilBerita[],
  opsi: OpsiFetch & { jumlah?: number; kandidat?: number; batasMs?: number; maksHuruf?: number } = {},
): Promise<{ artikel: (ArtikelTerbaca & { nomor: number })[]; catatan: string[] }> {
  const kandidat = hasil
    .map((h, i) => ({ h, nomor: i + 1 }))
    .filter(({ h }) => !DOMAIN_TAK_TERBACA.some((d) => domainDariUrl(h.link).endsWith(d)))
    .slice(0, opsi.kandidat ?? 3);
  const bacaan = await Promise.all(kandidat.map(({ h }) => bacaArtikel(h.link, opsi)));
  const artikel: (ArtikelTerbaca & { nomor: number })[] = [];
  const catatan: string[] = [];
  bacaan.forEach((b, i) => {
    if (b.ok) {
      catatan.push(`[${kandidat[i].nomor}] ${domainDariUrl(b.artikel.url)} ${b.artikel.teks.length} huruf ${b.artikel.ms} ms`);
      if (artikel.length < (opsi.jumlah ?? 2)) artikel.push({ ...b.artikel, title: kandidat[i].h.title || b.artikel.title, nomor: kandidat[i].nomor });
    } else {
      catatan.push(`[${kandidat[i].nomor}] ${b.alasan}`);
    }
  });
  if (kandidat.length === 0) catatan.push('tidak ada tautan yang bisa dibaca langsung');
  return { artikel, catatan };
}

/** Daftar hasil bernomor untuk prompt, dengan isi artikel yang berhasil dibaca di bawahnya. */
export function susunDataPencarian(hasil: HasilBerita[], artikel: (ArtikelTerbaca & { nomor: number })[], maksHasil = 6): string {
  const daftar = hasil.slice(0, maksHasil).map((h, i) =>
    `[${i + 1}] ${h.title}\nSumber: ${[h.sumber || domainDariUrl(h.link), h.tanggal].filter(Boolean).join(', ')}\nURL: ${h.link}\nCuplikan: ${h.snippet}`,
  ).join('\n\n');
  const isi = artikel.length > 0
    ? artikel.map((a) => `--- ISI ARTIKEL [${a.nomor}] ${a.url} ---\n${a.teks}`).join('\n\n')
    : '(Tidak ada artikel yang berhasil dibaca; hanya cuplikan di atas yang tersedia.)';
  return `Hasil pencarian:\n${daftar}\n\nIsi artikel yang dibaca:\n${isi}`;
}
