import React, { useState } from 'react';
import Ikon from '../Ikon';
import TinjauAlat from './TinjauAlat';

/**
 * Satu server MCP yang dipasang Owner (Item 129 Tahap G2): kredensial, tinjau alat, sakelar per workspace (K3), hapus.
 * Nilai kredensial hanya DIKIRIM ke proses utama; layar tidak pernah menerimanya kembali (hanya "terisi/kosong").
 */
const WORKSPACE = [
  { id: 'ws-assistant', label: 'Assistant' },
  { id: 'ws-engineer', label: 'Engineer' },
];

const TOMBOL = 'flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all active:scale-95 font-semibold text-sm disabled:opacity-60';
const TOMBOL_BIASA = `${TOMBOL} border-outline-variant bg-surface-container-low text-on-surface-variant hover:text-on-surface`;

/** Teks status satu workspace dari status proses utama. */
export function teksStatusUmum(w, sedang) {
  if (sedang) return { teks: 'menyalakan…', kelas: 'text-on-surface-variant' };
  if (w?.status === 'nyala') return { teks: `● menyala — ${w.alat.length} alat dipakai`, kelas: 'text-primary' };
  if (w?.status === 'perlu_tinjau') return { teks: '● alat berubah sejak disetujui — tinjau ulang', kelas: 'text-error' };
  if (w?.status === 'belum_ditinjau') return { teks: '○ alat belum ditinjau', kelas: 'text-on-surface-variant' };
  if (w?.status === 'belum_terhubung') return { teks: '○ akun belum dihubungkan', kelas: 'text-on-surface-variant' };
  if (w?.status === 'perlu_hubungkan_ulang') return { teks: '● login kedaluwarsa — tekan Hubungkan ulang', kelas: 'text-error' };
  if (w?.status === 'gagal') return { teks: `● gagal: ${w.alasan || 'tanpa keterangan'}`, kelas: 'text-error' };
  if (w?.status === 'berhenti') return { teks: '● berhenti — matikan lalu nyalakan lagi', kelas: 'text-error' };
  return { teks: '○ mati', kelas: 'text-on-surface-variant' };
}

function IsiKredensial({ k, onSimpan }) {
  const [nilai, setNilai] = useState('');
  const [hasil, setHasil] = useState(null);
  const simpan = async () => {
    setHasil(null);
    const h = await onSimpan(k.id, nilai);
    setHasil(h);
    if (h?.ok) setNilai(''); // nilai tidak disimpan di layar sesudah terkirim
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-body-sm text-on-surface basis-full">
        {k.label} — {k.terisi ? <b className="text-primary">terisi</b> : <b className="text-error">kosong</b>}
      </span>
      <input
        type="password"
        autoComplete="off"
        value={nilai}
        onChange={(e) => setNilai(e.target.value)}
        placeholder={k.terisi ? 'ganti dengan nilai baru' : 'tempel di sini'}
        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-sm text-on-surface"
      />
      <button type="button" disabled={!nilai.trim()} onClick={simpan} className={TOMBOL_BIASA}>
        <Ikon nama="lock" ukuran={18} />
        Simpan
      </button>
      {hasil && !hasil.ok && <span className="text-body-sm text-error basis-full">{hasil.alasan}</span>}
    </div>
  );
}

/**
 * Akun server OAuth (Tahap F2): login di BROWSER SISTEM — akun & halaman dipilih Owner di halaman penyedia. Mamet tidak
 * pernah melihat password maupun token; layar hanya tahu terhubung/belum.
 */
