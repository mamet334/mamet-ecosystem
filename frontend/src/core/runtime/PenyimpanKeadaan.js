export class PenyimpanKeadaan {
  constructor() {
    this._sesi = new Map();
  }

  _ambilSesi(kunci) {
    if (!kunci) throw new Error('[PenyimpanKeadaan] kunci wajib diisi (mis. app:assistant)');
    let s = this._sesi.get(kunci);
    if (!s) {
      s = { nilai: new Map(), ref: new Map(), pendengar: new Map(), pengamat: new Map(), kotor: new Set(), terjadwal: false };
      this._sesi.set(kunci, s);
    }
    return s;
  }

  siapkan(kunci, nama, awal) {
    const s = this._ambilSesi(kunci);
    if (!s.nilai.has(nama)) s.nilai.set(nama, typeof awal === 'function' ? awal() : awal);
  }

  ada(kunci, nama) {
    return this._sesi.get(kunci)?.nilai.has(nama) ?? false;
  }

  baca(kunci, nama, awal) {
    this.siapkan(kunci, nama, awal);
    return this._sesi.get(kunci).nilai.get(nama);
  }

  tulis(kunci, nama, nilaiAtauPengubah) {
    const s = this._ambilSesi(kunci);
    const lama = s.nilai.get(nama);
    const baru = typeof nilaiAtauPengubah === 'function' ? nilaiAtauPengubah(lama) : nilaiAtauPengubah;
    if (s.nilai.has(nama) && Object.is(lama, baru)) return;
    s.nilai.set(nama, baru);
    for (const fn of [...(s.pendengar.get(nama) || [])]) fn();
    this._jadwalkanPengamat(kunci, s, nama);
  }

  langgan(kunci, nama, fn) {
    const s = this._ambilSesi(kunci);
    if (!s.pendengar.has(nama)) s.pendengar.set(nama, new Set());
    s.pendengar.get(nama).add(fn);
    return () => s.pendengar.get(nama)?.delete(fn);
  }

  ref(kunci, nama, awal) {
    const s = this._ambilSesi(kunci);
    if (!s.ref.has(nama)) s.ref.set(nama, { current: typeof awal === 'function' ? awal() : awal });
    return s.ref.get(nama);
  }

  amati(kunci, id, namaNama, fn) {
    const s = this._ambilSesi(kunci);
    s.pengamat.set(id, { nama: new Set(namaNama), fn });
    return () => { if (s.pengamat.get(id)?.fn === fn) s.pengamat.delete(id); };
  }

  _jadwalkanPengamat(kunci, s, nama) {
    s.kotor.add(nama);
    if (s.terjadwal) return;
    s.terjadwal = true;
    queueMicrotask(() => {
      s.terjadwal = false;
      if (this._sesi.get(kunci) !== s) return;
      const kotor = s.kotor;
      s.kotor = new Set();
      for (const [id, p] of [...s.pengamat]) {
        if (![...kotor].some((n) => p.nama.has(n))) continue;
        try { p.fn(); }
        catch (err) { console.error(`[PenyimpanKeadaan] pengamat "${id}" (${kunci}) gagal:`, err); }
      }
    });
  }

  lupakanSemua() {
    this._sesi.clear();
  }
}

export const penyimpanKeadaan = new PenyimpanKeadaan();
