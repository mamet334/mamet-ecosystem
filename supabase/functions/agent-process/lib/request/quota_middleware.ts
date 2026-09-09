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

export async function checkQuota(userId: string, supabaseUrl: string, supabaseServiceKey: string, stream: boolean, corsHeaders: HeadersInit): Promise<Response | null> {
  try {
    const supClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: currentCost, error: quotaError } = await supClient.rpc('check_daily_quota', { target_user_id: userId });
    
    if (!quotaError && currentCost !== null) {
      const DAILY_LIMIT = await resolveDailyLimit(supClient, userId);
      if (Number(currentCost) >= DAILY_LIMIT) {
         console.warn(`[CIRCUIT BREAKER] User ${userId} exceeded daily quota: $${currentCost}`);
         
         if (!stream) {
           return new Response(JSON.stringify({ 
              message: `[CIRCUIT BREAKER AKTIF] Limit harian AI Anda telah habis ($${Number(currentCost).toFixed(2)} / $${DAILY_LIMIT}). Arus API telah diputus otomatis untuk mencegah tagihan bengkak. Silakan coba lagi besok hari!` 
           }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         } else {
           const streamRes = new ReadableStream({
             start(controller) {
               const data = JSON.stringify({ choices: [{ delta: { content: `\n\n**[CIRCUIT BREAKER AKTIF]** Limit harian AI Anda telah habis ($${Number(currentCost).toFixed(2)} / $${DAILY_LIMIT}). Arus API telah diputus otomatis untuk mencegah tagihan bengkak. Silakan coba lagi besok hari!` } }] });
               controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
               controller.close();
             }
           });
           return new Response(streamRes, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' } });
         }
      }
    }
  } catch (quotaCheckError) {
    console.error("Quota check failed, bypassing...", quotaCheckError);
  }
  return null;
}