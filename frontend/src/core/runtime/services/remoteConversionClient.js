import { supabase } from '../../../supabase.js';

const BUCKET = 'conversions';
const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword'
};
const BATAS_TUNGGU_MS = 13 * 60 * 1000;

export const KUOTA_CACHE_MB = 200;
export const KUOTA_CACHE_BYTE = KUOTA_CACHE_MB * 1024 * 1024;

export async function statusLaptop() {
  const { data, error } = await supabase.rpc('conversion_worker_status');
  if (error || !data?.length) return null;
  return data[0];
}

export async function sidikJari(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

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

export async function tandaiDipakai(jobId) {
  await supabase.from('conversion_jobs').update({ last_accessed_at: new Date().toISOString() }).eq('id', jobId);
}

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
  return { ok: false, error: 'Belum selesai setelah 13 menit. Periksa apakah laptop dan aplikasi desktop Mamet OS masih menyala, lalu kirim ulang perintahnya.' };
}

export async function tautanUnduh(outputPath, sourceName, jobId = null) {
  const namaPdf = String(sourceName || 'dokumen').replace(/\.docx?$/i, '') + '.pdf';
  const { data, error } = await supabase.storage.from(BUCKET)
    .createSignedUrl(outputPath, 600, { download: namaPdf });
  if (error || !data?.signedUrl) {
    if (/not.?found/i.test(error?.message || '')) {
      throw new Error(`PDF ini sudah dibuang dari cache — penyimpanan dibatasi ${KUOTA_CACHE_MB} MB dan yang paling lama tidak dipakai dibuang lebih dulu. Kirim ulang dokumennya untuk membuat PDF baru.`);
    }
    throw new Error(error?.message || 'Tautan unduh kosong.');
  }
  if (jobId) tandaiDipakai(jobId).catch(() => {});
  return { url: data.signedUrl, namaPdf };
}

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

export async function hapusKonversi(job) {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Anda belum masuk.');

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
