import React, { useEffect, useState } from 'react';
import { temaService } from '../core/runtime/services/TemaService';
import { PILIHAN_SISTEM, latarNyala, lampuNyala } from '../core/runtime/services/tema.js';

// Settings › Tampilan (Item 128 Tahap B). Pilihan tema & latar ruangan, disimpan per akun lewat TemaService.
//
// Pratinjau tiap tema memakai warna SUNGGUHAN tema itu: kotaknya diberi `data-tema`, jadi variabel --warna-* di
// dalamnya milik tema tersebut sementara halaman tetap memakai tema aktif. Pelajaran Item 127: Owner menilai dari
// melihat, bukan dari deskripsi.

// "Kurangi gerakan" (Item 128 Tahap C) — bawaannya mengikuti setelan animasi Windows.
const PILIHAN_GERAK_TAMPIL = [
  { id: 'sistem', nama: 'Ikuti Windows', keterangan: 'Mengikuti setelan efek animasi di Windows.' },
  { id: 'kurangi', nama: 'Kurangi', keterangan: 'Animasi & kedipan berhenti — lebih tenang di mata.' },
  { id: 'normal', nama: 'Normal', keterangan: 'Animasi tetap berjalan, apa pun setelan Windows.' },
];

function Pratinjau({ idTema }) {
  return (
    <div data-tema={idTema} className="h-20 rounded-lg border border-outline-variant bg-background p-2.5 flex flex-col gap-1.5 overflow-hidden">
      <div className="flex items-center gap-1.5">
        <span className="w-8 h-2 rounded-full bg-surface-container-high border border-outline-variant" />
        <span className="w-6 h-2 rounded-full bg-surface-container-high border border-outline-variant" />
        <span className="ml-auto w-2.5 h-2.5 rounded-full bg-primary" />
      </div>
      <div className="flex-1 rounded-md bg-surface-container border border-outline-variant px-2 py-1.5 flex flex-col gap-1">
        <span className="h-1.5 w-3/4 rounded-full bg-on-surface" />
        <span className="h-1.5 w-1/2 rounded-full bg-on-surface-variant" />
      </div>
    </div>
  );
}

function KartuPilihan({ terpilih, onPilih, judul, keterangan, children }) {
  return (
    <button
      type="button"
      onClick={onPilih}
      aria-pressed={terpilih}
      className={`text-left rounded-lg border p-3 flex flex-col gap-2.5 transition-colors ${terpilih ? 'border-primary bg-primary-container/20' : 'border-outline-variant hover:bg-surface-container-high'}`}
    >
      {children}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-on-surface">{judul}</div>
          <div className="text-[12px] text-on-surface-variant leading-snug">{keterangan}</div>
        </div>
        {terpilih && <span className="material-symbols-outlined text-[18px] text-primary shrink-0">check_circle</span>}
      </div>
    </button>
  );
}

