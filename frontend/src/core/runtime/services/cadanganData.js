
export const FORMAT_CADANGAN = 'mamet-cadangan';
export const VERSI_CADANGAN = 1;

export const TABEL_CADANGAN = [
  { nama: 'knowledge_spaces', halaman: 1000 },
  { nama: 'documents', halaman: 1000 },
  { nama: 'document_chunks', halaman: 300, catatan: 'teks + vektor RAG; pemilik lewat documents (RLS)' },
  { nama: 'workspace_summaries', halaman: 1000 },
  { nama: 'asn_berkas', halaman: 1000 },
  { nama: 'asn_pegawai', halaman: 1000 },
  { nama: 'chats', halaman: 200, catatan: 'riwayat chat bisa besar' },
  { nama: 'raw_memory_content', halaman: 1000, catatan: 'isi asli memori; ringkasannya di user_memories' },
  { nama: 'user_memories', halaman: 1000 },
  { nama: 'api_usage', halaman: 1000 },
  { nama: 'project_memory_entries', halaman: 1000 },
  { nama: 'engineering_tasks', halaman: 1000 },
  { nama: 'architecture_gaps', halaman: 1000 },
  { nama: 'verification_runs', halaman: 1000 },
  { nama: 'cost_ledger', halaman: 1000, catatan: 'per panggilan model; tanpa isi percakapan' },
  { nama: 'umpan_balik_jawaban', halaman: 1000, catatan: 'penilaian 👍/👎 → cost_ledger lewat trace_id' },
];

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

export async function hitungBaris(supabase, nama) {
  const { count, error } = await supabase.from(nama).select('id', { count: 'exact', head: true });
  if (error) throw new Error(`${nama} (hitung): ${error.message}`);
  return count ?? 0;
}

export async function buatCadangan(supabase, { userId, onKemajuan, tabel = TABEL_CADANGAN, sekarang = new Date() } = {}) {
  const data = {};
  const daftar = [];
  for (const [i, t] of tabel.entries()) {
    onKemajuan?.({ tabel: t.nama, ke: i + 1, total: tabel.length, baris: 0 });
    const baris = await ambilSemuaBaris(supabase, t.nama, t.halaman, (n) => onKemajuan?.({ tabel: t.nama, ke: i + 1, total: tabel.length, baris: n }));
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
