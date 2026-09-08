/**
 * TaskHandlers — Jalur read-only Engineer: membangun dynamic context,
 * menangani task ANALYSIS/REVIEW, dan seluruh alur READ_REPO (baca file,
 * list direktori, cari file) beserta parser teks prompt-nya.
 *
 * Diekstrak dari engineer.js (Fase 6, ADR-0017). `_handleAnalysisTask` dan
 * `_handleReviewTask` masih bergantung pada `_analyze`/`_review`/
 * `_calculateConfidence` yang belum diekstrak (target Fase 7/8) — deps
 * membawa fungsi-fungsi itu dalam bentuk sudah di-bind dari engineer.js.
 * `brain` dan `metrics` diteruskan by-reference (objek), sama seperti pola
 * Map di fase-fase sebelumnya — mutasi (`brain.dynamic = ...`,
 * `metrics.tasksAnalyzed++`) tetap terlihat di instance Engineer asli.
 */
import { extractFileNamesFromTask } from './FileSystemGateway.js';

/**
 * @param {Object} task
 * @param {Object} deps - { fileIndexService, brain, sessionArtifact }
 */
export async function buildDynamicContext(task, deps) {
  const { fileIndexService, brain, sessionArtifact } = deps;
  const targetFiles = task.files || extractFileNamesFromTask(task);
  let availableFiles = [];

  try {
    if (fileIndexService && fileIndexService.isReady) {
      availableFiles = fileIndexService.getAllFiles?.() || [];
    }
  } catch (e) {
    console.warn('[Engineer] Gagal mengambil file list dari FileIndexService:', e.message);
  }

  return {
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      files: targetFiles,
      requestedModel: task.requestedModel || null
    },
    projectContext: {
      totalIndexedFiles: availableFiles.length,
      targetFileCount: targetFiles.length,
      staticKnowledgeLoaded: brain.static?.loadedFiles?.length || 0
    },
    sessionContext: sessionArtifact ? sessionArtifact.getSummary() : null,
    timestamp: new Date().toISOString()
  };
}

/**
 * @param {Object} task
 * @param {Object} deps - { metrics, brain, fileIndexService, sessionArtifact, analyze, updateArtifact, emitRecommendation, calculateConfidence }
 */
export async function handleAnalysisTask(task, deps) {
  const { metrics, brain, fileIndexService, sessionArtifact, analyze, updateArtifact, emitRecommendation, calculateConfidence } = deps;
  metrics.tasksAnalyzed++;
  console.log(`[Engineer] Analyzing task: ${task.title || task.id}`);
  brain.dynamic = await buildDynamicContext(task, { fileIndexService, brain, sessionArtifact });
  const analysis = await analyze(task);

  updateArtifact('ANALYSIS', {
    taskId: task.id,
    files: Object.keys(analysis.rawContext || {}),
    violations: analysis.compliance?.violations || [],
    summary: analysis.summary
  });

  emitRecommendation({
    type: 'ANALYSIS',
    taskId: task.id,
    analysis,
    confidence: calculateConfidence(analysis),
    requiresApproval: false
  });
}

/**
 * @param {Object} task
 * @param {Object} deps - { metrics, brain, fileIndexService, sessionArtifact, review, emitRecommendation, calculateConfidence }
 */
export async function handleReviewTask(task, deps) {
  const { metrics, brain, fileIndexService, sessionArtifact, review, emitRecommendation, calculateConfidence } = deps;
  metrics.recommendationsMade++;
  console.log(`[Engineer] Reviewing changes for: ${task.title || task.id}`);
  brain.dynamic = await buildDynamicContext(task, { fileIndexService, brain, sessionArtifact });
  const reviewResult = await review(task);
  emitRecommendation({
    type: 'REVIEW',
    taskId: task.id,
    review: reviewResult,
    confidence: calculateConfidence(reviewResult),
    requiresApproval: false
  });
}

/**
 * Handler utama untuk intent READ_REPO.
 * @param {Object} task
 * @param {Object} deps - { repositoryReader, emitRecommendation, fileIndexService, sessionArtifact, eventBus }
 */
