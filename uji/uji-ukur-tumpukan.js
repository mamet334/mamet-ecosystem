// UKUR TUMPUKAN APLIKASI (Item 127 Tahap 0, 2026-10-19) — berapa biaya 11 aplikasi yang hidup bersamaan.
//
// Kenapa ada: `ApplicationContainer.jsx` merender SEMUA aplikasi terdaftar dan hanya menyembunyikan yang
// tidak aktif (`hidden`) — termasuk tiga salinan ConversationEngine (Assistant · Mametlite · Engineer).
// Tahap 1 roadmap mengubahnya jadi satu halaman pada satu waktu. Skrip ini mengambil GARIS DASAR
// sebelum perubahan itu, supaya manfaatnya kelak diukur, bukan dikira. Kalau ternyata kecil, roadmap
// mencatatnya apa adanya (ROADMAP-TAMPILAN-MENU-GAME.md §7 Tahap 0 butir 2).
//
// HANYA MEMBACA. Tidak menulis ke database, localStorage, atau keadaan aplikasi. Tidak memanggil model.
//
// Pemakaian — sudah login, aplikasi diam (tidak ada jawaban yang sedang mengalir):
//   1. buka DevTools (Ctrl+Shift+I) → tab Console
//   2. tempel SELURUH isi berkas ini → Enter
//   3. jalankan:  await ukurTumpukanMamet()
//   4. salin JSON yang dicetak (juga dikembalikan sebagai nilai)
// Di `npm run desktop` (mode dev) hasilnya paling lengkap: `window.__mamet` hanya ada di mode dev, dan
// tanpanya jumlah pendengar EventBus & urutan nama aplikasi tidak bisa dibaca.
//
// Berkas `uji-*.js` tidak dijalankan `jalankan-semua.mjs` (modul konsol, bukan uji baris perintah).
// Ia sengaja bisa DITEMPEL, bukan diimpor: `vite.config` hanya mengizinkan `.` dan `../tools` untuk
// `/@fs/`, jadi folder `uji/` di akar repo tidak bisa diimpor dari konsol.

