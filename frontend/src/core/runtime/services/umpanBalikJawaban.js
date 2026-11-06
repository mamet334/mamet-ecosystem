
export function nilaiBerikutnya(sekarang, tombol) {
  return sekarang === tombol ? 0 : tombol;
}

export function bolehDinilai(pesan) {
  return pesan?.role === 'model' && !pesan.isStreaming && !pesan.isPatchResult && typeof pesan.traceId === 'string' && pesan.traceId.length > 0;
}

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
