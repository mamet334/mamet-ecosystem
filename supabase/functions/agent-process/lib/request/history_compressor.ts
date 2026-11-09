import { bersihkanRiwayatDataTabel } from '../../../../../shared/dataTabelAsnSaring.js';
import { catatLapis, hurufThink, type JejakPrompt } from '../jejak_prompt.ts';

export function buangThink(history: any[]): any[] {
  return (Array.isArray(history) ? history : []).map((m) =>
    typeof m?.content === 'string' && /<think>/i.test(m.content)
      ? { ...m, content: m.content.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim() }
      : m
  );
}

export function adalahDuplikatPesanSaatIni(riwayat: any[], pesanSaatIni: string): boolean {
  const terakhir = Array.isArray(riwayat) ? riwayat[riwayat.length - 1] : undefined;
  return Boolean(terakhir?.role === 'user' && typeof terakhir.content === 'string'
    && pesanSaatIni && terakhir.content.trim() === pesanSaatIni.trim());
}

export function rapikanRiwayat(history: any[], pesanSaatIni: string): any[] {
  const riwayat = buangThink(history);
  return adalahDuplikatPesanSaatIni(riwayat, pesanSaatIni) ? riwayat.slice(0, -1) : riwayat;
}

export function siapkanRiwayatUntukModel(history: any[], pesanSaatIni: string, jejak?: JejakPrompt | null): any[] {
  const awal = Array.isArray(history) ? history : [];
  const tanpaThink = buangThink(awal);
  catatLapis(jejak, 'buang_think', awal, tanpaThink, { hurufThinkDibuang: hurufThink(awal) });
  const dirapikan = rapikanRiwayat(awal, pesanSaatIni);
  catatLapis(jejak, 'rapikan_riwayat', tanpaThink, dirapikan, { duplikatPesanSaatIni: adalahDuplikatPesanSaatIni(tanpaThink, pesanSaatIni) });
  const bersih = dirapikan.map((m: any) =>
    m && m.role !== 'user' && typeof m.content === 'string' ? { ...m, content: bersihkanRiwayatDataTabel(m.content) } : m);
  catatLapis(jejak, 'bersihkan_data_tabel', dirapikan, bersih, { melindungi: true });
  return bersih;
}
