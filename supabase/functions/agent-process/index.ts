import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { executeRequestPipeline } from './lib/request/request_pipeline.ts';
import { coreEngine } from './lib/orchestration/core_engine.ts';
import { streamController } from './lib/streaming/stream_controller.ts';
import { corsHeaders } from './lib/stream_handler.ts';
import { pingHeartbeat } from './lib/adapters/heartbeat.ts';
import { handleEmbedRequest } from './lib/request/embed_endpoint.ts';
import { handleJudgeConflictRequest } from './lib/request/judge_endpoint.ts';
import { handlePadatkanRequest } from './lib/request/padatkan_endpoint.ts';
import { handleProxyFetchRequest } from './lib/request/proxy_fetch_endpoint.ts';
import { handleRagAlatRequest } from './lib/request/rag_alat_endpoint.ts';

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY'
];

const DEPLOYED_COMMIT_SHA = Deno.env.get('DEPLOYED_COMMIT_SHA') || 'unknown';
const DEPLOYED_BRANCH = Deno.env.get('DEPLOYED_BRANCH') || 'unknown';
const DEPLOYED_AT = Deno.env.get('DEPLOYED_AT') || null;

const WAKTU_BOOT_WORKER = Date.now();

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
  const mulaiPermintaan = Date.now();
  try {
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

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method === 'POST') {
      const clonedReq = req.clone();

      let parsedBody: any = null;
      try {
        parsedBody = await clonedReq.json();
      } catch (_) {
        parsedBody = null;
      }

      if (parsedBody) {
        const embedResponse = await handleEmbedRequest(req, parsedBody, corsHeaders);
        if (embedResponse) return embedResponse;

        const judgeResponse = await handleJudgeConflictRequest(req, parsedBody, corsHeaders);
        if (judgeResponse) return judgeResponse;

        const padatkanResponse = await handlePadatkanRequest(req, parsedBody, corsHeaders);
        if (padatkanResponse) return padatkanResponse;

        const proxyResponse = await handleProxyFetchRequest(req, parsedBody, corsHeaders);
        if (proxyResponse) return proxyResponse;

        const ragAlatResponse = await handleRagAlatRequest(req, parsedBody, corsHeaders);
        if (ragAlatResponse) return ragAlatResponse;
      }
    }


    const pipelineResult = await executeRequestPipeline({ request: req, corsHeaders });
    if (pipelineResult.response) return pipelineResult.response;

    const { ctx, rctx } = pipelineResult;
    rctx.stream.mulaiPermintaan = mulaiPermintaan;
    console.log(`[BATAS_WAKTU] permintaan diterima; umur worker ${mulaiPermintaan - WAKTU_BOOT_WORKER} ms`);

    if (rctx.stream?.streamNalar) {
      const encoder = new TextEncoder();
      const aliran = new ReadableStream({
        async start(controller) {
          let tertutup = false;
          const tulis = (teks: string) => { if (tertutup) return; try { controller.enqueue(encoder.encode(teks)); } catch (_) {  } };
          const kirim = (obj: any) => tulis(`data: ${JSON.stringify(obj)}\n\n`);
          const detak = setInterval(() => tulis(': detak\n\n'), 10000);
          rctx.stream.kirimNalar = kirim;
          try {
            const engineResult = await coreEngine.execute(ctx, rctx);
            await rctx.tasks.awaitAll();
            await pingHeartbeat('agent-process', 'HEALTHY');
            const res = streamController.pipe(engineResult, rctx);
            const teks = await res.text();
            let data: any;
            try { data = JSON.parse(teks); } catch { data = { message: teks }; }
            kirim({ tipe: 'hasil', status: res.status, data });
          } catch (error: any) {
            console.error('Edge Function Error (hybrid):', error);
            await pingHeartbeat('agent-process', 'DOWN');
            kirim({ tipe: 'galat', pesan: String(error?.message || error) });
          } finally {
            clearInterval(detak);
            tertutup = true;
            try { controller.close(); } catch (_) {  }
          }
        }
      });
      return new Response(aliran, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
    }

    const engineResult = await coreEngine.execute(ctx, rctx);
    
    await rctx.tasks.awaitAll();

    await pingHeartbeat('agent-process', 'HEALTHY');

    return streamController.pipe(engineResult, rctx);

  } catch (error: any) {
    console.error('Edge Function Error:', error);
    await pingHeartbeat('agent-process', 'DOWN');
    
    const errorMessage = String(error.message || '');
    let statusCode = 500;
    
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
