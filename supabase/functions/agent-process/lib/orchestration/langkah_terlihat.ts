
const rapikan = (s: unknown, maks: number): string => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > maks ? `${t.slice(0, maks - 1)}…` : t;
};

export function barisRencana(plan: any[]): string {
  const isi = plan.map((p) => `${p?.subagent || '?'}${p?.task ? `: "${rapikan(p.task, 140)}"` : ''}`).join(' · ');
  return `📋 Rencana: ${plan.length} sub-agent akan ditugaskan → ${isi}`;
}

export function barisDicariSubagent(subagent: string, toolExec: any): string | null {
  const kueri = toolExec?.args?.kueri;
  if (!kueri) return null;
  const penyedia = toolExec?.args?.penyedia;
  return `🔍 Dicari (berita, ${subagent}): "${rapikan(kueri, 160)}"${penyedia ? ` → ${penyedia}` : ''}`;
}
