import React, { useCallback, useEffect, useState } from 'react';
import Ikon from './Ikon';

/**
 * Settings › Konektor (Item 129 Tahap C, 2026-10-23) — susunan disetujui Owner dari pratinjau ①–⑤.
 *
 *   ① tab sendiri · ② sakelar TERPISAH Assistant/Engineer (K3) · ③ cara crawler mengakses halaman, hanya ditampilkan
 *   (dibaca Mamet dari `katalog` saat konektor menyala; sakelarnya di `.env` crawler) · ④ konektor yang tak bisa
 *   dijalankan: sakelar mati, alasan ditampilkan · ⑤ versi web: konektor hanya di desktop · ⑥ komponen stealth (E2) · ⑦ yang terpasang di perangkat ini (E3).
 *
 * Setelan disimpan proses utama di perangkat (K7, `konektor.json` di userData). Layar ini hanya membaca status dan
 * memakai sakelar — memanggil alat konektor tidak bisa dari sini (K2: gerbang persetujuan di proses utama, Tahap D).
 * Warna memakai token palet (primary/error/tertiary), jadi ikut tema (Item 128); ikon lewat <Ikon>.
 */

const WORKSPACE = [
  { id: 'ws-assistant', label: 'Assistant' },
  { id: 'ws-engineer', label: 'Engineer' },
];

const KETERANGAN = {
  'ecosystem-crawler': 'Mencari dan mengambil data mentah dari banyak sumber. Setiap misi menunggu persetujuan Anda.',
};

const SELANG_SEGAR_MS = 3000;

/** Status per konektor: { id, nama, jenis, tersedia, alasan, ws: { 'ws-assistant': {...}, ... }, ringkasan } */
export function kelompokkan(daftar) {
  const hasil = new Map();
  for (const s of daftar || []) {
    const k = hasil.get(s.konektor) || { id: s.konektor, nama: s.nama, jenis: s.jenis, tersedia: s.tersedia, alasan: s.alasan, ws: {}, ringkasan: null, stealth: s.stealth || null };
    k.ws[s.workspace] = s;
    if (s.ringkasan && !k.ringkasan) k.ringkasan = s.ringkasan;
    hasil.set(s.konektor, k);
  }
  return [...hasil.values()];
}

export function teksStatus(s, sedang) {
  if (sedang) return { teks: 'menyalakan… (di komputer lambat bisa sampai semenit)', kelas: 'text-on-surface-variant' };
  if (s?.status === 'nyala') return { teks: '● menyala', kelas: 'text-primary' };
  if (s?.diaktifkan) return { teks: '● berhenti — matikan lalu nyalakan lagi', kelas: 'text-error' };
  return { teks: '○ mati', kelas: 'text-on-surface-variant' };
}

/**
 * ⑥ Komponen tingkat stealth (Tahap E2, susunan disetujui Owner 26 Okt). Tidak tampil di `npm run desktop`
 * (keadaan "pengembangan": stealth sudah ada di .venv). Pasang → proses utama meminta persetujuan unduhan dulu.
 */
export function BarisStealth({ stealth, sedang, hasil, onPasang }) {
  if (!stealth || stealth.keadaan === 'pengembangan') return null;
  if (sedang || stealth.sedangDipasang) {
    return (
      <p className="text-body-sm text-on-surface-variant flex items-center gap-2">
        <Ikon nama="hourglass_top" ukuran={18} className="shrink-0" />
        Memasang komponen stealth… (bisa beberapa menit)
      </p>
    );
  }
  if (stealth.keadaan === 'terpasang') {
    return (
      <p className="text-body-sm text-on-surface flex items-center gap-2">
        <Ikon nama="check_circle" ukuran={18} className="shrink-0 text-primary" />
        Komponen stealth terpasang{stealth.paket ? ` (${stealth.paket.replace('==', ' ')})` : ''}
      </p>
    );
  }
  const gagal = hasil && !hasil.ok && !hasil.ditolakOwner;
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {gagal ? (
        <span className="text-body-sm text-error flex items-start gap-2 basis-full">
          <Ikon nama="warning" ukuran={18} className="shrink-0" />
          <span>Gagal di langkah &quot;{hasil.langkah}&quot;: {hasil.alasan}</span>
        </span>
      ) : (
        <span className="text-body-sm text-on-surface-variant">
          Komponen stealth belum terpasang — halaman yang memblokir dilewati.
        </span>
      )}
      <button
        type="button"
        onClick={onPasang}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all active:scale-95 font-semibold text-sm border-outline-variant bg-surface-container-low text-on-surface-variant hover:text-on-surface"
      >
        <Ikon nama="download" ukuran={18} />
        {gagal ? 'Coba lagi' : 'Pasang komponen stealth'}
      </button>
    </div>
  );
}

