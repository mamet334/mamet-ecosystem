/**
 * RemoteConversionWorkerService — laptop sebagai "pekerja" konversi untuk HP (Item 57).
 *
 * Mamet OS versi web (mamet-ecosystem.vercel.app, termasuk dari HP) tidak punya Word. Laptop
 * punya (Word 2007 + Microsoft Print to PDF, Item 56). Service ini menjadikan aplikasi desktop
 * pekerja antrian di Supabase:
 *
 *   1. Berdetak tiap 20 dtk lewat RPC `conversion_worker_heartbeat` (jam server). Versi web
 *      memeriksa `conversion_worker_status` sebelum mengirim; laptop yang tidak berdetak
 *      > 60 dtk dianggap offline dan pengguna diberi tahu, bukan dibiarkan menunggu.
 *   2. Memeriksa `conversion_jobs` berstatus 'pending' tiap 6 dtk.
 *   3. MENGKLAIM dengan `update ... where status = 'pending'` — hanya satu pekerja yang bisa
 *      memindahkannya ke 'processing', walau dua jendela aplikasi terbuka bersamaan.
 *   4. Mengunduh .docx → berkas sementara → tool yang sama dengan chat (IPC doc:word-to-pdf)
 *      → mengunggah PDF → 'done'. Gagal → 'failed' dengan alasan apa adanya.
 *
 * Tidak berjalan di luar Electron (tidak ada Word), dan tidak berdetak bila tool
 * `word_to_pdf` dimatikan di panel Tools laptop — versi web lalu melihat laptop sebagai offline.
 */
import { supabase } from '../../../supabase.js';

const INTERVAL_PERIKSA_MS = 6000;
const INTERVAL_DETAK_MS = 20000;
// Pekerjaan 'processing' lebih tua dari ini dianggap tertinggal (laptop mati / aplikasi ditutup
// di tengah konversi). Batas keras konversi di main.cjs 11 menit, jadi 15 menit aman.
const BATAS_MACET_MS = 15 * 60 * 1000;
const BUCKET = 'conversions';

