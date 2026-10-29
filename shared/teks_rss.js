/**
 * MODUL BERSAMA — pembersih teks RSS berita, dipakai SERVER (agent-process `lib/web/pencarian_berita.ts`, sub-agent
 * researcher/deep_research) dan KLIEN (`WebComparisonService.js`, web Tier 3). Murni: tanpa impor, tanpa I/O.
 *
 * Dipindahkan dari `pencarian_berita.ts` (15 Sep 2026) pada 29 Okt 2026 — aturannya sama persis; hanya ditambah
 * `String(s || '')` karena klien tak bertipe (masukan kosong → ''). Klien dulu punya pengurai sendiri
 * yang lebih lemah — uji live 29 Okt: URL sumber yang sampai ke model berupa tautan pengalih Bing
 * (`bing.com/news/apiclick.aspx?…&amp;…`), bukan alamat situs beritanya; dan tag HTML deskripsi Google News (dikodekan)
 * baru terurai SESUDAH tag dibuang, sehingga ikut ke cuplikan. Uji: uji/uji-kueri-pencarian.mjs, uji/uji-shared-t15.mjs.
 */

/** Entitas HTML & CDATA → teks. `&amp;` terakhir, agar "&amp;lt;" tidak terurai dua kali. */
export function entitas(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

/** Tag dibuang, spasi dirapikan. Deskripsi Google News dikodekan dua kali (&amp;nbsp;), jadi &nbsp; bisa tersisa setelah entitas(). */
export function tanpaTag(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Tautan Bing RSS berupa bing.com/news/apiclick.aspx?...&url=<asli>; ambil URL situs aslinya. */
export function urlAsliBing(link) {
  try {
    const u = new URL(link);
    if (u.hostname.endsWith('bing.com') && u.pathname.toLowerCase().includes('apiclick')) {
      return u.searchParams.get('url') || link;
    }
  } catch { /* bukan URL, kembalikan apa adanya */ }
  return link;
}
