/**
 * PatchGenerator — Menghasilkan patch dari LLM: membangun prompt, memanggil
 * BrainService, mengekstrak kode dari respons, dan fallback deterministik
 * saat LLM gagal.
 *
 * Diekstrak dari engineer.js (Fase 7, ADR-0017). Digabung sengaja dengan
 * implementasi baru `CodeSnippetExtractor.js` (SPESIFIKASI-TEKNIS-MAMET-OS-v2.md
 * §2.1) karena keduanya menyentuh `_buildPatchPrompt()` yang sama — dikerjakan
 * sekali agar tidak ada dua PR yang tumpang tindih di titik yang sama.
 *
 * §2.1 mengganti percabangan lama berbasis jumlah-karakter (isLargeFile:
 * 4000 char awal + 4000 akhir untuk file >6000 char) dengan pemangkasan
 * presisi berbasis identifier via `extractRelevantSnippet()`, dan SELALU
 * meminta format search-replace ke LLM (bukan cuma untuk file besar) —
 * lihat §2.1.5. Apply logic untuk search-replace di `generatePatch()` di
 * bawah TIDAK berubah dari sebelumnya (bekerja terhadap isi file utuh yang
 * tetap disimpan di memori, snippet cuma memangkas apa yang ditunjukkan ke LLM).
 */
import { extractFileNamesFromTask, tryReadFile } from './FileSystemGateway.js';
import { MAX_FILES_PER_PATCH } from './CapabilityGuard.js';
import { extractRelevantSnippet, extractTargetIdentifiers } from './CodeSnippetExtractor.js';

/**
 * @param {Object} task
 * @param {Object} deps - { storageManager, fileIndexService, serviceManager, eventBus, brain, injectArtifactIntoPrompt }
 */
