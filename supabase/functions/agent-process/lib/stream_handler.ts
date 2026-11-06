import { RuntimeContext } from './runtime_context.ts';
import { runStreamLLM } from './llm_orchestrator.ts';
import { periksaLabelSumber, LABEL_HIPOTESIS } from './verification/label_sumber.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-byok-gemini, x-byok-groq, x-byok-openai, x-byok-openrouter',
};

export const getStreamResponse = (promptText: string, systemPromptText = '', chatHistory: any[] = [], metaData: any = {}, rctx: RuntimeContext) => {
  const { isiDokumen = [], catatanRag = '', ...metaTanpaIsi } = metaData || {};
  const safeMeta = { ...metaTanpaIsi };
  if (safeMeta.subagentRuns) safeMeta.subagentRuns = safeMeta.subagentRuns.map((r: any) => ({ ...r, output: '[Omitted to save header space]' }));

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const enqueueStr = (text: string) => {
         const data = JSON.stringify({ choices: [{ delta: { content: text } }] });
         controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };
      const enqueueData = (obj: Record<string, unknown>) => {
         controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      console.log("[SSE EARLY INIT] Streaming started before LLM calls");
      enqueueStr("");

      const closeSafely = async () => {
         try {
            if (safeMeta.auditMode === 'BASIC' || safeMeta.auditMode === 'FULL') {
                const amode = safeMeta.auditMode;
                const MAX_AUDIT_SUBAGENTS = 5;
                const shortId = (id: string | null) => id ? `${id.substring(0, 8)}...` : 'null';
                
                let auditStr = '\n\n---\n**🔍 AUDIT REPORT**\n\n';
                
                if (amode === 'BASIC') {
                    const ragPass = safeMeta.routingDecision?.workspace_id ? 'PASS' : (safeMeta.routingDecision?.scope === 'CORE' ? 'PASS' : 'FAIL');
                    const hasSave = safeMeta.subagentRuns?.find((r: any) => r.toolExecution?.target);
                    
                    auditStr += `- **Execution Contract:** ${safeMeta.contractValidation?.status || 'N/A'}\n`;
                    auditStr += `- **Routing Scope:** ${safeMeta.routingDecision?.scope || 'N/A'}\n`;
                    auditStr += `- **RAG Isolation:** ${ragPass}\n`;
                    if (hasSave) auditStr += `- **Save Decision:** APPROVED\n`;
                } else if (amode === 'FULL') {
                    auditStr += `**Execution Contract:**\n${safeMeta.contractValidation?.status || 'N/A'}\n\n`;
                    
                    auditStr += `**Routing Decision:**\nscope=${safeMeta.routingDecision?.scope || 'N/A'}\nworkspace_id=${shortId(safeMeta.routingDecision?.workspace_id)}\n\n`;
                    
                    auditStr += `**RAG:**\nscope=${safeMeta.routingDecision?.scope || 'N/A'}\nworkspace_id=${shortId(safeMeta.routingDecision?.workspace_id)}\nmatch_count=AUTO\n\n`;
                    
                    const saveTask = safeMeta.subagentRuns?.find((r: any) => r.toolExecution?.target);
                    if (saveTask && saveTask.toolExecution) {
                        auditStr += `**Save:**\ntarget=${saveTask.toolExecution.target}\nworkspace_id=${shortId(saveTask.toolExecution.workspace_id)}\nreason_code=${saveTask.toolExecution.reason_code}\napproved_by=${saveTask.toolExecution.approved_by}\n\n`;
                    }
                    
                    if (safeMeta.subagentRuns?.length > 0) {
                        auditStr += `**Subagent Execution:**\n`;
                        const runs = safeMeta.subagentRuns.slice(0, MAX_AUDIT_SUBAGENTS);
                        for (const r of runs) {
                            auditStr += `- ${r.subagent}\n`;
                        }
                        if (safeMeta.subagentRuns.length > MAX_AUDIT_SUBAGENTS) {
                            auditStr += `- ... (${safeMeta.subagentRuns.length - MAX_AUDIT_SUBAGENTS} more)\n`;
                        }
                    }
                }
                
                const MAX_AUDIT_LENGTH = 1500;
                if (auditStr.length > MAX_AUDIT_LENGTH) {
                    auditStr = auditStr.substring(0, MAX_AUDIT_LENGTH) + '\n... [AUDIT_TRUNCATED]';
                }
                
                enqueueStr(auditStr);
            }
         } catch (auditErr) {
            console.error("[Audit Injector Error]", auditErr);
         }

         try { controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`)); } catch (e) {}
         controller.close();
         await rctx.tasks.awaitAll();
      };

      let fullLLMResponse = '';

      try {
        const streamIter = runStreamLLM(promptText, systemPromptText, chatHistory, rctx);
        for await (const chunk of streamIter) {
            fullLLMResponse += chunk;
            enqueueStr(chunk);
        }
        
        const semuaGagal = Boolean((rctx as any)?.semuaPenyediaGagal);
        if (!semuaGagal) try {
          const cek = periksaLabelSumber(fullLLMResponse, safeMeta.judulDokumen || [], isiDokumen);
          if (cek.dikoreksi) {
            const label = cek.label || LABEL_HIPOTESIS;
            console.warn(`[LABEL] stream: label dikoreksi -> ${label} (${cek.alasan}); dokumen dilampirkan: ${(safeMeta.judulDokumen || []).length}`);
            enqueueStr(`\n\n${label}\n${cek.catatan}\n`);
          }
        } catch (labelErr) {
          console.error('[LABEL] gagal memeriksa label:', labelErr);
        }
        if (catatanRag && !semuaGagal) enqueueStr(`\n\n${catatanRag}\n`);

        try {
          if (rctx.penyediaHulu) enqueueData({ penyedia: rctx.penyediaHulu });
        } catch (penyediaErr) {
          console.error('[T14] gagal mengirim nama penyedia:', penyediaErr);
        }

      } catch(fatalErr: any) {
         console.error("Fatal Stream Error:", fatalErr);
         enqueueStr(`\n\n**Internal Server Error:** ${fatalErr.message}`);
      } finally {
         await closeSafely();
      }
    }
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'X-Agent-Metadata': btoa(encodeURIComponent(JSON.stringify(safeMeta)))
    }
  });
};
