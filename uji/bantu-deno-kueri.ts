// Pembantu uji-kueri-pencarian.mjs (bukan berkas uji — namanya tidak diawali "uji-"), dijalankan dengan Deno:
// membuktikan pencarian_berita.ts (server, Deno) memuat shared/kueri_pencarian.js lewat impor relatifnya dan
// cariBerita() mengirim kata kunci hasil aturan bersama ke Bing. fetch tiruan — tanpa jaringan.
// 29 Okt: juga mengurai contoh RSS (argumen ke-2) dengan uraiRss server — pembanding parser klien (shared/teks_rss.js) —
// dan meringkas contoh ADR-0021 (lookbehind "soal" harus jalan di Deno juga).
const akar = Deno.args[0];
const rss = Deno.args[1] || '';
const { cariBerita, uraiRss } = await import(`file:///${akar}/supabase/functions/agent-process/lib/web/pencarian_berita.ts`);
const { ringkasKueri } = await import(`file:///${akar}/shared/kueri_pencarian.js`);
const diminta: string[] = [];
const fetchFn = async (url: string) => { diminta.push(String(url)); return new Response('<rss></rss>', { status: 200 }); };
const q = 'Cari informasi dan susun laporan tentang 3 perusahaan AI terbesar pada tahun 2026';
await cariBerita(q, { fetchFn, batasTotalMs: 2000 });
const pertama = decodeURIComponent((diminta[0] || '').match(/[?&]q=([^&]+)/)?.[1] || '').replace(/\+/g, ' ');
console.log(JSON.stringify({
  deno: Deno.version.deno, permintaanPertama: pertama, aturanBersama: ringkasKueri(q),
  kueriAdr: ringkasKueri('tolong carikan berita terbaru soal OKU dong'), urai: rss ? uraiRss(rss, 'uji') : [],
}));
