import { RuntimeContext } from '../runtime_context.ts';
import { embedLewatOpenRouter, EMBED_DIMENSI } from '../vector_utils.ts';

export const EMBEDDING_DIMENSIONS = EMBED_DIMENSI;

export type SebabEmbedding = 'tanpa-kunci' | 'galat' | 'dimensi';

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
    const hasil = vektor ?? [];
    if (jejak && hasil.length !== EMBEDDING_DIMENSIONS) {
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

export const kalimatSebabEmbedding = (jejak: JejakEmbedding): string => {
  if (jejak.sebab === 'tanpa-kunci') return 'tidak ada kunci OpenRouter (BYOK) pada permintaan ini';
  if (jejak.sebab === 'dimensi') return `vektornya tak sesuai skema database (${jejak.pesan})`;
  if (jejak.sebab === 'galat') return `OpenRouter menolak atau gagal — ${jejak.pesan}`;
  return 'sebabnya tidak tercatat';
};
