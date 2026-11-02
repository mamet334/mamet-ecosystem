import { TraceParseResult } from './types.ts';

export function extractSourceTrace(msg: string): TraceParseResult {
  const lines = msg.split('\n');
  const formatRegex = /[A-Z]{2,3}-\d{4}/;
  const keywordRegex = /^(?:\W|_)*(?:source\s*trace|sources?|referensi)\b/i;
  
  // Scan 30 baris terakhir (diperluas dari 15 — ADR-0012, 2026-07-23)
  // Instruksi prompt baru menaruh SOURCE TRACE di akhir, tapi jawaban panjang
  // memerlukan window yang lebih besar untuk memastikan parser bisa menemukan format ID.
  const scanLimit = Math.max(0, lines.length - 30);
  let headerIndex = -1;
  let firstIdIndex = -1;
  
  for (let i = scanLimit; i < lines.length; i++) {
    const line = lines[i].trim();
    if (headerIndex === -1 && keywordRegex.test(line)) headerIndex = i;
    if (firstIdIndex === -1 && formatRegex.test(line)) firstIdIndex = i;
  }
  
  let startIndex = -1;
  if (headerIndex !== -1) {
    let hasId = false;
    for (let i = headerIndex; i < lines.length; i++) {
      if (formatRegex.test(lines[i])) { hasId = true; break; }
    }
    if (hasId) startIndex = headerIndex;
    else if (firstIdIndex !== -1) startIndex = firstIdIndex;
  } else if (firstIdIndex !== -1) {
    startIndex = firstIdIndex;
  }
  
  if (startIndex !== -1) {
    const replyWithoutTrace = lines.slice(0, startIndex).join('\n').trim();
    // Penjaga: SOURCE TRACE adalah EKOR jawaban, jadi memotongnya tidak boleh menghabiskan seluruh jawaban.
    // Tanpa penjaga ini, satu ID di BARIS PERTAMA membuat seluruh jawaban dianggap trace dan teks jawaban jadi
    // kosong → CHECK_001_RESPONSE_NOT_EMPTY gagal → HARD GATE memblokir, Owner tidak menerima jawaban apa pun.
    // Terbukti live 2026-09-23 01:53: baris pertama "TUGAS YANG DIKERJAKAN: TASK-0014 — …" cocok dengan
    // formatRegex (potongan "ASK-0014"), jawaban Engineer yang utuh hilang seluruhnya.
    // Bila pemotongan menyisakan jawaban kosong, anggap saja tidak ada trace yang bisa dipisahkan.
    if (replyWithoutTrace.length > 0) {
      return {
        replyWithoutTrace,
        sourceTrace: lines.slice(startIndex).join('\n').trim()
      };
    }
  }

  return { replyWithoutTrace: msg, sourceTrace: undefined };
}