export async function generatePatch(task, deps) {
  const { storageManager, fileIndexService, serviceManager, eventBus, brain, injectArtifactIntoPrompt } = deps;

  try {
    console.log(`[Engineer] 🔨 Generating patch for task: ${task?.title || task?.id || 'unknown'}`);

    const relevantFiles = task?.files || [];
    const fileContents = {};

    const targetFiles = relevantFiles.length > 0
      ? relevantFiles
      : extractFileNamesFromTask(task);

    console.log(`[Engineer] 📂 Target files: ${targetFiles.join(', ')}`);

    for (const filePath of targetFiles.slice(0, MAX_FILES_PER_PATCH)) {
      const result = await tryReadFile(filePath, { storageManager, fileIndexService });
      if (result) {
        fileContents[result.path] = result.content;
        console.log(`[Engineer] ✅ Read: ${result.path} (${result.content.length} chars)`);
      } else {
        console.warn(`[Engineer] ⚠️ File not found: ${filePath}`);
      }
    }

    if (Object.keys(fileContents).length === 0) {
      console.warn('[Engineer] No files could be read for patch generation');
      return {
        files: [],
        description: 'No target files could be read.',
        ready: false,
        error: 'No readable files'
      };
    }

    let generatedCode = null;
    let rawLLMResponse = null;
    let modelUsed = 'fallback';
    let isFallback = false;
    let llmErrorMessage = null;

    console.log('[Engineer] 🔍 Checking BrainService availability...');

    let brainService = null;
    try {
      brainService = serviceManager.get('BrainService');
    } catch (e) {
      console.error('[Engineer] Error getting BrainService:', e.message);
    }

    if (brainService && typeof brainService.executeLLM === 'function') {
      console.log(`[Engineer] 🧠 BrainService available, calling LLM...`);
      const prompt = buildPatchPrompt(task, fileContents, { brain, injectArtifactIntoPrompt });

      try {
        rawLLMResponse = await brainService.executeLLM(prompt, {
          model: task?.requestedModel
        });
        modelUsed = task?.requestedModel || brainService.currentModel || 'unknown';

        console.log('[Engineer] === LLM RAW RESPONSE ===');
        console.log(rawLLMResponse);
        console.log('[Engineer] === END RAW RESPONSE ===');
        console.log(`[Engineer] 🤖 Model: ${modelUsed} | Length: ${rawLLMResponse?.length || 0} chars`);

        generatedCode = extractCodeFromResponse(rawLLMResponse);
      } catch (llmError) {
        console.error('[Engineer] LLM call failed:', llmError.message);
        llmErrorMessage = llmError.message;
        isFallback = true;
        generatedCode = generateFallbackPatch(task, fileContents);
      }
    } else {
      console.warn('[Engineer] ⚠️ BrainService not available or missing executeLLM method');
      llmErrorMessage = 'BrainService not available or missing executeLLM method';
      isFallback = true;
      generatedCode = generateFallbackPatch(task, fileContents);
    }

    const patchFiles = [];
    for (const [filePath, newContent] of Object.entries(generatedCode || {})) {
      if (filePath === 'message' || filePath === 'reply' || filePath === 'content') continue;

      let finalContent = null;

      // === HANDLE FORMAT SEARCH-REPLACE ===
      if (newContent && typeof newContent === 'object' && newContent.__mode === 'search_replace') {
        const originalContent = fileContents[filePath] || '';
        let workingContent = originalContent;
        let changeCount = 0;

        if (Array.isArray(newContent.changes)) {
          for (const change of newContent.changes) {
            if (!change.search || typeof change.search !== 'string') continue;
            if (typeof change.replace !== 'string') continue;

            if (workingContent.includes(change.search)) {
              workingContent = workingContent.replace(change.search, change.replace);
              changeCount++;
              console.log(`[Engineer] ✅ Search-replace applied: "${change.search.substring(0, 50)}..."`);
            } else {
              const trimmedSearch = change.search.trim();
              if (workingContent.includes(trimmedSearch)) {
                workingContent = workingContent.replace(trimmedSearch, change.replace);
                changeCount++;
                console.log(`[Engineer] ✅ Search-replace (trimmed) applied`);
              } else {
                console.warn(`[Engineer] ⚠️ Search pattern not found: "${change.search.substring(0, 80)}"`);
              }
            }
          }
        }

        if (changeCount > 0) {
          finalContent = workingContent;
          console.log(`[Engineer] 🔄 Search-replace mode: ${changeCount} perubahan diterapkan ke ${filePath}`);
        } else {
          console.error(`[Engineer] ❌ Search-replace mode: tidak ada perubahan berhasil diterapkan ke ${filePath}`);
          continue;
        }
      }
      // === HANDLE FORMAT STRING BIASA ===
      else if (newContent !== null && newContent !== undefined && typeof newContent === 'string') {
        finalContent = newContent;
      }
      // === SKIP TIPE LAIN ===
      else {
        console.warn(`[Engineer] ⚠️ Skipping file "${filePath}": format tidak dikenal (${typeof newContent})`);
        continue;
      }

      patchFiles.push({
        path: filePath,
        newContent: finalContent,
        originalContent: fileContents[filePath] || '',
        status: 'PENDING_APPROVAL',
        size: finalContent.length
      });
    }

    const patch = {
      id: `PATCH-${Date.now()}`,
      taskId: task.id,
      files: patchFiles,
      description: task.description || 'Auto-generated patch',
      generatedAt: new Date().toISOString(),
      ready: patchFiles.length > 0,
      rawLLMResponse: rawLLMResponse,
      extractedCodeKeys: Object.keys(generatedCode || {}),
      modelUsed: modelUsed,
      isFallback: isFallback,
      llmError: llmErrorMessage
    };

    eventBus.emit('Engineer:PatchGenerated', patch);
    return patch;
  } catch (error) {
    console.error('[Engineer] Patch generation failed:', error);
    return { files: [], description: `Patch generation failed: ${error.message}`, ready: false, error: error.message };
  }
}

/**
 * [FIX #3] Menyertakan Session Artifact context untuk handoff antar model AI.
 * [ADR-0017 Fase 7 / §2.1] Snippet per-file sekarang dipangkas presisi via
 * `extractRelevantSnippet()` (identifier-based + brace-matching string-aware),
 * bukan potongan 4000-awal+4000-akhir berbasis jumlah karakter. Format output
 * yang diminta SELALU search-replace, untuk semua ukuran file — bukan cuma
 * file besar seperti versi lama.
 * @param {Object} deps - { brain, injectArtifactIntoPrompt }
 */
