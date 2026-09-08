/**
 * CodeSnippetExtractor — Implementasi SPESIFIKASI-TEKNIS-MAMET-OS-v2.md §2.1
 * "Scoped Snippet Extraction (Mengganti Full-File Reading)".
 *
 * Modul PURE, tanpa dependency ke instance Engineer atau I/O apa pun — hanya
 * menerima string/array dan mengembalikan data. Menggantikan potongan lama
 * berbasis jumlah-karakter (4000 awal + 4000 akhir) di `_buildPatchPrompt()`
 * dengan pemangkasan presisi berbasis identifier (nama fungsi/method/class
 * yang disebut di task), plus brace-matching yang SADAR-STRING (wajib per
 * §2.1.4 — file seperti engineer.js sendiri menulis '{'/'}' literal di dalam
 * template literal saat membangun prompt, brace counter naif akan salah).
 */

const IDENTIFIER_TOKEN_REGEX = /\b_?[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)*\b/g;

/**
 * §2.1.3 — Mengekstrak kandidat identifier (camelCase/PascalCase/snake_case/
 * _prefixed) dari teks task, lalu memvalidasi ulang terhadap identifier yang
 * benar-benar muncul di `fileContent` — membuang kandidat yang cuma kebetulan
 * mirip kata biasa (mis. "refactor", "file").
 * @param {Object} task - { title, description }
 * @param {string} fileContent
 * @returns {string[]} Identifier tervalidasi, urutan kemunculan di task
 */
export function extractTargetIdentifiers(task, fileContent) {
  const text = `${task?.title || ''} ${task?.description || ''}`;
  const tokens = text.match(IDENTIFIER_TOKEN_REGEX) || [];

  const isCodeShaped = (tok) =>
    tok.startsWith('_') || /[a-z][A-Z]/.test(tok) || /^[A-Z][a-z]/.test(tok) || tok.includes('_');

  const seen = new Set();
  const validated = [];
  for (const tok of tokens) {
    if (tok.length < 3 || seen.has(tok)) continue;
    if (!isCodeShaped(tok)) continue;
    // Validasi ulang: identifier harus benar-benar muncul di file (word boundary)
    const presence = new RegExp(`\\b${_escapeRegex(tok)}\\b`);
    if (!presence.test(fileContent)) continue;
    seen.add(tok);
    validated.push(tok);
  }
  return validated;
}

/**
 * §2.1.2 — Fungsi utama: memangkas fileContent menjadi snippet relevan.
 * @param {string} fileContent - Isi file lengkap (tetap disimpan utuh di
 *   memori oleh caller untuk keperluan apply search-replace nanti — HANYA
 *   payload prompt yang dipangkas oleh fungsi ini).
 * @param {string[]} targetIdentifiers - Nama fungsi/method/class dari task.
 * @param {number} contextLines - Baris konteks di sekitar target (default 5).
 * @returns {{snippet: string, startLine: number, endLine: number, totalLines: number,
 *            identifierFound: boolean, method: 'identifier'|'keyword-scan'|'full-file'}}
 */
export function extractRelevantSnippet(fileContent, targetIdentifiers = [], contextLines = 5) {
  const lines = fileContent.split('\n');
  const totalLines = lines.length;

  if (fileContent.length <= 3000) {
    return {
      snippet: fileContent,
      startLine: 1,
      endLine: totalLines,
      totalLines,
      identifierFound: true,
      method: 'full-file'
    };
  }

  const headerEndLine = _detectHeaderEnd(lines);

  const blocks = [];
  for (const id of targetIdentifiers) {
    const startLine = _findDeclarationLine(lines, id);
    if (startLine === -1) continue;
    const endLine = _findBlockEnd(lines, startLine);
    blocks.push({ id, startLine, endLine });
  }

  if (blocks.length === 0) {
    return _keywordDensityFallback(lines, targetIdentifiers, headerEndLine, totalLines);
  }

  blocks.sort((a, b) => a.startLine - b.startLine);
  const snippet = _assembleSnippet(lines, headerEndLine, blocks, contextLines);

  return {
    snippet,
    startLine: blocks[0].startLine + 1,
    endLine: blocks[blocks.length - 1].endLine + 1,
    totalLines,
    identifierFound: true,
    method: 'identifier'
  };
}

// =============================================
// Internal helpers (tidak diekspor)
// =============================================

function _escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Baris terakhir (0-based, inklusif) dari blok import/const-require di atas
 * file — dinamis, berhenti di baris kosong pertama SETELAH blok tersebut
 * ditemukan (bukan hardcode N baris).
 * @returns {number} 0 jika tidak ada header sama sekali
 */
