import { MAEFExecutionResult } from '../maef/maef_contract.ts';
import { corsHeaders, getStreamResponse } from '../stream_handler.ts';
import { barisLogJejak, salinJejak } from '../jejak_prompt.ts';

export const streamController = {
    pipe(result: MAEFExecutionResult, rctx: any): Response {

        if (result.mode === 'STREAM') {
            console.log(barisLogJejak(rctx?.jejakPrompt));
            if (result.type === 'BLOCKED') {
                const blockedStream = new ReadableStream({
                  start(controller) {
                    const encoder = new TextEncoder();
                    const data = JSON.stringify({ choices: [{ delta: { content: result.blockedMsg } }] });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                    controller.close();
                  }
                });
                return new Response(blockedStream, {
                  headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' }
                });
            } else if (result.type === 'LLM') {
                return getStreamResponse(result.prompt || '', result.systemContext || '', result.history || [], result.payload, rctx);
            }
        }
        
        if (result.mode === 'DIRECT') {
            console.log(barisLogJejak(rctx?.jejakPrompt));
            const badan = rctx?.jejakPrompt && result.aiResponse && typeof result.aiResponse === 'object'
                ? { ...result.aiResponse, jejakPrompt: salinJejak(rctx.jejakPrompt) }
                : result.aiResponse;
            return new Response(JSON.stringify(badan), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ error: "Unknown execution mode" }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
