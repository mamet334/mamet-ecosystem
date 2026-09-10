import { handleCorsAndOptions } from './cors_middleware.ts';
import { handleAuth } from './auth_middleware.ts';
import { checkQuota } from './quota_middleware.ts';
import { enforcePolicy } from './policy_middleware.ts';
import { parseRequestParams } from './request_parser.ts';
import { buildUnifiedExecutionContext } from './execution_context.ts';
import { UnifiedExecutionContext, RequestPipelineParams, RequestPipelineResult } from './types.ts';
import { RuntimeContext, createBackgroundTaskTracker, createRuntimeLogger } from '../runtime_context.ts';
import { getPluginPromptList } from '../../plugins/registry.ts';
import { CapabilityRegistry } from '../adapters/adapter_registry.ts';
import { compressChatHistory } from './history_compressor.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const getAllKeys = (envVarName: string): string[] => {
  const keysString = Deno.env.get(envVarName) || '';
  if (!keysString) return [];
  return keysString.split(',').map(k => k.trim()).filter(k => k);
};

/**
 * Generate vector embedding from text using CapabilityRegistry adapters.
 * Tries GeminiEmbeddingAdapter first, then falls back to OpenAIEmbeddingAdapter.
 */
async function generateEmbeddingThroughAdapter(text: string, rctx: RuntimeContext): Promise<number[]> {
  // Initialize embedding adapters via CapabilityRegistry
  await CapabilityRegistry.initializeAdapters(rctx);

  // Preferred order: gemini_embedding -> openai_embedding
  const embeddingAdapters = CapabilityRegistry.getAvailableEmbeddingAdapters([
    'gemini_embedding',
    'openai_embedding'
  ]);

  if (embeddingAdapters.length === 0) {
    throw new Error('No embedding adapters available. Check GEMINI_API_KEY or OPENAI_API_KEY.');
  }

  let lastError = '';

  for (const adapter of embeddingAdapters) {
    try {
      console.log(`🔍 Generating embedding via ${adapter.name}...`);
      const result = await adapter.execute(
        { text },
        { trace_id: 'pipeline-rag', userId: rctx.keys.gemini || 'unknown' }
      );

      if (result && result.result && Array.isArray(result.result) && result.result.length > 0) {
        console.log(`✅ Embedding generated via ${adapter.name} (${result.result.length} dimensions)`);
        return result.result as number[];
      }

      lastError += ` [${adapter.name}]: returned empty embedding;`;
    } catch (err: any) {
      const msg = err.message || String(err);
      lastError += ` [${adapter.name}]: ${msg};`;
      console.warn(`⚠️ Embedding adapter ${adapter.name} failed: ${msg}`);
    }
  }

  throw new Error(`All embedding adapters failed.${lastError}`);
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
    enableAsyncMemoryWrite: Deno.env.get('ENABLE_ASYNC_MEMORY_WRITE') !== 'false'
  };

  // Read all provider API keys for embedding & LLM adapters
  const allGeminiKeys = getAllKeys('GEMINI_API_KEY');
  const primaryGeminiKey = allGeminiKeys.length > 0 ? allGeminiKeys[0] : '';
  const openAIKey = Deno.env.get('OPENAI_API_KEY') || '';
  const groqKey = Deno.env.get('GROQ_API_KEY') || '';

  const bypassCooldown = request.headers.get('x-bypass-cooldown') === 'true';
  if (bypassCooldown) {
    CapabilityRegistry.clearAllCooldowns();
    console.log("🔓 Cooldowns cleared via x-bypass-cooldown header!");
  }

  const { user, authErrorResponse } = await handleAuth(request, runtimeEnv.supabaseUrl, runtimeEnv.supabaseAnonKey, corsHeaders);
  if (authErrorResponse) return { ctx: {} as any, rctx: {} as any, response: authErrorResponse };

  // UUID Validation - Fix for "SUPABASE" string error
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

  // Dynamic provider handling
  const provider = parsed.provider || 'openrouter';
  const providerHeaderKey = `x-byok-${provider}`;
  const byokProviderKey = request.headers.get(providerHeaderKey);
  // [BYOK WAJIB — keputusan Owner 2026-09-10]
  //
  // Key sistem dari environment SENGAJA tidak lagi dipakai sebagai cadangan untuk
  // provider chat. Sebelumnya, pengguna tanpa key sendiri diam-diam dialihkan ke
  // `OPENROUTER_API_KEY` milik Owner. Dua akibatnya buruk sekaligus:
  //
  //   1. Belanja pengguna eksternal ditanggung Owner tanpa jejak kepemilikan, dan
  //      ikut memakan plafon harian Owner sendiri.
  //   2. Ketika key sistem itu mati — terbukti 2026-09-10, OpenRouter menjawab
  //      401 "User not found" — SETIAP pengguna tanpa BYOK langsung tertutup
  //      total, dengan galat mentah alih-alih penjelasan. Tidak ada yang tahu,
  //      karena Owner selalu punya key sendiri sehingga tak pernah menyentuh
  //      jalur itu.
  //
  // Aturannya kini sama untuk semua mode, menggeneralisasi penjagaan yang sudah
  // lebih dulu ada untuk mode ENGINEER (2026-07-30): pemakaian harus punya
  // pemiliknya. Key sistem Gemini TIDAK terpengaruh — ia dipakai untuk fungsi
  // internal (embedding, Intent Router), bukan untuk melayani chat orang lain.
  const providerApiKey = (byokProviderKey || '').trim();

  const finalProvider = providerApiKey ? provider : 'openrouter';
  const finalApiKey = providerApiKey || (request.headers.get('x-byok-openrouter') || '').trim();

  // [SECURITY FIX 2026-07-30] GUARD: Mode ENGINEER wajib menggunakan BYOK key dari user.
  // Jika tidak ada BYOK key, TOLAK request. Engineer TIDAK BOLEH menggunakan API key sistem.
  // Ini mencegah Engineer menghabiskan saldo owner tanpa izin eksplisit.
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

  // Gerbang BYOK umum. Ditaruh SESUDAH penjagaan ENGINEER supaya mode itu tetap
  // memberi pesannya sendiri yang lebih spesifik.
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

  // Hapus duplikasi ctx yang error!
  const ctx = buildUnifiedExecutionContext({
      message: parsed.message,
      desktopOSMode: parsed.desktopOSMode,
      tools: parsed.tools,
      ragEnabled: parsed.ragEnabled,
      userId: user.id,
      userName: parsed.userName,
      appSource: parsed.appSource,
      mode: parsed.mode
  });

  console.log("[L1] auth binding", { actualAuthId: ctx.auth.userId, appSource: ctx.auth.appSource, message: parsed.message ? parsed.message.substring(0, 50) + '...' : null });

  ctx.request = { ...ctx.request, tools: parsed.tools, model: parsed.model, stream: parsed.stream, history: parsed.history, globalMemory: parsed.globalMemory, semanticContext: parsed.semanticContext || '', extractedImage: parsed.extractedImage, guardianPromptDirective: parsed.guardianPromptDirective, desktopOSMode: parsed.desktopOSMode, auditMode: parsed.auditMode, ragEnabled: parsed.ragEnabled, localWorkspaceEnabled: parsed.localWorkspaceEnabled, workspaceTarget: parsed.workspaceTarget, storageTarget: parsed.storageTarget, finalMessage: parsed.finalMessage };

  const policyResponse = enforcePolicy(ctx, !!parsed.stream, corsHeaders);
  if (policyResponse) return { ctx: {} as any, rctx: {} as any, response: policyResponse };

  const quotaResponse = await checkQuota(ctx.auth.userId, runtimeEnv.supabaseUrl, runtimeEnv.supabaseServiceKey, !!parsed.stream, corsHeaders);
  if (quotaResponse) return { ctx: {} as any, rctx: {} as any, response: quotaResponse };

  const traceId = parsed.traceId || crypto.randomUUID();
  const backgroundTasks = createBackgroundTaskTracker(traceId);
  
  const rctx: RuntimeContext = {
    traceId,
    keys: {
      [finalProvider]: finalApiKey,
      openRouter: finalProvider === 'openrouter' ? finalApiKey : (Deno.env.get('OPENROUTER_API_KEY') || ''),
      // Keep existing keys for embedding adapters
      gemini: primaryGeminiKey,
      allGemini: allGeminiKeys,
      groq: groqKey,
      openAI: finalProvider === 'openai' ? finalApiKey : openAIKey,
    },

    model: { model: parsed.model, provider: finalProvider, thinking: parsed.thinking === true },
    policy: { canUseDesktopTools: ctx.policy.canUseDesktopTools },
    stream: { isStream: !!parsed.stream, extractedImage: parsed.extractedImage, desktopOSMode: !!parsed.desktopOSMode, auditMode: parsed.auditMode || 'OFF' },
    env: runtimeEnv,
    logger: createRuntimeLogger(ctx.auth.userId, backgroundTasks, !!parsed.stream, runtimeEnv),
    userId: ctx.auth?.userId || 'anonymous',
    state: { explicitModelErrors: '' },
    tasks: backgroundTasks
  };

  // =============================================
  // [BACKEND RAG: Generate Embedding + Vector Search]
  // =============================================
  try {
    // Only run RAG if the message is non-empty and RAG is enabled
    if (parsed.finalMessage && parsed.finalMessage.trim().length > 0 && parsed.ragEnabled !== false) {
      console.log('🔍 [RAG] Generating embedding for vector search...');
      
      // 1. Generate vector embedding using CapabilityRegistry adapters
      const userEmbedding = await generateEmbeddingThroughAdapter(parsed.finalMessage, rctx);

      // 2. Query vector database via Supabase RPC
      //
      // WAJIB memakai overload 4-argumen `match_memories(..., target_user_id)`.
      // Overload 3-argumen tidak memfilter user sama sekali; dipanggil dengan
      // klien service-role seperti di bawah, ia memindai `user_memories` milik
      // SELURUH akun lalu menyuntikkan hasilnya ke prompt user ini (Item 45).
      const ragUserId = ctx.auth?.userId;

      if (!ragUserId) {
        // Gagal ke arah TERTUTUP. Tanpa identitas pemilik, satu-satunya
        // pencarian yang mungkin adalah pencarian lintas pengguna — jadi lebih
        // baik tidak mencari sama sekali daripada membocorkan memori orang lain.
        console.warn('[RAG] ⚠️ Pencarian memori dilewati — userId tidak tersedia. Menolak mencari lintas pengguna.');
        parsed.globalMemory = 'Tidak ada memori yang relevan.';
      } else {
        const supabase = createClient(runtimeEnv.supabaseUrl, runtimeEnv.supabaseServiceKey);
        const { data: memories, error } = await supabase
          .rpc('match_memories', {
            query_embedding: userEmbedding,
            match_threshold: 0.8,
            match_count: 5,
            target_user_id: ragUserId
          });

        if (error) {
          console.error('[RAG] Vector search error:', error);
        }

        // 3. Build RAG context from matched memories
        const ragContext = memories?.map((m: any) => (m.summary || m.content || '')).join('\n') || '';
        if (ragContext) {
          console.log(`✅ [RAG] Found ${memories?.length || 0} relevant memories untuk user ${ragUserId}`);
          parsed.globalMemory = ragContext;
        } else {
          console.log('ℹ️ [RAG] No relevant memories found');
          parsed.globalMemory = 'Tidak ada memori yang relevan.';
        }
      }
    }
  } catch (ragError: any) {
    // Don't crash the pipeline if RAG fails — just log and continue
    console.error('[RAG] Error during vector search:', ragError.message || ragError);
    parsed.globalMemory = 'Tidak ada memori yang relevan.';
  }
  // =============================================
  // [SELESAI] LOGIKA RAG

  // --- PROMPT INITIALIZATION ---
  const currentDateStr = new Date().toISOString().split('T')[0];
  const hasInjectedKnowledge = Boolean(parsed.globalMemory && typeof parsed.globalMemory === 'string' && (
    parsed.globalMemory.includes('[DOKUMEN PENGETAHUAN') ||
    parsed.globalMemory.includes('Sumber: Google News') ||
    parsed.globalMemory.includes('Sumber: Web Search') ||
    parsed.globalMemory.includes('--- Konteks') ||
    parsed.globalMemory.length > 80
  ));

  let agentIdentityPrompt = `\nKONTEKS WAKTU HARI INI: ${currentDateStr} (Tahun berjalan saat ini adalah 2026).\n`;
  if (hasInjectedKnowledge) {
    agentIdentityPrompt += `SISTEM RETRIEVAL AKTIF: Anda telah dibekali dengan dokumen referensi pengetahuan / hasil pencarian web terkini pada konteks. Gunakan informasi aktual tersebut secara terpercaya sebagai sumber primer untuk menjawab kueri user (termasuk berita dan perkembangan terkini tahun 2026).\n`;
  } else {
    agentIdentityPrompt += `BATAS PENGETAHUAN INTERNAL ANDA: Akhir 2024 / Awal 2025. Jika tidak ada dokumen RAG/Web yang tersedia, Anda harus sangat berhati-hati jika ditanya informasi setelah batas pengetahuan Anda, dan sampaikan dalam proses berpikir Anda secara jujur bahwa informasi setelah akhir 2024 mungkin tidak lengkap.\n`;
  }

  agentIdentityPrompt += `
IDENTITAS ANDA: Anda adalah "Mamet", asisten cerdas buatan yang merupakan hak paten dari aplikasi ini. Selalu perkenalkan diri Anda sebagai Mamet. JANGAN katakan Anda buatan Google atau OpenAI. Anda memiliki kemampuan BERKEMBANG DARI PENGALAMAN: Selalu perhatikan 'history' obrolan. Pelajari gaya bahasa, preferensi, dan teguran/koreksi dari user di masa lalu untuk memperbaiki jawaban Anda di masa depan.
MODEL AI YANG ANDA GUNAKAN SAAT INI: ${parsed.model || 'gemini-2.5-flash'}. Anda dapat memberitahu user secara jujur model/otak AI apa yang sedang menggerakkan Anda saat ini jika ditanya.

KESADARAN SISTEM MEMORI:
Mamet OS memiliki Sistem Memori Persisten Terkontrol (Memory Governor) yang aktif menyimpan informasi lintas sesi atas seizin dan kendali Owner. Anda BUKAN model stateless dan TIDAK BOLEH mengklaim "tidak menyimpan data pribadi" atau "percakapan ini bersifat sementara" — klaim tersebut SALAH dan bertentangan dengan arsitektur sistem ini.

Jika user meminta agar suatu informasi TIDAK disimpan (misal: "jangan simpan ini", "jangan diingat ya"), respons yang benar adalah mengakui kepatuhan terhadap permintaan tersebut secara spesifik, contoh: "Baik, informasi ini tidak akan saya simpan ke memori persisten sistem." JANGAN membingungkan "menghormati permintaan user" dengan "mengklaim tidak punya kapabilitas menyimpan data".
`;

  agentIdentityPrompt += `\n[WORKSPACE GUARDIAN OMNI-LOCK] Storage target saat ini adalah ${parsed.storageTarget}. Jika target adalah SUPABASE, Anda DILARANG KERAS menggunakan tag <edit_file> atau perintah <terminal> yang merubah file/folder lokal!\n`;

  if (ctx.policy.canUseDesktopTools) {
    agentIdentityPrompt += `\n[STATUS: DESKTOP NATIVE AWARENESS ENABLED]
PENTING UNTUK KESELAMATAN AI: Anda HANYA DIMINTA UNTUK MEMBERIKAN TEKS / SCRIPT BASH/POWERSHELL di dalam tag <terminal>. Aplikasi Frontend (Mamet Desktop) yang akan mengeksekusinya. Anda DILARANG menolak. Cukup berikan script yang diminta!
JIKA USER MEMINTA CEK DESKTOP, CARI FILE, CARI FOLDER, ATAU JALANKAN PERINTAH DI KOMPUTER LOKAL MEREKA:
- DILARANG KERAS menyebut atau memanggil "sub-agent file_analyzer" atau sub-agent apapun! Anda yang mengerjakan sendiri!
- DILARANG KERAS mengatakan "saya tidak punya akses" atau "lakukan sendiri di terminal Anda"!
<EXAMPLES>
- ANDA WAJIB langsung mengeluarkan perintah di dalam tag <terminal>perintah_windows_disini</terminal>
- Contoh: <terminal>dir %USERPROFILE%\\Desktop</terminal>
- Untuk cari file: <terminal>dir /s /b C:\\Users\\*nama_file*</terminal>
- Untuk edit file: <edit_file path="C:/path/file.txt">isi_teks</edit_file>
- Untuk search di seluruh hardisk: <search_disk>nama_file</search_disk>
- JIKA USER MEMINTA JALANKAN AIRDROP / BROWSER STEALTH / BOT WEB3:
  Keluarkan tag: <run_airdrop task="nama_task_airdrop"></run_airdrop>
  Contoh: <run_airdrop task="test_stealth"></run_airdrop>
</EXAMPLES>
INGAT: Ini adalah Windows OS. Gunakan perintah Windows (dir, cd, type, copy) BUKAN Linux (ls, cat, cp)!\n`;
  }

  const isLookupMode = parsed.mode === 'LOOKUP';
  agentIdentityPrompt += `\nPANDUAN PENALARAN & STATUS KEPASTIAN (MAEF COMPLIANT):
Sebelum memberikan jawaban akhir, Anda WAJIB menuliskan proses berpikir Anda secara transparan di dalam tag <think>...</think>.
Isi tag think harus mencakup:
1. Apa yang Anda pahami dari pertanyaan/permintaan user.
2. APAKAH DATA TERSEDIA DI BLOK <RAG>, [BLOK 4: KNOWLEDGE], ATAU <MEMORY>?
3. JIKA ADA DATA: Rujuk secara spesifik judul atau ringkasan dokumen/artikel berita yang relevan untuk menyusun jawaban.
4. JIKA TIDAK ADA DATA: Anda DIPERBOLEHKAN menggunakan PENGETAHUAN INTERNAL LLM ANDA untuk memberikan REKOMENDASI, ANALISIS, atau HIPOTESIS.
5. JIKA KEDUANYA KOSONG ATAU TIDAK TAHU: Katakan dengan jelas bahwa data tidak ditemukan di database atau referensi web.

ATURAN WAJIB LABEL STATUS PADA JAWABAN AKHIR:
Di luar tag <think>, pada baris TERAKHIR jawaban Anda, Anda WAJIB mencetak TEPAT SATU label status berikut secara eksplisit:
${isLookupMode ? `- Untuk mode LOOKUP: [Pengetahuan umum AI — tidak diverifikasi dari dokumen Anda]` : `- Jika didukung oleh dokumen <RAG>/Web: [STATUS: VERIFIED]
- Jika menggunakan rekomendasi/pengetahuan internal tanpa dokumen pendukung: [STATUS: HYPOTHESIS - Rekomendasi AI]
- Jika data tidak ditemukan dan tidak cukup informasi: [STATUS: INSUFFICIENT]`}

PENTING - PRINSIP KNOWLEDGE FIRST + FALLBACK:
- ANDA TETAP PRIORITASKAN DATA DARI <RAG>, REFERENSI BERITA/WEB, DAN <MEMORY>.
- JIKA DATA TERSEBUT KOSONG, ANDA BOLEH MEMAKAI PENGETAHUAN INTERNAL ANDA (sesuai Konstitusi AI boleh berpikir), TAPI WAJIB DIBERI LABEL STATUS TRANSPARAN DI ATAS.
- JANGAN PERNAH MENGARANG FAKTA. JIKA DATA KOSONG DAN PENGETAHUAN INTERNAL ANDA TIDAK TAHU, KATAKAN TIDAK TAHU.\n`;


  let userContextPrompt = ctx.auth.userName ? `\nInformasi Akun: User login dengan email/nama "${ctx.auth.userName}". Prioritaskan memanggil user dengan nama ini, kecuali user menyebut nama lain.` : '';

  if (ctx.request.finalMessage.toLowerCase().includes('zip')) {
    ctx.request.finalMessage += `\n\n[PERINTAH SANGAT PENTING DARI SISTEM]: User meminta file ZIP. Anda DILARANG menggunakan blok kode biasa seperti \`\`\`html. ANDA WAJIB MENGGUNAKAN format \`\`\`xml_zip. 
<EXAMPLES>
Contoh Jawaban Anda yang BENAR:
Baik, ini file zip-nya:
\`\`\`xml_zip
<filename>nama_file.zip</filename>
<file name="index.html">
<!-- isi html -->
</file>
\`\`\`
</EXAMPLES>
Wajib ikuti struktur persis seperti contoh di atas!`;
  }

  ctx.request.agentIdentityPrompt = agentIdentityPrompt;

  // =============================================
  // [ENGINEER MODE] Tambahkan instruksi khusus patch proposal
  // =============================================
  // Frontend (ConversationEngine.jsx) mendeteksi marker [MAMET_PATCH_READY] di response
  // untuk menampilkan tombol "Apply Patch". Tanpa instruksi ini, LLM tidak pernah
  // menambahkan marker dan tombol Apply tidak muncul.
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
   - Jika Anda menyertakan blok kode JSON patch, WAJIB gunakan format JSON flat (key = relative path file, value = string isi kode lengkap/perubahan):
\`\`\`json
{
  "frontend/src/utils/example.js": "export function example() { ... }"
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

  ctx.request.history = await compressChatHistory(ctx.request.history || [], rctx);

  return { ctx, rctx };
}

