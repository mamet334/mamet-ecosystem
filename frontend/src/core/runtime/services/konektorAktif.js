
import { KONEKTOR_DIKENAL, payloadKonektor } from '../../../../../shared/konektorAlat.js';
import { muatanKonektorUmumAman, petaAlatUmum } from '../../../../../shared/konektorUmum.js';

const api = () => (typeof window !== 'undefined' ? window.electronAPI : null);

export async function bacaKonektorAktif(workspaceId) {
  const e = api();
  let crawler = null;
  let umum = null;
  if (e?.konektor?.panggil) {
    try {
      const s = (await e.konektor.status() || []).find((x) => x.workspace === workspaceId && x.status === 'nyala' && KONEKTOR_DIKENAL[x.konektor]);
      if (s) crawler = { id: s.konektor, nama: s.nama, sumberSiap: s.ringkasan?.sumberSiap || [], akses: s.ringkasan?.akses || null };
    } catch {
      crawler = null;
    }
  }
  if (e?.konektorUmum?.aktif) {
    try {
      umum = muatanKonektorUmumAman({ putaran: 0, daftar: await e.konektorUmum.aktif(workspaceId) });
    } catch {
      umum = null;
    }
  }
  if (!crawler && !umum) return null;
  const nama = [crawler?.nama, ...(umum?.daftar || []).map((k) => k.nama)].filter(Boolean).join(', ');
  return { crawler, umum, nama };
}

export function petaAlatAktif(k) {
  return {
    ...(k?.crawler ? { [k.crawler.id]: KONEKTOR_DIKENAL[k.crawler.id].alat } : {}),
    ...petaAlatUmum(k?.umum),
  };
}

export function muatanKonektor(info) {
  if (!info) return {};
  return {
    konektor: info.crawler ? payloadKonektor({ ...info.crawler, putaran: info.putaran || 0, maks: info.maks, sisa: info.sisa }) : undefined,
    konektorUmum: info.umum ? { putaran: info.putaran || 0, ...(Number.isInteger(info.maks) ? { maks: info.maks, sisa: info.sisa } : {}), daftar: info.umum.daftar } : undefined,
  };
}

export function panggilKonektor(workspaceId, p, chatId) {
  const e = api();
  if (KONEKTOR_DIKENAL[p.konektor]) return e.konektor.panggil(workspaceId, p.konektor, p.alat, p.argumen);
  return e.konektorUmum.panggil(workspaceId, p.konektor, p.alat, p.argumen, chatId || null);
}

const LABEL_CRAWLER = {
  jalankan_misi: '🛰️ menunggu persetujuan misi Anda (lihat dialog), lalu crawler bekerja (≤ 2 menit)',
  status_misi: '⏳ memeriksa status misi',
  baca_tangkapan: '📥 membaca hasil misi',
  daftar_misi: '📋 menunggu izin Anda melihat daftar misi (lihat dialog)',
  ekspor_misi: '💾 menunggu izin Anda mengekspor hasil (lihat dialog)',
};

export function labelAlat(p) {
  if (KONEKTOR_DIKENAL[p.konektor]) return LABEL_CRAWLER[p.alat] || `⚙️ ${p.alat}`;
  return `🔌 ${p.konektor}·${p.alat} — menunggu izin Anda (lihat dialog)`;
}
