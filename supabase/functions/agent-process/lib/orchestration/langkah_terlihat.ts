// Baris langkah proses untuk hasil olahan LLM yang WAJIB terlihat Owner (ADR-0021 §2.3 "selalu terlihat — satu baris",
// 29 Okt 2026). Dulu baris rencana hanya menyebut nama sub-agent; tugas yang DITULIS ULANG Coordinator (mis. "Cari pemenang
// MotoGP 2026") dan kata kunci yang benar-benar dikirim researcher ke mesin berita hanya masuk log server.

const rapikan = (s: unknown, maks: number): string => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > maks ? `${t.slice(0, maks - 1)}…` : t;
};

/** `📋 Rencana: 2 sub-agent akan ditugaskan → researcher: "Cari …" · cron_manager: "…"` */
export function barisRencana(plan: any[]): string {
  const isi = plan.map((p) => `${p?.subagent || '?'}${p?.task ? `: "${rapikan(p.task, 140)}"` : ''}`).join(' · ');
  return `📋 Rencana: ${plan.length} sub-agent akan ditugaskan → ${isi}`;
}

/** `🔍 Dicari (berita, researcher): "kata kunci" → Bing News` — kueri yang BENAR-BENAR dikirim; null bila sub-agent tak mencari. */
export function barisDicariSubagent(subagent: string, toolExec: any): string | null {
  const kueri = toolExec?.args?.kueri;
  if (!kueri) return null;
  const penyedia = toolExec?.args?.penyedia;
  return `🔍 Dicari (berita, ${subagent}): "${rapikan(kueri, 160)}"${penyedia ? ` → ${penyedia}` : ''}`;
}