export class RemoteConversionWorkerService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.isInitialized = false;
    this.userId = null;
    this.timerPeriksa = null;
    this.timerDetak = null;
    this.sedangBekerja = false;
    this.api = null;
  }

  async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const api = typeof window !== 'undefined' ? window.electronAPI : null;
    if (!api?.wordToPdf || !api?.conversionTempSave) {
      console.log('[RemoteConversionWorker] Bukan aplikasi desktop — pekerja konversi tidak dijalankan.');
      return;
    }
    this.api = api;

    supabase.auth.onAuthStateChange((_event, session) => this._aturSesi(session));
    const { data: { session } } = await supabase.auth.getSession();
    this._aturSesi(session);
  }

  _aturSesi(session) {
    const uid = session?.user?.id || null;
    if (uid === this.userId) return;
    this.stop();
    this.userId = uid;
    if (uid) this.start();
  }

  /** Mengikuti toggle global tool word_to_pdf di panel Tools. */
  _aktif() {
    const prefs = this.serviceManager.has('ToolPreferencesService')
      ? this.serviceManager.get('ToolPreferencesService')
      : null;
    return prefs ? prefs.getGlobalDefault('word_to_pdf') !== false : true;
  }

  start() {
    console.log('[RemoteConversionWorker] ▶️ Laptop siap menerima konversi Word → PDF dari HP.');
    this._detak();
    this._pulihkanYangMacet();
    this._periksa();
    this.timerDetak = setInterval(() => this._detak(), INTERVAL_DETAK_MS);
    this.timerPeriksa = setInterval(() => this._periksa(), INTERVAL_PERIKSA_MS);
  }

  stop() {
    if (this.timerDetak) clearInterval(this.timerDetak);
    if (this.timerPeriksa) clearInterval(this.timerPeriksa);
    this.timerDetak = null;
    this.timerPeriksa = null;
  }

  async _detak() {
    if (!this.userId || !this._aktif()) return;
    const { error } = await supabase.rpc('conversion_worker_heartbeat', { p_device_label: 'Laptop (Mamet OS)' });
    if (error) console.warn('[RemoteConversionWorker] Detak gagal — HP akan menganggap laptop offline:', error.message);
  }

  /** Pekerjaan yang ditinggal di tengah jalan (aplikasi ditutup saat konversi) → 'failed'. */
  async _pulihkanYangMacet() {
    if (!this.userId) return;
    const batas = new Date(Date.now() - BATAS_MACET_MS).toISOString();
    const { data, error } = await supabase
      .from('conversion_jobs')
      .update({
        status: 'failed',
        error: 'Laptop berhenti di tengah konversi (aplikasi ditutup atau komputer mati). Silakan kirim ulang.',
        finished_at: new Date().toISOString()
      })
      .eq('user_id', this.userId)
      .eq('status', 'processing')
      .lt('claimed_at', batas)
      .select('id');
    if (error) console.warn('[RemoteConversionWorker] Gagal memeriksa pekerjaan macet:', error.message);
    else if (data?.length) console.warn(`[RemoteConversionWorker] ${data.length} pekerjaan macet ditandai gagal.`);
  }

  async _periksa() {
    if (!this.userId || this.sedangBekerja || !this._aktif()) return;

    const { data: antrian, error } = await supabase
      .from('conversion_jobs')
      .select('id')
      .eq('user_id', this.userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);
    if (error || !antrian?.length) return;

    // Klaim atomik: hanya berhasil bila statusnya MASIH 'pending' saat update dijalankan.
    const { data: diklaim, error: errKlaim } = await supabase
      .from('conversion_jobs')
      .update({ status: 'processing', claimed_at: new Date().toISOString() })
      .eq('id', antrian[0].id)
      .eq('status', 'pending')
      .select('*');
    if (errKlaim || !diklaim?.length) return; // sudah diambil pekerja lain

    this.sedangBekerja = true;
    try {
      await this._kerjakan(diklaim[0]);
    } finally {
      this.sedangBekerja = false;
    }
  }

  async _kerjakan(job) {
    console.log(`[RemoteConversionWorker] 📥 Mengonversi "${job.source_name}" dari HP...`);
    let hasil = null;
    try {
      const { data: blob, error: errUnduh } = await supabase.storage.from(BUCKET).download(job.source_path);
      if (errUnduh || !blob) throw new Error(`Gagal mengunduh dokumen: ${errUnduh?.message || 'kosong'}`);

      const simpan = await this.api.conversionTempSave(job.id, job.source_name, new Uint8Array(await blob.arrayBuffer()));
      if (!simpan?.ok) throw new Error(`Gagal menyimpan berkas sementara: ${simpan?.error}`);

      hasil = await this.api.wordToPdf(simpan.filePath);

      // Word sedang dipakai konversi dari chat — kembalikan ke antrian, jangan digagalkan.
      if (hasil?.stage === 'sibuk') {
        await supabase.from('conversion_jobs').update({ status: 'pending', claimed_at: null }).eq('id', job.id);
        console.log('[RemoteConversionWorker] Word sedang dipakai; pekerjaan dikembalikan ke antrian.');
        return;
      }
      if (!hasil?.ok) throw new Error(hasil?.error || `Konversi gagal di tahap ${hasil?.stage || 'tidak diketahui'}.`);

      const baca = await this.api.conversionTempRead(hasil.output);
      if (!baca?.ok) throw new Error(`Gagal membaca PDF hasil: ${baca?.error}`);

      // Kunci storage sengaja nama tetap: nama dokumen dinas bisa berisi karakter yang ditolak
      // atau merepotkan di kunci storage (#, %, ?). Nama asli dipulihkan saat diunduh di HP
      // (createSignedUrl dengan opsi download: <nama asli>.pdf).
      const outputPath = `${this.userId}/${job.id}/hasil.pdf`;
      const { error: errUnggah } = await supabase.storage.from(BUCKET).upload(
        outputPath,
        new Blob([baca.bytes], { type: 'application/pdf' }),
        { contentType: 'application/pdf', upsert: true }
      );
      if (errUnggah) throw new Error(`Gagal mengunggah PDF: ${errUnggah.message}`);

      await supabase.from('conversion_jobs').update({
        status: 'done',
        output_path: outputPath,
        result: hasil,
        error: null,
        finished_at: new Date().toISOString()
      }).eq('id', job.id);

      console.log(`[RemoteConversionWorker] ✅ "${job.source_name}" selesai: ${hasil.halaman_pdf} halaman, ${hasil.detik} dtk.`);
      this.eventBus?.emit('RemoteConversion:Done', { jobId: job.id, name: job.source_name });
    } catch (err) {
      console.error(`[RemoteConversionWorker] ❌ "${job.source_name}" gagal:`, err.message);
      await supabase.from('conversion_jobs').update({
        status: 'failed',
        error: err.message,
        result: hasil,
        finished_at: new Date().toISOString()
      }).eq('id', job.id);
    } finally {
      this.api.conversionTempCleanup(job.id).catch(() => {});
    }
  }
}

export default RemoteConversionWorkerService;
