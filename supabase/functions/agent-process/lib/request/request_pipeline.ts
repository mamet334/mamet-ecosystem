import { handleCorsAndOptions } from './cors_middleware.ts';
import { handleAuth } from './auth_middleware.ts';
import { checkQuota } from './quota_middleware.ts';
import { saringAlatMenurutKemampuan } from './policy_middleware.ts';
import { parseRequestParams } from './request_parser.ts';
import { buildUnifiedExecutionContext } from './execution_context.ts';
import { UnifiedExecutionContext, RequestPipelineParams, RequestPipelineResult } from './types.ts';
import { RuntimeContext, createBackgroundTaskTracker, createRuntimeLogger } from '../runtime_context.ts';
import { getPluginPromptList } from '../../plugins/registry.ts';
import { CapabilityRegistry } from '../adapters/adapter_registry.ts';
import { generateEmbedding, EMBEDDING_DIMENSIONS, kalimatSebabEmbedding, type JejakEmbedding } from '../rag/embedding.ts';
import { siapkanRiwayatUntukModel } from './history_compressor.ts';
import { buatJejak, ukurRiwayat, catatLapis, catatPenolakan, barisLogJejak, catatCatatanJujur } from '../jejak_prompt.ts';
import { catatanModelRiwayatDilewati } from '../catatan_jujur.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { konteksWaktuPengguna, zonaWaktuSah } from './waktu_pengguna.ts';
import { blokPromptFolder } from '../../../../../shared/folderKerjaAlat.js';
import { blokPromptKonektor } from '../../../../../shared/konektorAlat.js';
import { blokPromptKonektorUmum } from '../../../../../shared/konektorUmum.js';
import { blokPromptRag } from '../../../../../shared/ragAlat.js';
import { blokPromptWeb } from '../../../../../shared/webAlat.js';
import { susunPromptDasar, petunjukZip } from './prompt_dasar.ts';


