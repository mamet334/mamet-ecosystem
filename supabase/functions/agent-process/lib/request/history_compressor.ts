import { bersihkanRiwayatDataTabel } from '../../../../../shared/dataTabelAsnSaring.js';
import { catatLapis, hurufThink, type JejakPrompt } from '../jejak_prompt.ts';

const AMBANG_HURUF = 4000;
const PESAN_UTUH = 2;
const MAKS_HURUF_PESAN_LAMA = 800;

const adalahPatok = (m: any) => m?._patok === true;

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
  let riwayat = buangThink(history);

  if (adalahDuplikatPesanSaatIni(riwayat, pesanSaatIni)) {
    riwayat = riwayat.slice(0, -1);
  }

  const total = riwayat.reduce((n, m) => n + (typeof m?.content === 'string' ? m.content.length : 0), 0);
  if (total < AMBANG_HURUF || riwayat.length <= PESAN_UTUH) return riwayat;

  const batas = riwayat.length - PESAN_UTUH;
  const hasil = riwayat.map((m, i) => {
    if (adalahPatok(m) || i >= batas || typeof m?.content !== 'string' || m.content.length <= MAKS_HURUF_PESAN_LAMA) return m;
    return { ...m, content: `${m.content.slice(0, MAKS_HURUF_PESAN_LAMA)}… [dipangkas]` };
  });
  const totalBaru = hasil.reduce((n, m) => n + (typeof m?.content === 'string' ? m.content.length : 0), 0);
  const jumlahPatok = riwayat.filter(adalahPatok).length;
  console.log(`[Riwayat] ${riwayat.length} pesan, ${total} → ${totalBaru} huruf (pesan lama dipangkas ke ${MAKS_HURUF_PESAN_LAMA} huruf, ${PESAN_UTUH} terakhir utuh, ${jumlahPatok} sisipan dipatok tidak dipangkas).`);
  return hasil;
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
