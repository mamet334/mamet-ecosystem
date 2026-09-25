const express = require('express');
const cors = require('cors');
const axios = require('axios');
const google = require('googlethis');
const cheerio = require('cheerio');
const PDFParser = require('pdf2json');
const mammoth = require('mammoth');
const {
  resolveTraceId,
  emitTelemetryEvent,
  persistAiSystemLog,
  persistVerificationLog
} = require('./telemetry');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

/**
 * /api/chat — Endpoint utama yang digunakan oleh AIAgent UI.
 * Menerima provider, model, dan apiKey langsung dari frontend (dari Settings/VaultService).
 * Ini memungkinkan pengguna menggunakan API key mereka sendiri tanpa perlu edit .env.
 * 
 * FIX: Sebelumnya AIAgent hanya melakukan simulasi, bukan memanggil backend nyata.
 * Sekarang koneksi AI berjalan end-to-end.
 */
app.post('/api/chat', async (req, res) => {
  const requestStartedAt = Date.now();
  const traceId = resolveTraceId({
    headers: req.headers,
    body: req.body
  });

  await emitTelemetryEvent({
    eventType: 'Pipeline.Start',
    traceId,
    provider: req.body?.provider || null,
    message: '/api/chat request started',
    metadata: {
      endpoint: '/api/chat',
      user_id: req.body?.userId || req.body?.user_id || null
    }
  });

  try {
    const { message, provider, model, apiKey, history = [], userId, userName, globalMemory } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Parameter "message" wajib diisi.' });
    }
    if (!provider || !model) {
      return res.status(400).json({ error: 'Parameter "provider" dan "model" wajib diisi.' });
    }

    // Gunakan apiKey dari request body (dari VaultService frontend), fallback ke ENV
    const resolvedKey = apiKey || (
      provider === 'openrouter' ? process.env.OPENROUTER_API_KEY :
      provider === 'openai'     ? process.env.OPENAI_API_KEY :
      provider === 'groq'       ? process.env.GROQ_API_KEY :
      provider === 'anthropic'  ? process.env.ANTHROPIC_API_KEY :
      provider === 'gemini'     ? process.env.GEMINI_API_KEY : null
    );

    console.log(`[/api/chat] provider=${provider}, model=${model}, userId=${userId}, traceId=${traceId}, key=${resolvedKey ? '***set***' : 'MISSING'}`);

    await emitTelemetryEvent({
      eventType: 'Provider.Request',
      traceId,
      provider: provider || null,
      message: 'Provider request started',
      metadata: {
        model,
        user_id: userId || null,
        status: 'start'
      }
    });

    const agentIdentity = `Anda adalah "Mamet", asisten cerdas Mamet Ecosystem. Jangan katakan Anda buatan Google atau OpenAI. Selalu perkenalkan diri sebagai Mamet.`;
    const userContext = userName ? `\nUser: ${userName}` : '';
    const memoryContext = globalMemory ? `\n\n[MEMORI]:\n${globalMemory}` : '';
    const systemPrompt = agentIdentity + userContext + memoryContext;

    // Bangun history messages (format OpenAI-compatible)
    const buildMessages = (sys, hist) => {
      const msgs = [{ role: 'system', content: sys }];
      if (hist && hist.length > 0) {
        for (const h of hist) {
          msgs.push({ role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user', content: h.content });
        }
      }
      msgs.push({ role: 'user', content: message });
      return msgs;
    };

    let replyText = '';

    // ── OPENROUTER ──────────────────────────────────────────────────────────
    if (provider === 'openrouter') {
      if (!resolvedKey) {
        return res.status(400).json({ error: 'OpenRouter API Key tidak ditemukan. Silakan masukkan API Key di Settings → API Key.' });
      }
      const resp = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: model,
        messages: buildMessages(systemPrompt, history)
      }, {
        headers: {
          'Authorization': `Bearer ${resolvedKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://mamet-os.app',
          'X-Title': 'Mamet OS'
        }
      });
      replyText = resp.data.choices?.[0]?.message?.content || 'Tidak ada respons dari model.';

    // ── OPENAI ───────────────────────────────────────────────────────────────
    } else if (provider === 'openai') {
      if (!resolvedKey) {
        return res.status(400).json({ error: 'OpenAI API Key tidak ditemukan. Silakan masukkan API Key di Settings.' });
      }
      const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: model,
        messages: buildMessages(systemPrompt, history)
      }, {
        headers: {
          'Authorization': `Bearer ${resolvedKey}`,
          'Content-Type': 'application/json'
        }
      });
      replyText = resp.data.choices?.[0]?.message?.content || 'Tidak ada respons dari model.';

    // ── GROQ ─────────────────────────────────────────────────────────────────
    } else if (provider === 'groq') {
      if (!resolvedKey) {
        return res.status(400).json({ error: 'Groq API Key tidak ditemukan. Silakan masukkan API Key di Settings.' });
      }
      const resp = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: model,
        messages: buildMessages(systemPrompt, history)
      }, {
        headers: {
          'Authorization': `Bearer ${resolvedKey}`,
          'Content-Type': 'application/json'
        }
      });
      replyText = resp.data.choices?.[0]?.message?.content || 'Tidak ada respons dari model.';

    // ── ANTHROPIC ────────────────────────────────────────────────────────────
    } else if (provider === 'anthropic') {
      if (!resolvedKey) {
        return res.status(400).json({ error: 'Anthropic API Key tidak ditemukan. Silakan masukkan API Key di Settings.' });
      }
      const anthropicMessages = [];
      if (history && history.length > 0) {
        for (const h of history) {
          anthropicMessages.push({ role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user', content: h.content });
        }
      }
      anthropicMessages.push({ role: 'user', content: message });
      const resp = await axios.post('https://api.anthropic.com/v1/messages', {
        model: model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: anthropicMessages
      }, {
        headers: {
          'x-api-key': resolvedKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      });
      replyText = resp.data.content?.[0]?.text || 'Tidak ada respons dari model.';

    // ── GEMINI ───────────────────────────────────────────────────────────────
    } else if (provider === 'gemini') {
      if (!resolvedKey) {
        return res.status(400).json({ error: 'Gemini API Key tidak ditemukan. Silakan masukkan API Key di Settings.' });
      }
      const geminiModel = model || 'gemini-2.5-flash';
      const contents = [];
      if (history && history.length > 0) {
        for (const h of history) {
          contents.push({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: h.content }] });
        }
      }
      contents.push({ role: 'user', parts: [{ text: message }] });
      const resp = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${resolvedKey}`,
        { systemInstruction: { parts: [{ text: systemPrompt }] }, contents },
        { headers: { 'Content-Type': 'application/json' } }
      );
      replyText = resp.data.candidates?.[0]?.content?.parts?.[0]?.text || 'Tidak ada respons dari model.';

    } else {
      return res.status(400).json({ error: `Provider "${provider}" tidak didukung. Pilih: openrouter, openai, groq, anthropic, atau gemini.` });
    }

    const latencyMs = Date.now() - requestStartedAt;

    await emitTelemetryEvent({
      eventType: 'Provider.Response',
      traceId,
      provider: provider || null,
      message: 'Provider response completed',
      metadata: {
        model,
        user_id: userId || null,
        latency_ms: latencyMs,
        status: 'success'
      }
    });

    await persistAiSystemLog({
      traceId,
      provider: provider || null,
      model: model || null,
      latencyMs,
      status: 'success',
      errorFlag: false,
      llmCallCount: 1,
      metadata: {
        endpoint: '/api/chat',
        user_id: userId || null
      }
    });

    await emitTelemetryEvent({
      eventType: 'Pipeline.Completed',
      traceId,
      provider: provider || null,
      message: '/api/chat request completed',
      metadata: {
        endpoint: '/api/chat',
        user_id: userId || null,
        latency_ms: latencyMs,
        status: 'success'
      }
    });

    return res.json({ message: replyText, timestamp: new Date(), userId, trace_id: traceId });

  } catch (error) {
    const errData = error.response?.data;
    const errMsg = errData?.error?.message || errData?.message || error.message;
    const latencyMs = Date.now() - requestStartedAt;

    console.error('[/api/chat] Error:', errMsg, errData);

    await emitTelemetryEvent({
      eventType: 'Provider.Error',
      traceId,
      provider: req.body?.provider || null,
      message: 'Provider request failed',
      metadata: {
        model: req.body?.model || null,
        user_id: req.body?.userId || null,
        latency_ms: latencyMs,
        status: 'failed',
        error: errMsg
      }
    });

    await persistAiSystemLog({
      traceId,
      provider: req.body?.provider || null,
      model: req.body?.model || null,
      latencyMs,
      status: 'failed',
      errorFlag: true,
      llmCallCount: 1,
      metadata: {
        endpoint: '/api/chat',
        user_id: req.body?.userId || null,
        error: errMsg
      }
    });

    await emitTelemetryEvent({
      eventType: 'Pipeline.Failed',
      traceId,
      provider: req.body?.provider || null,
      message: '/api/chat request failed',
      metadata: {
        endpoint: '/api/chat',
        user_id: req.body?.userId || null,
        latency_ms: latencyMs,
        status: 'failed',
        error: errMsg
      }
    });

    return res.status(500).json({
      error: `Koneksi ke AI gagal: ${errMsg}`,
      details: errData,
      trace_id: traceId
    });
  }
});


// Get available tools
app.get('/api/tools', (req, res) => {
  const tools = [
    { id: 'web_search', name: 'Web Search', category: 'research' },
    { id: 'code_executor', name: 'Code Executor', category: 'compute' },
    { id: 'api_caller', name: 'API Caller', category: 'integration' },
    { id: 'slack_integration', name: 'Slack Integration', category: 'communication' },
  ];

  res.json({ tools });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    timestamp: new Date()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║  🤖 AI Agent Backend Started!         ║
║  Server: http://localhost:${PORT}          ║
║  API Health: /api/health              ║
║  Chat (Engineer): /api/chat           ║
║  Get Tools: /api/tools                ║
╚═══════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Server shutting down...');
  process.exit(0);
});

module.exports = app;
