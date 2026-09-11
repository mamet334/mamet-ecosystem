import { RuntimeContext } from '../runtime_context.ts';

/**
 * TULIS ULANG PERTANYAAN LANJUTAN (Item 67, 2026-09-11)
 *
 * Pencarian dokumen memvektorkan pesan SAAT INI saja. Pertanyaan lanjutan seperti
 * "Lanjutkan, apa kendala utamanya?" tidak menyebut topiknya, jadi vektornya tidak mirip
 * dokumen mana pun — skor teratas 0,541 (di bawah ambang 0,55) padahal dokumen HCDP memuat
 * jawabannya. Model utama lalu menjawab "dokumen tidak tersedia".
 *
 * Dua cara diuji dengan data asli sebelum memilih ini:
 *
 *   Menggabungkan pertanyaan sebelumnya + pesan sekarang lalu memvektorkannya: dokumen
 *   ketemu (0,762), TETAPI pertanyaan ganti topik ("apa itu inflasi") ikut menarik 5 potongan
 *   HCDP (0,708). Vektor gabungan didominasi pertanyaan lama (kemiripan 0,93), dan kemiripan
 *   pesan lanjutan vs ganti topik dengan pertanyaan sebelumnya terlalu rapat untuk dijadikan
 *   ambang (0,508 / 0,537 vs 0,488). Yang bisa membedakannya adalah pemahaman bahasa.
 *
 *   Tulis ulang oleh model murah (dipakai di sini): lanjutan menjadi "Apa kendala utama
 *   dalam pelaksanaan program pengembangan kompetensi ASN ... dokumen HCDP tersebut?"
 *   (0,765, potongan tentang hambatan di urutan pertama); ganti topik dikembalikan apa
 *   adanya dan tetap tidak menemukan dokumen. ±$0,00002–0,00004 per panggilan, 1,6–2,7 detik
 *   diukur dari browser Owner.
 *
 * Karena memakan waktu, fungsi ini hanya dipanggil bila pencarian pertama KOSONG dan ada
 * riwayat percakapan. Dibayar dengan kunci OpenRouter pengguna, sama seperti embedding.
 */
export const MODEL_TULIS_ULANG = 'deepseek/deepseek-v4-flash-0731';

const SISTEM_TULIS_ULANG =
  'Tulis ulang PESAN TERAKHIR pengguna menjadi satu pertanyaan mandiri yang bisa dipahami tanpa ' +
  'membaca percakapan, dengan melengkapi rujukan seperti "itu", "-nya", "tersebut", atau "lanjutkan" ' +
  'dari percakapan. Jika pesan terakhir sudah jelas sendiri atau berganti topik, kembalikan pesan itu ' +
  'APA ADANYA. Jangan menjawab. Keluarkan hanya pertanyaannya.';

// Jawaban asisten bisa ribuan huruf; awalnya sudah cukup untuk mengenali topik.
const MAKS_HURUF_PER_PESAN = 800;
const JUMLAH_PESAN_RIWAYAT = 4;

export type HasilTulisUlang = { teks: string; ms: number; biaya?: number };

/** Riwayat tanpa pesan saat ini — ConversationEngine mengirim riwayat yang sudah memuatnya. */
export function riwayatSebelumPesan(riwayat: any[] | undefined, pesan: string): { role: string; content: string }[] {
  const bersih = (Array.isArray(riwayat) ? riwayat : [])
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', content: m.content.trim() }));
  const terakhir = bersih[bersih.length - 1];
  if (terakhir && terakhir.role === 'user' && terakhir.content === pesan.trim()) bersih.pop();
  return bersih;
}

const normalkan = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** true bila model mengembalikan pesan apa adanya — tanda pesan sudah mandiri / ganti topik. */
export function samaDenganAsli(tulisUlang: string, pesan: string): boolean {
  return normalkan(tulisUlang) === normalkan(pesan);
}

export async function tulisUlangPertanyaan(
  pesan: string,
  riwayat: { role: string; content: string }[],
  rctx: RuntimeContext,
  opsi: { batasWaktuMs?: number } = {}
): Promise<HasilTulisUlang | null> {
  const kunci = (rctx?.keys?.openRouterByok || '').trim();
  if (!kunci || riwayat.length === 0) return null;

  const percakapan = riwayat
    .slice(-JUMLAH_PESAN_RIWAYAT)
    .map((m) => `${m.role === 'user' ? 'Pengguna' : 'Asisten'}: ${m.content.slice(0, MAKS_HURUF_PER_PESAN)}`)
    .join('\n');

  const pengendali = new AbortController();
  const penghenti = setTimeout(() => pengendali.abort(), opsi.batasWaktuMs ?? 4000);
  const t0 = Date.now();
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: pengendali.signal,
      headers: { 'Authorization': `Bearer ${kunci}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_TULIS_ULANG,
        max_tokens: 120,
        temperature: 0,
        reasoning: { enabled: false },
        messages: [
          { role: 'system', content: SISTEM_TULIS_ULANG },
          { role: 'user', content: `Percakapan:\n${percakapan}\n\nPESAN TERAKHIR: ${pesan}` }
        ]
      })
    });
    if (!res.ok) {
      console.warn(`[RAG] Tulis ulang gagal: OpenRouter ${res.status} ${(await res.text().catch(() => '')).slice(0, 150)}`);
      return null;
    }
    const body = await res.json().catch(() => ({}));
    const teks = String(body?.choices?.[0]?.message?.content || '')
      .split('\n').map((s) => s.trim()).find((s) => s.length > 0) || '';
    const bersih = teks.replace(/^["'“”]+|["'“”]+$/g, '').trim();
    // Keluaran kosong atau kepanjangan = model menjawab, bukan menulis ulang. Abaikan.
    if (!bersih || bersih.length > 400) return null;
    return { teks: bersih, ms: Date.now() - t0, biaya: body?.usage?.cost };
  } catch (e: any) {
    console.warn(`[RAG] Tulis ulang gagal: ${e?.name === 'AbortError' ? 'melebihi batas waktu' : e?.message}`);
    return null;
  } finally {
    clearTimeout(penghenti);
  }
}
