
export function extractExports(content) {
  if (!content || typeof content !== 'string') return [];
  const names = new Set();
  const patterns = [
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    /export\s+(?:const|let|var)\s+(\w+)/g,
    /export\s+class\s+(\w+)/g,
    /export\s+type\s+(\w+)/g,
    /export\s+interface\s+(\w+)/g,
    /export\s+\{([^}]+)\}/g,
  ];
  for (const pattern of patterns) {
    let match;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(content)) !== null) {
      match[1].split(',').forEach(part => {
        const clean = part.trim().split(/\s+as\s+/)[0].trim();
        if (clean && /^\w+$/.test(clean)) names.add(clean);
      });
    }
  }
  return [...names];
}

export function extractFunctionSignatures(content) {
  if (!content || typeof content !== 'string') return new Map();
  const sigs = new Map();

  const fnRe = /export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
  let m;
  while ((m = fnRe.exec(content)) !== null) {
    const name   = m[1];
    const params = m[2].trim();
    const count  = params === '' ? 0 : params.split(',').length;
    sigs.set(name, count);
  }

  const arrowRe = /export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g;
  while ((m = arrowRe.exec(content)) !== null) {
    const name   = m[1];
    const params = m[2].trim();
    const count  = params === '' ? 0 : params.split(',').length;
    if (!sigs.has(name)) sigs.set(name, count);
  }

  return sigs;
}

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
    .slice(0, 200);

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

export async function detectBreakingChanges(patch, deps) {
  const warnings = [];
  for (const file of patch.files) {
    if (!file.originalContent || !file.newContent) continue;
    if (file.originalContent.trim().length === 0) continue;

    const originalExports = extractExports(file.originalContent);
    const newExports      = extractExports(file.newContent);

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

    const survivingExports = originalExports.filter(name => newExports.includes(name));
    if (survivingExports.length > 0) {
      const originalSigs = extractFunctionSignatures(file.originalContent);
      const newSigs      = extractFunctionSignatures(file.newContent);

      for (const symbol of survivingExports) {
        const origCount = originalSigs.get(symbol);
        const newCount  = newSigs.get(symbol);
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

    if (!writtenContent || writtenContent.trim().length === 0) {
      issues.push({ file: file.path, issue: 'File kosong setelah patch', severity: 'CRITICAL' });
      continue;
    }

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
