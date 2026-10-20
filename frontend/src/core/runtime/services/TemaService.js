// Layanan tema aplikasi (Item 128 Tahap B) — yang menyentuh dunia luar: <html>, localStorage, akun Supabase.
// Logika pilihnya murni, ada di tema.js.
//
// Urutan supaya aplikasi TIDAK berkedip dari tema lama ke tema pilihan:
//   1. Kernel boot memuat metadata (themes.json) lalu memanggil `pasang()` — SEBELUM tampilan dipasang.
//   2. `pasang()` membaca salinan lokal setelan dan langsung menerapkannya ke <html> (data-tema, data-latar).
//   3. Sesudah masuk, App memanggil `sinkronDariAkun(user)`: setelan di akun (user_metadata.tampilan) menjadi
//      sumber kebenaran — tema ikut ke desktop dan web (keputusan Owner 20 Okt: per akun).
// Pola penyimpanan per akun sama dengan batas biaya harian di Settings (user_metadata) — tanpa tabel baru.

import { supabase } from '../../../supabase';
import {
  KUNCI_LOKAL, PILIHAN_SISTEM, metaDipakai, normalisasiSetelan, pilihTema, latarNyala, aturanCssTema, gerakDikurangi, lampuNyala,
} from './tema.js';

const ID_GAYA = 'mamet-tema';

class TemaService {
  constructor() {
    this.meta = metaDipakai(null);
    this.setelan = normalisasiSetelan(null, this.meta);
    this.pendengar = new Set();
    this.mq = null;
    this.mqGerak = null;
  }

  /** Dipanggil kernel sesudah metadata dimuat, sebelum tampilan dipasang. */
  pasang(metaTema) {
    this.meta = metaDipakai(metaTema);
    if (typeof document !== 'undefined') {
      let gaya = document.getElementById(ID_GAYA);
      if (!gaya) {
        gaya = document.createElement('style');
        gaya.id = ID_GAYA;
        document.head.appendChild(gaya);
      }
      gaya.textContent = aturanCssTema(this.meta);
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.mq = window.matchMedia('(prefers-color-scheme: dark)');
      // "Ikuti sistem": Windows berganti gelap/terang saat aplikasi terbuka → tema ikut berganti.
      this.mq.addEventListener?.('change', () => { if (this.setelan.tema === PILIHAN_SISTEM) this.#terapkan(); });
      // "Kurangi gerakan" mengikuti sistem (bawaan): setelan animasi Windows berubah → aplikasi ikut.
      this.mqGerak = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.mqGerak.addEventListener?.('change', () => { if (this.setelan.gerak === 'sistem') this.#terapkan(); });
    }
    this.setelan = normalisasiSetelan(this.#bacaLokal(), this.meta);
    this.#terapkan();
  }

  daftarTema() { return this.meta.themes; }
  ambilMeta() { return this.meta; }
  ambilSetelan() { return { ...this.setelan }; }
  temaTampil() { return pilihTema(this.setelan, this.#sistemGelap(), this.meta); }
  gerakTampilDikurangi() { return gerakDikurangi(this.setelan, this.mqGerak?.matches); }

  /** Ubah setelan + simpan ke akun. Mengembalikan { error } dari Supabase — tampilan sudah berganti apa pun hasilnya. */
  async simpan(setelanBaru) {
    this.setelan = normalisasiSetelan({ ...this.setelan, ...setelanBaru }, this.meta);
    this.#terapkan();
    this.#tulisLokal();
    const { error } = await supabase.auth.updateUser({ data: { tampilan: this.setelan } });
    return { error };
  }

  /** Setelan di akun menjadi sumber kebenaran sesudah masuk. Tanpa setelan di akun, setelan lokal dipertahankan. */
  sinkronDariAkun(user) {
    const diAkun = user?.user_metadata?.tampilan;
    if (!diAkun) return;
    const s = normalisasiSetelan(diAkun, this.meta);
    if (s.tema === this.setelan.tema && s.latarRuangan === this.setelan.latarRuangan && s.gerak === this.setelan.gerak && s.lampu === this.setelan.lampu) return;
    this.setelan = s;
    this.#terapkan();
    this.#tulisLokal();
  }

  langgan(fn) {
    this.pendengar.add(fn);
    return () => this.pendengar.delete(fn);
  }

  #sistemGelap() { return this.mq ? this.mq.matches : true; }

  #terapkan() {
    const id = this.temaTampil();
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      html.dataset.tema = id;
      const latar = latarNyala(this.setelan, id, this.meta);
      html.dataset.latar = latar ? 'nyala' : 'mati';
      html.dataset.lampu = lampuNyala(this.setelan, latar) ? 'nyala' : 'mati';
      html.dataset.gerak = this.gerakTampilDikurangi() ? 'kurangi' : 'normal';
    }
    for (const fn of this.pendengar) fn(this.ambilSetelan(), id);
  }

  #bacaLokal() {
    try {
      return JSON.parse(localStorage.getItem(KUNCI_LOKAL) || 'null');
    } catch {
      // localStorage tak tersedia / isinya rusak: pakai bawaan — setelan akun akan menyusul sesudah masuk.
      return null;
    }
  }

  #tulisLokal() {
    try {
      localStorage.setItem(KUNCI_LOKAL, JSON.stringify(this.setelan));
    } catch {
      // Penyimpanan lokal penuh/ditolak: tema tetap tersimpan di akun; hanya salinan pembuka-cepatnya yang hilang.
    }
  }
}

export const temaService = new TemaService();