export function buildPatchPrompt(task, fileContents, deps) {
  const { brain, injectArtifactIntoPrompt } = deps;

  let prompt = `### SYSTEM INSTRUCTION (WAJIB DIPATUHI) ###\n`;
  prompt += `Anda adalah Mamet Engineer. Tugas Anda adalah menghasilkan PATCH FILE dalam format JSON MURNI.\n\n`;

  prompt += `### PERINGATAN KERAS ###\n`;
  prompt += `- Jika Anda tidak mengembalikan JSON murni, sistem akan ERROR.\n`;
  prompt += `- JANGAN menulis kalimat pembuka atau penutup.\n`;
  prompt += `- JANGAN menggunakan markdown code block.\n`;
  prompt += `- HANYA JSON yang akan diproses.\n`;
  prompt += `- SELALU gunakan format SEARCH-REPLACE (lihat di bawah), untuk SEMUA file apa pun ukurannya.\n\n`;

  const artifactContext = injectArtifactIntoPrompt ? injectArtifactIntoPrompt() : '';
  if (artifactContext) {
    prompt += `### KONTEKS SESI SEBELUMNYA ###\n`;
    prompt += `(Gunakan ini sebagai referensi keputusan yang sudah diambil dalam sesi ini)\n`;
    prompt += artifactContext;
    prompt += `\n\n`;
  }

  // 🧠 VERIFIED APPROACH MEMORY: inject pendekatan terbukti dari sesi-sesi sebelumnya
  const verifiedApproaches = brain?.verifiedApproaches || [];
  const rejectedPatterns = brain?.rejectedPatterns || [];

  if (verifiedApproaches.length > 0 || rejectedPatterns.length > 0) {
    prompt += `### MEMORI ENGINEER (DARI SESI-SESI SEBELUMNYA) ###\n`;
    prompt += `Gunakan ini sebagai panduan — pendekatan yang sudah terbukti berhasil atau pernah ditolak.\n\n`;

    if (verifiedApproaches.length > 0) {
      prompt += `✅ PENDEKATAN YANG TERBUKTI BERHASIL:\n`;
      verifiedApproaches.slice(0, 5).forEach((a, i) => {
        const files = (a.files || []).map(f => f.split('/').pop()).join(', ');
        prompt += `${i + 1}. [${a.taskType}] Task: "${(a.taskSummary || '').slice(0, 100)}"\n`;
        prompt += `   File: ${files || '(tidak ada)'} | Disetujui: ${a.approvalCount}x | Terakhir: ${(a.lastApprovedAt || '').slice(0, 10)}\n`;
      });
      prompt += `\n`;
    }

    if (rejectedPatterns.length > 0) {
      prompt += `❌ POLA YANG PERNAH DITOLAK (HINDARI):\n`;
      rejectedPatterns.slice(0, 3).forEach((r, i) => {
        const files = (r.files || []).map(f => f.split('/').pop()).join(', ');
        prompt += `${i + 1}. [${r.taskType}] Task: "${(r.taskSummary || '').slice(0, 100)}"\n`;
        prompt += `   File: ${files || '(tidak ada)'} | Ditolak: ${r.rejectionCount}x | Alasan: ${(r.reason || '-').slice(0, 100)}\n`;
      });
      prompt += `\n`;
    }

    prompt += `=== END MEMORI ENGINEER ===\n\n`;
  }

  prompt += `### ATURAN OUTPUT (CRITICAL - JANGAN DILANGGAR) ###\n`;
  prompt += `1. Karakter PERTAMA output Anda HARUS "{" (kurung kurawal buka)\n`;
  prompt += `2. Karakter TERAKHIR output Anda HARUS "}" (kurung kurawal tutup)\n`;
  prompt += `3. DILARANG KERAS menulis kalimat pembuka (contoh: "Baik", "Tentu", "Berikut", "Ini patch-nya")\n`;
  prompt += `4. DILARANG KERAS menulis kalimat penutup (contoh: "Semoga membantu", "Let me know")\n`;
  prompt += `5. DILARANG KERAS menggunakan markdown code block (\`\`\`json atau \`\`\`)\n`;
  prompt += `6. DILARANG KERAS menambah komentar di luar JSON\n`;
  prompt += `7. Output Anda akan di-PARSE oleh mesin. Jika ada teks di luar JSON, sistem akan ERROR.\n\n`;

  prompt += `### FORMAT JSON WAJIB (SEARCH-REPLACE, SELALU — §2.1) ###\n`;
  prompt += `{\n`;
  prompt += `  "path/lengkap/ke/file.jsx": {\n`;
  prompt += `    "__mode": "search_replace",\n`;
  prompt += `    "changes": [\n`;
  prompt += `      {\n`;
  prompt += `        "search": "KODE ASLI YANG AKAN DIGANTI (EXACT, termasuk whitespace, harus cocok persis dengan snippet di bawah)",\n`;
  prompt += `        "replace": "KODE BARU PENGGANTINYA"\n`;
  prompt += `      }\n`;
  prompt += `    ]\n`;
  prompt += `  }\n`;
  prompt += `}\n\n`;

  prompt += `### CONTOH OUTPUT YANG BENAR ###\n`;
  prompt += `{\n`;
  prompt += `  "frontend/src/components/chat/ConversationEngine.jsx": {\n`;
  prompt += `    "__mode": "search_replace",\n`;
  prompt += `    "changes": [\n`;
  prompt += `      { "search": "return <div>Test</div>;", "replace": "return <div>Updated</div>;" }\n`;
  prompt += `    ]\n`;
  prompt += `  }\n`;
  prompt += `}\n\n`;

  prompt += `### CONTOH OUTPUT YANG SALAH (JANGAN DITIRU) ###\n`;
  prompt += `❌ "Tentu, berikut patch-nya:\\n\`\`\`json\\n{...}\\n\`\`\`\\nSemoga membantu!"\n`;
  prompt += `❌ "Saya akan menambahkan console.log. Ini kodenya: {...}"\n`;
  prompt += `❌ \`\`\`json\\n{...}\\n\`\`\`\n`;
  prompt += `❌ Mengembalikan konten file lengkap sebagai string (bukan search-replace)\n\n`;

  prompt += `### TUGAS ANDA ###\n`;
  prompt += `Task ID: ${task.title || task.id}\n`;
  prompt += `Deskripsi: ${task.description || 'Tidak ada deskripsi'}\n\n`;

  if (Object.keys(fileContents).length > 0) {
    prompt += `### FILE YANG DIMINTA UNTUK DIUBAH (SNIPPET TERFOKUS — §2.1) ###\n`;
    prompt += `(Snippet ini dipangkas presisi ke area target berdasarkan nama fungsi/method yang disebut di deskripsi tugas. "search" pada search-replace Anda HARUS cocok persis dengan teks yang tampil di sini.)\n\n`;

    for (const [path, content] of Object.entries(fileContents)) {
      const identifiers = extractTargetIdentifiers(task, content);
      const snippetResult = extractRelevantSnippet(content, identifiers, 5);

      prompt += `--- FILE: ${path} (${content.length} chars total, baris ${snippetResult.startLine}-${snippetResult.endLine} dari ${snippetResult.totalLines}, method: ${snippetResult.method}) ---\n`;
      prompt += snippetResult.snippet;
      prompt += `\n--- END FILE ---\n\n`;
    }
  }

  prompt += `### ATURAN KODE (WAJIB DIPATUHI) ###\n`;
  prompt += `- Gunakan format search-replace EXACT sesuai instruksi di atas — JANGAN kembalikan konten file penuh\n`;
  prompt += `- Jangan ubah file yang tidak diminta\n`;
  prompt += `- Pertahankan komentar dan dokumentasi yang ada\n`;
  prompt += `- Ikuti standar ESModules\n`;
  prompt += `- JANGAN gunakan eval() atau new Function()\n`;
  prompt += `- Event EventBus HARUS pakai format Kategori:Nama (contoh: Engineer:Ready)\n`;
  prompt += `- DILARANG KERAS menulis eventBus.emit("Engineer:GeneratePatch", ...) di file yang Anda ubah (memicu infinite loop patch)\n`;
  prompt += `- Jangan panggil API vendor langsung (OpenAI, Gemini, dll)\n`;
  prompt += `- JANGAN modifikasi file core (Kernel.js, EventBus.js, ServiceManager.js, dll)\n`;
  prompt += `- Untuk belajar dari eksperimen lama, HANYA baca _knowledge_archive/00_EXPERIMENT_HISTORY.md. DILARANG membaca atau menyalin kode raw dari _knowledge_archive/\n\n`;

  prompt += `### MULAI OUTPUT JSON SEKARANG ###\n`;

  return prompt;
}

