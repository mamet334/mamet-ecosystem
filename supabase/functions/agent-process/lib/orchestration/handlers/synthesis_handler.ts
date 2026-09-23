import { runLLMDenganNalar } from '../../llm_orchestrator.ts';
import { executeResponsePipeline } from '../../coordinator/parser_pipeline.ts';
import { VerificationEngine } from '../../verification/verification_engine.ts';
import { persistTelemetryLog } from '../../verification/verification_service.ts';
import { eventBus } from '../../event/event_bus.ts';
import { koreksiLabel } from '../../verification/label_sumber.ts';
import { sumberDariHasilAlat, sumberDariKeluaranTerminal } from '../../../../../../frontend/src/core/runtime/services/folderKerjaAlat.js';
import { tutupJawabanDataTabel } from '../../data_tabel/data_tabel.ts';
import { sisipkanNalar } from '../../adapters/reasoning_openrouter.ts';
import { CATATAN_TERPOTONG, susunBahanLanjutan, susunPromptLanjutan, tenggatJawaban } from '../../streaming/batas_waktu.ts';

/** Jawaban akhir. Nalar model ikut ditampilkan (`<think>`) hanya bila Thinking dinyalakan eksplisit. */
async function jawabanAkhir(prompt: string, sistem: string, riwayat: any[], rctx: any, tanpaNalar = false): Promise<string> {
  // Hybrid: nalar dialirkan ke klien sambil model berpikir; jawaban tetap dirakit utuh & diperiksa di bawah.
  const kirim = rctx?.model?.thinking === true && !tanpaNalar ? rctx?.stream?.kirimNalar : undefined;
  const opsi: any = kirim
    ? { onNalar: (teks: string) => kirim({ tipe: 'nalar', teks }), onIsiMulai: () => kirim({ tipe: 'nalar_selesai' }) }
    : {};
  // Tenggat sebelum batas waktu dinding Supabase (2026-09-15): yang sudah ditulis disimpan, bukan dibuang.
  opsi.tenggat = tenggatJawaban(rctx);
  // Lanjutan jawaban terpotong: nalarnya sudah dibayar dan ditampilkan di pesan sebelumnya, dan diserahkan lewat prompt.
  // Live v444: lanjutan yang bernalar ulang dari nol terpotong lagi sebelum sempat menulis satu huruf pun.
  if (tanpaNalar) opsi.thinking = false;
  const r = await runLLMDenganNalar(prompt, sistem, riwayat, rctx, opsi);
  let teks = rctx?.model?.thinking === true ? sisipkanNalar(r.result, r.reasoning) : r.result;
  if (r.terpotong) {
    rctx.stream.jawabanTerpotong = true;
    teks = `${teks || ''}${CATATAN_TERPOTONG}`;
  }
  return teks;
}

