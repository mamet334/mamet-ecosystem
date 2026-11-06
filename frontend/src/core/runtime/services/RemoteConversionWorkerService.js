import { supabase } from '../../../supabase.js';
import { KUOTA_CACHE_BYTE, KUOTA_CACHE_MB } from './remoteConversionClient.js';

const INTERVAL_PERIKSA_MS = 6000;
const INTERVAL_DETAK_MS = 20000;
const BATAS_MACET_MS = 15 * 60 * 1000;
const BUCKET = 'conversions';

const BATAS_ANTRE_MS = 15 * 60 * 1000;
const SIMPAN_GAGAL_MS = 7 * 24 * 60 * 60 * 1000;
const INTERVAL_BERSIH_MS = 60 * 60 * 1000;

export class RemoteConversionWorkerService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.isInitialized = false;
    this.userId = null;
    this.timerPeriksa = null;
    this.timerDetak = null;
    this.timerBersih = null;
    this.sedangBekerja = false;
    this.sedangMembersihkan = false;
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
    this._bersihkan().then(() => this._periksa());
    this.timerDetak = setInterval(() => this._detak(), INTERVAL_DETAK_MS);
    this.timerPeriksa = setInterval(() => this._periksa(), INTERVAL_PERIKSA_MS);
    this.timerBersih = setInterval(() => this._bersihkan(), INTERVAL_BERSIH_MS);
  }

  stop() {
    if (this.timerDetak) clearInterval(this.timerDetak);
    if (this.timerPeriksa) clearInterval(this.timerPeriksa);
    if (this.timerBersih) clearInterval(this.timerBersih);
    this.timerDetak = null;
    this.timerPeriksa = null;
    this.timerBersih = null;
  }

  async _bersihkan() {
    if (!this.userId) return;
    if (this.sedangMembersihkan) return;
    this.sedangMembersihkan = true;
    try {
      await this._bersihkanInti();
    } catch (err) {
      console.warn('[RemoteConversionWorker] Pembersihan terhenti:', err.message);
    } finally {
      this.sedangMembersihkan = false;
    }
  }

  async _bersihkanInti() {
    const sekarang = Date.now();

    const { data: basi, error: errBasi } = await supabase
      .from('conversion_jobs')
      .update({
        status: 'failed',
        error: 'Kedaluwarsa: tidak diambil laptop dalam 15 menit (laptop mati atau aplikasi desktop tertutup). Silakan kirim ulang.',
        finished_at: new Date(sekarang).toISOString()
      })
      .eq('user_id', this.userId)
      .eq('status', 'pending')
      .lt('created_at', new Date(sekarang - BATAS_ANTRE_MS).toISOString())
      .select('id, source_path');
    if (errBasi) {
      console.warn('[RemoteConversionWorker] Gagal memeriksa antrian kedaluwarsa:', errBasi.message);
    } else if (basi?.length) {
      const terhapus = await this._hapusSumber(basi);
      console.log(`[RemoteConversionWorker] 🧹 ${basi.length} pekerjaan kedaluwarsa ditandai gagal; ${terhapus} berkas sumber dihapus.`);
    }

    const { data: sisa } = await supabase
      .from('conversion_jobs')
      .select('id, source_path')
      .eq('user_id', this.userId)
      .in('status', ['done', 'failed'])
      .eq('source_deleted', false)
      .limit(100);
    if (sisa?.length) {
      const terhapus = await this._hapusSumber(sisa);
      console.log(`[RemoteConversionWorker] 🧹 Sumber tertinggal dibersihkan: ${terhapus} berkas dari ${sisa.length} pekerjaan.`);
    }

    await supabase
      .from('conversion_jobs')
      .delete()
      .eq('user_id', this.userId)
      .eq('status', 'failed')
      .lt('finished_at', new Date(sekarang - SIMPAN_GAGAL_MS).toISOString());

    const { data: cache, error: errCache } = await supabase
      .from('conversion_jobs')
      .select('id, output_path, output_size, last_accessed_at, finished_at')
      .eq('user_id', this.userId)
      .eq('status', 'done')
      .not('output_path', 'is', null);
    if (errCache || !cache?.length) return;

    let total = cache.reduce((n, j) => n + (Number(j.output_size) || 0), 0);
    if (total <= KUOTA_CACHE_BYTE) return;

    const urut = [...cache].sort((a, b) =>
      new Date(a.last_accessed_at || a.finished_at || 0) - new Date(b.last_accessed_at || b.finished_at || 0));
    const dibuang = [];
    for (const j of urut) {
      if (total <= KUOTA_CACHE_BYTE) break;
      dibuang.push(j);
      total -= Number(j.output_size) || 0;
    }

    const { error: errHapus } = await supabase.storage.from(BUCKET).remove(dibuang.map(j => j.output_path));
    if (errHapus) {
      console.warn('[RemoteConversionWorker] Gagal membuang cache, dicoba lagi nanti:', errHapus.message);
      return;
    }
    const { error: errBaris } = await supabase.from('conversion_jobs').delete().in('id', dibuang.map(j => j.id));
    if (errBaris) console.warn('[RemoteConversionWorker] PDF terbuang tapi riwayatnya gagal dihapus:', errBaris.message);
    const mb = (n) => (n / 1048576).toFixed(1);
    console.log(`[RemoteConversionWorker] 🧹 Cache melewati ${KUOTA_CACHE_MB} MB: ${dibuang.length} PDF paling lama tak dipakai dibuang; tersisa ${mb(total)} MB.`);
  }

  async _hapusSumber(jobs) {
    const target = (jobs || []).filter(j => j?.source_path);
    if (!target.length) return 0;
    const { data, error } = await supabase.storage.from(BUCKET).remove(target.map(j => j.source_path));
    if (error) {
      console.warn('[RemoteConversionWorker] Gagal menghapus berkas sumber:', error.message);
      return 0;
    }
    await supabase.from('conversion_jobs').update({ source_deleted: true }).in('id', target.map(j => j.id));
    return data?.length || 0;
  }

  async _detak() {
    if (!this.userId || !this._aktif()) return;
    const { error } = await supabase.rpc('conversion_worker_heartbeat', { p_device_label: 'Laptop (Mamet OS)' });
    if (error) console.warn('[RemoteConversionWorker] Detak gagal — HP akan menganggap laptop offline:', error.message);
  }

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
      .select('id, source_path');
    if (error) console.warn('[RemoteConversionWorker] Gagal memeriksa pekerjaan macet:', error.message);
    else if (data?.length) {
      const terhapus = await this._hapusSumber(data);
      console.warn(`[RemoteConversionWorker] ${data.length} pekerjaan macet ditandai gagal; ${terhapus} berkas sumber dihapus.`);
    }
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

    const { data: diklaim, error: errKlaim } = await supabase
      .from('conversion_jobs')
      .update({ status: 'processing', claimed_at: new Date().toISOString() })
      .eq('id', antrian[0].id)
      .eq('status', 'pending')
      .select('*');
    if (errKlaim || !diklaim?.length) return;

    this.sedangBekerja = true;
    try {
      await this._kerjakan(diklaim[0]);
    } finally {
      this.sedangBekerja = false;
    }
    this._bersihkan();
  }

  async _kerjakan(job) {
    console.log(`[RemoteConversionWorker] 📥 Mengonversi "${job.source_name}" dari HP...`);
    let hasil = null;
    let hapusSumber = true;
    try {
      const { data: blob, error: errUnduh } = await supabase.storage.from(BUCKET).download(job.source_path);
      if (errUnduh || !blob) throw new Error(`Gagal mengunduh dokumen: ${errUnduh?.message || 'kosong'}`);

      const simpan = await this.api.conversionTempSave(job.id, job.source_name, new Uint8Array(await blob.arrayBuffer()));
      if (!simpan?.ok) throw new Error(`Gagal menyimpan berkas sementara: ${simpan?.error}`);

      hasil = await this.api.wordToPdf(simpan.filePath);

      if (hasil?.stage === 'sibuk') {
        hapusSumber = false;
        await supabase.from('conversion_jobs').update({ status: 'pending', claimed_at: null }).eq('id', job.id);
        console.log('[RemoteConversionWorker] Word sedang dipakai; pekerjaan dikembalikan ke antrian.');
        return;
      }
      if (!hasil?.ok) throw new Error(hasil?.error || `Konversi gagal di tahap ${hasil?.stage || 'tidak diketahui'}.`);

      const baca = await this.api.conversionTempRead(hasil.output);
      if (!baca?.ok) throw new Error(`Gagal membaca PDF hasil: ${baca?.error}`);

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
        output_size: baca.bytes.byteLength ?? baca.bytes.length,
        last_accessed_at: new Date().toISOString(),
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
      if (hapusSumber) {
        const n = await this._hapusSumber([job]);
        if (n === 0) console.warn(`[RemoteConversionWorker] Sumber "${job.source_name}" belum terhapus; dicoba lagi pada pembersihan berikutnya.`);
      }
    }
  }
}

export default RemoteConversionWorkerService;
