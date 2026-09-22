// CADANGAN DATA (Item 93 Tahap 1, 2026-09-22) — satu berkas JSON berisi data milik pengguna yang login, dibuat
// langsung dari aplikasi dengan sesi pengguna itu. RLS membatasi ke milik sendiri; tidak ada kunci server.
//
// Menggantikan edge function backup-export/backup-restore (dihapus), yang ternyata: tidak memuat teks RAG (teks hanya
// ada di document_chunks — documents cuma judul), tidak memuat data ASN, memotong diam-diam di 1.000 baris (batas
// PostgREST), selalu gagal pada tabel tanpa created_at, dan ikut mencadangkan agent_logs (pernah berisi kunci API).
//
// Setiap tabel diambil per halaman berurutan `id`, lalu jumlahnya dicocokkan dengan hitungan database (count exact,
// di bawah RLS yang sama). Berkas berisi data pribadi (nama & NIP ASN) — simpan di tempat aman.

export const FORMAT_CADANGAN = 'mamet-cadangan';
export const VERSI_CADANGAN = 1;

// Urutan = urutan pemulihan (induk sebelum anak). halaman: baris per permintaan (potongan RAG membawa vektor 768-D,
// ±9 KB per baris → halaman lebih kecil).
export const TABEL_CADANGAN = [
  { nama: 'knowledge_spaces', halaman: 1000 },
  { nama: 'documents', halaman: 1000 },
  { nama: 'document_chunks', halaman: 300, catatan: 'teks + vektor RAG; pemilik lewat documents (RLS)' },
  { nama: 'workspace_summaries', halaman: 1000 },
  { nama: 'asn_berkas', halaman: 1000 },
  { nama: 'asn_pegawai', halaman: 1000 },
  { nama: 'chats', halaman: 200, catatan: 'riwayat chat bisa besar' },
  { nama: 'user_memories', halaman: 1000 },
  { nama: 'api_usage', halaman: 1000 },
  { nama: 'project_memory_entries', halaman: 1000 },
  { nama: 'engineering_tasks', halaman: 1000 },
  { nama: 'architecture_gaps', halaman: 1000 },
  { nama: 'verification_runs', halaman: 1000 },
];
// Sengaja TIDAK ikut: agent_logs, evidence_audit_logs, verification_audit_logs (log, bukan data; agent_logs pernah
// menyimpan kunci API — T7), tabel pemantauan (checks, incidents, monitors, service_heartbeat).

/** Semua baris satu tabel, per halaman, berurutan id. Melempar galat bila satu halaman gagal (tidak diam-diam). */
export async function ambilSemuaBaris(supabase, nama, halaman = 1000, onHalaman) {
  const hasil = [];
  for (let dari = 0; ; dari += halaman) {
    const { data, error } = await supabase.from(nama).select('*').order('id', { ascending: true }).range(dari, dari + halaman - 1);
    if (error) throw new Error(`${nama}: ${error.message}`);
    hasil.push(...(data || []));
    onHalaman?.(hasil.length);
    if (!data || data.length < halaman) break;
  }
  return hasil;
}

/** Hitungan baris di database, di bawah RLS yang sama dengan pengambilan. */
export async function hitungBaris(supabase, nama) {
  const { count, error } = await supabase.from(nama).select('id', { count: 'exact', head: true });
  if (error) throw new Error(`${nama} (hitung): ${error.message}`);
  return count ?? 0;
}

/**
 * Susun berkas cadangan. onKemajuan({tabel, ke, total, baris}) untuk status di layar.
 * @returns {{berkas: object, ringkas: {cocok: boolean, tabel: Array<{nama, db, berkas, cocok}>}}}
 */
export async function buatCadangan(supabase, { userId, onKemajuan, tabel = TABEL_CADANGAN, sekarang = new Date() } = {}) {
  const data = {};
  const daftar = [];
  for (const [i, t] of tabel.entries()) {
    onKemajuan?.({ tabel: t.nama, ke: i + 1, total: tabel.length, baris: 0 });
    const baris = await ambilSemuaBaris(supabase, t.nama, t.halaman, (n) => onKemajuan?.({ tabel: t.nama, ke: i + 1, total: tabel.length, baris: n }));
    // Dihitung SESUDAH diambil: baris baru yang masuk di tengah pengambilan (mis. api_usage dari chat lain) membuat
    // hitungan lebih besar → terlihat sebagai "tidak cocok", bukan tersembunyi.
    const db = await hitungBaris(supabase, t.nama);
    data[t.nama] = baris;
    daftar.push({ nama: t.nama, db, berkas: baris.length, cocok: db === baris.length });
  }
  const berkas = {
    format: FORMAT_CADANGAN,
    versi: VERSI_CADANGAN,
    dibuat: sekarang.toISOString(),
    akun: userId || null,
    catatan: 'Berisi data pribadi (nama & NIP ASN, memori, chat). Simpan di tempat aman. Vektor RAG 768-D ikut (model gemini-embedding-2).',
    tabel: Object.fromEntries(daftar.map((x) => [x.nama, { jumlah: x.berkas, jumlah_db: x.db }])),
    data,
  };
  return { berkas, ringkas: { cocok: daftar.every((x) => x.cocok), tabel: daftar } };
}

/**
 * Periksa berkas cadangan yang dibaca ulang (tanpa database): format, versi, dan jumlah baris tiap tabel sama dengan
 * daftar isinya sendiri. Dipakai sesudah berkas ditulis & oleh uji.
 */
export function periksaBerkasCadangan(berkas) {
  const masalah = [];
  if (!berkas || berkas.format !== FORMAT_CADANGAN) masalah.push('bukan berkas cadangan Mamet');
  else {
    if (berkas.versi !== VERSI_CADANGAN) masalah.push(`versi ${berkas.versi} (diharapkan ${VERSI_CADANGAN})`);
    for (const [nama, info] of Object.entries(berkas.tabel || {})) {
      const n = Array.isArray(berkas.data?.[nama]) ? berkas.data[nama].length : -1;
      if (n !== info.jumlah) masalah.push(`${nama}: daftar isi ${info.jumlah}, isi ${n}`);
      if (info.jumlah !== info.jumlah_db) masalah.push(`${nama}: database ${info.jumlah_db}, tercadang ${info.jumlah}`);
    }
  }
  return { sah: masalah.length === 0, masalah };
}

export const namaBerkasCadangan = (sekarang = new Date()) => `mamet-cadangan-${sekarang.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