function _detectHeaderEnd(lines) {
  let lastImportLine = -1;
  let sawImport = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (
      /^(import\s|export\s+\*|export\s+\{)/.test(trimmed) ||
      /^(const|let|var)\s+.+=\s*require\(/.test(trimmed)
    ) {
      sawImport = true;
      lastImportLine = i;
      continue;
    }

    if (trimmed === '') {
      if (sawImport) return lastImportLine + 1;
      continue;
    }

    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    if (sawImport) return lastImportLine + 1;
    break; // baris kode pertama sebelum ada import apa pun -> tidak ada header
  }

  return sawImport ? lastImportLine + 1 : 0;
}

/**
 * Mencari baris deklarasi (0-based) sebuah identifier: function/async function,
 * class, const/let/var assignment (arrow function), atau method class
 * (indented, tanpa keyword, bukan call-site).
 * @returns {number} -1 jika tidak ditemukan
 */
function _findDeclarationLine(lines, identifier) {
  const escaped = _escapeRegex(identifier);
  const patterns = [
    new RegExp(`^\\s*(export\\s+)?(default\\s+)?(async\\s+)?function\\s*\\*?\\s+${escaped}\\s*\\(`),
    new RegExp(`^\\s*(export\\s+)?(default\\s+)?class\\s+${escaped}\\b`),
    new RegExp(`^\\s*(export\\s+)?(const|let|var)\\s+${escaped}\\s*=`),
    new RegExp(`^\\s*(async\\s+)?(static\\s+)?\\*?\\s*${escaped}\\s*\\(`) // class method
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      if (pattern.test(line)) return i;
    }
  }
  return -1;
}

/**
 * §2.1.4 — Brace-matching STRING-AWARE. Melacak state NORMAL / string /
 * template literal / komentar agar '{' '}' literal di dalam string (mis.
 * template literal yang membangun prompt) tidak dihitung sebagai pembuka/
 * penutup blok kode. Interpolasi `${...}` di dalam template literal membuka
 * kembali konteks JS normal bersarang (dilacak via stack terpisah, tidak
 * mempengaruhi brace count blok terluar) sampai '}' penutup interpolasi.
 * @returns {number} Baris akhir blok (0-based, inklusif)
 */
function _findBlockEnd(lines, startLineIdx) {
  const text = lines.join('\n');
  const lineOffsets = _computeLineOffsets(lines);
  const declOffset = lineOffsets[startLineIdx];

  // Batasi pencarian '{' pembuka ke beberapa baris ke depan saja — mencegah
  // menangkap brace dari blok lain yang tidak berhubungan jika deklarasi ini
  // ternyata ekspresi satu-baris tanpa body (mis. arrow function implicit-return).
  const searchWindowEndLine = Math.min(startLineIdx + 5, lines.length - 1);
  const searchWindowEnd = lineOffsets[searchWindowEndLine] + lines[searchWindowEndLine].length;

  const braceStart = text.indexOf('{', declOffset);
  if (braceStart === -1 || braceStart > searchWindowEnd) {
    return startLineIdx; // deklarasi satu-baris, tidak ada body blok
  }

  let i = braceStart + 1;
  let braceDepth = 1;
  const n = text.length;
  // Stack konteks non-kode: 'STRING_SINGLE' | 'STRING_DOUBLE' | 'TEMPLATE' | 'INTERP' | 'LINE_COMMENT' | 'BLOCK_COMMENT'
  // Frame INTERP membawa localDepth sendiri (brace di dalam interpolasi tidak menyentuh braceDepth terluar).
  const ctxStack = [];

  while (i < n) {
    const ch = text[i];
    const next = text[i + 1];
    const top = ctxStack.length > 0 ? ctxStack[ctxStack.length - 1] : null;

    if (top === null) {
      // NORMAL — level terluar ATAU di dalam INTERP (ditangani cabang INTERP di bawah)
      if (ch === '/' && next === '/') { ctxStack.push({ type: 'LINE_COMMENT' }); i += 2; continue; }
      if (ch === '/' && next === '*') { ctxStack.push({ type: 'BLOCK_COMMENT' }); i += 2; continue; }
      if (ch === "'") { ctxStack.push({ type: 'STRING_SINGLE' }); i++; continue; }
      if (ch === '"') { ctxStack.push({ type: 'STRING_DOUBLE' }); i++; continue; }
      if (ch === '`') { ctxStack.push({ type: 'TEMPLATE' }); i++; continue; }
      if (ch === '{') { braceDepth++; i++; continue; }
      if (ch === '}') {
        braceDepth--;
        i++;
        if (braceDepth === 0) return _offsetToLine(lineOffsets, i - 1);
        continue;
      }
      i++;
      continue;
    }

    if (top.type === 'LINE_COMMENT') {
      if (ch === '\n') ctxStack.pop();
      i++;
      continue;
    }

    if (top.type === 'BLOCK_COMMENT') {
      if (ch === '*' && next === '/') { ctxStack.pop(); i += 2; continue; }
      i++;
      continue;
    }

    if (top.type === 'STRING_SINGLE') {
      if (ch === '\\') { i += 2; continue; }
      if (ch === "'") { ctxStack.pop(); i++; continue; }
      i++;
      continue;
    }

    if (top.type === 'STRING_DOUBLE') {
      if (ch === '\\') { i += 2; continue; }
      if (ch === '"') { ctxStack.pop(); i++; continue; }
      i++;
      continue;
    }

    if (top.type === 'TEMPLATE') {
      if (ch === '\\') { i += 2; continue; }
      if (ch === '`') { ctxStack.pop(); i++; continue; }
      if (ch === '$' && next === '{') { ctxStack.push({ type: 'INTERP', depth: 1 }); i += 2; continue; }
      i++;
      continue;
    }

    if (top.type === 'INTERP') {
      if (ch === '/' && next === '/') { ctxStack.push({ type: 'LINE_COMMENT' }); i += 2; continue; }
      if (ch === '/' && next === '*') { ctxStack.push({ type: 'BLOCK_COMMENT' }); i += 2; continue; }
      if (ch === "'") { ctxStack.push({ type: 'STRING_SINGLE' }); i++; continue; }
      if (ch === '"') { ctxStack.push({ type: 'STRING_DOUBLE' }); i++; continue; }
      if (ch === '`') { ctxStack.push({ type: 'TEMPLATE' }); i++; continue; }
      if (ch === '{') { top.depth++; i++; continue; }
      if (ch === '}') {
        top.depth--;
        i++;
        if (top.depth === 0) ctxStack.pop(); // tutup interpolasi, kembali ke TEMPLATE
        continue;
      }
      i++;
      continue;
    }

    i++; // fallback, seharusnya tidak tercapai
  }

  // EOF tanpa brace menutup — file terpotong/malformed, fallback aman: sampai akhir file.
  return lines.length - 1;
}

