// Lupa & ganti kata sandi Mametlite (T19, ADR-0022 K4, 29 Okt 2026). Aturannya (panjang minimal, pesan netral, jenis
// tautan, terjemahan galat) dari modul bersama `shared/kata_sandi.js` — sama persis dengan Mamet Ecosystem.
import React, { useState } from 'react';
import { Loader2, Mail, KeyRound } from 'lucide-react';
import { supabase } from './supabase';
import {
  PANJANG_MINIMAL_SANDI, PESAN_TAUTAN_TERKIRIM, alamatKembaliPemulihan, periksaSandiBaru, pesanGalatSandi,
} from '../../../shared/kata_sandi.js';

const ISIAN = 'w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none';
const TOMBOL = 'w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50';

function KotakGalat({ galat }) {
  if (!galat) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-700/60 bg-red-950/40 px-3 py-2">
      <p className="text-sm text-red-200 leading-snug">{galat.judul}</p>
      {galat.saran && <p className="mt-0.5 text-xs text-red-200/80 leading-snug">{galat.saran}</p>}
      {galat.teknis && <p className="mt-1.5 text-[11px] text-red-200/50 break-words leading-snug">Pesan teknis: {galat.teknis}</p>}
    </div>
  );
}

/** Isian email → tautan pemulihan. Pesan sesudahnya SAMA untuk email terdaftar maupun tidak. */
export function FormLupaSandi({ onKembali, kedaluwarsa = false }) {
  const [email, setEmail] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState(
    kedaluwarsa ? { judul: 'Tautan pemulihan sudah tidak berlaku.', saran: 'Minta tautan baru di bawah.' } : null,
  );
  const [terkirim, setTerkirim] = useState(false);

  const kirim = async (e) => {
    e.preventDefault();
    setProses(true); setGalat(null); setTerkirim(false);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: alamatKembaliPemulihan(window.location, 'https://mametlite.vercel.app/'),
    });
    if (error) setGalat(pesanGalatSandi(error)); else setTerkirim(true);
    setProses(false);
  };

  return (
    <form onSubmit={kirim} className="space-y-4">
      <p className="text-sm text-slate-400">Masukkan email akun Anda. Kami kirim tautan untuk membuat kata sandi baru.</p>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={ISIAN} />
      </div>
      <KotakGalat galat={galat} />
      {terkirim && (
        <div role="status" className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200 leading-snug">
          {PESAN_TAUTAN_TERKIRIM}
        </div>
      )}
      <button type="submit" disabled={proses} className={TOMBOL}>
        {proses ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Kirim Tautan
      </button>
      <button type="button" onClick={onKembali} className="w-full text-sm text-slate-400 hover:text-emerald-400 transition-colors">
        Kembali ke halaman masuk
      </button>
    </form>
  );
}

/** Dibuka dari tautan pemulihan (App.jsx menahan aplikasi sampai kata sandi baru disimpan). */
export function FormSandiBaru({ adaSesi, onSelesai, onMintaBaru }) {
  const [baru, setBaru] = useState('');
  const [ulang, setUlang] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState(null);

  const simpan = async (e) => {
    e.preventDefault();
    const salah = periksaSandiBaru(baru, ulang);
    if (salah) { setGalat({ judul: salah }); return; }
    setProses(true); setGalat(null);
    const { error } = await supabase.auth.updateUser({ password: baru });
    setProses(false);
    if (error) setGalat(pesanGalatSandi(error)); else onSelesai?.();
  };

  if (!adaSesi) {
    return (
      <div className="space-y-4">
        <KotakGalat galat={{ judul: 'Tautan pemulihan sudah tidak berlaku.', saran: 'Minta tautan baru dari halaman masuk.' }} />
        <button type="button" onClick={onMintaBaru} className={TOMBOL}><Mail className="w-4 h-4" /> Minta Tautan Baru</button>
      </div>
    );
  }
  return (
    <form onSubmit={simpan} className="space-y-4">
      <p className="text-sm text-slate-400">Buat kata sandi baru untuk akun Anda.</p>
      <input type="password" value={baru} onChange={(e) => setBaru(e.target.value)} required minLength={PANJANG_MINIMAL_SANDI}
        autoComplete="new-password" placeholder={`Kata sandi baru (minimal ${PANJANG_MINIMAL_SANDI} karakter)`} className={ISIAN} />
      <input type="password" value={ulang} onChange={(e) => setUlang(e.target.value)} required minLength={PANJANG_MINIMAL_SANDI}
        autoComplete="new-password" placeholder="Ulangi kata sandi baru" className={ISIAN} />
      <KotakGalat galat={galat} />
      <button type="submit" disabled={proses} className={TOMBOL}>
        {proses ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Simpan Kata Sandi
      </button>
    </form>
  );
}

/** Ganti kata sandi akun yang sedang masuk — kata sandi LAMA diperiksa dulu. Untuk panel Pengaturan. */
export function FormGantiSandi({ email }) {
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
    if (salah) { setGalat({ judul: salah }); return; }
    setProses(true);
    const { error: salahLama } = await supabase.auth.signInWithPassword({ email, password: lama });
    const { error: gagal } = salahLama ? { error: salahLama } : await supabase.auth.updateUser({ password: baru });
    setProses(false);
    if (gagal) { setGalat(pesanGalatSandi(gagal)); return; }
    setLama(''); setBaru(''); setUlang(''); setBerhasil(true);
  };

  const kecil = 'w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-emerald-500 focus:outline-none';
  return (
    <form onSubmit={simpan} className="mt-3 pt-3 border-t border-slate-700 space-y-2">
      <div className="flex items-center gap-2 text-slate-200 text-sm font-semibold">
        <KeyRound className="w-4 h-4 text-emerald-400" /> Ganti Kata Sandi
      </div>
      <input type="password" value={lama} onChange={(e) => setLama(e.target.value)} required autoComplete="current-password" placeholder="Kata sandi sekarang" className={kecil} />
      <input type="password" value={baru} onChange={(e) => setBaru(e.target.value)} required minLength={PANJANG_MINIMAL_SANDI} autoComplete="new-password" placeholder={`Kata sandi baru (min. ${PANJANG_MINIMAL_SANDI})`} className={kecil} />
      <input type="password" value={ulang} onChange={(e) => setUlang(e.target.value)} required minLength={PANJANG_MINIMAL_SANDI} autoComplete="new-password" placeholder="Ulangi kata sandi baru" className={kecil} />
      <KotakGalat galat={galat} />
      {berhasil && <p role="status" className="text-[11px] text-emerald-400">Kata sandi sudah diganti.</p>}
      <button type="submit" disabled={proses} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
        {proses ? 'Menyimpan…' : 'Simpan'}
      </button>
    </form>
  );
}
