/**
 * remoteConversionClient — sisi PENGIRIM antrian konversi laptop (Item 57) + cache (Item 58).
 *
 * Dipakai Mamet OS versi WEB (mamet-ecosystem.vercel.app, termasuk dibuka dari HP): tidak ada
 * Word di sana, jadi dokumen dikirim ke antrian `conversion_jobs` dan dikerjakan laptop yang
 * menjalankan aplikasi desktop (RemoteConversionWorkerService).
 *
 * CACHE: sebelum mengirim, sidik jari ISI dokumen (SHA-256) dicocokkan dengan hasil yang sudah
 * ada. Cocok → PDF langsung diberikan, tanpa laptop, bahkan saat laptop mati. Detail kebijakan
 * ada di migrasi 20260910200000_conversion_cache.sql.
 *
 * Sengaja HANYA untuk Mamet OS. mametlite tidak memakai fitur ini — keputusan Owner
 * 2026-09-10: mametlite hanya RAG dan pencarian web.
 */
import { supabase } from '../../../supabase.js';

const BUCKET = 'conversions';
const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword'
};
// Batas keras konversi di laptop 11 menit (main.cjs); ditambah jeda antrian.
const BATAS_TUNGGU_MS = 13 * 60 * 1000;

// Satu-satunya sumber angka kuota: RemoteConversionWorkerService mengimpornya untuk membuang,
// panel Riwayat memakainya untuk menampilkan pemakaian.
export const KUOTA_CACHE_MB = 200;
export const KUOTA_CACHE_BYTE = KUOTA_CACHE_MB * 1024 * 1024;

/** Status laptop-pekerja menurut JAM SERVER. null = akun ini tidak punya pekerja / migrasi belum ada. */
export async function statusLaptop() {
  const { data, error } = await supabase.rpc('conversion_worker_status');
  if (error || !data?.length) return null;
  return data[0];
}

/** Sidik jari SHA-256 dari ISI berkas (heksadesimal, 64 karakter). */
export async function sidikJari(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cari hasil konversi yang sudah ada untuk isi dokumen yang sama.
 * Berkasnya diperiksa benar-benar masih ada — baris tanpa berkas dianggap tidak ada di cache,
 * supaya pengguna tidak diberi tombol unduh yang pasti gagal.
 * @returns {Promise<object|null>} baris conversion_jobs, atau null
 */
export async function cariDiCache(hash) {
  if (!hash) return null;
  const { data, error } = await supabase
    .from('conversion_jobs')
    .select('*')
    .eq('kind', 'word_to_pdf')
    .eq('status', 'done')
    .eq('source_hash', hash)
    .not('output_path', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;

  const job = data[0];
  const { error: errCek } = await supabase.storage.from(BUCKET).createSignedUrl(job.output_path, 60);
  if (errCek) return null;

  await tandaiDipakai(job.id);
  return job;
}

/** Perbarui waktu terakhir dipakai — dasar urutan pembuangan cache. */
export async function tandaiDipakai(jobId) {
  await supabase.from('conversion_jobs').update({ last_accessed_at: new Date().toISOString() }).eq('id', jobId);
}

/**
 * Kirim dokumen ke laptop dan tunggu sampai selesai.
 * @param {File} file
 * @param {(status: string, job?: object) => void} [onStatus] - 'mengirim' | 'pending' | 'processing'
 * @param {string} [hash] - sidik jari yang sudah dihitung (supaya tidak dihitung dua kali)
 * @returns {Promise<{ ok: boolean, job?: object, error?: string }>}
 */
export async function kirimKeLaptop(file, onStatus, hash = null) {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'Anda belum masuk.' };

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!MIME[ext]) return { ok: false, error: `Hanya dokumen Word (.doc/.docx) yang bisa diubah ke PDF, bukan ".${ext}".` };
  if (file.size > 25 * 1024 * 1024) return { ok: false, error: 'Ukuran maksimal 25 MB.' };

  onStatus?.('mengirim');
  const jobId = crypto.randomUUID();
  const sourcePath = `${userId}/${jobId}/sumber.${ext}`;

  const { error: errUp } = await supabase.storage.from(BUCKET)
    .upload(sourcePath, file, { contentType: MIME[ext], upsert: false });
  if (errUp) return { ok: false, error: `Gagal mengunggah dokumen: ${errUp.message}` };

  const { error: errIns } = await supabase.from('conversion_jobs').insert({
    id: jobId,
    source_name: file.name,
    source_path: sourcePath,
    source_hash: hash || await sidikJari(file)
  });
  if (errIns) {
    await supabase.storage.from(BUCKET).remove([sourcePath]);
    return { ok: false, error: `Gagal membuat antrian: ${errIns.message}` };
  }

  const mulai = Date.now();
  let statusLalu = null;
  while (Date.now() - mulai < BATAS_TUNGGU_MS) {
    await new Promise(r => setTimeout(r, 4000));
    const { data: job, error } = await supabase.from('conversion_jobs').select('*').eq('id', jobId).single();
    if (error || !job) continue;
    if (job.status !== statusLalu) { statusLalu = job.status; onStatus?.(job.status, job); }
    if (job.status === 'done') return { ok: true, job };
    if (job.status === 'failed') return { ok: false, job, error: job.error || 'Laptop gagal mengonversi.' };
  }
  // Batas konversi di laptop 11 menit, jadi 13 menit tanpa hasil berarti laptop berhenti
  // (tertutup/mati) atau antriannya macet.
  return { ok: false, error: 'Belum selesai setelah 13 menit. Periksa apakah laptop dan aplikasi desktop Mamet OS masih menyala, lalu kirim ulang perintahnya.' };
}

