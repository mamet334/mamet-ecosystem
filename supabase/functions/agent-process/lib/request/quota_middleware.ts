import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Dipakai kalau plafon sistem belum diset di system_config — mempertahankan perilaku lama.
const FALLBACK_DAILY_LIMIT = 1;

/**
 * Batas harian efektif = nilai TERKECIL antara batas pribadi user dan plafon sistem.
 *
 * Batas pribadi disimpan di user_metadata (bisa diubah Owner sendiri dari Settings, pola sama
 * seperti model_tiers). Plafon sistem ada di tabel system_config yang HANYA bisa ditulis service
 * role — ini yang mencegah pengguna menaikkan sendiri jatah belanjanya, penting karena pengguna
 * mametlite tanpa BYOK key memakai API key sistem milik Owner. Jadi tombol di UI hanya bisa
 * membuat batas lebih ketat, tidak pernah melewati plafon.
 */
async function resolveDailyLimit(supClient: any, userId: string): Promise<number> {
  let systemCap = FALLBACK_DAILY_LIMIT;
  let userCap: number | null = null;

  try {
    const { data: config } = await supClient
      .from('system_config')
      .select('daily_budget_cap_usd')
      .single();
    const parsed = Number(config?.daily_budget_cap_usd);
    if (Number.isFinite(parsed) && parsed > 0) systemCap = parsed;
  } catch (e) {
    console.warn('[QUOTA] Gagal baca system_config, pakai fallback:', (e as Error).message);
  }

  try {
    const { data } = await supClient.auth.admin.getUserById(userId);
    const parsed = Number(data?.user?.user_metadata?.daily_budget_cap_usd);
    if (Number.isFinite(parsed) && parsed > 0) userCap = parsed;
  } catch (e) {
    console.warn('[QUOTA] Gagal baca batas pribadi user, pakai plafon sistem:', (e as Error).message);
  }

  const effective = userCap === null ? systemCap : Math.min(userCap, systemCap);
  console.log(`[QUOTA] Batas harian efektif user ${userId}: $${effective} (pribadi: ${userCap ?? 'tidak diset'}, plafon sistem: $${systemCap})`);
  return effective;
}

/**
 * Membangun respons penolakan, seragam untuk jalur stream maupun non-stream.
 * Sebelumnya kedua bentuk ini ditulis dua kali dengan kalimat yang disalin
 * tangan, sehingga menambah satu jenis penolakan berarti menyalinnya lagi.
 */
function bangunPenolakan(pesan: string, stream: boolean, corsHeaders: HeadersInit): Response {
  if (!stream) {
    return new Response(JSON.stringify({ message: pesan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  const streamRes = new ReadableStream({
    start(controller) {
      const data = JSON.stringify({ choices: [{ delta: { content: `\n\n${pesan}` } }] });
      controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
      controller.close();
    }
  });
  return new Response(streamRes, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' } });
}

/**
 * Penjaga belanja harian. GAGAL-TERTUTUP.
 *
 * Sebelum 2026-09-10 fungsi ini gagal-TERBUKA lewat dua celah sekaligus:
 *
 *   1. `catch { console.error("Quota check failed, bypassing...") }` lalu
 *      `return null` — permintaan diteruskan. Kodenya jujur menyebut dirinya
 *      sendiri "bypassing".
 *   2. Seluruh penjagaan dibungkus `if (!quotaError && currentCost !== null)`,
 *      jadi kalau RPC mengembalikan error, pemeriksaan dilewati diam-diam
 *      tanpa satu pun log peringatan.
 *
 * Akibatnya satu gangguan sesaat di database membuat penjaga ini lenyap tanpa
 * jejak — padahal inilah satu-satunya kontrol yang melindungi saldo Owner, dan
 * pengguna mametlite tanpa BYOK membelanjakan API key Owner.
 *
 * Sekarang: kalau kuota tidak bisa dipastikan, permintaan DITOLAK. Ini memang
 * menukar ketersediaan dengan keamanan biaya, dan itu pertukaran yang disengaja
 * — pola yang sama sudah dipakai `resolveDailyLimit`, yang jatuh ke batas paling
 * ketat ($1) saat plafon sistem tidak terbaca.
 *
 * Pesan penolakannya sengaja dibedakan supaya Owner bisa membedakan "jatah saya
 * memang habis" dari "pemeriksaannya yang rusak" — dua keadaan yang menuntut
 * tindakan berbeda.
 */
export async function checkQuota(userId: string, supabaseUrl: string, supabaseServiceKey: string, stream: boolean, corsHeaders: HeadersInit): Promise<Response | null> {
  const PESAN_GAGAL_PERIKSA =
    '**[PENGAMAN BIAYA AKTIF]** Pemakaian harian Anda tidak bisa dipastikan saat ini, ' +
    'jadi permintaan dihentikan demi keamanan — bukan karena jatah Anda habis. ' +
    'Biasanya ini gangguan sesaat pada database; coba ulangi sebentar lagi. ' +
    'Kalau terus berulang, periksa log fungsi agent-process.';

  try {
    const supClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: currentCost, error: quotaError } = await supClient.rpc('check_daily_quota', { target_user_id: userId });

    if (quotaError || currentCost === null || currentCost === undefined) {
      console.error(
        `[QUOTA] ⛔ Permintaan DITOLAK — pemeriksaan kuota tidak menghasilkan angka untuk user ${userId}. ` +
        `Gagal-tertutup disengaja. Sebab: ${quotaError?.message ?? 'RPC mengembalikan null'}`
      );
      return bangunPenolakan(PESAN_GAGAL_PERIKSA, stream, corsHeaders);
    }

    const DAILY_LIMIT = await resolveDailyLimit(supClient, userId);
    if (Number(currentCost) >= DAILY_LIMIT) {
      console.warn(`[CIRCUIT BREAKER] User ${userId} exceeded daily quota: $${currentCost}`);
      return bangunPenolakan(
        `**[CIRCUIT BREAKER AKTIF]** Limit harian AI Anda telah habis ($${Number(currentCost).toFixed(2)} / $${DAILY_LIMIT}). ` +
        `Arus API telah diputus otomatis untuk mencegah tagihan bengkak. Silakan coba lagi besok hari!`,
        stream,
        corsHeaders
      );
    }

    return null;
  } catch (quotaCheckError) {
    console.error(
      `[QUOTA] ⛔ Permintaan DITOLAK — pemeriksaan kuota melempar exception untuk user ${userId}. ` +
      `Gagal-tertutup disengaja.`,
      quotaCheckError
    );
    return bangunPenolakan(PESAN_GAGAL_PERIKSA, stream, corsHeaders);
  }
}