function KodePerangkat({ login, onBatal }) {
  const [disalin, setDisalin] = useState(false);
  const salin = async () => {
    try { await navigator.clipboard.writeText(login.kodePengguna); setDisalin(true); }
    catch { setDisalin(false); /* papan klip ditolak — kode tetap terbaca di layar untuk diketik */ }
  };
  return (
    <div className="basis-full rounded-lg border border-primary/50 bg-primary/10 p-3 flex flex-col gap-2">
      <span className="text-body-sm text-on-surface">
        Masukkan kode ini di <code className="break-all">{login.alamat}</code> (sudah dibuka di browser), lalu setujui Mamet Ecosystem:
      </span>
      <div className="flex items-center gap-3 flex-wrap">
        <code className="text-headline-md font-semibold tracking-widest text-primary select-all">{login.kodePengguna}</code>
        <button type="button" onClick={salin} className={TOMBOL_BIASA}>
          <Ikon nama="content_copy" ukuran={18} />
          {disalin ? 'Tersalin' : 'Salin kode'}
        </button>
        <button type="button" onClick={onBatal} className={TOMBOL_BIASA}>
          <Ikon nama="cancel" ukuran={18} />
          Batal
        </button>
      </div>
      <span className="text-[12px] text-on-surface-variant">Mamet memeriksa ke penyedia beberapa detik sekali. Kode berlaku ±15 menit.</span>
    </div>
  );
}

function BagianAkun({ s, onHubungkan, onPutuskan, onBatal, sedangLogin }) {
  const perangkat = s.login?.jenis === 'perangkat' && s.login.kodePengguna;
  return (
    <div className="mt-3 flex items-center gap-3 flex-wrap">
      <span className="text-body-sm text-on-surface">
        Akun — {s.terhubung ? <b className="text-primary">terhubung</b> : <b className="text-error">belum dihubungkan</b>}
      </span>
      <button type="button" disabled={sedangLogin} onClick={onHubungkan} className={TOMBOL_BIASA}>
        <Ikon nama="key" ukuran={18} />
        {sedangLogin ? 'Menunggu login di browser…' : s.terhubung ? 'Hubungkan ulang' : 'Hubungkan akun'}
      </button>
      {s.terhubung && (
        <button type="button" disabled={sedangLogin} onClick={onPutuskan} className={TOMBOL_BIASA}>
          <Ikon nama="logout" ukuran={18} />
          Putuskan
        </button>
      )}
      {sedangLogin && perangkat && <KodePerangkat login={s.login} onBatal={onBatal} />}
      {sedangLogin && !perangkat && (
        <span className="text-body-sm text-on-surface-variant basis-full flex items-center gap-3 flex-wrap">
          Selesaikan login di browser, lalu kembali ke sini. Batas waktu 5 menit.
          <button type="button" onClick={onBatal} className={TOMBOL_BIASA}>
            <Ikon nama="cancel" ukuran={18} />
            Batal
          </button>
        </span>
      )}
    </div>
  );
}