const teksMB = (mb) => {
  if (typeof mb !== 'number') return '';
  return mb < 1 ? ' — kurang dari 1 MB' : ` — ${mb.toLocaleString('id-ID')} MB`;
};

function TombolBukaFolder({ onBuka }) {
  return (
    <button
      type="button"
      onClick={onBuka}
      className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-outline-variant text-[12px] text-on-surface-variant hover:text-on-surface transition-all active:scale-95"
    >
      <Ikon nama="folder_open" ukuran={16} />
      Buka folder
    </button>
  );
}

function BarisTerpasang({ ikon, judul, keterangan, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-t border-outline-variant">
      <Ikon nama={ikon} ukuran={18} className="shrink-0 mt-0.5 text-on-surface-variant" />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-sm text-on-surface">{judul}</p>
        {keterangan && <p className="text-body-sm text-on-surface-variant">{keterangan}</p>}
        {children}
      </div>
    </div>
  );
}

function Lokasi({ alamat, onBuka }) {
  if (!alamat) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <code className="text-[12px] text-on-surface-variant break-all">{alamat}</code>
      {onBuka && <TombolBukaFolder onBuka={onBuka} />}
    </div>
  );
}

/**
 * ⑦ Yang terpasang di perangkat ini (Tahap E3, susunan disetujui Owner 26 Okt) — transparansi isi bundel & unduhan.
 * Isi dari proses utama (`komponen.json` yang ditulis build + ukuran folder yang diukur saat dibuka). "Buka folder"
 * mengirim KUNCI (bawaan/data/stealth/browser), bukan alamat.
 */
