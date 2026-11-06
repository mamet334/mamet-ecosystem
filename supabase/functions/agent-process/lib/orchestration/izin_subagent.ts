
import { ALIAS_TOOLS as ALIAS_SHARED, SUBAGEN_MAMETLITE, SUBAGEN_KHUSUS_PEMILIK } from '../../../../../shared/daftarSubagen.js';

export const ALIAS_TOOLS: Record<string, string> = { ...ALIAS_SHARED };

export const SUBAGENT_MAMETLITE = new Set<string>(SUBAGEN_MAMETLITE);

export const SUBAGENT_KHUSUS_PEMILIK = new Set<string>(SUBAGEN_KHUSUS_PEMILIK);

export function subagentDiminta(tools: unknown): Set<string> {
  if (!Array.isArray(tools)) return new Set();
  return new Set(tools.filter((t) => typeof t === 'string').map((t) => ALIAS_TOOLS[t] || t));
}

export function adalahPemilik(userId: unknown, daftar: string | undefined): boolean {
  if (typeof userId !== 'string' || !userId) return false;
  return String(daftar || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    .includes(userId.toLowerCase());
}

export function alasanTolakSubagent(
  subagent: unknown,
  { tools, appSource, pemilik }: { tools: unknown; appSource?: string; pemilik: boolean },
): string | null {
  const nama = typeof subagent === 'string' ? subagent : '';
  if (!nama) return 'nama sub-agent kosong';
  if (!subagentDiminta(tools).has(nama)) return 'tidak diminta aplikasi (tools)';
  if (appSource === 'mametlite' && !SUBAGENT_MAMETLITE.has(nama)) return 'tidak tersedia di Mametlite';
  if (SUBAGENT_KHUSUS_PEMILIK.has(nama) && !pemilik) return 'hanya untuk akun pemilik (memakai layanan berbayar Owner)';
  return null;
}