export async function handleReadRepoTask(task, deps) {
  const { repositoryReader, emitRecommendation } = deps;
  const taskText = `${task.title || ''} ${task.description || ''}`;
  console.log(`[Engineer] 📂 READ_REPO task: ${task.title || task.id}`);

  if (!repositoryReader) {
    emitRecommendation({
      type: 'READ_REPO_ERROR',
      taskId: task.id,
      message: '❌ **RepositoryReaderService** belum tersedia. Coba restart OS.',
      requiresApproval: false
    });
    return;
  }

  const isListRequest = /list|daftar|struktur|tree|folder|direktori|directory/i.test(taskText);
  const isSearchRequest = /cari|search|find|dimana|where/i.test(taskText);

  if (isListRequest) {
    const dirPath = extractDirectoryFromPrompt(taskText);
    await handleListDirectory(task, dirPath, deps);
  } else if (isSearchRequest) {
    const query = extractSearchQueryFromPrompt(taskText);
    await handleSearchFiles(task, query, deps);
  } else {
    const paths = extractPathsFromPrompt(taskText);
    if (paths.length === 0) {
      emitRecommendation({
        type: 'READ_REPO_CLARIFICATION',
        taskId: task.id,
        message: '❓ **Engineer** — Sebutkan nama file atau path yang ingin dibaca.\n\nContoh:\n- `baca file Kernel.js`\n- `tampilkan isi engineer.js`\n- `list folder frontend/src/core`\n- `cari file BrainService`',
        requiresApproval: false
      });
      return;
    }
    await handleReadFiles(task, paths, deps);
  }
}

/**
 * Membaca satu atau beberapa file dan emit hasilnya ke UI.
 * @param {Object} deps - { fileIndexService, repositoryReader, sessionArtifact, eventBus, emitRecommendation }
 */
export async function handleReadFiles(task, paths, deps) {
  const { fileIndexService, repositoryReader, sessionArtifact, eventBus, emitRecommendation } = deps;
  const results = [];
  const errors = [];

  for (const requestedPath of paths) {
    let resolvedPath = requestedPath;
    if (!requestedPath.includes('/') && fileIndexService?.isReady) {
      const resolved = fileIndexService.resolvePath(requestedPath);
      if (resolved) {
        resolvedPath = resolved;
        console.log(`[Engineer] 🔍 Path resolved: ${requestedPath} → ${resolvedPath}`);
      }
    }

    const result = await repositoryReader.readFile(resolvedPath);
    if (result) {
      results.push(result);
      sessionArtifact?.addAnalyzedFile(resolvedPath);
    } else {
      const searchResults = await repositoryReader.searchFiles(requestedPath);
      if (searchResults.length > 0) {
        const firstMatch = searchResults[0];
        const fallback = await repositoryReader.readFile(firstMatch);
        if (fallback) {
          results.push(fallback);
          sessionArtifact?.addAnalyzedFile(firstMatch);
        } else {
          errors.push(requestedPath);
        }
      } else {
        errors.push(requestedPath);
      }
    }
  }

  if (results.length === 0) {
    emitRecommendation({
      type: 'READ_REPO_NOT_FOUND',
      taskId: task.id,
      message: `❌ **Engineer** — File tidak ditemukan: ${errors.join(', ')}\n\nGunakan \`cari file [nama]\` untuk mencari file yang dimaksud.`,
      requiresApproval: false
    });
    return;
  }

  for (const file of results) {
    eventBus.emit('Engineer:FileContent', {
      taskId: task.id,
      path: file.path,
      content: file.content,
      size: file.size,
      backend: file.backend,
      from: 'Engineer',
      timestamp: new Date().toISOString()
    });
  }

  const summary = results.map(r => `📄 \`${r.path}\` (${r.size} chars)`).join('\n');
  const errorNote = errors.length > 0 ? `\n\n⚠️ Tidak ditemukan: ${errors.join(', ')}` : '';

  emitRecommendation({
    type: 'READ_REPO_RESULT',
    taskId: task.id,
    message: `✅ **Engineer** — ${results.length} file berhasil dibaca:\n\n${summary}${errorNote}`,
    files: results.map(r => ({ path: r.path, size: r.size, content: r.content })),
    requiresApproval: false
  });
}

