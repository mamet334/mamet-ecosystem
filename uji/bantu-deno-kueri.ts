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
