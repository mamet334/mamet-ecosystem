export function chunkText(text: string, maxLength: number = 4500): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = i + maxLength;
    if (end < text.length) {
      let breakPoint = text.lastIndexOf('\n', end);
      if (breakPoint <= i) breakPoint = text.lastIndexOf('. ', end);
      if (breakPoint > i) {
        end = breakPoint + 1;
      }
    }
    chunks.push(text.substring(i, end).trim());
    if (end >= text.length) break;

    let nextI = end - 250;
    let bLine = text.lastIndexOf('\n', end);
    let bDot = text.lastIndexOf('. ', end);
    let boundary = bLine >= end - 150 ? bLine : (bDot >= end - 150 ? bDot : -1);
    
    if (boundary > nextI && boundary < end) {
      nextI = boundary + 1;
    }
    if (nextI <= i) nextI = end;
    i = nextI;
  }
  return chunks.filter(c => c.length > 0);
}

/**
 * Embedding Gemini dengan rotasi key + retry, dipakai edge function `rag-process`
 * (jalur unggah dokumen RAG).
 *
 * DIPULIHKAN 2026-09-09. Fungsi ini dihapus commit 3176c6e (2026-07-01,
 * "vendor decoupling for llm and embeddings") tanpa memutakhirkan pemanggilnya —
 * `rag-process/index.ts` masih mengimpornya, sehingga fungsi itu akan GAGAL BOOT
 * begitu di-deploy ulang. Belum meledak hanya karena versi yang berjalan di
 * produksi masih bundel 30 Juni 2026, sehari sebelum commit tersebut. Lihat Item 40.
 *
 * Model dan bentuk request sengaja dibuat identik dengan GeminiEmbeddingAdapter
 * (embedding_adapter.ts) supaya dimensinya sama persis (3072) dengan 512 chunk yang
 * sudah ada di database.
 *
 * DUPLIKASI YANG DISENGAJA: idealnya `rag-process` memakai adapter seperti
 * `agent-process`, sejalan dengan maksud commit 3176c6e. Tapi adapter menuntut
 * RuntimeContext penuh yang tidak dibangun `rag-process`, dan merombaknya berarti
 * mengubah jalur unggah dokumen yang tidak bisa diuji tanpa dokumen nyata.
 * Memulihkan fungsi ini adalah perbaikan paling kecil yang menutup ranjaunya.
 */
export async function getGeminiEmbeddingWithRetry(text: string, allKeys: string[], maxRetries = 3): Promise<number[]> {
  let lastError = 'Unknown error';
  let geminiKeyIndex = 0;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (let ki = 0; ki < allKeys.length; ki++) {
      const key = allKeys[(geminiKeyIndex + ki) % allKeys.length];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${key}`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/gemini-embedding-2',
            content: { parts: [{ text }] }
          })
        });

        if (response.ok) {
          geminiKeyIndex = (geminiKeyIndex + ki + 1) % allKeys.length;
          const data = await response.json();
          return data.embedding.values;
        }

        const errText = await response.text();
        lastError = `Status ${response.status}: ${errText}`;

        if (response.status === 429) {
          console.warn(`Gemini key #${ki} hit 429, trying next key...`);
          continue;
        }
      } catch (e: any) {
        lastError = e.message || String(e);
      }
    }

    if (attempt < maxRetries - 1) {
      const waitMs = Math.pow(2, attempt) * 1000;
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  throw new Error(`Gemini Embedding Error: ${lastError}`);
}
