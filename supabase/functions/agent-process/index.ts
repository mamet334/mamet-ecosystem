import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { executeRequestPipeline } from './lib/request/request_pipeline.ts';
import { coreEngine } from './lib/orchestration/core_engine.ts';
import { streamController } from './lib/streaming/stream_controller.ts';
import { corsHeaders } from './lib/stream_handler.ts';
import { pingHeartbeat } from './lib/adapters/heartbeat.ts';
import { handleEmbedRequest } from './lib/request/embed_endpoint.ts';

// PRIORITY 2: ENVIRONMENT VALIDATION (STARTUP)
const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY'
];

// DEPLOYMENT DRIFT DETECTION: Metadata commit di-set via `supabase secrets set`
// oleh script deploy (lihat scripts/deploy-agent-process.ps1), bukan file statis,
// agar tidak terikat pada satu mekanisme deploy (CLI atau MCP tool).
const DEPLOYED_COMMIT_SHA = Deno.env.get('DEPLOYED_COMMIT_SHA') || 'unknown';
const DEPLOYED_BRANCH = Deno.env.get('DEPLOYED_BRANCH') || 'unknown';
const DEPLOYED_AT = Deno.env.get('DEPLOYED_AT') || null;

let envValidationStatus = 'OK';
let missingEnvs: string[] = [];

try {
  missingEnvs = REQUIRED_ENV_VARS.filter(key => !Deno.env.get(key));
  if (missingEnvs.length > 0) {
    envValidationStatus = 'DEGRADED';
    console.error(`[ENV_VALIDATOR] Missing critical environment variables: ${missingEnvs.join(', ')}`);
  }
} catch(e) {
  envValidationStatus = 'ERROR';
}

serve(async (req) => {
  try {
    // PRIORITY 2: DEEP HEALTH CHECK SYSTEM
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname.endsWith('/health')) {
      const healthReport = {
         status: envValidationStatus === 'OK' ? 'HEALTHY' : envValidationStatus,
         timestamp: new Date().toISOString(),
         missing_env: missingEnvs,
         deployed_commit_sha: DEPLOYED_COMMIT_SHA,
         deployed_branch: DEPLOYED_BRANCH,
         deployed_at: DEPLOYED_AT,
         services: {
            backend: 'UP',
            edge_function: 'UP',
            database: Deno.env.get('SUPABASE_URL') ? 'CONFIGURED' : 'MISSING_URL',
            llm_provider: (Deno.env.get('GEMINI_API_KEY') || Deno.env.get('OPENROUTER_API_KEY') || Deno.env.get('GROQ_API_KEY')) ? 'CONFIGURED' : 'MISSING',
         }
      };

      if (healthReport.status === 'HEALTHY') {
        await pingHeartbeat('agent-process', 'HEALTHY');
      }

      return new Response(JSON.stringify(healthReport), {
        status: envValidationStatus === 'OK' ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-deployed-commit-sha': DEPLOYED_COMMIT_SHA },
      });
    }

    // Handle CORS for OPTIONS
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // TIER 3 WEB PROXY BRIDGE: Membantu client Web/Vercel melakukan fetch URL tanpa kendala CORS browser
    if (req.method === 'POST') {
      const clonedReq = req.clone();

      // Body di-parse SEKALI di luar blok penelan galat di bawah.
      //
      // Blok `try { ... } catch (_) { /* lanjut */ }` yang lama menelan SEMUA
      // galat, bukan hanya kegagalan parse JSON. Menaruh penanganan action baru
      // di dalamnya berarti setiap galat di dalamnya akan diam-diam jatuh ke
      // pipeline chat — pemanggil menerima jawaban chat untuk permintaan
      // embedding, tanpa satu pun pesan galat. Pola yang sama yang melahirkan
      // Item 46. Jadi parse-nya dipisahkan, dan hanya kegagalan parse yang boleh
      // diabaikan diam-diam.
      let parsedBody: any = null;
      try {
        parsedBody = await clonedReq.json();
      } catch (_) {
        parsedBody = null; // Bukan JSON — lanjutkan ke pipeline normal.
      }

      // ENDPOINT EMBEDDING (Item 46) — `{ action: 'embed', text }`.
      // Di luar penelan galat: kalau ia gagal, kegagalannya harus terdengar.
      // Penjagaan JWT-nya ada di dalam handleEmbedRequest, WAJIB karena fungsi
      // ini di-deploy dengan --no-verify-jwt.
      if (parsedBody) {
        const embedResponse = await handleEmbedRequest(req, parsedBody, corsHeaders);
        if (embedResponse) return embedResponse;
      }

      try {
        const body = parsedBody || {};
        if (body?.action === 'proxy_fetch' && body?.url) {
          const targetUrl = body.url;
          console.log(`[ProxyFetch] Server-side fetching external URL: ${targetUrl}`);
          try {
            const fetchRes = await fetch(targetUrl, {
              signal: AbortSignal.timeout(12000),
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
            const content = await fetchRes.text();
            const isOk = fetchRes.ok || (content.includes('<item>') || content.includes('<rss') || content.includes('<feed'));
            console.log(`[ProxyFetch] Fetch done: status=${fetchRes.status}, length=${content.length}, isOk=${isOk}`);
            return new Response(JSON.stringify({
              ok: isOk,
              status: isOk ? 200 : fetchRes.status,
              data: content
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

          } catch (fetchErr: any) {
            console.error('[ProxyFetch] Error:', fetchErr.message);
            return new Response(JSON.stringify({
              ok: false,
              status: 500,
              error: fetchErr.message
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

        }
      } catch (_) {
        // Bukan JSON body atau bukan proxy_fetch, lanjutkan ke pipeline normal
      }
    }


    const pipelineResult = await executeRequestPipeline({ request: req, corsHeaders });
    if (pipelineResult.response) return pipelineResult.response;

    const { ctx, rctx } = pipelineResult;

    // --- EXECUTE ORCHESTRATION ---
    const engineResult = await coreEngine.execute(ctx, rctx);
    
    // --- POST EXECUTION GUARANTEES ---
    await rctx.tasks.awaitAll();

    // === TAMBAHAN: Update heartbeat HEALTHY setiap kali request sukses ===
    await pingHeartbeat('agent-process', 'HEALTHY');

    // --- STREAMING OR RESPONSE LAYER ---
    return streamController.pipe(engineResult, rctx);

  } catch (error: any) {
    console.error('Edge Function Error:', error);
    await pingHeartbeat('agent-process', 'DOWN');
    
    // Determine appropriate status code
    const errorMessage = String(error.message || '');
    let statusCode = 500;
    
    // Provider/LLM errors should return 400 (client error) rather than 500 (server error)
    if (errorMessage.includes('Provider') || errorMessage.includes('failed') || errorMessage.includes('not available')) {
      statusCode = 400;
    }
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
