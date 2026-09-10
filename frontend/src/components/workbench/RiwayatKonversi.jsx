import React, { useState, useEffect, useRef, useCallback } from 'react';
import { daftarRiwayat, tautanUnduh, hapusKonversi, KUOTA_CACHE_BYTE, KUOTA_CACHE_MB } from '../../core/runtime/services/remoteConversionClient';

/**
 * Panel "Riwayat konversi" (Item 58) — isi cache Word → PDF milik akun ini.
 *
 * Tanpa panel ini PDF hanya bisa diunduh dari tombol di pesan chat tempat konversi dilakukan;
 * cache yang disimpan sampai 200 MB jadi tak terlihat dan tak bisa dikelola. Bentuknya dropdown
 * seperti panel Tools, supaya toolbar chat tidak bertambah penuh.
 *
 * Yang tercantum hanya konversi lewat antrian (dikirim dari versi web, dikerjakan laptop).
 * Konversi langsung di aplikasi desktop (Item 56) menyimpan PDF di sebelah dokumen aslinya
 * dan tidak masuk cache.
 */

const mb = (n) => ((Number(n) || 0) / 1048576).toFixed(1);

const STATUS = {
  pending:    { ikon: 'schedule',       warna: 'text-amber-400',   teks: 'Menunggu laptop' },
  processing: { ikon: 'progress_activity', warna: 'text-sky-400 animate-spin', teks: 'Diproses laptop' },
  done:       { ikon: 'check_circle',   warna: 'text-emerald-400', teks: 'Siap diunduh' },
  failed:     { ikon: 'error',          warna: 'text-red-400',     teks: 'Gagal' }
};

export default function RiwayatKonversi() {
  const [buka, setBuka] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [terpakai, setTerpakai] = useState(0);
  const [memuat, setMemuat] = useState(false);
  const [pesan, setPesan] = useState(null);
  const ref = useRef(null);

  const muat = useCallback(async () => {
    try {
      const r = await daftarRiwayat();
      setJobs(r.jobs);
      setTerpakai(r.terpakai);
      setPesan(null);
    } catch (err) {
      // Tabel belum ada (migrasi belum dijalankan) atau jaringan putus — katakan, jangan kosong diam.
      setPesan(`Riwayat tidak bisa dimuat: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    if (!buka) return;
    setMemuat(true);
    muat().finally(() => setMemuat(false));
  }, [buka, muat]);

  // Selama ada yang menunggu/diproses dan panel terbuka, segarkan tiap 4 detik.
  const adaYangBerjalan = jobs.some(j => j.status === 'pending' || j.status === 'processing');
  useEffect(() => {
    if (!buka || !adaYangBerjalan) return;
    const t = setInterval(muat, 4000);
    return () => clearInterval(t);
  }, [buka, adaYangBerjalan, muat]);

  useEffect(() => {
    if (!buka) return;
    const tutup = (e) => { if (ref.current && !ref.current.contains(e.target)) setBuka(false); };
    document.addEventListener('mousedown', tutup);
    return () => document.removeEventListener('mousedown', tutup);
  }, [buka]);

  const unduh = async (job) => {
    try {
      const { url, namaPdf } = await tautanUnduh(job.output_path, job.source_name, job.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = namaPdf;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setPesan(err.message);
    }
  };

  const hapus = async (job) => {
    if (!window.confirm(`Hapus "${job.source_name}" dari riwayat? PDF-nya ikut dihapus dari penyimpanan.`)) return;
    try {
      await hapusKonversi(job);
      await muat();
    } catch (err) {
      setPesan(err.message);
    }
  };

  const persen = Math.min(100, (terpakai / KUOTA_CACHE_BYTE) * 100);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setBuka(v => !v)}
        title="Riwayat konversi Word → PDF"
        className={`h-10 px-3 flex items-center gap-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm active:scale-95
          ${buka ? 'bg-primary/15 border-primary/50 text-primary' : 'bg-surface-container-low border-outline-variant text-on-surface-variant'}`}
      >
        <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
        Riwayat
      </button>

      {buka && (
        <div className="absolute left-0 top-12 z-50 w-80 max-w-[90vw] rounded-xl border border-outline-variant bg-surface-container-low shadow-lg p-2">
          <div className="px-2 py-1 text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
            Riwayat konversi Word → PDF
          </div>

          <div className="px-2 pb-2">
            <div className="flex justify-between text-[10px] text-on-surface-variant mb-1">
              <span>Cache terpakai</span>
              <span>{mb(terpakai)} MB dari {KUOTA_CACHE_MB} MB</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-variant overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${persen}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-on-surface-variant leading-snug">
              Bila penuh, PDF yang paling lama tidak dipakai dibuang lebih dulu.
            </p>
          </div>

          {pesan && (
            <div className="mx-2 mb-2 px-2 py-1.5 rounded-lg bg-error/10 border border-error/30 text-[11px] text-error leading-snug">
              {pesan}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-1">
            {memuat && jobs.length === 0 && (
              <div className="px-2 py-3 text-xs text-on-surface-variant">Memuat…</div>
            )}
            {!memuat && jobs.length === 0 && !pesan && (
              <div className="px-2 py-3 text-xs text-on-surface-variant leading-snug">
                Belum ada konversi. Lampirkan dokumen Word lalu ketik <b>ubah word ke pdf dokumen ini</b>.
              </div>
            )}
            {jobs.map(job => {
              const s = STATUS[job.status] || STATUS.pending;
              const r = job.result || {};
              return (
                <div key={job.id} className="px-2 py-2 rounded-lg hover:bg-surface-variant/60 transition-colors">
                  <div className="flex items-start gap-2">
                    <span className={`material-symbols-outlined text-[16px] mt-0.5 ${s.warna}`}>{s.ikon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-on-surface truncate" title={job.source_name}>{job.source_name}</div>
                      <div className="text-[10px] text-on-surface-variant">
                        {s.teks}
                        {job.status === 'done' && r.halaman_pdf ? ` · ${r.halaman_pdf} hal` : ''}
                        {job.status === 'done' && job.output_size ? ` · ${mb(job.output_size)} MB` : ''}
                        {` · ${new Date(job.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}`}
                      </div>
                      {job.status === 'failed' && job.error && (
                        <div className="text-[10px] text-error/80 leading-snug mt-0.5">{job.error}</div>
                      )}
                    </div>
                    <div className="flex items-center shrink-0">
                      {job.status === 'done' && job.output_path && (
                        <button onClick={() => unduh(job)} title="Unduh PDF" className="p-1 rounded-md text-primary hover:bg-primary/10">
                          <span className="material-symbols-outlined text-[18px]">download</span>
                        </button>
                      )}
                      {job.status !== 'processing' && (
                        <button onClick={() => hapus(job)} title="Hapus dari riwayat" className="p-1 rounded-md text-on-surface-variant hover:text-error hover:bg-error/10">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