function _computeLineOffsets(lines) {
  const offsets = new Array(lines.length);
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    offsets[i] = offset;
    offset += lines[i].length + 1; // +1 untuk karakter '\n' yang dibuang split()
  }
  return offsets;
}

function _offsetToLine(lineOffsets, charOffset) {
  // Binary search sederhana (lineOffsets sudah terurut naik)
  let lo = 0, hi = lineOffsets.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (lineOffsets[mid] <= charOffset) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/**
 * Menyusun snippet akhir: header + tiap blok (±contextLines), menggabungkan
 * rentang yang overlap/berdekatan, dengan penanda "... N baris dilewati ..."
 * di antara rentang yang tidak bersambung.
 */
function _assembleSnippet(lines, headerEndLine, blocks, contextLines) {
  const totalLines = lines.length;
  const ranges = blocks.map((b) => ({
    start: Math.max(b.startLine - contextLines, headerEndLine),
    end: Math.min(b.endLine + contextLines, totalLines - 1)
  }));

  // Gabungkan rentang yang overlap atau berdekatan
  ranges.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end + 1) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }

  const parts = [];
  if (headerEndLine > 0) {
    parts.push(lines.slice(0, headerEndLine).join('\n'));
  }

  let cursor = headerEndLine;
  for (const range of merged) {
    if (range.start > cursor) {
      const skipped = range.start - cursor;
      if (skipped > 0) parts.push(`// ... ${skipped} baris dilewati ...`);
    }
    parts.push(lines.slice(range.start, range.end + 1).join('\n'));
    cursor = range.end + 1;
  }

  if (cursor < totalLines) {
    parts.push(`// ... ${totalLines - cursor} baris dilewati ...`);
  }

  return parts.join('\n\n');
}

/**
 * Fallback saat tidak ada identifier yang match deklarasi apa pun: scan
 * window 50-baris, pilih window dengan kepadatan kemunculan targetIdentifiers
 * tertinggi (sekadar substring match, bukan deklarasi). Kalau targetIdentifiers
 * kosong juga (task tanpa nama fungsi eksplisit), ambil window pertama setelah
 * header sebagai titik awal yang aman.
 */
function _keywordDensityFallback(lines, targetIdentifiers, headerEndLine, totalLines) {
  const WINDOW = 50;
  let bestStart = headerEndLine;
  let bestScore = -1;

  if (targetIdentifiers.length > 0) {
    for (let start = headerEndLine; start < totalLines; start += WINDOW) {
      const end = Math.min(start + WINDOW, totalLines);
      const windowText = lines.slice(start, end).join('\n');
      let score = 0;
      for (const id of targetIdentifiers) {
        const matches = windowText.match(new RegExp(_escapeRegex(id), 'g'));
        score += matches ? matches.length : 0;
      }
      if (score > bestScore) {
        bestScore = score;
        bestStart = start;
      }
    }
  }

  const identifierFound = bestScore > 0;
  const windowEnd = Math.min(bestStart + WINDOW, totalLines) - 1;

  const parts = [];
  if (headerEndLine > 0) parts.push(lines.slice(0, headerEndLine).join('\n'));
  if (bestStart > headerEndLine) parts.push(`// ... ${bestStart - headerEndLine} baris dilewati ...`);
  parts.push(lines.slice(bestStart, windowEnd + 1).join('\n'));
  if (windowEnd + 1 < totalLines) parts.push(`// ... ${totalLines - windowEnd - 1} baris dilewati ...`);

  return {
    snippet: parts.join('\n\n'),
    startLine: bestStart + 1,
    endLine: windowEnd + 1,
    totalLines,
    identifierFound,
    method: 'keyword-scan'
  };
}
