/**
 * remoteConversionClient — sisi PENGIRIM antrian konversi laptop (Item 57).
 *
 * Dipakai Mamet OS versi WEB (mamet-ecosystem.vercel.app, termasuk dibuka dari HP): tidak ada
 * Word di sana, jadi dokumen dikirim ke antrian `conversion_jobs` dan dikerjakan laptop yang
 * menjalankan aplikasi desktop (RemoteConversionWorkerService).
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

/** Status laptop-pekerja menurut JAM SERVER. null = akun ini tidak punya pekerja / migrasi belum ada. */
export async function statusLaptop() {
  const { data, error } = await supabase.rpc('conversion_worker_status');
  if (error || !data?.length) return null;
  return data[0];
}

/**
 * Kirim dokumen ke laptop dan tunggu sampai selesai.
 * @param {File} file
 * @param {(status: string, job?: object) => void} [onStatus] - 'mengirim' | 'pending' | 'processing'
 * @returns {Promise<{ ok: boolean, job?: object, error?: string }>}
 */
export async function kirimKeLaptop(file, onStatus) {
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

  const { error: errIns } = await supabase.from('conversion_jobs')
    .insert({ id: jobId, source_name: file.name, source_path: sourcePath });
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
  // (tertutup/mati) atau antriannya macet. Tidak ada daftar riwayat konversi di UI, jadi JANGAN
  // menjanjikan "hasilnya bisa diunduh nanti".
  return { ok: false, error: 'Belum selesai setelah 13 menit. Periksa apakah laptop dan aplikasi desktop Mamet OS masih menyala, lalu kirim ulang perintahnya.' };
}

/** Tautan unduh sementara (10 menit) dengan nama berkas asli. */
export async function tautanUnduh(outputPath, sourceName) {
  const namaPdf = String(sourceName || 'dokumen').replace(/\.docx?$/i, '') + '.pdf';
  const { data, error } = await supabase.storage.from(BUCKET)
    .createSignedUrl(outputPath, 600, { download: namaPdf });
  if (error || !data?.signedUrl) throw new Error(error?.message || 'Tautan unduh kosong.');
  return { url: data.signedUrl, namaPdf };
}
