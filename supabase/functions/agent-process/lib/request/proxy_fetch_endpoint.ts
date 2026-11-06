import { handleAuth } from './auth_middleware.ts';
import { alamatBolehDiambil, ambilAman, AlamatDitolakError } from '../web/alamat_publik.ts';

export { alamatBolehDiambil };


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
