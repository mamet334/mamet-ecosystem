import { RuntimeContext } from '../runtime_context.ts';
import { embedLewatOpenRouter, EMBED_DIMENSI } from '../vector_utils.ts';

/**
 * Dimensi vektor yang WAJIB dihasilkan embedding.
 *
 * Angkanya ditentukan oleh skema database, bukan sebaliknya: kolom
 * `document_chunks.embedding` dan `user_memories.embedding` bertipe `vector(768)` sejak Item 70
 * (sebelumnya 3072). Menyimpan dimensi lain ditolak Postgres; membandingkannya pun gagal
 * (`different vector dimensions`, Item 62).
 *
 * Riwayat: konstanta ini dulu 768 — sisa era model lama — sehingga generateEmbedding()
 * selalu mengembalikan array kosong tanpa ada yang tahu (Item 39). Penjaga 768 kedua
 * tercecer di knowledge_manager.ts (Item 46; plugin itu dihapus di T9), karena itu angkanya diekspor dari satu sumber.
 */
export const EMBEDDING_DIMENSIONS = EMBED_DIMENSI;

/**
 * PINTU EMBEDDING TUNGGAL agent-process — pencarian memori, pencarian dokumen, endpoint
 * embed, penulisan memori & knowledge.
 *
 * SEJAK 2026-09-11 (Item 65): lewat OpenRouter dengan KUNCI PENGGUNA (rctx.keys.openRouterByok,
 * dari header x-byok-openrouter), model tetap `google/gemini-embedding-2` — keputusan Owner
 * Item 63. Sebelumnya lewat GeminiEmbeddingAdapter dengan kunci Gemini sistem (hanya 1 dari 3
 * yang hidup, Item 51) melalui CapabilityRegistry — Map statis yang dipakai bersama semua
 * permintaan, tempat yang salah untuk kunci pengguna.
 *
 * TIDAK ADA CADANGAN (Item 62): vektor dari model lain tidak sebanding dengan yang tersimpan.
 * Tanpa kunci atau bila OpenRouter gagal → array KOSONG, dan pemanggil yang memutuskan:
 * pencarian dilewati / jatuh ke pencocokan kata, pengindeksan menolak.
 */
export type SebabEmbedding = 'tanpa-kunci' | 'galat' | 'dimensi';

/**
 * Wadah SEBAB kegagalan, diisi di tempat (opsional).
 *
 * Kenapa bukan nilai kembalian: array kosong adalah kontrak yang sudah dipakai lima pemanggil.
 * Mengubahnya menjadi objek akan menyentuh semuanya sekaligus. Yang hilang dari array kosong
 * hanyalah SEBABNYA — dan sebab itulah yang menentukan tindakan: 'tanpa-kunci' tak akan pernah
 * berhasil kalau dicoba lagi, 'galat' mungkin sesaat saja.
 *
 * Pemanggil yang tidak peduli cukup tidak mengirimnya. Perilaku fungsinya TIDAK berubah.
 */
export interface JejakEmbedding {
  sebab?: SebabEmbedding;
  pesan?: string;
}

export const generateEmbedding = async (
  text: string,
  rctx: RuntimeContext,
  jejak?: JejakEmbedding,
): Promise<number[]> => {
  const kunci = (rctx?.keys?.openRouterByok || '').trim();
  if (!kunci) {
    console.warn('[Embedding] Dilewati — tidak ada kunci OpenRouter pengguna (x-byok-openrouter).');
    if (jejak) {
      jejak.sebab = 'tanpa-kunci';
      jejak.pesan = 'tidak ada kunci OpenRouter pengguna (BYOK)';
    }
    return [];
  }
  try {
    const [vektor] = await embedLewatOpenRouter([text], kunci, { batasWaktuMs: 15_000 });
    // `?? []` menepati janji tipenya: embedLewatOpenRouter yang mengembalikan daftar kosong
    // membuat `vektor` menjadi undefined, dan pemanggil yang menulis `.length` akan melempar
    // TypeError yang lalu terbaca sebagai "galat RAG" — menyamarkan sebab yang sebenarnya.
    const hasil = vektor ?? [];
    if (jejak && hasil.length !== EMBEDDING_DIMENSIONS) {
      // Ketidakcocokan dimensi pernah berjalan diam-diam selama berminggu-minggu (Item 39).
      jejak.sebab = 'dimensi';
      jejak.pesan = `didapat ${hasil.length} dimensi, perlu ${EMBEDDING_DIMENSIONS}`;
    }
    return hasil;
  } catch (e: any) {
    console.warn(`[Embedding] Gagal (${e?.kode || 'ERROR'}): ${e?.message || String(e)}`);
    if (jejak) {
      jejak.sebab = 'galat';
      jejak.pesan = `${e?.kode || 'ERROR'}: ${String(e?.message || e).slice(0, 160)}`;
    }
    return [];
  }
};

/** Satu kalimat yang bisa ditindaklanjuti Owner, bukan nama keadaan internal. */
export const kalimatSebabEmbedding = (jejak: JejakEmbedding): string => {
  if (jejak.sebab === 'tanpa-kunci') return 'tidak ada kunci OpenRouter (BYOK) pada permintaan ini';
  if (jejak.sebab === 'dimensi') return `vektornya tak sesuai skema database (${jejak.pesan})`;
  if (jejak.sebab === 'galat') return `OpenRouter menolak atau gagal — ${jejak.pesan}`;
  return 'sebabnya tidak tercatat';
};
