
const IDENTIFIER_TOKEN_REGEX = /\b_?[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)*\b/g;

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
    const presence = new RegExp(`\\b${_escapeRegex(tok)}\\b`);
    if (!presence.test(fileContent)) continue;
    seen.add(tok);
    validated.push(tok);
  }
  return validated;
}

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


function _escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
    break;
  }

  return sawImport ? lastImportLine + 1 : 0;
}

function _findDeclarationLine(lines, identifier) {
  const escaped = _escapeRegex(identifier);
  const patterns = [
    new RegExp(`^\\s*(export\\s+)?(default\\s+)?(async\\s+)?function\\s*\\*?\\s+${escaped}\\s*\\(`),
    new RegExp(`^\\s*(export\\s+)?(default\\s+)?class\\s+${escaped}\\b`),
    new RegExp(`^\\s*(export\\s+)?(const|let|var)\\s+${escaped}\\s*=`),
    new RegExp(`^\\s*(async\\s+)?(static\\s+)?\\*?\\s*${escaped}\\s*\\(`)
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      if (pattern.test(line)) return i;
    }
  }
  return -1;
}

function _findBlockEnd(lines, startLineIdx) {
  const text = lines.join('\n');
  const lineOffsets = _computeLineOffsets(lines);
  const declOffset = lineOffsets[startLineIdx];

  const searchWindowEndLine = Math.min(startLineIdx + 5, lines.length - 1);
  const searchWindowEnd = lineOffsets[searchWindowEndLine] + lines[searchWindowEndLine].length;

  const braceStart = text.indexOf('{', declOffset);
  if (braceStart === -1 || braceStart > searchWindowEnd) {
    return startLineIdx;
  }

  let i = braceStart + 1;
  let braceDepth = 1;
  const n = text.length;
  const ctxStack = [];

  while (i < n) {
    const ch = text[i];
    const next = text[i + 1];
    const top = ctxStack.length > 0 ? ctxStack[ctxStack.length - 1] : null;

    if (top === null) {
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
        if (top.depth === 0) ctxStack.pop();
        continue;
      }
      i++;
      continue;
    }

    i++;
  }

  return lines.length - 1;
}

function _computeLineOffsets(lines) {
  const offsets = new Array(lines.length);
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    offsets[i] = offset;
    offset += lines[i].length + 1;
  }
  return offsets;
}

function _offsetToLine(lineOffsets, charOffset) {
  let lo = 0, hi = lineOffsets.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (lineOffsets[mid] <= charOffset) lo = mid; else hi = mid - 1;
  }
  return lo;
}

function _assembleSnippet(lines, headerEndLine, blocks, contextLines) {
  const totalLines = lines.length;
  const ranges = blocks.map((b) => ({
    start: Math.max(b.startLine - contextLines, headerEndLine),
    end: Math.min(b.endLine + contextLines, totalLines - 1)
  }));

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
