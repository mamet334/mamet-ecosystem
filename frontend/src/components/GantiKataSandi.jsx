import React, { useState } from 'react';
import { supabase } from '../supabase';
import { PANJANG_MINIMAL_SANDI, periksaSandiBaru, pesanGalatSandi } from '../../../shared/kata_sandi.js';

/**
 * Ganti kata sandi untuk akun yang sedang masuk — Settings › Identitas (T19, ADR-0022 K4, 29 Okt 2026).
 *
 * Kata sandi LAMA diperiksa dulu (masuk ulang dengan email akun ini) sebelum yang baru disimpan: tanpa itu siapa pun
 * yang menemukan aplikasi dalam keadaan masuk bisa mengunci pemiliknya keluar. Kelas tampilan disalin dari isian &
 * tombol yang sudah ada di Settings (Model ID, Simpan batas harian).
 */
export default function GantiKataSandi() {
  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');
  const [ulang, setUlang] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState(null);
  const [berhasil, setBerhasil] = useState(false);

  const simpan = async (e) => {
    e.preventDefault();
    setGalat(null); setBerhasil(false);
    const salah = periksaSandiBaru(baru, ulang);
    if (salah) { setGalat({ judul: salah, saran: '', teknis: '' }); return; }
    setProses(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('session missing');
      const { error: salahLama } = await supabase.auth.signInWithPassword({ email: user.email, password: lama });
      if (salahLama) throw salahLama;
      const { error: gagalSimpan } = await supabase.auth.updateUser({ password: baru });
      if (gagalSimpan) throw gagalSimpan;
      setLama(''); setBaru(''); setUlang('');
      setBerhasil(true);
    } catch (err) {
      console.warn('[GantiKataSandi] gagal mengganti kata sandi:', err?.message || err);
      setGalat(pesanGalatSandi(err));
    } finally {
      setProses(false);
    }
  };

  const isian = 'w-full bg-surface-container-lowest border border-outline-variant px-5 py-4 rounded-lg text-on-surface font-body-base focus:border-primary focus:ring-0 transition-all'; // tanpa `pulse-focus` milik isian Settings: kelas itu tak pernah didefinisikan (T18)
  return (
    <form onSubmit={simpan} className="mt-6 pt-6 border-t border-outline-variant space-y-3">
      <h3 className="font-headline-md text-headline-md mb-2">Ganti Kata Sandi</h3>
      <input type="password" value={lama} onChange={(e) => setLama(e.target.value)} required autoComplete="current-password"
        placeholder="Kata sandi sekarang" className={isian} />
      <input type="password" value={baru} onChange={(e) => setBaru(e.target.value)} required minLength={PANJANG_MINIMAL_SANDI}
        autoComplete="new-password" placeholder={`Kata sandi baru (minimal ${PANJANG_MINIMAL_SANDI} karakter)`} className={isian} />
      <input type="password" value={ulang} onChange={(e) => setUlang(e.target.value)} required minLength={PANJANG_MINIMAL_SANDI}
        autoComplete="new-password" placeholder="Ulangi kata sandi baru" className={isian} />
      {galat && (
        <div role="alert" className="p-3 rounded-lg bg-error/10 border border-error/30">
          <p className="text-[12px] text-error leading-relaxed break-words">{galat.judul} {galat.saran}</p>
        </div>
      )}
      {berhasil && (
        <div role="status" className="p-3 rounded-lg bg-primary-container/5 border border-primary/20">
          <p className="text-body-sm text-primary/80 leading-relaxed">Kata sandi sudah diganti. Pakai yang baru saat masuk berikutnya, juga di aplikasi desktop.</p>
        </div>
      )}
      <button type="submit" disabled={proses}
        className="px-5 py-3 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50">
        {proses ? 'Menyimpan…' : 'Simpan kata sandi baru'}
      </button>
    </form>
  );
}
