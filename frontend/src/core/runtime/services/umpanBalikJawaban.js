// Umpan balik 👍/👎 per jawaban (Item 126 Fase 0, Data Flywheel — 2026-10-27). Tabel `umpan_balik_jawaban`
// (migrasi 20261027000000): satu baris per pengguna per jawaban, disambungkan ke `cost_ledger` lewat `trace_id` — model,
// pemilih model, dan biaya diketahui dari sana, tidak disalin ke sini. TANPA isi percakapan (Gerbang 1).
// Tunduk RLS: hanya baris milik akun yang login. supabase-js tidak melempar galat — setiap { error } diperiksa sendiri.

/** Nilai berikutnya bila tombol `tombol` (+1 = 👍, -1 = 👎) ditekan saat nilai sekarang `sekarang`: sama = batal (0). */
export function nilaiBerikutnya(sekarang, tombol) {
  return sekarang === tombol ? 0 : tombol;
}

/** Jawaban mana yang boleh dinilai: jawaban model yang selesai DAN membawa traceId (pesan sistem/lama tidak). */
export function bolehDinilai(pesan) {
  return pesan?.role === 'model' && !pesan.isStreaming && !pesan.isPatchResult && typeof pesan.traceId === 'string' && pesan.traceId.length > 0;
}

/**
 * Simpan penilaian. `nilai` 1 / -1 → upsert (satu baris per user+trace); 0 → hapus (batal).
 * Mengembalikan { ok: true } atau { ok: false, alasan } — layar menampilkan alasannya, tidak ditelan.
 */
export async function simpanUmpanBalik(supabase, { traceId, nilai, workspace = null }) {
  if (typeof traceId !== 'string' || !traceId) return { ok: false, alasan: 'jawaban ini tidak punya traceId' };
  if (![1, 0, -1].includes(nilai)) return { ok: false, alasan: `nilai tidak sah: ${nilai}` };
  const { data: sesi } = await supabase.auth.getSession();
  const userId = sesi?.session?.user?.id;
  if (!userId) return { ok: false, alasan: 'belum masuk' };
  const { error } = nilai === 0
    ? await supabase.from('umpan_balik_jawaban').delete().eq('user_id', userId).eq('trace_id', traceId)
    : await supabase.from('umpan_balik_jawaban').upsert(
      { user_id: userId, trace_id: traceId, nilai, workspace, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,trace_id' },
    );
  return error ? { ok: false, alasan: error.message || 'gagal menyimpan' } : { ok: true };
}