(() => {
  const VERSI = 1;

  window.ukurTumpukanMamet = async function ukurTumpukanMamet({ detikDiam = 15 } = {}) {
    console.log(`[UKUR-TUMPUKAN] versi skrip ${VERSI} — mengamati ${detikDiam} detik, jangan sentuh aplikasi…`);

    // ── Pembungkus aplikasi di <main> (ApplicationContainer) ────────────────────────────────────
    const main = document.querySelector('main');
    const pembungkus = main ? [...main.children] : [];
    const sm = window.__mamet?.serviceManager || null;
    let namaApp = [];
    try { namaApp = sm?.get('ApplicationManager')?.getState()?.apps?.map((a) => a.id) || []; } catch { /* mode produksi */ }

    const simpul = (el) => el.getElementsByTagName('*').length + 1;
    const perAplikasi = pembungkus.map((el, i) => ({
      aplikasi: namaApp[i] || `#${i}`,
      terlihat: !el.classList.contains('hidden'),
      simpulDom: simpul(el),
      kotakKetik: el.querySelectorAll('form textarea, form input[type="text"]').length,
      kanvas: el.querySelectorAll('canvas').length,
    }));
    const jumlah = (arr, k) => arr.reduce((s, x) => s + x[k], 0);
    const terlihat = perAplikasi.filter((a) => a.terlihat);
    const tersembunyi = perAplikasi.filter((a) => !a.terlihat);

    // ── Pendengar EventBus (hanya mode dev) ─────────────────────────────────────────────────────
    let pendengarEventBus = null;
    try {
      const bus = sm?.get('EventBus');
      if (bus?.listeners instanceof Map) {
        let total = 0;
        const terbanyak = [];
        for (const [nama, set] of bus.listeners) { total += set.size; terbanyak.push([nama, set.size]); }
        terbanyak.sort((a, b) => b[1] - a[1]);
        pendengarEventBus = { total, jenisEvent: bus.listeners.size, terbanyak: terbanyak.slice(0, 10) };
      }
    } catch { /* biarkan null */ }

    // ── Kanal realtime Supabase yang terbuka ────────────────────────────────────────────────────
    let kanalRealtime = null;
    try {
      const { supabase } = await import('/src/supabase.js');
      kanalRealtime = supabase.getChannels().map((c) => c.topic);
    } catch { /* mode produksi: modul tidak bisa diimpor dari konsol */ }

    // ── Tata letak workbench yang TERSIMPAN di mesin ini ────────────────────────────────────────
    // WorkspaceManager.js:150 memulihkan tata letak dari localStorage. Inilah satu-satunya cara tahu
    // apakah widget selain Monitor MAEF pernah/masih muncul di layar Owner — kode saja tidak bisa.
    const tataLetakTersimpan = Object.keys(localStorage)
      .filter((k) => /^mamet_v[34]_.*_layout_/.test(k))
      .map((k) => {
        let v = null;
        try { v = JSON.parse(localStorage.getItem(k)); } catch { /* rusak */ }
        return {
          kunci: k,
          kiri: v?.left_workbench ?? null,
          kanan: v?.right_workbench ?? null,
          bawah: v?.bottom_workbench ?? null,
          mengambang: Array.isArray(v?.floating_windows) ? v.floating_windows.length : null,
        };
      });

    // ── Kerja di latar selama aplikasi DIAM ─────────────────────────────────────────────────────
    // Tugas panjang (≥ 50 ms) saat Owner tidak melakukan apa pun = kerja aplikasi yang tersembunyi.
    const tugasPanjang = [];
    let obs = null;
    try {
      obs = new PerformanceObserver((l) => l.getEntries().forEach((e) => tugasPanjang.push(Math.round(e.duration))));
      obs.observe({ type: 'longtask', buffered: false });
    } catch { /* tak didukung */ }
    const heapAwal = performance.memory?.usedJSHeapSize ?? null;
    await new Promise((r) => setTimeout(r, detikDiam * 1000));
    obs?.disconnect();
    const heapAkhir = performance.memory?.usedJSHeapSize ?? null;
    const mb = (x) => (x == null ? null : Math.round((x / 1048576) * 10) / 10);

    const hasil = {
      versiSkrip: VERSI,
      waktu: new Date().toISOString(),
      mode: sm ? 'dev (npm run desktop / vite)' : 'produksi atau window.__mamet tidak ada',
      lebarJendela: `${innerWidth}×${innerHeight}`,
      aplikasi: {
        terpasang: perAplikasi.length,
        terlihat: terlihat.length,
        tersembunyiTetapHidup: tersembunyi.length,
        kotakKetikTerpasang: jumlah(perAplikasi, 'kotakKetik'),
        kanvasTerpasang: jumlah(perAplikasi, 'kanvas'),
      },
      simpulDom: {
        seluruhHalaman: document.getElementsByTagName('*').length,
        aplikasiTerlihat: jumlah(terlihat, 'simpulDom'),
        aplikasiTersembunyi: jumlah(tersembunyi, 'simpulDom'),
      },
      perAplikasi,
      heapJsMB: { awal: mb(heapAwal), akhir: mb(heapAkhir) },
      selamaDiam: {
        detik: detikDiam,
        tugasPanjang: tugasPanjang.length,
        totalMs: tugasPanjang.reduce((s, x) => s + x, 0),
        terpanjangMs: tugasPanjang.length ? Math.max(...tugasPanjang) : 0,
      },
      pendengarEventBus,
      kanalRealtime,
      tataLetakTersimpan,
    };
    console.log('[UKUR-TUMPUKAN] HASIL\n' + JSON.stringify(hasil, null, 2));
    return hasil;
  };

  console.log(`[UKUR-TUMPUKAN] versi skrip ${VERSI} siap — jalankan: await ukurTumpukanMamet()`);
})();
