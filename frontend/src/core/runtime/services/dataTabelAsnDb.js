// Akses database data tabel rekonsiliasi ASN (Item 92 Tahap 2). Tabel asn_berkas / asn_pegawai + fungsi
// asn_simpan_berkas (migrasi 20260921090000). Semua tunduk RLS: hanya data milik akun yang login.
// supabase-js tidak melempar galat — setiap { error } diperiksa sendiri.

const HALAMAN = 1000; // batas baris per permintaan PostgREST

/** Berkas aktif (belum digantikan) + daftar NIP-nya — bahan dugaanVersi. */
export async function ambilBerkasAktif(supabase) {
  const { data: berkas, error } = await supabase
    .from('asn_berkas').select('id, opd, nama_berkas, created_at').is('digantikan_oleh', null);
  if (error) throw error;
  if (!berkas?.length) return [];
  const peta = new Map(berkas.map((b) => [b.id, { ...b, nips: [] }]));
  // NIP dibaca per halaman: 2.000+ baris melebihi batas 1.000 baris PostgREST (tanpa ini dugaan versi diam-diam kurang).
  for (let dari = 0; ; dari += HALAMAN) {
    const { data, error: e } = await supabase
      .from('asn_pegawai').select('berkas_id, nip')
      .in('berkas_id', [...peta.keys()]).not('nip', 'is', null)
      .order('id').range(dari, dari + HALAMAN - 1);
    if (e) throw e;
    for (const r of data || []) peta.get(r.berkas_id)?.nips.push(r.nip);
    if (!data || data.length < HALAMAN) break;
  }
  return [...peta.values()];
}

/**
 * Simpan satu berkas (satu transaksi di database).
 * @param {{p_berkas, p_pegawai}} muatan  dari siapkanSimpan()
 * @param {{gantikan?: string[], versiLamaDari?: string|null}} pilihan
 *   gantikan: berkas aktif yang digantikan berkas ini; versiLamaDari: berkas ini justru versi LAMA dari berkas itu
 *   (tersimpan sebagai riwayat, langsung ditandai digantikan).
 */
export async function simpanBerkasAsn(supabase, muatan, { gantikan = [], versiLamaDari = null } = {}) {
  const { data: id, error } = await supabase.rpc('asn_simpan_berkas', { ...muatan, p_gantikan: gantikan });
  if (error) throw error;
  if (versiLamaDari) {
    const { data, error: e } = await supabase.from('asn_berkas').update({ digantikan_oleh: versiLamaDari }).eq('id', id).select('id');
    if (e) throw e;
    if (!data?.length) throw new Error('Berkas tersimpan, tetapi gagal ditandai sebagai versi lama — tandai ulang dari daftar.');
  }
  return id;
}

/** Semua berkas tersimpan (aktif & riwayat), terbaru dulu. */
export async function daftarBerkasAsn(supabase) {
  const { data, error } = await supabase
    .from('asn_berkas').select('id, opd, nama_berkas, jumlah_orang, digantikan_oleh, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Hapus berkas beserta pegawainya (cascade). Bila berkas ini pernah menggantikan versi lama, versi lama itu otomatis
 * aktif lagi (digantikan_oleh → null lewat ON DELETE SET NULL) — hapus = batalkan unggahan.
 */
export async function hapusBerkasAsn(supabase, id) {
  const { data, error } = await supabase.from('asn_berkas').delete().eq('id', id).select('id');
  if (error) throw error;
  return (data || []).length;
}
