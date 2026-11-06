import { TraceParseResult } from './types.ts';

export function extractSourceTrace(msg: string): TraceParseResult {
  const lines = msg.split('\n');
  const formatRegex = /[A-Z]{2,3}-\d{4}/;
  const keywordRegex = /^(?:\W|_)*(?:source\s*trace|sources?|referensi)\b/i;
  
  const scanLimit = Math.max(0, lines.length - 30);
  let headerIndex = -1;
  let firstIdIndex = -1;

  const diDalamPagar: boolean[] = [];
  let pagarTerbuka = false;
  for (const l of lines) {
    if (/^\s*```/.test(l)) {
      diDalamPagar.push(true);
      pagarTerbuka = !pagarTerbuka;
      continue;
    }
    diDalamPagar.push(pagarTerbuka);
  }

  for (let i = scanLimit; i < lines.length; i++) {
    if (diDalamPagar[i]) continue;
    const line = lines[i].trim();
    if (headerIndex === -1 && keywordRegex.test(line)) headerIndex = i;
    if (firstIdIndex === -1 && formatRegex.test(line)) firstIdIndex = i;
  }
  
  let startIndex = -1;
  if (headerIndex !== -1) {
    let hasId = false;
    for (let i = headerIndex; i < lines.length; i++) {
      if (!diDalamPagar[i] && formatRegex.test(lines[i])) { hasId = true; break; }
    }
    if (hasId) startIndex = headerIndex;
    else if (firstIdIndex !== -1) startIndex = firstIdIndex;
  } else if (firstIdIndex !== -1) {
    startIndex = firstIdIndex;
  }
  
  if (startIndex !== -1) {
    const replyWithoutTrace = lines.slice(0, startIndex).join('\n').trim();
    const terbuka = (t: string, buka: string, tutup: string) =>
      (t.split(buka).length - 1) > (t.split(tutup).length - 1);
    const kurungTakSeimbang = terbuka(replyWithoutTrace, '{', '}') || terbuka(replyWithoutTrace, '[', ']');

    if (replyWithoutTrace.length > 0 && !kurungTakSeimbang) {
      return {
        replyWithoutTrace,
        sourceTrace: lines.slice(startIndex).join('\n').trim()
      };
    }
  }

  return { replyWithoutTrace: msg, sourceTrace: undefined };
}
