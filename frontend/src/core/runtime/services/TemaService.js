
import { supabase } from '../../../supabase';
import {
  KUNCI_LOKAL, PILIHAN_SISTEM, metaDipakai, normalisasiSetelan, pilihTema, latarNyala, aturanCssTema, gerakDikurangi, lampuNyala, dasarTema,
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
      this.mq.addEventListener?.('change', () => { if (this.setelan.tema === PILIHAN_SISTEM) this.#terapkan(); });
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

  async simpan(setelanBaru) {
    this.setelan = normalisasiSetelan({ ...this.setelan, ...setelanBaru }, this.meta);
    this.#terapkan();
    this.#tulisLokal();
    const { error } = await supabase.auth.updateUser({ data: { tampilan: this.setelan } });
    return { error };
  }

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
      html.dataset.dasar = dasarTema(id, this.meta);
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
      return null;
    }
  }

  #tulisLokal() {
    try {
      localStorage.setItem(KUNCI_LOKAL, JSON.stringify(this.setelan));
    } catch {
    }
  }
}

export const temaService = new TemaService();
