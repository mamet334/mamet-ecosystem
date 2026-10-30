import { handleAuth } from './auth_middleware.ts';
import { alamatBolehDiambil, ambilAman, AlamatDitolakError } from '../web/alamat_publik.ts';

// Pagar alamat pindah ke modul bersama (30 Okt 2026) — dipakai juga `communicator` & `scraper`.
export { alamatBolehDiambil };

/**
 * PROXY FETCH — `{ action: 'proxy_fetch', url }`: server mengambilkan RSS/halaman untuk web Tier 3 di versi web
 * (`WebComparisonService._safeFetch`), karena peramban terhalang CORS.
 *
 * K5 (ADR-0022, 30 Okt 2026): dulu blok ini berada langsung di `index.ts` dan berjalan SEBELUM pemeriksaan token apa
 * pun — fungsi di-deploy `--no-verify-jwt`, jadi siapa pun di internet bisa memakai server sebagai proksi gratis
 * (terbukti live 29 Okt: tanpa token, `example.com` diambilkan). Pemanggil sahnya selalu membawa token pengguna
 * (`supabase.functions.invoke`), jadi kini token WAJIB — pola yang sama dengan `embed_endpoint.ts`.
 * Ditambah: hanya http/https ke alamat publik (bukan localhost, jaringan privat, atau metadata 169.254.x — SSRF).
 */

const BATAS_MS = 12000;

const jawab = (isi: unknown, corsHeaders: HeadersInit) =>
  new Response(JSON.stringify(isi), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

export async function handleProxyFetchRequest(
  request: Request,
  body: any,
  corsHeaders: HeadersInit,
  fetchFn: typeof fetch = fetch,
): Promise<Response | null> {
  if (body?.action !== 'proxy_fetch' || !body?.url) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const { authErrorResponse } = await handleAuth(request, supabaseUrl, supabaseAnonKey, corsHeaders);
  if (authErrorResponse) {
    console.warn('[ProxyFetch] ⛔ Ditolak — token tidak sah atau tidak ada.');
    return authErrorResponse;
  }

  const targetUrl = String(body.url);
  if (!alamatBolehDiambil(targetUrl)) {
    console.warn(`[ProxyFetch] ⛔ Alamat ditolak (bukan http/https publik): ${targetUrl.slice(0, 120)}`);
    return new Response(JSON.stringify({ ok: false, status: 400, error: 'Alamat tidak diizinkan.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[ProxyFetch] Server-side fetching external URL: ${targetUrl}`);
  try {
    // ambilAman: tujuan setiap pengalihan ikut diperiksa (dulu `fetch` mengikutinya tanpa cek).
    const fetchRes = await ambilAman(targetUrl, {
      signal: AbortSignal.timeout(BATAS_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    }, fetchFn);
    const content = await fetchRes.text();
    const isOk = fetchRes.ok || (content.includes('<item>') || content.includes('<rss') || content.includes('<feed'));
    console.log(`[ProxyFetch] Fetch done: status=${fetchRes.status}, length=${content.length}, isOk=${isOk}`);
    return jawab({ ok: isOk, status: isOk ? 200 : fetchRes.status, data: content }, corsHeaders);
  } catch (fetchErr: any) {
    if (fetchErr instanceof AlamatDitolakError) {
      console.warn(`[ProxyFetch] ⛔ Pengalihan ke alamat terlarang ditolak: ${fetchErr.alamat.slice(0, 120)}`);
      return new Response(JSON.stringify({ ok: false, status: 400, error: 'Alamat tidak diizinkan.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.error('[ProxyFetch] Error:', fetchErr.message);
    return jawab({ ok: false, status: 500, error: fetchErr.message }, corsHeaders);
  }
}