async function generateEmbeddingThroughAdapter(
  text: string,
  rctx: RuntimeContext,
  jejak?: JejakEmbedding,
): Promise<number[]> {
  const embedding = await generateEmbedding(text, rctx, jejak);
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding gagal (didapat ${embedding.length} dimensi, perlu ${EMBEDDING_DIMENSIONS}) — pencarian memori dilewati.`);
  }
  return embedding;
}

export async function executeRequestPipeline(
  params: RequestPipelineParams,
  _rctx?: any 
): Promise<RequestPipelineResult> {
  const { request, corsHeaders } = params;
  
  const corsResponse = handleCorsAndOptions(request, corsHeaders);
  if (corsResponse) return { ctx: {} as any, rctx: {} as any, response: corsResponse };

  const runtimeEnv = {
    supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
    supabaseServiceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY') || '',
    apifyApiToken: Deno.env.get('APIFY_API_TOKEN') || '',
    enableAsyncMemoryWrite: Deno.env.get('ENABLE_ASYNC_MEMORY_WRITE') !== 'false',
    hakimBayangan: Deno.env.get('HAKIM_BAYANGAN') || ''
  };


  const bypassCooldown = request.headers.get('x-bypass-cooldown') === 'true';
  if (bypassCooldown) {
    CapabilityRegistry.clearAllCooldowns();
    console.log("🔓 Cooldowns cleared via x-bypass-cooldown header!");
  }

  const { user, authErrorResponse } = await handleAuth(request, runtimeEnv.supabaseUrl, runtimeEnv.supabaseAnonKey, corsHeaders);
  if (authErrorResponse) return { ctx: {} as any, rctx: {} as any, response: authErrorResponse };

  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
  if (!isValidUUID) {
    console.error('[RequestPipeline] Invalid user.id:', user.id);
    return { ctx: {} as any, rctx: {} as any, response: new Response(JSON.stringify({ error: 'Invalid user ID' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }) };
  }

  const parsed = await parseRequestParams(request, user);

  if (!parsed.finalMessage || !Array.isArray(parsed.tools)) {
      return { ctx: {} as any, rctx: {} as any, response: new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }) };
  }

  const provider = parsed.provider || 'openrouter';
  const providerHeaderKey = `x-byok-${provider}`;
  const byokProviderKey = request.headers.get(providerHeaderKey);
  const providerApiKey = (byokProviderKey || '').trim();

  const finalProvider = providerApiKey ? provider : 'openrouter';
  const finalApiKey = providerApiKey || (request.headers.get('x-byok-openrouter') || '').trim();

  if (parsed.mode === 'ENGINEER' || parsed.appSource === 'engineer') {
    const byokOpenrouter = request.headers.get('x-byok-openrouter') || '';
    const byokGemini    = request.headers.get('x-byok-gemini')     || '';
    const byokGroq      = request.headers.get('x-byok-groq')       || '';
    const byokOpenai    = request.headers.get('x-byok-openai')     || '';
    const byokAnthropic = request.headers.get('x-byok-anthropic')  || '';
    const hasAnyByok = byokOpenrouter || byokGemini || byokGroq || byokOpenai || byokAnthropic;

    if (!hasAnyByok) {
      console.warn('[RequestPipeline] ⛔ ENGINEER mode request ditolak: tidak ada BYOK API key dari user.');
      return { ctx: {} as any, rctx: {} as any, response: new Response(JSON.stringify({
        error: 'ENGINEER_NO_API_KEY',
        message: 'Engineer mode memerlukan API Key eksplisit dari user (BYOK). ' +
                 'Buka Settings → AI Provider dan masukkan API Key Anda terlebih dahulu.'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }) };
    }
  }

  if (!finalApiKey) {
    console.warn(`[RequestPipeline] ⛔ Permintaan ditolak: tidak ada BYOK API key dari user (mode: ${parsed.mode || 'default'}, appSource: ${parsed.appSource || 'unknown'}).`);
    return { ctx: {} as any, rctx: {} as any, response: new Response(JSON.stringify({
      error: 'NO_API_KEY',
      message: 'Aplikasi ini memerlukan API Key Anda sendiri. ' +
               'Buka Settings → AI Provider dan masukkan API Key Anda terlebih dahulu. ' +
               'Key disimpan di perangkat Anda dan dipakai langsung untuk permintaan Anda, ' +
               'sehingga setiap pemakaian jelas pemiliknya.'
    }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }) };
  }

  console.log(`[RequestPipeline] Provider: ${finalProvider}, Key source: BYOK header`);

  const ctx = buildUnifiedExecutionContext({
      message: parsed.message,
      desktopOSMode: parsed.desktopOSMode,
      tools: parsed.tools,
      ragEnabled: parsed.ragEnabled,
      memoryEnabled: parsed.memoryEnabled,
      userId: user.id,
      userName: parsed.userName,
      appSource: parsed.appSource,
      mode: parsed.mode
  });

  console.log("[L1] auth binding", { actualAuthId: ctx.auth.userId, appSource: ctx.auth.appSource, hurufPesan: (parsed.message || '').length });

  ctx.request = { ...ctx.request, tools: parsed.tools, model: parsed.model, stream: parsed.stream, history: parsed.history, globalMemory: parsed.globalMemory, semanticContext: parsed.semanticContext || '', extractedImage: parsed.extractedImage, guardianPromptDirective: parsed.guardianPromptDirective, desktopOSMode: parsed.desktopOSMode, auditMode: parsed.auditMode, ragEnabled: parsed.ragEnabled, memoryEnabled: parsed.memoryEnabled, dataTabel: parsed.dataTabel === true, folderKerja: parsed.folderKerja, workspaceTarget: parsed.workspaceTarget, storageTarget: parsed.storageTarget, finalMessage: parsed.finalMessage };

  const jejakPrompt = buatJejak({ traceId: parsed.traceId, appSource: parsed.appSource, mode: parsed.mode, riwayatDiterima: ukurRiwayat(parsed.riwayatAsli) });
  catatLapis(jejakPrompt, 'buang_tag_call', parsed.riwayatAsli, parsed.riwayatSesudahTag);
  ctx.state.jejakPrompt = jejakPrompt;

  saringAlatMenurutKemampuan(ctx);

  const quotaResponse = await checkQuota(ctx.auth.userId, runtimeEnv.supabaseUrl, runtimeEnv.supabaseServiceKey, !!parsed.stream, corsHeaders);
  if (quotaResponse) {
    catatPenolakan(jejakPrompt, 'kuota', `HTTP ${quotaResponse.status}`);
    console.log(barisLogJejak(jejakPrompt));
    return { ctx: {} as any, rctx: {} as any, response: quotaResponse };
  }

  const traceId = parsed.traceId || crypto.randomUUID();
  const backgroundTasks = createBackgroundTaskTracker(traceId);
  
  const rctx: RuntimeContext = {
    traceId,
    keys: {
      openRouter: finalProvider === 'openrouter'
        ? finalApiKey
        : (request.headers.get('x-byok-openrouter') || '').replace(/[^\x00-\x7F]/g, '').trim(),
      openRouterByok: (request.headers.get('x-byok-openrouter') || '').replace(/[^\x00-\x7F]/g, '').trim(),
      gemini: finalProvider === 'gemini' ? finalApiKey : '',
      allGemini: finalProvider === 'gemini' && finalApiKey ? [finalApiKey] : [],
      groq: finalProvider === 'groq' ? finalApiKey : '',
      openAI: finalProvider === 'openai' ? finalApiKey : '',
    },

    model: { model: parsed.model, provider: finalProvider, thinking: parsed.thinking === true ? true : parsed.thinking === false ? false : undefined, pemilih: parsed.pemilihModel },
    policy: {},
    stream: { isStream: !!parsed.stream, extractedImage: parsed.extractedImage, desktopOSMode: !!parsed.desktopOSMode, auditMode: parsed.auditMode || 'OFF', streamNalar: !parsed.stream && parsed.streamNalar === true && parsed.thinking === true },
    env: runtimeEnv,
    logger: createRuntimeLogger(ctx.auth.userId, backgroundTasks, !!parsed.stream, runtimeEnv),
    userId: ctx.auth?.userId || 'anonymous',
    state: { explicitModelErrors: '' },
    tasks: backgroundTasks,
    jejakPrompt
  };

  let memoriVektor = '';
  const jejakVektorMemori: JejakEmbedding = {};
  try {
    if (parsed.finalMessage && parsed.finalMessage.trim().length > 0 && parsed.ragEnabled !== false) {
      console.log('🔍 [RAG] Generating embedding for vector search...');

      const userEmbedding = await generateEmbeddingThroughAdapter(parsed.finalMessage, rctx, jejakVektorMemori);
      ctx.request.queryEmbedding = userEmbedding;

      const ragUserId = ctx.auth?.userId;

      if (parsed.memoryEnabled === false) {
        console.log('[RAG] Tombol Memory mati — pencarian memori dilewati.');
      } else if (!ragUserId) {
        console.warn('[RAG] ⚠️ Pencarian memori dilewati — userId tidak tersedia. Menolak mencari lintas pengguna.');
      } else {
        const supabase = createClient(runtimeEnv.supabaseUrl, runtimeEnv.supabaseServiceKey);
        const { data: memories, error } = await supabase
          .rpc('match_memories', {
            query_embedding: userEmbedding,
            match_threshold: 0.70,
            match_count: 5,
            target_user_id: ragUserId
          });

        if (error) {
          console.error('[RAG] Vector search error:', error);
        }

        const ragContext = memories?.map((m: any) => (m.summary || m.content || '')).join('\n') || '';
        if (ragContext) {
          console.log(`✅ [RAG] Found ${memories?.length || 0} relevant memories untuk user ${ragUserId}`);
          memoriVektor = ragContext;
        } else {
          console.log('ℹ️ [RAG] No relevant memories found');
        }
      }
    }
  } catch (ragError: any) {
    console.error('[RAG] Error during vector search:', ragError.message || ragError);
    if (jejakVektorMemori.sebab) {
      ctx.request.embeddingGagal = { sebab: jejakVektorMemori.sebab, pesan: jejakVektorMemori.pesan };
      ctx.state.processingSteps.push(
        `⚠️ [MEMORI DILEWATI] Pencarian memori butuh vektor dan vektornya gagal: ` +
        `${kalimatSebabEmbedding(jejakVektorMemori)}. Memori tidak punya cadangan pencocokan kata, ` +
        `jadi tak satu pun memori ikut ke model pada pesan ini.`
      );
    } else {
      ctx.state.processingSteps.push(`⚠️ [MEMORI DILEWATI] Galat saat pencarian vektor: ${String(ragError?.message || ragError).slice(0, 160)}`);
    }
  }

  const teksPenanda = [typeof parsed.globalMemory === 'string' ? parsed.globalMemory : '', memoriVektor].join('\n');
  const hasInjectedKnowledge = Boolean(
    teksPenanda.includes('[DOKUMEN PENGETAHUAN') ||
    teksPenanda.includes('Sumber: Google News') ||
    teksPenanda.includes('Sumber: Web Search') ||
    teksPenanda.includes('--- Konteks') ||
    teksPenanda.trim().length > 80
  );

  console.log(`[Waktu] Zona waktu pengguna: ${zonaWaktuSah(parsed.clientTimezone) ?? '(tidak dikirim / tidak sah)'}`);
  let agentIdentityPrompt = susunPromptDasar({
    konteksWaktu: konteksWaktuPengguna(new Date(), parsed.clientTimezone),
    adaPengetahuanDisuntik: hasInjectedKnowledge,
    model: parsed.model || '',
    memoryEnabled: parsed.memoryEnabled !== false,
  });
  agentIdentityPrompt += petunjukZip(parsed.message);


  let userContextPrompt = ctx.auth.userName ? `\nInformasi Akun: User login dengan email/nama "${ctx.auth.userName}". Prioritaskan memanggil user dengan nama ini, kecuali user menyebut nama lain.` : '';

  const catatanRiwayat = catatanModelRiwayatDilewati(parsed.riwayatDilewati);
  agentIdentityPrompt += catatanRiwayat;
  jejakPrompt.riwayatDilewatiKlien = parsed.riwayatDilewati;
  if (catatanRiwayat) catatCatatanJujur(jejakPrompt, 'riwayat_dilewati');
  ctx.request.agentIdentityPrompt = agentIdentityPrompt;

  if (parsed.folderKerja) {
    ctx.request.agentIdentityPrompt += blokPromptFolder(parsed.folderKerja.nama, parsed.folderKerja.putaran, { maks: parsed.folderKerja.maks, sisa: parsed.folderKerja.sisa });
    console.log(`[FolderKerja] aktif "${parsed.folderKerja.nama}" · putaran alat ${parsed.folderKerja.putaran}`);
  }

  if (parsed.alatRag && ctx.policy.mode !== 'LITE' && ctx.auth.appSource !== 'mametlite') {
    const engineer = ctx.policy.mode === 'ENGINEER';
    (ctx.request as any).alatRagAktif = true;
    ctx.request.agentIdentityPrompt += blokPromptRag({ putaran: parsed.alatRag.putaran, maks: parsed.alatRag.maks, sisa: parsed.alatRag.sisa, engineer });
    console.log(`[AlatRag] aktif · putaran alat ${parsed.alatRag.putaran}${engineer ? ' · Engineer' : ''}`);
  }

  if (parsed.alatWeb && ctx.policy.mode === 'ENGINEER') {
    ctx.request.agentIdentityPrompt += blokPromptWeb({ putaran: parsed.alatWeb.putaran, maks: parsed.alatWeb.maks, sisa: parsed.alatWeb.sisa });
    console.log(`[AlatWeb] aktif · putaran alat ${parsed.alatWeb.putaran}`);
  }

  if (parsed.konektor) {
    ctx.request.agentIdentityPrompt += blokPromptKonektor(parsed.konektor);
    console.log(`[Konektor] aktif "${parsed.konektor.id}" · putaran alat ${parsed.konektor.putaran} · ${parsed.konektor.sumberSiap.length} sumber siap`);
  }

  if (parsed.konektorUmum) {
    ctx.request.agentIdentityPrompt += blokPromptKonektorUmum(parsed.konektorUmum);
    console.log(`[KonektorUmum] aktif ${parsed.konektorUmum.daftar.map((k: any) => `${k.id}(${k.alat.length} alat)`).join(', ')} · putaran alat ${parsed.konektorUmum.putaran}`);
  }

  if (parsed.mode === 'ENGINEER' || parsed.appSource === 'engineer') {
    ctx.request.agentIdentityPrompt += `\n\n[ENGINEER MODE — INSTRUKSI WAJIB]
Anda adalah Mamet Engineer, AI yang membantu merencanakan dan mengeksekusi perubahan kode.

AKSES FILE (WAJIB DIPAHAMI — SUMBER KEGAGALAN UMUM):
Anda PUNYA akses tulis file nyata lewat mekanisme patch di bawah ini — Owner mengoperasikan aplikasi desktop
yang benar-benar menerapkan patch ke file di disk setelah disetujui. JANGAN PERNAH menjawab "saya tidak
memiliki akses langsung ke file" atau semacamnya — itu salah dan menyesatkan Owner. Kalau permintaan Owner
adalah modifikasi file (walau ditulis singkat/sopan, misal "tolong tambahkan...", "ubah...", "hapus..."),
anggap itu permintaan patch, bukan sekadar pertanyaan informasi.

ATURAN RESPONS DI MODE ENGINEER:
1. Analisis permintaan user dengan cermat.
2. Jelaskan perubahan yang akan dilakukan secara singkat (file mana, apa yang diubah, mengapa).
3. Jika user meminta modifikasi/patch kode (termasuk permintaan singkat/kasual sekalipun — kata kerja seperti
   "tambah(kan)", "ubah", "hapus", "ganti", "perbaiki", "buat" semua menandakan ini):
   - Jika Anda menyertakan blok kode JSON patch, WAJIB gunakan format JSON flat (key = relative path file, value = POTONGAN PERUBAHAN dalam bentuk "SEBELUM: <teks lama persis> SESUDAH: <teks baru>", BUKAN isi berkas lengkap). Setelah Owner klik Apply, sistem membaca berkas asli dari disk dan menerapkan perubahan sebagai cari-ganti — baris lain tidak disentuh. JANGAN menulis potongan kecil seolah-olah itu seluruh isi berkas:
\`\`\`json
{
  "frontend/src/utils/example.js": "SEBELUM: return a + b; SESUDAH: return Number(a) + Number(b);"
}
\`\`\`
   - JANGAN membungkus dengan object bersarang tambahan (seperti "patch": { ... } atau "files": [ ... ]).
   - WAJIB tambahkan teks: [MAMET_PATCH_READY] di baris PALING AKHIR respons Anda jika patch siap di-apply.
4. Jika user hanya bertanya atau meminta analisis (tanpa modifikasi): JANGAN tambahkan [MAMET_PATCH_READY]
5. JANGAN menulis teks non-JSON di dalam blok code json.

Catatan: ini satu-satunya sumber kebenaran untuk aturan marker [MAMET_PATCH_READY] dan format JSON patch.
Instruksi ENGINEER lain (RULE 1-6 di konteks Two-Brain) merujuk ke sini, tidak mengulang aturan ini.`;
  }

  ctx.request.userContextPrompt = userContextPrompt;
  ctx.request.isRagEnabled = (parsed.ragEnabled !== false) && (ctx.policy.ragTopK > 0);
  ctx.request.effectiveRagMatchCount = ctx.policy.ragTopK;
  ctx.request.effectiveRagThreshold = ctx.policy.ragThreshold;

  ctx.request.history = siapkanRiwayatUntukModel(ctx.request.history || [], parsed.message, jejakPrompt);

  return { ctx, rctx };
}

