/**
 * StaticCodeAnalyzer — Analisis kode statis berbasis regex (bukan AST), tanpa panggilan LLM.
 *
 * Diekstrak dari engineer.js (Fase 3, ADR-0017). `extractExports` dan
 * `extractFunctionSignatures` murni (input string, output data). `findUsages`
 * dan `verifySemanticDiff` butuh akses `fileIndexService`/`storageManager` —
 * diterima lewat parameter `deps`, pola sama seperti CapabilityGuard.js Fase 2.
 */

/**
 * Ekstrak semua nama export dari isi file (function/const/let/var/class/type/interface/named export).
 * @param {string} content - Isi file
 * @returns {string[]} Daftar nama yang di-export
 */
export function extractExports(content) {
  if (!content || typeof content !== 'string') return [];
  const names = new Set();
  const patterns = [
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    /export\s+(?:const|let|var)\s+(\w+)/g,
    /export\s+class\s+(\w+)/g,
    /export\s+type\s+(\w+)/g,
    /export\s+interface\s+(\w+)/g,
    /export\s+\{([^}]+)\}/g,        // export { a, b as c }
  ];
  for (const pattern of patterns) {
    let match;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(content)) !== null) {
      // Handle export { a, b as c } — bisa berisi banyak nama
      match[1].split(',').forEach(part => {
        const clean = part.trim().split(/\s+as\s+/)[0].trim();
        if (clean && /^\w+$/.test(clean)) names.add(clean);
      });
    }
  }
  return [...names];
}

/**
 * Extract signature (nama → jumlah parameter) untuk setiap export function di file.
 * Hanya menangani export function dan export const arrow — cukup untuk mendeteksi
 * perubahan arity yang bisa merusak caller.
 * @param {string} content - Isi file
 * @returns {Map<string, number>} nama → jumlah parameter
 */
export function extractFunctionSignatures(content) {
  if (!content || typeof content !== 'string') return new Map();
  const sigs = new Map();

  // export function foo(a, b) { / export async function foo(a, b) {
  const fnRe = /export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
  let m;
  while ((m = fnRe.exec(content)) !== null) {
    const name   = m[1];
    const params = m[2].trim();
    const count  = params === '' ? 0 : params.split(',').length;
    sigs.set(name, count);
  }

  // export const foo = (a, b) => / export const foo = async (a, b) =>
  const arrowRe = /export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g;
  while ((m = arrowRe.exec(content)) !== null) {
    const name   = m[1];
    const params = m[2].trim();
    const count  = params === '' ? 0 : params.split(',').length;
    // Prioritaskan export function kalau sudah ada (lebih reliable)
    if (!sigs.has(name)) sigs.set(name, count);
  }

  return sigs;
}

/**
 * Cari semua file di codebase yang mengandung symbol tertentu.
 * Gunakan fileIndexService.getAllFiles() + storageManager.read per file.
 * Dibatasi 200 file agar tidak terlalu lambat.
 * @param {string} symbol - Nama fungsi/class/const yang dicari
 * @param {string} excludePath - Path file sumber yang dilewati
 * @param {Object} deps - { fileIndexService, storageManager }
 * @returns {Promise<string[]>} List file path yang menggunakan symbol
 */
export async function findUsages(symbol, excludePath, deps) {
  const { fileIndexService, storageManager } = deps;
  const callers = [];
  if (!fileIndexService?.isReady) return callers;

  const SOURCE_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'];
  const SKIP_DIRS = ['node_modules', '.git', 'dist', 'release', '.vite', 'mamet_fs', 'backup'];

  const allFiles = fileIndexService.getAllFiles()
    .filter(p => {
      const normalized = p.replace(/\\/g, '/');
      if (normalized === excludePath?.replace(/\\/g, '/')) return false;
      if (SKIP_DIRS.some(d => normalized.includes(`/${d}/`) || normalized.startsWith(`${d}/`))) return false;
      return SOURCE_EXTS.some(ext => normalized.endsWith(ext));
    })
    .slice(0, 200); // limit agar tidak freeze

  for (const filePath of allFiles) {
    try {
      const content = await storageManager.read(filePath);
      if (content && content.includes(symbol)) {
        callers.push(filePath);
      }
    } catch (_) {}
  }
  return callers;
}