export default function KartuServerUmum({ s, api, onBerubah }) {
  const [sedang, setSedang] = useState({});
  const [galat, setGalat] = useState(null);
  const [tinjauan, setTinjauan] = useState(null);
  const [sedangTinjau, setSedangTinjau] = useState(false);
  const [sedangLogin, setSedangLogin] = useState(false);
  // Akses siap: kredensial ketik terisi (stdio/http berkunci) DAN — untuk server OAuth — akun terhubung.
  const aksesSiap = s.kredensial.every((k) => k.terisi) && (!s.oauth || s.terhubung === true);
  const siap = aksesSiap && s.alatDisetujui.length > 0;

  // GH2: penyedia tanpa alamat pencabutan (mis. GitHub) — token di laptop sudah dihapus, tetapi izinnya masih ada di
  // sana sampai dicabut di situs penyedia. Dikatakan apa adanya, bukan "terputus" saja.
  const [info, setInfo] = useState(null);
  const putuskan = async () => {
    setInfo(null);
    const h = await jalankan(() => api.putuskan(s.id));
    if (h?.ok && h.dicabut !== true) {
      setInfo('Token di perangkat ini sudah dihapus. Penyedia ini tidak menyediakan pencabutan otomatis — cabut juga izinnya di situs penyedia (GitHub: Settings › Applications › Authorized GitHub Apps).');
    }
  };

  const hubungkan = async () => {
    setInfo(null);
    setSedangLogin(true);
    await jalankan(() => api.hubungkan(s.id)); // `jalankan` didefinisikan di bawah; dipanggil saat tombol ditekan
    setSedangLogin(false);
  };

  const jalankan = async (kerja) => {
    setGalat(null);
    try {
      const h = await kerja();
      if (h && !h.ok && !h.dibatalkan) setGalat(h.alasan || 'gagal');
      return h;
    } catch (e) {
      setGalat(e.message); // tidak ditelan: tampil di kartu
      return { ok: false, alasan: e.message };
    } finally {
      onBerubah();
    }
  };

  const tekan = async (ws, nyala) => {
    setSedang((x) => ({ ...x, [ws]: true }));
    await jalankan(() => api.atur(ws, s.id, nyala));
    setSedang((x) => ({ ...x, [ws]: false }));
  };

  const tinjau = async () => {
    setSedangTinjau(true);
    const h = await jalankan(() => api.tinjau(s.id));
    setSedangTinjau(false);
    if (h?.ok) setTinjauan(h);
  };

  const setujui = async (alat) => {
    setSedangTinjau(true);
    const h = await jalankan(() => api.setujui(s.id, alat));
    setSedangTinjau(false);
    if (h?.ok) setTinjauan(null);
  };

  return (
    <div className="rounded-lg border border-outline-variant p-4 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-on-surface">{s.nama}</span>
        <span className="text-[12px] px-2 py-0.5 rounded border border-outline-variant text-on-surface-variant">{s.jenis}</span>
        {s.dariResep && <span className="text-[12px] text-on-surface-variant">resep {s.dariResep}</span>}
      </div>
      <p className="text-body-sm text-on-surface-variant mt-1 break-all">
        <code>{s.lokasi}</code>{s.argumen?.length ? ` ${s.argumen.join(' ')}` : ''}
      </p>

      {s.kredensial.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {s.kredensial.map((k) => (
            <IsiKredensial key={k.id} k={k} onSimpan={(kredId, nilai) => jalankan(() => api.kredensial(s.id, kredId, nilai))} />
          ))}
        </div>
      )}

      {s.oauth && (
        <BagianAkun s={s} sedangLogin={sedangLogin} onHubungkan={hubungkan} onPutuskan={putuskan} onBatal={() => api.batalLogin?.(s.id)} />
      )}
      {info && <p className="text-body-sm text-on-surface-variant mt-2">{info}</p>}

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <span className="text-body-sm text-on-surface">
          {s.alatDisetujui.length ? `${s.alatDisetujui.length} alat disetujui` : 'Belum ada alat yang disetujui'}
        </span>
        <button type="button" disabled={sedangTinjau || !aksesSiap} onClick={tinjau} className={TOMBOL_BIASA}>
          <Ikon nama="verified_user" ukuran={18} />
          {sedangTinjau && !tinjauan ? 'Membaca alat…' : 'Tinjau alat'}
        </button>
      </div>
      {!aksesSiap && (
        <p className="text-body-sm text-on-surface-variant mt-1">
          {s.oauth && !s.terhubung ? 'Hubungkan akun dulu' : 'Isi kredensial dulu'} — server baru bisa dibaca alatnya sesudah itu.
        </p>
      )}

      {tinjauan && <TinjauAlat hasil={tinjauan} sedang={sedangTinjau} onSetujui={setujui} onBatal={() => setTinjauan(null)} />}

      <div className="mt-4 flex flex-col gap-2.5">
        {WORKSPACE.map((w) => {
          const st = s.ws?.[w.id];
          const nyala = !!st?.diaktifkan;
          const t = teksStatusUmum(st, sedang[w.id]);
          return (
            <div key={w.id} className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                aria-pressed={nyala}
                disabled={!!sedang[w.id] || (!nyala && !siap)}
                onClick={() => tekan(w.id, !nyala)}
                className={`${TOMBOL} ${nyala ? 'border-primary/50 bg-primary/10 text-primary' : 'border-outline-variant bg-surface-container-low text-on-surface-variant'}`}
              >
                <Ikon nama={nyala ? 'toggle_on' : 'toggle_off'} ukuran={18} />
                {w.label}
              </button>
              <span className={`text-body-sm ${t.kelas}`}>{t.teks}</span>
            </div>
          );
        })}
      </div>

      {galat && <p className="text-body-sm text-error mt-3">{galat}</p>}

      <div className="mt-4 pt-3 border-t border-outline-variant">
        <button type="button" onClick={() => jalankan(() => api.hapus(s.id))} className={TOMBOL_BIASA}>
          <Ikon nama="delete" ukuran={18} />
          Hapus konektor
        </button>
      </div>
    </div>
  );
}