/** Tautan unduh sementara (10 menit) dengan nama berkas asli. Ikut menandai "dipakai". */
export async function tautanUnduh(outputPath, sourceName, jobId = null) {
  const namaPdf = String(sourceName || 'dokumen').replace(/\.docx?$/i, '') + '.pdf';
  const { data, error } = await supabase.storage.from(BUCKET)
    .createSignedUrl(outputPath, 600, { download: namaPdf });
  if (error || !data?.signedUrl) {
    // Tombol di pesan chat lama bisa sampai di sini setelah PDF-nya dibuang dari cache.
    // Jelaskan sebabnya, jangan tampilkan "Object not found" mentah.
    if (/not.?found/i.test(error?.message || '')) {
      throw new Error(`PDF ini sudah dibuang dari cache — penyimpanan dibatasi ${KUOTA_CACHE_MB} MB dan yang paling lama tidak dipakai dibuang lebih dulu. Kirim ulang dokumennya untuk membuat PDF baru.`);
    }
    throw new Error(error?.message || 'Tautan unduh kosong.');
  }
  if (jobId) tandaiDipakai(jobId).catch(() => {});
  return { url: data.signedUrl, namaPdf };
}

/** Riwayat konversi akun ini, terbaru dulu, beserta pemakaian cache. */
export async function daftarRiwayat(batas = 50) {
  const { data, error } = await supabase
    .from('conversion_jobs')
    .select('id, status, source_name, output_path, output_size, error, result, created_at, finished_at, last_accessed_at')
    .order('created_at', { ascending: false })
    .limit(batas);
  if (error) throw new Error(error.message);
  const terpakai = (data || [])
    .filter(j => j.status === 'done' && j.output_path)
    .reduce((n, j) => n + (Number(j.output_size) || 0), 0);
  return { jobs: data || [], terpakai };
}

/** Hapus satu konversi: berkasnya dulu, baru barisnya (baris adalah penunjuk ke berkas). */
export async function hapusKonversi(job) {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Anda belum masuk.');

  // Seluruh isi folder pekerjaan, termasuk sumber yang mungkin belum sempat dihapus laptop.
  const folder = `${userId}/${job.id}`;
  const { data: isi } = await supabase.storage.from(BUCKET).list(folder);
  const jalur = (isi || []).map(o => `${folder}/${o.name}`);
  if (jalur.length) {
    const { error } = await supabase.storage.from(BUCKET).remove(jalur);
    if (error) throw new Error(`Berkas gagal dihapus: ${error.message}`);
  }
  const { error: errBaris } = await supabase.from('conversion_jobs').delete().eq('id', job.id);
  if (errBaris) throw new Error(`Berkas terhapus, tapi riwayat gagal dihapus: ${errBaris.message}`);
}