export function DaftarTerpasang({ komponen, onBuka }) {
  const [bukaDaftar, setBukaDaftar] = useState(false);
  if (!komponen) return null; // belum dibaca
  if (!komponen.ok) {
    return <p className="text-body-sm text-error mt-4">Daftar yang terpasang tidak bisa dibaca: {komponen.alasan || 'alasan tidak diketahui'}</p>;
  }
  const { bawaan, data, stealth: st } = komponen;
  const paket = bawaan?.paket;
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-on-surface flex items-center gap-2 mb-1">
        <Ikon nama="hard_drive" ukuran={18} className="text-on-surface-variant" />
        Yang terpasang di perangkat ini
      </p>

      {komponen.mode === 'pengembangan' ? (
        <>
          <BarisTerpasang ikon="layers" judul="Mode pengembangan — memakai .venv repo" keterangan="npm run desktop: Python & paket crawler dari repo, bukan dari pemasang.">
            <Lokasi alamat={bawaan?.lokasi} onBuka={() => onBuka('bawaan')} />
          </BarisTerpasang>
          <BarisTerpasang ikon="folder" judul="Data crawler" keterangan="Di folder crawler repo (hasil tangkapan, .env, inbox).">
            <Lokasi alamat={data?.lokasi} onBuka={() => onBuka('data')} />
          </BarisTerpasang>
        </>
      ) : (
        <>
          <BarisTerpasang
            ikon="layers"
            judul={`Bawaan pemasang${teksMB(bawaan?.mb)}`}
            keterangan={paket
              ? `Python ${bawaan.python || '?'} · ${bawaan.crawler?.nama || 'Ecosystem Crawler'} ${bawaan.crawler?.versi || ''} · ${paket.length} paket Python`
              : 'Daftar isi tidak tersedia — pemasang ini dibangun sebelum daftarnya ada.'}
          >
            <Lokasi alamat={bawaan?.lokasi} onBuka={() => onBuka('bawaan')} />
            {paket && (
              <button
                type="button"
                onClick={() => setBukaDaftar((b) => !b)}
                className="self-start flex items-center gap-1 text-[12px] text-primary hover:underline"
              >
                <Ikon nama="expand_more" ukuran={16} className={bukaDaftar ? 'rotate-180' : ''} />
                {bukaDaftar ? 'Sembunyikan daftar' : `Lihat ${paket.length} paket`}
              </button>
            )}
            {paket && bukaDaftar && (
              <table className="w-full table-fixed text-[12px] text-on-surface-variant mt-1">
                <thead>
                  <tr className="text-left"><th className="font-normal pb-1 w-[45%]">Paket</th><th className="font-normal pb-1 w-[25%]">Versi</th><th className="font-normal pb-1">Lisensi</th></tr>
                </thead>
                <tbody>
                  {paket.map((p) => (
                    <tr key={p.nama} className="border-t border-outline-variant">
                      <td className="py-0.5 pr-2 break-all text-on-surface">{p.nama}</td>
                      <td className="py-0.5 pr-2 break-all">{p.versi}</td>
                      <td className="py-0.5 break-words">{p.lisensi || 'tidak tercantum'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </BarisTerpasang>

          <BarisTerpasang ikon="folder" judul={`Data crawler${teksMB(data?.mb)}`} keterangan="Hasil tangkapan, pengaturan crawler (.env), inbox.">
            <Lokasi alamat={data?.lokasi} onBuka={() => onBuka('data')} />
          </BarisTerpasang>

          {st?.keadaan === 'terpasang' ? (
            <BarisTerpasang
              ikon="visibility_off"
              judul={`Komponen stealth — terpasang${teksMB(st.mb)}`}
              keterangan={`${(st.paket || 'patchright').replace('==', ' ')} · ${st.browser.map((b) => `${b.nama} ${b.versi || b.revisi}`).join(' · ')}`}
            >
              <Lokasi alamat={st.lokasiPaket} onBuka={() => onBuka('stealth')} />
              <Lokasi alamat={st.akarBrowser} onBuka={() => onBuka('browser')} />
              {st.browser.filter((b) => !b.ada).map((b) => (
                <p key={b.nama} className="text-body-sm text-error">Browser {b.nama} (revisi {b.revisi}) tidak ditemukan di folder itu.</p>
              ))}
            </BarisTerpasang>
          ) : (
            <BarisTerpasang ikon="visibility_off" judul="Komponen stealth — belum terpasang" keterangan={`Bila dipasang: Patchright + Chromium, ±${st?.perkiraanMB || 830} MB.`} />
          )}
        </>
      )}
    </div>
  );
}

function KotakAkses({ ringkasan }) {
  const akses = ringkasan?.akses;
  if (!akses) {
    return <p className="text-body-sm text-on-surface-variant italic">Cara crawler mengakses halaman tampil setelah konektor menyala.</p>;
  }
  return (
    <div className="rounded-lg border border-outline-variant px-3 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-on-surface">
      <span className="flex items-center gap-1.5">
        <Ikon nama={akses.patuhi_robots ? 'check_circle' : 'warning'} ukuran={16} className={akses.patuhi_robots ? 'text-primary' : 'text-tertiary'} />
        robots.txt <b className="font-semibold">{akses.patuhi_robots ? 'dipatuhi' : 'tidak dipatuhi'}</b>
      </span>
      <span className="flex items-center gap-1.5">
        <Ikon nama={akses.stealth ? 'visibility_off' : 'visibility'} ukuran={16} className="text-on-surface-variant" />
        stealth <b className="font-semibold">{akses.stealth ? 'nyala' : 'mati'}</b>
      </span>
      <span className="text-[12px] text-on-surface-variant">diubah di <code>.env</code> crawler</span>
    </div>
  );
}

export default function BagianKonektor() {
  const api = typeof window !== 'undefined' ? window.electronAPI?.konektor : null;
  const [daftar, setDaftar] = useState([]);
  const [sedang, setSedang] = useState({}); // `${ws}::${id}` → true selama sakelar diproses
  const [galat, setGalat] = useState({});   // `${ws}::${id}` → alasan gagal terakhir
  const [sedangStealth, setSedangStealth] = useState(false);
  const [hasilStealth, setHasilStealth] = useState(null);   // hasil pemasangan terakhir (untuk pesan gagal)
  const [komponen, setKomponen] = useState({});              // id konektor → daftar yang terpasang (⑦)
  const [galatBuka, setGalatBuka] = useState(null);

  // ⑦ dibaca saat layar dibuka & sesudah pemasangan stealth — bukan tiap 3 detik (menghitung ukuran folder).
  const segarkanKomponen = useCallback(async () => {
    if (!api?.komponen) return;
    const hasil = {};
    for (const id of Object.keys(KETERANGAN)) {
      try {
        hasil[id] = await api.komponen(id);
      } catch (e) {
        // Tidak ditelan: alasannya tampil di bagian ⑦ ("tidak bisa dibaca: …"), bukan bagian yang hilang diam-diam.
        hasil[id] = { ok: false, alasan: e.message };
      }
    }
    setKomponen(hasil);
  }, [api]);

  const bukaFolder = async (id, kunci) => {
    setGalatBuka(null);
    try {
      const h = await api.bukaFolder(id, kunci);
      if (!h?.ok) setGalatBuka(h?.alasan || 'folder tidak bisa dibuka');
    } catch (e) {
      // Tidak ditelan: tampil di bawah kartu konektor (galatBuka).
      setGalatBuka(e.message);
    }
  };

  const pasangStealth = async () => {
    setSedangStealth(true);
    setHasilStealth(null);
    try { setHasilStealth(await api.pasangStealth()); }
    catch (e) { setHasilStealth({ ok: false, langkah: 'IPC', alasan: e.message }); }
    finally { setSedangStealth(false); segarkan(); segarkanKomponen(); }
  };

  const segarkan = useCallback(async () => {
    if (!api) return;
    try { setDaftar(await api.status()); } catch { /* proses utama sibuk — dicoba lagi pada selang berikutnya */ }
  }, [api]);

  useEffect(() => {
    if (!api) return undefined;
    segarkan();
    segarkanKomponen();
    const t = setInterval(segarkan, SELANG_SEGAR_MS); // status "berhenti sendiri" & ringkasan katalog muncul tanpa muat ulang
    return () => clearInterval(t);
  }, [api, segarkan, segarkanKomponen]);

  const tekan = async (ws, id, nyala) => {
    const k = `${ws}::${id}`;
    setSedang((s) => ({ ...s, [k]: true }));
    setGalat((g) => ({ ...g, [k]: null }));
    try {
      const h = await api.atur(ws, id, nyala);
      if (!h?.ok) setGalat((g) => ({ ...g, [k]: h?.alasan || 'gagal' }));
    } catch (e) {
      setGalat((g) => ({ ...g, [k]: e.message }));
    } finally {
      setSedang((s) => ({ ...s, [k]: false }));
      segarkan();
    }
  };

  return (
    <section className="glass-panel rim-light p-4 md:p-gutter rounded-xl border border-outline-variant">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center">
          <Ikon nama="lan" ukuran={24} className="text-primary" />
        </div>
        <div>
          <h2 className="font-headline-md text-headline-md">Konektor</h2>
          <p className="text-body-sm text-on-surface-variant">Alat dari program lain (MCP), dinyalakan per workspace. Setelan disimpan di perangkat ini, tidak ikut akun.</p>
        </div>
      </div>

      {!api && (
        <p className="text-body-sm text-on-surface-variant flex items-center gap-2">
          <Ikon nama="public" ukuran={18} />
          Konektor hanya tersedia di aplikasi desktop.
        </p>
      )}

      {api && kelompokkan(daftar).map((k) => (
        <div key={k.id} className="rounded-lg border border-outline-variant p-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-on-surface">{k.nama}</span>
            <span className="text-[12px] px-2 py-0.5 rounded border border-outline-variant text-on-surface-variant">{k.jenis}</span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {KETERANGAN[k.id] || ''}
            {k.ringkasan ? ` ${k.ringkasan.sumber} sumber (${k.ringkasan.siap} siap).` : ''}
          </p>

          {!k.tersedia ? (
            <p className="text-body-sm text-error mt-3 flex items-start gap-2">
              <Ikon nama="error" ukuran={18} className="shrink-0" />
              <span>{k.alasan}</span>
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-2.5">
                {WORKSPACE.map((w) => {
                  const kunci = `${w.id}::${k.id}`;
                  const s = k.ws[w.id];
                  const nyala = !!s?.diaktifkan;
                  const st = teksStatus(s, sedang[kunci]);
                  return (
                    <div key={w.id} className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        aria-pressed={nyala}
                        disabled={!!sedang[kunci]}
                        onClick={() => tekan(w.id, k.id, !nyala)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all active:scale-95 font-semibold text-sm disabled:opacity-60
                          ${nyala ? 'border-primary/50 bg-primary/10 text-primary' : 'border-outline-variant bg-surface-container-low text-on-surface-variant'}`}
                      >
                        <Ikon nama={nyala ? 'toggle_on' : 'toggle_off'} ukuran={18} />
                        {w.label}
                      </button>
                      <span className={`text-body-sm ${st.kelas}`}>{st.teks}</span>
                      {galat[kunci] && <span className="text-body-sm text-error basis-full">{galat[kunci]}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4">
                <KotakAkses ringkasan={k.ringkasan} />
              </div>
              {k.stealth && k.stealth.keadaan !== 'pengembangan' && (
                <div className="mt-3">
                  <BarisStealth stealth={k.stealth} sedang={sedangStealth} hasil={hasilStealth} onPasang={pasangStealth} />
                </div>
              )}
            </>
          )}
          <DaftarTerpasang komponen={komponen[k.id]} onBuka={(kunci) => bukaFolder(k.id, kunci)} />
          {galatBuka && <p className="text-body-sm text-error mt-2">Folder tidak bisa dibuka: {galatBuka}</p>}
        </div>
      ))}
    </section>
  );
}
