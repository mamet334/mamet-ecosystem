/**
 * FileSystemGateway — Satu-satunya tempat Engineer bicara ke StorageManager/
 * FileIndexService untuk membaca source code.
 *
 * Diekstrak dari engineer.js (Fase 4, ADR-0017). `extractFileNamesFromTask` dan
 * `findRelevantADR` murni (regex/keyword matching atas teks task). `readFile`,
 * `findFiles`, `tryReadFile` butuh `storageManager`/`fileIndexService` lewat
 * parameter `deps`, pola sama seperti modul Fase 2 & 3.
 */

// =============================================
// FILE OPERATIONS
// =============================================

export async function readFile(filePath, deps) {
  const { storageManager } = deps;
  try {
    const content = await storageManager.read(filePath);
    if (content === null) {
      console.warn(`[Engineer] File tidak ditemukan: ${filePath}`);
      return null;
    }
    console.log(`[Engineer] File dibaca: ${filePath} (${content.length} karakter)`);
    return content;
  } catch (error) {
    console.error(`[Engineer] Gagal membaca file ${filePath}:`, error);
    return null;
  }
}

export async function findFiles(pattern, dir = '.', deps) {
  const { storageManager } = deps;
  try {
    const allFiles = await storageManager.list(dir);
    if (pattern === '*') return allFiles;
    if (pattern.endsWith('*')) {
      const prefix = pattern.replace('*', '');
      return allFiles.filter(f => f.startsWith(dir + prefix) || f.includes(prefix));
    }
    if (pattern.startsWith('*.')) {
      const ext = pattern.replace('*', '');
      return allFiles.filter(f => f.endsWith(ext));
    }
    return allFiles.filter(f => f.includes(pattern));
  } catch (error) {
    console.error(`[Engineer] Gagal mencari file:`, error);
    return [];
  }
}

// =============================================
// TASK TEXT EXTRACTION (murni, tanpa I/O)
// =============================================

export function extractFileNamesFromTask(task) {
  const text = `${task.title || ''} ${task.description || ''}`;
  console.log('[Engineer] Task text for extraction:', text);

  const fullPathRegex = /(frontend\/[a-zA-Z0-9_\-./]+\.(jsx?|tsx?|ts|json|md))/gi;
  const fullPathMatches = [...text.matchAll(fullPathRegex)];
  if (fullPathMatches.length > 0) {
    const extracted = [...new Set(fullPathMatches.map(m => m[0]))];
    console.log('[Engineer] Extracted full paths:', extracted);
    return extracted;
  }

  const srcPathRegex = /(src\/[a-zA-Z0-9_\-./]+\.(jsx?|tsx?|ts|json|md))/gi;
  const srcPathMatches = [...text.matchAll(srcPathRegex)];
  if (srcPathMatches.length > 0) {
    const extracted = [...new Set(srcPathMatches.map(m => m[0]))];
    console.log('[Engineer] Extracted src paths:', extracted);
    return extracted;
  }

  const nameRegex = /([a-zA-Z0-9_\-]+\.(jsx?|tsx?|ts|json|md))/gi;
  const nameMatches = [...text.matchAll(nameRegex)];
  const extracted = [...new Set(nameMatches.map(m => m[1]))];
  console.log('[Engineer] Extracted filenames (fallback):', extracted);
  return extracted;
}

export function findRelevantADR(task) {
  const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();

  const adrMapping = [
    { keywords: ['event', 'bus', 'emit', 'listener'], file: 'constitution/11_MAEF_EVENT_SYSTEM.md' },
    { keywords: ['kernel', 'boot', 'phase', 'service'], file: 'constitution/02_MAEF_KERNEL.md' },
    { keywords: ['adapter', 'vendor', 'openrouter', 'gemini'], file: 'constitution/12_CAPABILITY_ADAPTER_SPEC.md' },
    { keywords: ['verification', 'confidence', 'evidence'], file: 'constitution/13_VERIFICATION_ENGINE_SPEC.md' },
    { keywords: ['memory', 'user_memory', 'project_memory'], file: 'constitution/06_MEMORY_SYSTEM.md' },
    { keywords: ['rag', 'embedding', 'vector', 'chunk'], file: 'constitution/05_KNOWLEDGE_SYSTEM.md' },
    { keywords: ['engineer', 'patch', 'self-maintenance'], file: 'constitution/07_ENGINEERING_SYSTEM.md' },
    { keywords: ['logging', 'telemetry', 'observability'], file: 'constitution/15_LOGGING_OBSERVABILITY_SYSTEM.md' },
    { keywords: ['metric', 'health', 'shi'], file: 'constitution/16_ENGINEERING_METRICS_SYSTEM.md' }
  ];

  for (const mapping of adrMapping) {
    if (mapping.keywords.some(kw => text.includes(kw))) {
      return { title: mapping.file, path: mapping.file };
    }
  }

  return null;
}

/**
 * Coba baca file dengan beberapa strategi fallback: path langsung, tambah
 * ekstensi umum, lalu resolve via FileIndexService berdasarkan nama file saja.
 * @param {string} basePath
 * @param {Object} deps - { storageManager, fileIndexService }
 * @returns {Promise<{content: string, path: string}|null>}
 */
export async function tryReadFile(basePath, deps) {
  const { storageManager, fileIndexService } = deps;
  const normalizedBase = basePath.replace(/\\/g, '/');

  if (fileIndexService && !fileIndexService.isReady) {
    console.log('[Engineer] Menunggu FileIndexService selesai membangun indeks...');
    let attempts = 0;
    while (!fileIndexService.isReady && attempts < 100) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
  }

  let content = await storageManager.read(normalizedBase);
  if (content !== null && content !== undefined) {
    return { content, path: normalizedBase };
  }

  const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md'];
  const baseName = normalizedBase.replace(/\.[^.]+$/, '');

  for (const ext of extensions) {
    const candidate = baseName + ext;
    try {
      const content = await storageManager.read(candidate);
      if (content !== null && content !== undefined) {
        console.log(`[Engineer:_tryReadFile] ✅ BERHASIL membaca: "${candidate}"`);
        return { content, path: candidate };
      }
    } catch (_) {}
  }

  if (fileIndexService && fileIndexService.isReady) {
    const fileName = normalizedBase.split('/').pop();
    console.log(`[Engineer:_tryReadFile] 🔍 Mencari "${fileName}" via FileIndexService...`);
    const resolvedPath = fileIndexService.resolvePath(fileName);
    if (resolvedPath) {
      console.log(`[Engineer:_tryReadFile] 📍 FileIndexService meresolve ke: "${resolvedPath}"`);
      const content = await storageManager.read(resolvedPath);
      if (content !== null && content !== undefined) {
        return { content, path: resolvedPath };
      }
    }
  }

  console.log(`[Engineer:_tryReadFile] ❌ GAGAL: Semua metode gagal untuk "${normalizedBase}"`);
  return null;
}