/**
 * [C] Breaking Change Detector — dipanggil setelah patch di-generate, sebelum _requestApproval.
 * Cari export yang hilang/berubah dan cek apakah masih dipakai file lain.
 * @param {Object} patch - Patch yang akan diterapkan
 * @param {Object} deps - { fileIndexService, storageManager }
 * @returns {Promise<Array>} warnings[] — { file, symbol, callers[], severity }
 */
export async function detectBreakingChanges(patch, deps) {
  const warnings = [];
  for (const file of patch.files) {
    if (!file.originalContent || !file.newContent) continue;
    // Skip file baru (belum ada original)
    if (file.originalContent.trim().length === 0) continue;

    const originalExports = extractExports(file.originalContent);
    const newExports      = extractExports(file.newContent);

    // --- Fase 1: Export yang ada di original tapi hilang di versi baru ---
    const removedExports = originalExports.filter(name => !newExports.includes(name));
    for (const symbol of removedExports) {
      const callers = await findUsages(symbol, file.path, deps);
      warnings.push({
        file: file.path,
        symbol,
        callers,
        severity: callers.length > 0 ? 'HIGH' : 'LOW'
      });
    }

    // --- Fase 2: Export yang masih ada tapi signature (arity) berubah ---
    // Perubahan jumlah parameter bisa merusak caller walau nama export tetap sama.
    const survivingExports = originalExports.filter(name => newExports.includes(name));
    if (survivingExports.length > 0) {
      const originalSigs = extractFunctionSignatures(file.originalContent);
      const newSigs      = extractFunctionSignatures(file.newContent);

      for (const symbol of survivingExports) {
        const origCount = originalSigs.get(symbol);
        const newCount  = newSigs.get(symbol);
        // Hanya flag kalau keduanya terdeteksi (keduanya adalah function) dan berbeda
        if (origCount !== undefined && newCount !== undefined && origCount !== newCount) {
          const callers = await findUsages(symbol, file.path, deps);
          warnings.push({
            file: file.path,
            symbol,
            callers,
            type: 'SIGNATURE_CHANGED',
            detail: `Parameter berubah: ${origCount} → ${newCount} (mungkin aman jika parameter baru optional)`,
            severity: 'MEDIUM'
          });
        }
      }
    }
  }
  return warnings;
}

// =============================================
// SEMANTIC DIFF VERIFICATION
// Setelah patch ditulis: baca ulang file dan verifikasi
// struktur masih valid — export tidak hilang, tidak kosong.
// =============================================

/**
 * [D] Semantic Diff Verification — dipanggil setelah _executePatchApplication.
 * Re-read setiap file yang berhasil ditulis dan cek:
 * - File tidak kosong
 * - Export original masih ada
 * - Tidak ada truncation silent (di luar check size yang sudah ada)
 * @param {Object} patch - Patch yang sudah diterapkan
 * @param {Object} deps - { storageManager }
 * @returns {Promise<Array>} issues[] — { file, issue, severity }
 */
export async function verifySemanticDiff(patch, deps) {
  const { storageManager } = deps;
  const issues = [];
  for (const file of patch.files) {
    if (file.status !== 'APPLIED') continue;
    let writtenContent;
    try {
      writtenContent = await storageManager.read(file.path);
    } catch (e) {
      issues.push({ file: file.path, issue: 'Tidak bisa membaca file setelah ditulis', severity: 'CRITICAL' });
      continue;
    }

    // 1. File kosong
    if (!writtenContent || writtenContent.trim().length === 0) {
      issues.push({ file: file.path, issue: 'File kosong setelah patch', severity: 'CRITICAL' });
      continue;
    }

    // 2. Export original hilang dari file yang sudah ditulis
    if (file.originalContent) {
      const originalExports = extractExports(file.originalContent);
      const writtenExports  = extractExports(writtenContent);
      const missingExports  = originalExports.filter(e => !writtenExports.includes(e));
      if (missingExports.length > 0) {
        issues.push({
          file: file.path,
          issue: `Export hilang setelah patch: ${missingExports.join(', ')}`,
          severity: 'HIGH'
        });
      }
    }

    // 3. File sangat kecil tanpa komentar (< 5 baris kode nyata)
    const realLines = writtenContent.split('\n').filter(l => {
      const t = l.trim();
      return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    });
    if (realLines.length < 5 && (file.originalContent?.split('\n').length || 0) > 20) {
      issues.push({
        file: file.path,
        issue: `File terlalu pendek setelah patch (${realLines.length} baris kode vs ${file.originalContent.split('\n').length} sebelumnya)`,
        severity: 'HIGH'
      });
    }
  }
  return issues;
}
