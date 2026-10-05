import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { RuntimeContext } from '../runtime_context.ts';
import { RagDocument, FormattedRagContext, RoutingDecision } from './types.ts';
import { kataKunciPencarian } from '../../../../../frontend/src/core/runtime/services/KnowledgeService.js';
import { gabungkan, MAKS_POTONGAN_JUDUL, kataKunciJudul } from './cari_judul.ts';

export const searchDocuments = async (
  queryEmbedding: number[],
  finalMessage: string,
  effectiveRagThreshold: number,
  effectiveRagMatchCount: number,
  routingDecision: RoutingDecision,
  userId: string,
  rctx: RuntimeContext
): Promise<FormattedRagContext[]> => {
  const supabaseClient = createClient(
    rctx.env.supabaseUrl,
    rctx.env.supabaseServiceKey
  );

  // Batasi ke satu space HANYA bila space itu dipilih eksplisit (scope WORKSPACE: UUID dari UI
  // atau nama space disebut di pesan). Selain itu cari di SEMUA space milik pengguna (Item 65).
  // Dulu `routing_decider` mengisi workspace_id dengan space CORE setiap kali klien tak mengirim
  // workspaceTarget — jalur LOOKUP — sehingga dokumen di space lain tak pernah ditemukan, sementara
  // jalur chat biasa mencari di semua space. Hasilnya bergantung pada cara bertanya. Research App
  // pun otomatis memilih space terbaru saat mengunggah, jadi dokumen jarang berada di CORE.
  const spaceId = routingDecision?.scope === 'WORKSPACE' ? routingDecision.workspace_id : null;

  // PENCARIAN GABUNGAN (Item 90 Tahap B, 2026-09-17): peringkat vektor + peringkat kata kunci (RRF k=60)
  // di dalam database, SEBELUM dipotong ke batas jumlah potongan. Vektor saja menaruh tabel persyaratan
  // Kepbup di #15 untuk "tingkat kepentingan pelatihan teknis Sekretaris DPRD" (hanya 8 diambil); gabungan
  // #3, set uji 13/14 → 14/14. Ambang & batas tidak berubah. Kata kunci dibatasi 30 karena finalMessage
  // bisa memuat isi lampiran. Bila RPC gabungan gagal, jatuh ke match_documents (vektor saja).
  const kataKunci = kataKunciPencarian(finalMessage).slice(0, 30);
  const argumenDasar = {
    query_embedding: queryEmbedding,
    match_threshold: effectiveRagThreshold,
    match_count: effectiveRagMatchCount,
    p_user_id: userId,
    p_space_id: spaceId
  };
  let { data: matchedDocs, error: matchError } = await supabaseClient.rpc('match_documents_hybrid', {
    ...argumenDasar,
    query_words: kataKunci
  });
  if (matchError) {
    console.warn(`[RAG] match_documents_hybrid gagal (${matchError.message}) — cadangan match_documents (vektor saja).`);
    ({ data: matchedDocs, error: matchError } = await supabaseClient.rpc('match_documents', argumenDasar));
  } else {
    console.log(`[RAG] Pencarian gabungan vektor+kata: ${matchedDocs?.length ?? 0} potongan, ${kataKunci.length} kata kunci [${kataKunci.join(', ').slice(0, 160)}]`);
  }

  if (matchError) {
    throw new Error(`RAG_DB_FAIL: ${matchError.message}`);
  }

  // PENCARIAN LEWAT JUDUL (2026-10-01). Diukur: 221 dokumen Kepbup, kata "kepbup" muncul di 0 dari
  // 3.629 potongan, dan 221 dari 221 tidak memuat nomornya sendiri di teks terindeks. Judul memuat
  // keduanya tetapi tidak pernah ikut dicari. RRF tak bisa menolong — ambang kemiripan VEKTOR
  // membuang potongannya sebelum RRF bekerja. Jalur ini berdiri sendiri; `match_documents_hybrid`
  // TIDAK disentuh supaya patokan 14/14 (Item 90) tetap sebanding.
  //
  // Kegagalannya tidak boleh menggagalkan pencarian biasa: dibungkus, dan bila gagal hasilnya apa adanya.
  try {
    // Kata kunci TERPISAH untuk jalur judul (2026-10-05): `kataKunci` membuang token ≤2 huruf,
    // sehingga "kepbup 17" tiba sebagai satu kata saja dan penjaga `array_length >= 2` memulangkan
    // kosong — 99 dari 221 dokumen (45%) tak bisa ditemukan lewat nomor alaminya. Daftar ini
    // menambah varian angka berpadding; `kataKunci` sengaja TIDAK diubah supaya patokan 14/14
    // milik `match_documents_hybrid` tetap sebanding. Lihat `kataKunciJudul`.
    const kataJudul = kataKunciJudul(finalMessage, kataKunci);
    const { data: lewatJudul, error: galatJudul } = await supabaseClient.rpc('match_documents_judul', {
      query_words: kataJudul,
      match_count: MAKS_POTONGAN_JUDUL,
      p_user_id: userId,
      p_space_id: spaceId
    });
    if (galatJudul) {
      console.warn(`[RAG] pencarian judul dilewati (${galatJudul.message})`);
    } else if (lewatJudul?.length) {
      const g = gabungkan(matchedDocs || [], lewatJudul, effectiveRagMatchCount);
      if (g.disisipkan) {
        matchedDocs = g.hasil;
        console.log(`[RAG] Judul cocok: ${g.disisipkan} potongan disisipkan dari "${lewatJudul[0]?.title ?? '?'}"`);
      }
    }
  } catch (e) {
    console.warn(`[RAG] pencarian judul galat: ${(e as Error).message}`);
  }

  if (!matchedDocs || matchedDocs.length === 0) {
    return [];
  }

  // 1. DEDUPLICATION LAYER (POST-RAG)
  const calculateCosineSimilarity = (strA: string, strB: string) => {
    const getWords = (s: string) => s.toLowerCase().match(/\w+/g) || [];
    const wordsA = getWords(strA);
    const wordsB = getWords(strB);
    
    if (wordsA.length === 0 || wordsB.length === 0) return 0;

    const freqA = new Map<string, number>();
    for (const w of wordsA) freqA.set(w, (freqA.get(w) || 0) + 1);
    
    const freqB = new Map<string, number>();
    for (const w of wordsB) freqB.set(w, (freqB.get(w) || 0) + 1);

    let dotProduct = 0; let normA = 0; let normB = 0;
    
    for (const count of freqA.values()) { normA += count * count; }
    for (const [w, countB] of freqB.entries()) {
      normB += countB * countB;
      const countA = freqA.get(w) || 0;
      dotProduct += countA * countB;
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  const deduplicatedDocs: RagDocument[] = [];
  for (const doc of matchedDocs) {
    let isDuplicate = false;
    for (const savedDoc of deduplicatedDocs) {
      if (calculateCosineSimilarity(doc.content, savedDoc.content) > 0.92) {
        if ((doc.similarity || 0) > (savedDoc.similarity || 0)) {
           savedDoc.content = doc.content;
           savedDoc.similarity = doc.similarity;
        }
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) deduplicatedDocs.push(doc);
  }

  // 2. CONTEXT RE-RANKING LAYER
  const queryWords = finalMessage.toLowerCase().match(/\w+/g) || [];
  const validQueryWords = queryWords.filter((w: string) => w.length > 3);
  
  deduplicatedDocs.forEach((doc: any, idx: number) => {
    const vector_similarity = doc.similarity || 0;
    const position_weight = 1.0 - (idx / deduplicatedDocs.length);
    
    const docWordsStr = doc.content.toLowerCase();
    let matchCount = 0;
    for(const qw of validQueryWords) {
       if (docWordsStr.includes(qw)) matchCount++;
    }
    const query_coverage_score = validQueryWords.length > 0 ? Math.min(1.0, matchCount / validQueryWords.length) : 0;
    
    doc.hybrid_score = (vector_similarity * 0.7) + (position_weight * 0.2) + (query_coverage_score * 0.1);
  });

  return deduplicatedDocs.map((doc: any) => ({
    type: 'rag',
    id: doc.id,
    document_id: doc.document_id || doc.title || 'unknown_doc',
    title: doc.title,
    content: `[Dari file "${doc.title || 'dokumen'}"]: "${doc.content}"`,
    raw_content: doc.content,
    score: doc.hybrid_score,
    similarity: doc.similarity ?? (doc.hybrid_score || 0.5),
    source_url: doc.source_url || null,
    source_type: doc.source_type || 'local'
  }));
};
