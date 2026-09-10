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
import { KUOTA_CACHE_BYTE, KUOTA_CACHE_MB } from './remoteConversionClient.js';

const INTERVAL_PERIKSA_MS = 6000;
const INTERVAL_DETAK_MS = 20000;
// Pekerjaan 'processing' lebih tua dari ini dianggap tertinggal (laptop mati / aplikasi ditutup
// di tengah konversi). Batas keras konversi di main.cjs 11 menit, jadi 15 menit aman.
const BATAS_MACET_MS = 15 * 60 * 1000;
const BUCKET = 'conversions';

// CACHE & PEMBERSIHAN (Item 58). Tanpa ini setiap konversi meninggalkan sumber + hasil di bucket
// selamanya. Pembersihan HARUS lewat Storage API: trigger `storage.protect_delete` memblokir
// DELETE langsung di storage.objects, jadi jadwal pg_cron di database tidak bisa melakukannya.
// Laptop-pekerja yang membersihkan — ia sudah login, hanya berhak atas folder akunnya sendiri,
// dan satu-satunya yang MENAMBAH isi cache, jadi kuota cukup ditegakkan di sini.
//   - sumber.docx        : dihapus segera setelah konversi selesai/gagal. Salinan aslinya selalu
//                          ada di perangkat Owner; sistem tidak perlu menyimpannya.
//   - pending > 15 mnt   : ditandai kedaluwarsa. Versi web berhenti menunggu di menit ke-13
//                          (remoteConversionClient), jadi tak ada lagi yang menunggu hasilnya.
//   - hasil.pdf (cache)  : disimpan selama total ≤ 200 MB. Lewat kuota → buang yang paling lama
//                          TIDAK DIPAKAI (last_accessed_at) sampai kembali di bawah kuota.
//   - baris gagal > 7 hr : dihapus (tak punya berkas, hanya mengotori riwayat).
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

  /**
   * Cache & pembersihan (lihat komentar konstanta di atas). Dijalankan saat pekerja mulai —
   * SEBELUM pemeriksaan antrian pertama, supaya pekerjaan basi tidak sempat dikonversi — lalu
   * tiap jam, dan setelah setiap konversi (supaya kuota tidak pernah terlampaui lama).
   * Setiap langkah melaporkan jumlah yang benar-benar terhapus, bukan jumlah yang dicoba.
   */
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

    // 1. Pending yang tak diambil > 15 menit: tak ada yang menunggu lagi. Tandai kedaluwarsa
    //    lebih dulu (klaim atomik, sama seperti _periksa) supaya tidak bentrok dengan pekerja
    //    lain yang kebetulan sedang mengambilnya.
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

    // 2. Sumber yang masih tertinggal pada pekerjaan yang sudah selesai/gagal — hasil sebelum
    //    Item 58, atau penghapusan segera di _kerjakan yang gagal. Ditandai source_deleted
    //    supaya tidak dicoba ulang tiap jam.
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

    // 3. Baris gagal > 7 hari: tidak punya berkas, hanya mengotori riwayat.
    await supabase
      .from('conversion_jobs')
      .delete()
      .eq('user_id', this.userId)
      .eq('status', 'failed')
      .lt('finished_at', new Date(sekarang - SIMPAN_GAGAL_MS).toISOString());

    // 4. KUOTA CACHE: total hasil.pdf ≤ 200 MB. Lewat kuota → buang yang paling lama TIDAK
    //    DIPAKAI sampai kembali di bawah kuota. Baris dihapus HANYA bila berkasnya berhasil
    //    dihapus — kalau Storage gagal, baris tetap ada sebagai penunjuk untuk dicoba lagi,
    //    bukan berkas yatim yang tidak tercatat di mana pun.
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

  /**
   * Hapus berkas sumber lalu tandai source_deleted. Berkas yang ternyata sudah tidak ada tetap
   * ditandai — hasil akhirnya sama: tidak ada lagi di bucket.
   * @returns {Promise<number>} jumlah berkas yang BENAR-BENAR terhapus menurut Storage API
   */
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
    // Hasil baru baru saja masuk cache — tegakkan kuota sekarang, bukan menunggu satu jam.
    this._bersihkan();
  }

  async _kerjakan(job) {
    console.log(`[RemoteConversionWorker] 📥 Mengonversi "${job.source_name}" dari HP...`);
    let hasil = null;
    // Sumber dihapus setelah selesai ATAU gagal (retensi, Item 58) — kecuali pekerjaan
    // dikembalikan ke antrian karena Word sibuk: saat itu sumbernya masih akan dipakai.
    let hapusSumber = true;
    try {
      const { data: blob, error: errUnduh } = await supabase.storage.from(BUCKET).download(job.source_path);
      if (errUnduh || !blob) throw new Error(`Gagal mengunduh dokumen: ${errUnduh?.message || 'kosong'}`);

      const simpan = await this.api.conversionTempSave(job.id, job.source_name, new Uint8Array(await blob.arrayBuffer()));
      if (!simpan?.ok) throw new Error(`Gagal menyimpan berkas sementara: ${simpan?.error}`);

      hasil = await this.api.wordToPdf(simpan.filePath);

      // Word sedang dipakai konversi dari chat — kembalikan ke antrian, jangan digagalkan.
      if (hasil?.stage === 'sibuk') {
        hapusSumber = false;
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
