
export const UKURAN_KELOMPOK_HAPUS = 20;

export async function hapusDokumenBanyak(supabase, ids, { onKemajuan } = {}) {
  const unik = [...new Set((ids || []).filter(Boolean))];
  const dihapus = [];
  const tidakDitemukan = [];
  for (let i = 0; i < unik.length; i += UKURAN_KELOMPOK_HAPUS) {
    const grup = unik.slice(i, i + UKURAN_KELOMPOK_HAPUS);
    const { error: errPotongan } = await supabase.from('document_chunks').delete().in('document_id', grup);
    if (errPotongan) return { dihapus, tidakDitemukan, gagal: { pesan: errPotongan.message || String(errPotongan), belumDiproses: unik.slice(i) } };
    const { data, error: errDokumen } = await supabase.from('documents').delete().in('id', grup).select('id');
    if (errDokumen) return { dihapus, tidakDitemukan, gagal: { pesan: errDokumen.message || String(errDokumen), belumDiproses: unik.slice(i) } };
    const kena = new Set((data || []).map((d) => d.id));
    for (const id of grup) (kena.has(id) ? dihapus : tidakDitemukan).push(id);
    onKemajuan?.({ selesai: Math.min(i + UKURAN_KELOMPOK_HAPUS, unik.length), total: unik.length });
  }
  return { dihapus, tidakDitemukan, gagal: null };
}

export function buatPenjagaTerbaru() {
  let terakhir = 0;
  return {
    mulai: () => ++terakhir,
    masihTerbaru: (nomor) => nomor === terakhir,
  };
}

export function ringkasRuang(dokumen, ruang) {
  const nama = new Map((ruang || []).map((r) => [r.id, r.name]));
  const hitung = new Map();
  for (const d of dokumen || []) {
    const n = nama.get(d.space_id) || '(tanpa workspace)';
    hitung.set(n, (hitung.get(n) || 0) + 1);
  }
  return [...hitung].map(([n, c]) => `${n} (${c})`).join(', ');
}
