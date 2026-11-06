import { runLLMDenganNalar } from '../../llm_orchestrator.ts';
import { executeResponsePipeline } from '../../coordinator/parser_pipeline.ts';
import { VerificationEngine } from '../../verification/verification_engine.ts';
import { persistTelemetryLog } from '../../verification/verification_service.ts';
import { eventBus } from '../../event/event_bus.ts';
import { koreksiLabel, catatanRagTurun } from '../../verification/label_sumber.ts';
import { jalankanHakimBayangan } from '../../verification/hakim_bayangan.ts';
import { sumberDariHasilAlat, sumberDariKeluaranTerminal } from '../../../../../../shared/folderKerjaAlat.js';
import { tutupJawabanDataTabel } from '../../data_tabel/data_tabel.ts';
import { sisipkanNalar } from '../../adapters/reasoning_openrouter.ts';
import { CATATAN_TERPOTONG, susunBahanLanjutan, susunPromptLanjutan, tenggatJawaban } from '../../streaming/batas_waktu.ts';

async function jawabanAkhir(prompt: string, sistem: string, riwayat: any[], rctx: any, tanpaNalar = false): Promise<string> {
  const kirim = rctx?.model?.thinking === true && !tanpaNalar ? rctx?.stream?.kirimNalar : undefined;
  const opsi: any = kirim
    ? { onNalar: (teks: string) => kirim({ tipe: 'nalar', teks }), onIsiMulai: () => kirim({ tipe: 'nalar_selesai' }) }
    : {};
  opsi.tenggat = tenggatJawaban(rctx);
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
    const lanjutan = state.lanjutan || null;
    
    const stream = ctx.request.stream;
    const extractedImage = ctx.request.extractedImage;
    const history = ctx.request.history;
    const requestMode = (ctx.request.mode || 'ASSISTANT').toUpperCase();
    const judulDokumen: string[] = (ctx.state.ragArray || [])
      .flatMap((r: any) => [r.formattedTitle, r.docId])
      .filter((t: any) => typeof t === 'string' && t.trim());
    const isiDokumen: string[] = (ctx.state.ragArray || [])
      .map((r: any) => r.contentWithId || r.content)
      .filter((t: any) => typeof t === 'string' && t.trim());
    const catatanRag = catatanRagTurun(ctx.state.ragTurunKeKata);
    if ((ctx.request as any).folderKerja?.putaran > 0) {
      const sumberFolder = sumberDariHasilAlat([
        ctx.request.originalMessage || ctx.request.finalMessage,
        ...(history || []).filter((h: any) => h?.role === 'user').map((h: any) => String(h.content || '')),
      ]);
      judulDokumen.push(...sumberFolder.judul);
      isiDokumen.push(...sumberFolder.isi);
      ctx.state.processingSteps.push(`📂 Sumber folder kerja untuk pemeriksa label: ${sumberFolder.judul.length} berkas dibaca`);
    }
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

    const tanpaHasilSubAgen = !Array.isArray(subagentRuns) || subagentRuns.length === 0;
    if (!lanjutan && !isChatBiasa && maef.shouldExecutePhase('ORCHESTRATION') && tanpaHasilSubAgen) {
        ctx.state.processingSteps.push('↩️ Tak ada sub-agent yang bekerja → dijawab langsung (bukan sintesis multi-agen)');
    }

    if (lanjutan) {
        ctx.state.processingSteps.push('⏩ Melanjutkan jawaban yang terpotong — Coordinator & sub-agent tidak dijalankan ulang');
        replyMessage = await jawabanAkhir(susunPromptLanjutan(lanjutan), fullSystemContext, lanjutan.riwayat, rctx, true);
    } else if (isChatBiasa || !maef.shouldExecutePhase('ORCHESTRATION') || tanpaHasilSubAgen) {
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
              isiDokumen,
              catatanRag
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
        
        const responseText = vContext.responseText || '';
        const tanpaPagar = responseText.replace(/^\s*```[a-z]*\s*/i, '').trimStart();
        const looksLikeJsonPatch = requestMode === 'ENGINEER' && (
          /^[\[{]/.test(tanpaPagar) ||
          responseText.includes('"files"') ||
          responseText.includes('"newContent"') ||
          responseText.includes('"patches"') ||
          responseText.includes('"__mode"') ||
          responseText.includes('"search_replace"')
        );
        const effectiveMode = (requestMode === 'ENGINEER' && !looksLikeJsonPatch)
          ? 'LITE'
          : requestMode;
        const vReport = VerificationEngine.verify(effectiveMode, vContext);
        
        console.log(`[SynthesisHandler] Verification Profile: ${vReport.profile} | Decision: ${vReport.decision} | Score: ${vReport.score} | Mode: ${requestMode}`);

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

        if (vReport.decision === "FAIL") {
          const failedChecksSummary = vReport.failures
            .map(f => `[${f.severity}] ${f.id}: ${f.message}`)
            .join(' | ');
          
          console.error(`[HARD GATE] ❌ BLOCKED. Profile: ${vReport.profile} | Mode: ${requestMode} | Score: ${vReport.score} | Failed Checks: ${vReport.failedChecks}/${vReport.totalChecks}`);
          console.error(`[HARD GATE] Failure details: ${failedChecksSummary}`);
          
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
        
        if (vReport.warnings && vReport.warnings.length > 0) {
          console.warn(`[VERIFICATION] ⚠️ ${vReport.warnings.length} warning(s) on profile ${vReport.profile}: ${vReport.warnings.map(w => w.id).join(', ')}`);
        }
        
    } else {
        if (maef.shouldExecutePhase('POST_PROCESSING')) {
          maef.requestTransition('POST_PROCESSING', 'Starting Final Synthesis');
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
                judulDokumen,
                isiDokumen,
                catatanRag
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
                judulDokumen,
                isiDokumen,
                catatanRag
              },
              snapshot: maef.getSnapshot()
            };
          }
          replyMessage = await jawabanAkhir(ctx.request.finalMessage, fullSystemContext, history, rctx);
        }
    }

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

    const sebelumLabel = replyMessage;
    replyMessage = koreksiLabel(replyMessage, judulDokumen, requestMode, isiDokumen);
    if (catatanRag) replyMessage = `${replyMessage}\n\n${catatanRag}`;

    await jalankanHakimBayangan(rctx, {
      jawaban: sebelumLabel,
      jawabanAkhir: replyMessage,
      isiDokumen,
      diturunkan: replyMessage !== sebelumLabel,
      chatId: (ctx.request as any)?.chatId || ''
    });
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
      ...(rctx.penyediaHulu ? { penyedia: rctx.penyediaHulu } : {}),
      timestamp: new Date(),
      userId: ctx.auth.userId,
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