export default function BagianTampilan() {
  const [setelan, setSetelan] = useState(() => temaService.ambilSetelan());
  const [temaTampil, setTemaTampil] = useState(() => temaService.temaTampil());
  const [status, setStatus] = useState(null);

  useEffect(() => temaService.langgan((s, id) => { setSetelan(s); setTemaTampil(id); }), []);

  const meta = temaService.ambilMeta();
  const daftar = temaService.daftarTema();
  const latar = latarNyala(setelan, temaTampil, meta);

  const simpan = async (ubahan) => {
    setStatus({ jenis: 'menyimpan', teks: 'Menyimpan ke akun…' });
    const { error } = await temaService.simpan(ubahan);
    setStatus(error
      ? { jenis: 'gagal', teks: `Tampilan sudah berganti di perangkat ini, tetapi gagal disimpan ke akun: ${error.message}` }
      : { jenis: 'tersimpan', teks: 'Tersimpan di akun — ikut ke desktop dan web.' });
  };

  const namaTema = (id) => daftar.find((t) => t.id === id)?.nama || id;

  return (
    <section className="glass-panel rim-light p-4 md:p-gutter rounded-xl border border-outline-variant relative overflow-hidden">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary">visibility</span>
        </div>
        <div>
          <h2 className="font-headline-md text-headline-md">Tampilan</h2>
          <p className="text-body-sm text-on-surface-variant">Tema, latar, dan gerakan — disimpan di akun Anda, ikut ke desktop dan web</p>
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex flex-col gap-3">
          <label className="text-label-mono text-on-surface-variant uppercase tracking-widest pl-1">Tema</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {daftar.map((t) => (
              <KartuPilihan key={t.id} terpilih={setelan.tema === t.id} onPilih={() => simpan({ tema: t.id })} judul={t.nama} keterangan={t.keterangan}>
                <Pratinjau idTema={t.id} />
              </KartuPilihan>
            ))}
            <KartuPilihan
              terpilih={setelan.tema === PILIHAN_SISTEM}
              onPilih={() => simpan({ tema: PILIHAN_SISTEM })}
              judul="Ikuti sistem"
              keterangan={`Windows gelap → ${namaTema(meta.ikutiSistem.gelap)} · terang → ${namaTema(meta.ikutiSistem.terang)}`}
            >
              <div className="grid grid-cols-2 gap-1.5">
                <Pratinjau idTema={meta.ikutiSistem.gelap} />
                <Pratinjau idTema={meta.ikutiSistem.terang} />
              </div>
            </KartuPilihan>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-label-mono text-on-surface-variant uppercase tracking-widest pl-1">Ruangan</label>
          <button
            type="button"
            role="switch"
            aria-checked={latar}
            onClick={() => simpan({ latarRuangan: !latar })}
            className="w-full flex items-center justify-between gap-4 rounded-lg border border-outline-variant px-5 py-4 hover:bg-surface-container-high transition-colors text-left"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-on-surface">Dinding kayu di belakang aplikasi</span>
              <span className="block text-[12px] text-on-surface-variant">
                {setelan.latarRuangan === null ? 'Mengikuti bawaan tema' : 'Pilihan Anda'} — sekarang {latar ? 'nyala' : 'mati'}
              </span>
            </span>
            <span className={`material-symbols-outlined text-[32px] shrink-0 ${latar ? 'text-primary' : 'text-on-surface-variant'}`}>
              {latar ? 'toggle_on' : 'toggle_off'}
            </span>
          </button>
          {/* Lampu (Item 128 Tahap C) — pendar hangat dari atas, 25% kekuatan layar masuk; bagian dari ruangan. */}
          <button
            type="button"
            role="switch"
            aria-checked={setelan.lampu}
            onClick={() => simpan({ lampu: !setelan.lampu })}
            className="w-full flex items-center justify-between gap-4 rounded-lg border border-outline-variant px-5 py-4 hover:bg-surface-container-high transition-colors text-left"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-on-surface">Lampu ruangan</span>
              <span className="block text-[12px] text-on-surface-variant">
                {setelan.lampu && !latar
                  ? 'Nyala — tetapi baru tampil bila dinding kayu dinyalakan'
                  : `Pendar hangat dari atas — sekarang ${lampuNyala(setelan, latar) ? 'nyala' : 'mati'}`}
              </span>
            </span>
            <span className={`material-symbols-outlined text-[32px] shrink-0 ${setelan.lampu ? 'text-primary' : 'text-on-surface-variant'}`}>
              {setelan.lampu ? 'toggle_on' : 'toggle_off'}
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-label-mono text-on-surface-variant uppercase tracking-widest pl-1">Gerakan</label>
          <div role="radiogroup" aria-label="Gerakan" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PILIHAN_GERAK_TAMPIL.map((g) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={setelan.gerak === g.id}
                onClick={() => simpan({ gerak: g.id })}
                className={`text-left rounded-lg border px-4 py-3 transition-colors ${setelan.gerak === g.id ? 'border-primary bg-primary-container/20' : 'border-outline-variant hover:bg-surface-container-high'}`}
              >
                <span className="block text-sm font-semibold text-on-surface">{g.nama}</span>
                <span className="block text-[12px] text-on-surface-variant leading-snug">{g.keterangan}</span>
              </button>
            ))}
          </div>
          <p className="text-[12px] text-on-surface-variant pl-1">
            Sekarang: {temaService.gerakTampilDikurangi() ? 'gerakan dikurangi — animasi berhenti, penanda proses tetap terbaca dari teksnya' : 'gerakan normal'}
          </p>
        </div>

        {status && (
          <p role="status" className={`text-[12px] ${status.jenis === 'gagal' ? 'text-error' : 'text-on-surface-variant'}`}>{status.teks}</p>
        )}
      </div>
    </section>
  );
}