export function extractCodeFromResponse(response) {
  try {
    if (!response || typeof response !== 'string') return {};

    try {
      const trimmed = response.trim();
      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        const keys = Object.keys(parsed);
        if (keys.length === 1 && (keys[0] === 'message' || keys[0] === 'reply' || keys[0] === 'content')) {
          const inner = parsed[keys[0]];
          if (typeof inner === 'string' && inner.trim().startsWith('{')) {
            try {
              const innerParsed = JSON.parse(inner);
              if (typeof innerParsed === 'object' && !Array.isArray(innerParsed)) {
                console.log('[Engineer] ✅ Double-JSON unwrapped successfully');
                return innerParsed;
              }
            } catch (_) {}
          }
        }
        return parsed;
      }
    } catch (_) {}

    const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g;
    const codeBlockMatches = [...response.matchAll(codeBlockRegex)];
    for (const match of codeBlockMatches) {
      const jsonCandidate = match[1].trim();
      try {
        const parsed = JSON.parse(jsonCandidate);
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch (_) {
        continue;
      }
    }

    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = response.substring(firstBrace, lastBrace + 1);
      const cleaned = jsonCandidate
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch (_) {}
    }

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch (_) {}
    }

    // =============================================
    // FALLBACK: Ekstrak dari diff atau natural language
    // =============================================
    try {
      // Coba ekstrak file path + content dari diff format
      const diffRegex = /--- a\/(.+?)\n\+\+\+ b\/(.+?)\n@@.*?\n([\s\S]+?)(?=\n---|\n@@|$)/g;
      const matches = [...response.matchAll(diffRegex)];
      if (matches.length > 0) {
        const result = {};
        for (const match of matches) {
          const filePath = match[2] || match[1];
          let content = match[3].trim();
          content = content.split('\n').map(line => {
            if (line.startsWith('+')) return line.substring(1);
            if (line.startsWith('-')) return null;
            return line;
          }).filter(Boolean).join('\n');
          if (content.length > 50) {
            result[filePath] = content;
          }
        }
        if (Object.keys(result).length > 0) {
          console.log('[Engineer] ✅ Extracted files from diff format:', Object.keys(result));
          return result;
        }
      }

      const fileBlockRegex = /(?:file|path)\s*[:：]\s*([^\n]+)\s*```(?:js|ts|jsx|tsx|json)\s*\n([\s\S]+?)\s*```/gi;
      const blockMatches = [...response.matchAll(fileBlockRegex)];
      if (blockMatches.length > 0) {
        const result = {};
        for (const match of blockMatches) {
          const filePath = match[1].trim();
          const content = match[2].trim();
          if (content.length > 50) {
            result[filePath] = content;
          }
        }
        if (Object.keys(result).length > 0) {
          console.log('[Engineer] ✅ Extracted files from named code blocks:', Object.keys(result));
          return result;
        }
      }
    } catch (e) {
      console.warn('[Engineer] Fallback extraction error:', e.message);
    }

    return {};
  } catch (e) {
    console.warn('[Engineer] Failed to extract code from response:', e);
    return {};
  }
}

export function generateFallbackPatch(task, fileContents) {
  const result = {};
  for (const filePath of Object.keys(fileContents)) {
    result[filePath] = fileContents[filePath] + '\n// TODO: Implement changes for task: ' + (task.title || task.id);
  }
  return result;
}