/**
 * Mendaftar isi direktori dan emit hasilnya.
 * @param {Object} deps - { repositoryReader, emitRecommendation }
 */
export async function handleListDirectory(task, dirPath, deps) {
  const { repositoryReader, emitRecommendation } = deps;
  const entries = await repositoryReader.listDirectory(dirPath);

  if (entries.length === 0) {
    emitRecommendation({
      type: 'READ_REPO_EMPTY',
      taskId: task.id,
      message: `📁 **Engineer** — Direktori \`${dirPath || '(root)'}\` kosong atau tidak ditemukan.`,
      requiresApproval: false
    });
    return;
  }

  const dirs = entries.filter(e => e.type === 'dir');
  const files = entries.filter(e => e.type !== 'dir');
  let listing = `📁 **Isi direktori:** \`${dirPath || '(root)'}\`\n\n`;
  if (dirs.length) listing += `**Folder (${dirs.length}):**\n` + dirs.map(d => `  📁 ${d.name}`).join('\n') + '\n\n';
  if (files.length) listing += `**File (${files.length}):**\n` + files.map(f => `  📄 ${f.name}`).join('\n');

  emitRecommendation({
    type: 'READ_REPO_LISTING',
    taskId: task.id,
    message: listing,
    entries,
    dirPath,
    requiresApproval: false
  });
}

/**
 * Mencari file berdasarkan query dan emit hasilnya.
 * @param {Object} deps - { repositoryReader, emitRecommendation }
 */
export async function handleSearchFiles(task, query, deps) {
  const { repositoryReader, emitRecommendation } = deps;
  const matches = await repositoryReader.searchFiles(query);

  if (matches.length === 0) {
    emitRecommendation({
      type: 'READ_REPO_NOT_FOUND',
      taskId: task.id,
      message: `🔍 **Engineer** — Tidak ada file yang cocok dengan: \`${query}\``,
      requiresApproval: false
    });
    return;
  }

  const listing = matches.slice(0, 30).map(p => `  📄 ${p}`).join('\n');
  const note = matches.length > 30 ? `\n\n_...dan ${matches.length - 30} file lainnya._` : '';

  emitRecommendation({
    type: 'READ_REPO_SEARCH_RESULT',
    taskId: task.id,
    message: `🔍 **Engineer** — Ditemukan **${matches.length} file** untuk: \`${query}\`\n\n${listing}${note}\n\nGunakan \`baca file [nama lengkap]\` untuk membaca isinya.`,
    matches,
    query,
    requiresApproval: false
  });
}

/**
 * Mengekstrak path/nama file dari teks prompt.
 * Contoh: "baca file Kernel.js" → ["Kernel.js"]
 */
export function extractPathsFromPrompt(text) {
  const paths = [];

  const extPattern = /[\w\-./]+\.(js|jsx|ts|tsx|css|scss|md|json|html|txt|yaml|yml|cjs|mjs|env)/gi;
  const extMatches = text.match(extPattern) || [];
  paths.push(...extMatches);

  const pathPattern = /(?:file|path|dari|of|di|in)\s+([\w\-./]+)/gi;
  let m;
  while ((m = pathPattern.exec(text)) !== null) {
    if (!paths.includes(m[1])) paths.push(m[1]);
  }

  return [...new Set(paths)].filter(p => p.length > 2);
}

/**
 * Mengekstrak nama direktori dari teks prompt.
 */
export function extractDirectoryFromPrompt(text) {
  const pathPattern = /(?:folder|direktori|directory|di|in|of)\s+([\w\-./]+)/i;
  const m = text.match(pathPattern);
  if (m) return m[1].replace(/\\/g, '/');

  const pathLike = text.match(/[\w]+\/[\w./\-]*/);
  if (pathLike) return pathLike[0];

  return '';
}

/**
 * Mengekstrak query pencarian dari teks prompt.
 */
export function extractSearchQueryFromPrompt(text) {
  const m = text.match(/(?:cari|search|find|dimana|where(?:\s+is)?)\s+(?:file\s+)?(.+)/i);
  if (m) return m[1].trim().replace(/\?$/, '');
  return text.replace(/cari|search|find|file/gi, '').trim();
}
