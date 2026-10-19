/**
 * PenyimpanKeadaan — keadaan layar yang HIDUP DI LUAR layarnya (Item 127 Tahap 1, 2026-10-19).
 *
 * ── Kenapa ada ───────────────────────────────────────────────────────────────────────────────────
 * `ApplicationContainer.jsx` merender SEMUA 11 aplikasi sekaligus dan hanya menyembunyikan yang tidak
 * aktif. Diukur 19 Okt (Tahap 0): 86% simpul DOM milik layar yang tidak dilihat, tiga mesin chat hidup
 * bersamaan. Itu bukan kelalaian — itu TAMBALAN: keadaan chat disimpan di `useState` layarnya, jadi
 * menutup layar = jawaban yang sedang mengalir, ketikan yang belum terkirim, dan chat aktif hilang.
 *
 * Akar masalahnya bukan "terlalu banyak layar", tetapi "keadaan tinggal di layar". Modul ini
 * memindahkan keadaan keluar, sehingga layar boleh dipasang dan dilepas tanpa ada yang hilang — seperti
 * game yang menyimpan *save*-nya terpisah dari layar yang sedang ditampilkan.
 *
 * ── Bentuknya ────────────────────────────────────────────────────────────────────────────────────
 * Per KUNCI (satu per aplikasi: `app:assistant`, `app:engineer`, …), tiga hal:
 *   nilai     — pengganti `useState`. Semantiknya SAMA: pengubah fungsi menerima nilai terbaru, dan
 *               nilai yang identik (`Object.is`) tidak memberi tahu siapa pun.
 *   ref       — pengganti `useRef` untuk ref yang harus SELAMAT melewati lepas-pasang layar (nomor urut
 *               percakapan, kendali kiriman, kunci simpan terakhir). Objeknya tetap sama selamanya.
 *   pengamat  — pengganti `useEffect` untuk kerja yang harus jalan WALAU layarnya tidak terpasang —
 *               terutama penyimpanan otomatis chat. Dijalankan sesudah penulisan, digabung per detak
 *               (beberapa penulisan dalam satu detak = satu kali jalan), seperti efek sesudah commit.
 *
 * Modul ini SENGAJA tanpa React, supaya bisa diuji dengan node biasa (`uji/uji-penyimpan-keadaan.mjs`).
 * Pengikatnya ke React ada di `hooks/useKeadaanTersimpan.js`.
 *
 * ── Satu kewajiban yang lahir bersamanya ─────────────────────────────────────────────────────────
 * Dulu logout melepas layar → keadaannya ikut hilang dari memori. Keadaan di luar layar TIDAK hilang
 * sendiri. Tanpa `lupakanSemua()` saat pengguna berganti, orang berikutnya yang masuk di aplikasi yang
 * sama — tanpa ditutup dulu — akan melihat percakapan orang sebelumnya. `App.jsx` memanggilnya.
 */
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

  /** Isi nilai awal bila belum ada. `awal` boleh fungsi (inisialisasi malas, seperti useState). */
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

  /** Ref yang selamat melewati lepas-pasang layar. Objek yang dikembalikan SELALU sama. */
  ref(kunci, nama, awal) {
    const s = this._ambilSesi(kunci);
    if (!s.ref.has(nama)) s.ref.set(nama, { current: typeof awal === 'function' ? awal() : awal });
    return s.ref.get(nama);
  }

  /**
   * Daftarkan kerja yang jalan saat salah satu `namaNama` berubah — dengan atau tanpa layar terpasang.
   * Mendaftar ulang dengan `id` yang sama MENGGANTI fungsinya (bukan menambah): layar yang dipasang
   * ulang menyerahkan closure terbarunya tanpa melipatgandakan kerja.
   */
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
      // Sesi bisa sudah dilupakan (logout) di antara penulisan dan detak ini — jangan jalankan apa pun.
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

  /** Kosongkan SEMUA keadaan — wajib saat pengguna berganti (lihat kepala berkas). */
  lupakanSemua() {
    this._sesi.clear();
  }
}

export const penyimpanKeadaan = new PenyimpanKeadaan();
