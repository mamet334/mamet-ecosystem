import { runCoordinatorLLM } from '../../llm_orchestrator.ts';
import { executeResponsePipeline } from '../../coordinator/parser_pipeline.ts';
import { getPluginPromptList } from '../../../plugins/registry.ts';
import { kataKunciAksi } from '../kata_kunci_router.ts';
import { barisRencana } from '../langkah_terlihat.ts';

export const IntentRouterHandler = {
  async handle(ctx: any, rctx: any, maef: any): Promise<any> {
    const tools = ctx.request.tools;
    let isChatBiasa = false;
    let plan: any[] = [];
    let contractValidation = ctx.request.contractValidation;

    if (!tools || tools.length === 0) {
      maef.evaluatePhaseResult('CONTEXT_BUILD', { skipPhases: ['ORCHESTRATION', 'TOOL_EXECUTION'] });
      return { isChatBiasa: true, plan, contractValidation };
    }

    ctx.request.lowerMsg = ctx.request.finalMessage.toLowerCase();
    ctx.state.processingSteps.push('🔍 Menganalisis permintaan user...');
    
    {
      const pemicu = kataKunciAksi(ctx.request.lowerMsg);

      if (pemicu) {
        isChatBiasa = false;
        ctx.state.processingSteps.push(`🎯 Intent Router: kata kunci aksi "${pemicu}" → Butuh Sub-Agent`);
      } else {
        try {
          ctx.state.processingSteps.push('🧠 Intent Router: Mengklasifikasi jenis permintaan...');
          const intentCheckPrompt = `Analisis apakah input user berikut membutuhkan pencarian internet (web search), kunjungan website, analisis mendalam, penulisan/eksekusi kode, pemanggilan API, atau pembuatan jadwal/cron.\nPesan user: "${ctx.request.finalMessage}"\n\nKriteria:\n- Jawab "CHAT_BIASA" jika pesan HANYA berupa sapaan, obrolan santai, ucapan terima kasih, atau pertanyaan umum yang bisa dijawab tanpa info luar/terbaru.\n- Jawab "BUTUH_AGENT" jika butuh agen eksternal.\n\nJawab HANYA dengan satu kata: "CHAT_BIASA" atau "BUTUH_AGENT".`;
          const intentResult = await runCoordinatorLLM(intentCheckPrompt, "Anda adalah router intent super ringan. Jawab HANYA satu kata.", true, rctx);
          if (intentResult.toUpperCase().includes("CHAT_BIASA")) {
             isChatBiasa = true;
             ctx.state.processingSteps.push('💬 Keputusan: Obrolan biasa → Jawab langsung tanpa sub-agent');
          } else {
             ctx.state.processingSteps.push('⚡ Keputusan: Butuh aksi → Mempersiapkan sub-agent...');
          }
        } catch (err) {
          console.warn("Intent router error, jalur aman (jawab langsung):", err);
          isChatBiasa = true;
          ctx.state.processingSteps.push(`⚠️ Intent Router gagal (${String((err as any)?.message || err).substring(0, 120)}) → jalur aman: dijawab langsung tanpa sub-agent`);
        }
      }
    } 

    maef.evaluatePhaseResult('CONTEXT_BUILD', { 
      skipPhases: isChatBiasa ? ['ORCHESTRATION', 'TOOL_EXECUTION'] : [] 
    });

    if (maef.shouldExecutePhase('ORCHESTRATION')) {
        let coordinatorSystemPrompt = `Tugas Anda adalah menganalisis permintaan user dan memilih sub-agent yang tepat.\nAnda memiliki tim Sub-Agent nyata berikut ini:\n${getPluginPromptList(tools)}\n\nPENTING:\n1. Anda adalah mesin parsing JSON. Anda DILARANG KERAS merespons dengan kalimat atau teks biasa. Anda WAJIB mengembalikan HANYA sebuah Array JSON murni. Jika tidak butuh sub-agent, kembalikan [].\n2. Jika user menanyakan informasi aktual, fakta terbaru, atau info di luar batas pengetahuan internal Anda, Anda WAJIB memanggil sub-agent "researcher" atau "deep_research".\n3. Jika user meminta penjadwalan, panggil "cron_manager".\n4. JIKA pertanyaan user adalah tentang data spesifik yang ada di Pangkalan Data RAG/Dokumen internal user, kembalikan [].\n5. Pertanyaan tentang isi dokumen atau workspace pengguna: kembalikan [].\nContoh Output Wajib: [{"subagent": "researcher", "task": "Cari pemenang MotoGP 2026"}]`;
        
        coordinatorSystemPrompt += (ctx.request.guardianPromptDirective || '');

        let planText = '[]';
        let rencanaGagal = false;
        maef.requestTransition('ORCHESTRATION', 'Starting Execution Planning');
        ctx.state.processingSteps.push('🤖 Kepala Agent (Coordinator): Merencanakan strategi...');
        try {
          planText = await runCoordinatorLLM(`Permintaan User: "${ctx.request.finalMessage}"`, coordinatorSystemPrompt, false, rctx);
        } catch (err) {
          console.error("Coordinator LLM Error:", err);
          rencanaGagal = true;
          ctx.state.processingSteps.push(`⚠️ Coordinator gagal merencanakan, lanjut tanpa sub-agent: ${String((err as any)?.message || err).substring(0, 120)}`);
        }

        const parseResult = executeResponsePipeline('parse_plan', planText, rctx);
        plan = parseResult.plan;
        contractValidation = parseResult.validation as any;

        if (Array.isArray(tools) && tools.includes('deep_research') && !tools.includes('web_search')) {
            let dialihkan = 0;
            plan = plan.map((p: any) => {
                if (p?.subagent !== 'researcher') return p;
                dialihkan++;
                return { ...p, subagent: 'deep_research' };
            });
            if (dialihkan > 0) ctx.state.processingSteps.push(`🔬 Deep Research menyala: ${dialihkan} tugas "researcher" dialihkan ke "deep_research"`);
        }

        if (plan.length > 0) {
            ctx.state.processingSteps.push(barisRencana(plan));
        } else if (contractValidation.status === "REJECTED") {
            ctx.state.processingSteps.push(`❌ [Execution Contract] Skema ditolak: ${contractValidation.reason_code}`);
        } else if (!rencanaGagal) {
            ctx.state.processingSteps.push('📋 Coordinator memutuskan tidak ada sub-agent yang diperlukan');
        }
    }

    return { isChatBiasa, plan, contractValidation };
  }
};
