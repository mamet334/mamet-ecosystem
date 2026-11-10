import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { handleAuth } from './auth_middleware.ts';
import { createBackgroundTaskTracker, createRuntimeLogger, type RuntimeContext } from '../runtime_context.ts';
import { generateEmbedding, EMBEDDING_DIMENSIONS, kalimatSebabEmbedding, type JejakEmbedding } from '../rag/embedding.ts';
import { searchDocuments } from '../rag/document_search.ts';
import { cariSpaceEngineer } from '../rag/routing_decider.ts';
import { jalankanAlatRag, TANPA_SPACE_ENGINEER } from '../rag/alat_rag.ts';
import { MAKS_ALAT_RAG_PER_PUTARAN } from '../../../../../shared/ragAlat.js';

export const AMBANG_CARI_ALAT = 0.55;

export async function handleRagAlatRequest(request: Request, body: any, corsHeaders: HeadersInit): Promise<Response | null> {
  if (body?.action !== 'rag_alat') return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const { user, authErrorResponse } = await handleAuth(request, supabaseUrl, supabaseAnonKey, corsHeaders);
  if (authErrorResponse) return authErrorResponse;

  const mentah = Array.isArray(body?.permintaan) ? body.permintaan : [];
  if (!mentah.length) return jawab({ error: 'PERMINTAAN_KOSONG', message: 'Tidak ada permintaan alat RAG.' }, 400, corsHeaders);
  const permintaan = mentah.slice(0, MAKS_ALAT_RAG_PER_PUTARAN);
  const engineer = body?.mode === 'ENGINEER';

  const traceId = crypto.randomUUID();
  const tasks = createBackgroundTaskTracker(traceId);
  const runtimeEnv = { supabaseUrl, supabaseServiceKey, supabaseAnonKey, apifyApiToken: '', enableAsyncMemoryWrite: false };
  const rctx = {
    traceId,
    keys: { gemini: '', allGemini: [], groq: '', openAI: '', openRouterByok: (request.headers.get('x-byok-openrouter') || '').replace(/[^\x00-\x7F]/g, '').trim() },
    model: { model: '', provider: 'openrouter', thinking: false },
    policy: {},
    stream: { isStream: false, desktopOSMode: false, auditMode: 'OFF' },
    env: runtimeEnv,
    logger: createRuntimeLogger(user.id, tasks, false, runtimeEnv),
    userId: user.id,
    state: { explicitModelErrors: '' },
    tasks,
  } as unknown as RuntimeContext;

  const db = createClient(supabaseUrl, supabaseServiceKey);
  const spaceTerkunci = engineer ? ((await cariSpaceEngineer(user.id, rctx)) ?? TANPA_SPACE_ENGINEER) : null;
  const dependensi = {
    db,
    userId: user.id,
    spaceTerkunci,
    ambang: AMBANG_CARI_ALAT,
    vektorKueri: async (kueri: string) => {
      const jejak: JejakEmbedding = {};
      const vektor = await generateEmbedding(kueri, rctx, jejak);
      return vektor.length === EMBEDDING_DIMENSIONS ? { vektor } : { vektor: [], sebab: kalimatSebabEmbedding(jejak) };
    },
    cariMakna: (vektor: number[], kueri: string, spaceId: string | null, jumlah: number) => searchDocuments(
      vektor, kueri, AMBANG_CARI_ALAT, jumlah,
      spaceId ? { scope: 'WORKSPACE', workspace_id: spaceId, reason_code: 'ALAT_RAG' } : { scope: 'CORE', workspace_id: null, reason_code: 'ALAT_RAG' },
      user.id, rctx,
    ),
  };

  const hasil = [];
  for (const p of permintaan) {
    const mulai = Date.now();
    const h = await jalankanAlatRag(p, dependensi);
    console.log(`[RagAlat] ${h.alat ?? '?'} ${h.ok ? 'ok' : 'GAGAL'} ${Date.now() - mulai} ms${engineer ? ' (Engineer)' : ''}`);
    hasil.push(h);
  }
  await tasks.awaitAll();
  return jawab({ hasil, diabaikan: mentah.length - permintaan.length }, 200, corsHeaders);
}

function jawab(isi: unknown, status: number, corsHeaders: HeadersInit): Response {
  return new Response(JSON.stringify(isi), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