export const SynthesisHandler = {
  async handle(state: any, ctx: any, rctx: any, maef: any): Promise<any> {
    const { 
      isChatBiasa, 
      fullSystemContext, 
      accumulatedContext, 
      confidenceReport, 
      evidenceReport, 
      tools, 
      groundingSources, 
      toolExecution, 
      subagentRuns, 
      routingDecision, 
      contractValidation 
    } = state;
    // Pesan "lanjutkan" untuk jawaban yang terpotong batas waktu (core_engine.ts, streaming/batas_waktu.ts).
    const lanjutan = state.lanjutan || null;
    
    const stream = ctx.request.stream;
    const extractedImage = ctx.request.extractedImage;
    const history = ctx.request.history;
    const requestMode = (ctx.request.mode || 'ASSISTANT').toUpperCase(); // Normalisasi mode
    // Judul DAN kode dokumen ([DOC-0001]) yang benar-benar dilampirkan ke prompt — dipakai memeriksa
    // label VERIFIED (Item 71). Keduanya diterima: model boleh menyebut judul atau kodenya.
    const judulDokumen: string[] = (ctx.state.ragArray || [])
      .flatMap((r: any) => [r.formattedTitle, r.docId])
      .filter((t: any) => typeof t === 'string' && t.trim());
    // Isi potongan yang dilampirkan — angka dan pasangan label–angka jawaban VERIFIED dicocokkan ke sini (Item 77).
    const isiDokumen: string[] = (ctx.state.ragArray || [])
      .map((r: any) => r.contentWithId || r.content)
      .filter((t: any) => typeof t === 'string' && t.trim());
    // Folder kerja (Item 85 Tahap 1): berkas yang TERBUKTI dibaca alat (pesan hasil alat kini + riwayat) ikut menjadi
    // sumber sah — tanpa ini jawaban dari isi berkas nyata selalu diturunkan ("tidak mengutip dokumen"). Pemeriksaan
    // tetap sama: nama berkas harus disebut di baris Sumber, angka jawaban harus ada di isi berkas/daftar.
    if ((ctx.request as any).folderKerja?.putaran > 0) {
      const sumberFolder = sumberDariHasilAlat([
        ctx.request.originalMessage || ctx.request.finalMessage,
        ...(history || []).filter((h: any) => h?.role === 'user').map((h: any) => String(h.content || '')),
      ]);
      judulDokumen.push(...sumberFolder.judul);
      isiDokumen.push(...sumberFolder.isi);
      ctx.state.processingSteps.push(`📂 Sumber folder kerja untuk pemeriksa label: ${sumberFolder.judul.length} berkas dibaca`);
    }
    // ENGINEER (2026-09-23): keluaran perintah yang Owner setujui — "[TERMINAL OUTPUT for: …]" — ikut menjadi sumber
    // sah. Tanpa ini, jawaban Engineer yang seluruhnya dibangun dari isi berkas nyata selalu diturunkan ke HYPOTHESIS
    // "tidak mengutip dokumen" (live TUGAS-02 & TUGAS-04), sementara jawaban tanpa bukti sama sekali tidak dihukum.
    if (requestMode === 'ENGINEER') {
      const sumberTerminal = sumberDariKeluaranTerminal([
        ctx.request.originalMessage || ctx.request.finalMessage,
        ...(history || []).filter((h: any) => h?.role === 'user').map((h: any) => String(h.content || '')),
      ]);
      if (sumberTerminal.judul.length) {
        judulDokumen.push(...sumberTerminal.judul);
        isiDokumen.push(...sumberTerminal.isi);
        ctx.state.processingSteps.push(`⌨️ Sumber keluaran perintah untuk pemeriksa label: ${sumberTerminal.judul.length} perintah`);
      }
    }
    let replyMessage = 'Gagal memproses jawaban.';

    if (lanjutan) {
        // Riset/sub-agent tidak diulang: bahan dan jawaban sejauh ini diambil dari metadata pesan yang terpotong.
        ctx.state.processingSteps.push('⏩ Melanjutkan jawaban yang terpotong — Coordinator & sub-agent tidak dijalankan ulang');
        replyMessage = await jawabanAkhir(susunPromptLanjutan(lanjutan), fullSystemContext, lanjutan.riwayat, rctx, true);
    } else if (isChatBiasa || !maef.shouldExecutePhase('ORCHESTRATION')) {
        ctx.state.processingSteps.push('✍️ Menghubungi Model AI untuk menjawab langsung...');
        
        if (stream && !extractedImage) {
          return { 
            mode: 'STREAM', 
            type: 'LLM', 
            prompt: ctx.request.finalMessage, 
            systemContext: fullSystemContext, 
            history, 
            payload: { 
              toolsUsed: tools, 
              groundingSources, 
              toolExecution, 
              subagentRuns, 
              processingSteps: ctx.state.processingSteps, 
              auditMode: ctx.request.auditMode, 
              routingDecision, 
              contractValidation,
              judulDokumen,
              isiDokumen // dikeluarkan lagi di stream_handler sebelum metadata jadi header
            },
            snapshot: maef.getSnapshot() 
          };
        }
        replyMessage = await jawabanAkhir(ctx.request.finalMessage, fullSystemContext, history, rctx);
        
        const { replyWithoutTrace, sourceTrace } = executeResponsePipeline('extract_trace', replyMessage, rctx);

        const vContext = {
          responseText: replyWithoutTrace,
          sourceTrace: sourceTrace,
          confidenceReport,
          evidenceReport,
          runtimeContext: ctx.state,
          mode: requestMode
        };

        // =============================================
        // DIAGNOSTIC: Persist verification input snapshot (ADR-0012)
        // =============================================
        // Khusus untuk mode ENGINEER, simpan snapshot diagnostik sebelum verifikasi
        if (requestMode === 'ENGINEER') {
          rctx.tasks.fire('SynthesisDiag', persistTelemetryLog(rctx, {
            userId: ctx.auth.userId ?? null,
            eventType: 'VERIFICATION_DIAG',
            provider: 'system',
            message: 'Engineer verification input snapshot',
            metadata: {
              reply_length: replyMessage?.length ?? 0,
              parser_trace: sourceTrace ?? null,
              parser_trace_found: sourceTrace !== undefined,
              backend_trace_items: confidenceReport?.sourceTrace?.length ?? 0,
              total_evidence: evidenceReport?.totalEvidence ?? 0,
              brain1_count: evidenceReport?.brain1Count ?? 0,
              brain2_count: evidenceReport?.brain2Count ?? 0,
              confidence_score: confidenceReport?.score ?? 0,
              confidence_grade: confidenceReport?.grade ?? null,
            },
          }));
        }
        
        // =============================================
        // MULTI-PROFILE VERIFICATION ROUTING (ADR-0013)
        // =============================================
        // ENGINEER mode: adaptif berdasarkan konten respons.
        // Patch JSON aktual ditandai dengan struktur array/object yang spesifik.
        // Chat natural → PERSONAL, Patch JSON → PATCH_ENGINEERING
        // LITE      → PERSONAL, ASSISTANT → ENGINEERING
        const responseText = vContext.responseText || '';
        // Cek apakah ini benar-benar JSON patch (bukan sekadar code block markdown dengan kurung kurawal)
        // Patch Engineer format: {"path/ke/file.js": "content"} — dimulai dengan { dan berisi string values
        // CATATAN: format lama juga dicek untuk backward compat
        // Jawaban patch SELALU berupa JSON utuh (boleh dibungkus pagar ```json). Pola longgar `"kunci": "nilai"`
        // DIHAPUS 2026-09-23: laporan analisis yang mengutip kode/JSON ikut tertangkap, lalu diperiksa sebagai patch
        // dan diblokir HARD GATE "Invalid JSON patch: No JSON object found" — live TUGAS-04, analisis 6.237 huruf
        // hilang seluruhnya dan Owner hanya menerima "Verification Failed".
        const tanpaPagar = responseText.replace(/^\s*```[a-z]*\s*/i, '').trimStart();
        const looksLikeJsonPatch = requestMode === 'ENGINEER' && (
          /^[\[{]/.test(tanpaPagar) ||                 // JSON utuh (dengan/tanpa pagar ```json)
          responseText.includes('"files"') ||          // field khas patch Engineer (format lama)
          responseText.includes('"newContent"') ||     // field khas patch Engineer (format lama)
          responseText.includes('"patches"') ||        // field khas patch Engineer (format lama)
          responseText.includes('"__mode"') ||         // search-replace mode
          responseText.includes('"search_replace"')    // format cari-ganti (PatchGenerator)
        );
        const effectiveMode = (requestMode === 'ENGINEER' && !looksLikeJsonPatch)
          ? 'LITE'   // pakai profile PERSONAL — ringan untuk chat natural
          : requestMode;
        const vReport = VerificationEngine.verify(effectiveMode, vContext);
        
        console.log(`[SynthesisHandler] Verification Profile: ${vReport.profile} | Decision: ${vReport.decision} | Score: ${vReport.score} | Mode: ${requestMode}`);

        // =============================================
        // SPECIFIC LOGGING: CHECK_002 Format Compliance (khusus ENGINEERING profile)
        // =============================================
        // Hanya relevan untuk profile ENGINEERING (mode ASSISTANT) yang membutuhkan ADR trace
        if (vReport.profile === 'ENGINEERING') {
          const check002Fail = vReport.failures.find(c => c.id === 'CHECK_002_SOURCE_TRACE_EXISTS');
          if (check002Fail) {
            rctx.tasks.fire('Check002FormatLog', persistTelemetryLog(rctx, {
              userId: ctx.auth.userId ?? null,
              eventType: 'CHECK_002_FORMAT_COMPLIANCE_FAIL',
              provider: 'system',
              message: check002Fail.message,
              metadata: {
                profile: vReport.profile,
                mode: requestMode,
                backend_trace_items: confidenceReport?.sourceTrace?.length ?? 0,
                parser_trace: sourceTrace ?? null,
                total_evidence: evidenceReport?.totalEvidence ?? 0,
                strict_mode: (Deno.env.get('ENGINEER_STRICT_MODE') ?? 'true') !== 'false',
                check_status: check002Fail.status,
              },
            }));
          }
        }
        
        // =============================================
        // AUDIT RECORD CREATION (semua profile)
        // =============================================
        const auditRecord = VerificationEngine.createAuditRecord(vReport, vContext);
        
        eventBus.emit({
          type: 'Verification.Completed',
          source: 'VerificationEngine',
          trace_id: rctx?.tasks?.traceId || 'unknown',
          payload: { 
            rctx, 
            vReport, 
            vContext, 
            userId: ctx.auth.userId, 
            auditRecord,
            profile: vReport.profile,
            mode: requestMode
          }
        });

        // =============================================
        // HARD GATE: Konsisten untuk semua profile (MAEF 4.5)
        // =============================================
        // Setiap profile memiliki kriteria FAIL-nya sendiri:
        // - ENGINEERING: FAIL jika ADR trace hilang atau ada hallucination
        // - PERSONAL: FAIL jika response kosong atau ada forbidden phrases
        // - PATCH_ENGINEERING: FAIL jika JSON invalid, ada dangerous patterns, atau core file dimodifikasi
        if (vReport.decision === "FAIL") {
          const failedChecksSummary = vReport.failures
            .map(f => `[${f.severity}] ${f.id}: ${f.message}`)
            .join(' | ');
          
          console.error(`[HARD GATE] ❌ BLOCKED. Profile: ${vReport.profile} | Mode: ${requestMode} | Score: ${vReport.score} | Failed Checks: ${vReport.failedChecks}/${vReport.totalChecks}`);
          console.error(`[HARD GATE] Failure details: ${failedChecksSummary}`);
          
          // Response berbeda berdasarkan profile untuk debugging yang lebih baik
          const failureResponse = {
            message: "Verification Failed",
            profile: vReport.profile,
            mode: requestMode,
            score: vReport.score,
            passRate: vReport.passRate,
            failures: vReport.failures.map(f => ({
              id: f.id,
              name: f.name,
              severity: f.severity,
              message: f.message
            }))
          };
          
          return { 
            mode: 'DIRECT', 
            aiResponse: failureResponse, 
            snapshot: maef.getSnapshot() 
          };
        }
        
        // Log soft warning jika ada warnings (non-fatal)
        if (vReport.warnings && vReport.warnings.length > 0) {
          console.warn(`[VERIFICATION] ⚠️ ${vReport.warnings.length} warning(s) on profile ${vReport.profile}: ${vReport.warnings.map(w => w.id).join(', ')}`);
        }
        
    } else {
        // =============================================
        // MULTI-AGENT ORCHESTRATION PATH (sub-agents dispatched)
        // =============================================
        if (maef.shouldExecutePhase('POST_PROCESSING')) {
          maef.requestTransition('POST_PROCESSING', 'Starting Final Synthesis');
          // fullSystemContext TIDAK ditempel di sini (Item 66, 2026-09-11): ia sudah dikirim sebagai
          // prompt sistem (argumen kedua runLLM di bawah). Dulu teks ini diawali
          // `...sub-agent.${fullSystemContext}`, sehingga seluruh prompt sistem — termasuk semua
          // potongan dokumen — terkirim DUA KALI. Terukur lewat [PROMPT_KOMPOSISI]: pertanyaan 80
          // huruf menjadi pesan 28.519 huruf di atas sistem 27.802 huruf (15.272 token).
          // Deep Research (2026-09-15) menyerahkan bahan artikel mentah dan pengguna memang meminta laporan riset, jadi
          // larangan "format kaku seperti laporan" tidak berlaku bila bahannya benar-benar ada.
          const adaBahanDeepResearch = (subagentRuns || []).some((r: any) =>
            r?.subagent === 'deep_research' && String(r?.output || '').startsWith('Bahan DEEP RESEARCH'));
          const aturanFormat = adaBahanDeepResearch
            ? `- Pengguna menyalakan Deep Research: tulis LAPORAN RISET terstruktur (ringkasan, temuan utama, tabel perbandingan bila datanya mendukung, kesimpulan) dengan nomor sumber [n] dan nama situsnya.\n- Awali dengan sapaan singkat, lalu langsung laporan.`
            : `- JANGAN gunakan format kaku seperti "Laporan Hasil Kerja".\n- Langsung berikan jawaban, sapaan balik, atau solusi.`;
          const synthesisPrompt = `Anda telah menugaskan beberapa sub-agent.\n\nPermintaan Awal User: "${ctx.request.finalMessage}"\n\nRiwayat pekerjaan sub-agent:\n${accumulatedContext}\n\nJAWABLAH pesan/pertanyaan user dengan ramah dan natural berdasarkan informasi dari sub-agent di atas. \n\nPENTING: \n${aturanFormat}\n- Sertakan gambar jika ada.\n- Jangan pernah mengarang data palsu!\n- Gunakan format Tabel Markdown HANYA jika menyajikan data terstruktur.\n- DILARANG KERAS menggunakan blok \`\`\`mermaid\`\`\` KECUALI diminta.`;
          
          ctx.state.processingSteps.push('📝 Merangkum dan menyintesis jawaban akhir...');
          
          if (stream && !extractedImage) {
            return { 
              mode: 'STREAM', 
              type: 'LLM', 
              prompt: synthesisPrompt, 
              systemContext: fullSystemContext, 
              history, 
              payload: { 
                toolsUsed: tools, 
                groundingSources, 
                toolExecution, 
                subagentRuns, 
                processingSteps: ctx.state.processingSteps, 
                auditMode: ctx.request.auditMode, 
                routingDecision, 
                contractValidation,
                // Tanpa dua data ini pemeriksa label di stream_handler mengira tidak ada dokumen dan
                // menurunkan SETIAP VERIFIED (Mametlite, 2026-09-21: "dokumen dilampirkan: 0" walau 7 potongan).
                judulDokumen,
                isiDokumen
              }, 
              snapshot: maef.getSnapshot() 
            };
          }
          replyMessage = await jawabanAkhir(synthesisPrompt, fullSystemContext, history, rctx);
        } else {
          if (stream && !extractedImage) {
            return { 
              mode: 'STREAM', 
              type: 'LLM', 
              prompt: ctx.request.finalMessage, 
              systemContext: fullSystemContext, 
              history, 
              payload: { 
                toolsUsed: tools, 
                groundingSources, 
                toolExecution, 
                subagentRuns, 
                processingSteps: ctx.state.processingSteps, 
                auditMode: ctx.request.auditMode, 
                routingDecision, 
                contractValidation,
                // Tanpa dua data ini pemeriksa label di stream_handler mengira tidak ada dokumen dan
                // menurunkan SETIAP VERIFIED (Mametlite, 2026-09-21: "dokumen dilampirkan: 0" walau 7 potongan).
                judulDokumen,
                isiDokumen
              }, 
              snapshot: maef.getSnapshot() 
            };
          }
          replyMessage = await jawabanAkhir(ctx.request.finalMessage, fullSystemContext, history, rctx);
        }
    }

    // =============================================
    // MEMORY WRITE REQUEST (Event-Driven)
    // =============================================
    eventBus.emit({
      type: 'Memory.WriteRequested',
      source: 'Orchestrator',
      trace_id: rctx?.tasks?.traceId || 'unknown',
      payload: { 
        rctx, 
        userId: ctx.auth.userId, 
        message: ctx.request.finalMessage, 
        canWriteMemory: ctx.policy.canWriteMemory, 
        mode: ctx.policy.mode 
      }
    });

    await rctx.tasks.awaitAll();

    // Label VERIFIED hanya boleh bertahan bila jawaban mengutip dokumen yang dilampirkan (Item 71).
    replyMessage = koreksiLabel(replyMessage, judulDokumen, requestMode, isiDokumen);
    // Tabel data (Item 92 Tahap 3) disusun kode dari database — ditempel SESUDAH label diperiksa, di luar jawaban model.
    const dataTabel = (ctx.state as any).dataTabel;
    if (dataTabel) {
      const tutup = tutupJawabanDataTabel(replyMessage, dataTabel);
      replyMessage = tutup.teks;
      if (tutup.nipDisamarkan) {
        console.warn(`[DataTabel] ${tutup.nipDisamarkan} angka berbentuk NIP di teks model disamarkan (karangan — model tidak menerima NIP).`);
        ctx.state.processingSteps.push(`🛡️ [DATA TABEL] ${tutup.nipDisamarkan} NIP karangan model disamarkan`);
      }
    }

    const aiResponse = {
      message: replyMessage,
      toolsUsed: tools,
      groundingSources,
      toolExecution,
      subagentRuns,
      processingSteps: ctx.state.processingSteps,
      timestamp: new Date(),
      userId: ctx.auth.userId,
      // Terpotong batas waktu: bahan untuk "lanjutkan" ikut tersimpan di metadata pesan (chats.messages) dan dikirim
      // kembali oleh desktop lewat riwayat. jawabanSebelumnya berantai bila lanjutan pun terpotong lagi.
      ...(rctx.stream?.jawabanTerpotong ? {
        terpotong: true,
        bahanLanjutan: susunBahanLanjutan(
          replyMessage,
          lanjutan,
          ctx.request.finalMessage,
          (subagentRuns || []).length > 0 ? accumulatedContext : '',
        ),
      } : {})
    };

    maef.requestTransition('COMPLETED', 'Execution Completed');
    eventBus.emit({ 
      type: 'Response.Generated', 
      source: 'Orchestrator', 
      payload: { success: true }, 
      trace_id: rctx?.tasks?.traceId || 'unknown' 
    });
    
    return { mode: 'DIRECT', aiResponse, snapshot: maef.getSnapshot() };
  }
};