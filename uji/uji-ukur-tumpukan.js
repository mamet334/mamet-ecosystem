
(() => {
  const VERSI = 1;

  window.ukurTumpukanMamet = async function ukurTumpukanMamet({ detikDiam = 15 } = {}) {
    console.log(`[UKUR-TUMPUKAN] versi skrip ${VERSI} — mengamati ${detikDiam} detik, jangan sentuh aplikasi…`);

    const main = document.querySelector('main');
    const pembungkus = main ? [...main.children] : [];
    const sm = window.__mamet?.serviceManager || null;
    let namaApp = [];
    try { namaApp = sm?.get('ApplicationManager')?.getState()?.apps?.map((a) => a.id) || []; } catch {  }

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
    } catch {  }

    let kanalRealtime = null;
    try {
      const { supabase } = await import('/src/supabase.js');
      kanalRealtime = supabase.getChannels().map((c) => c.topic);
    } catch {  }

    const tataLetakTersimpan = Object.keys(localStorage)
      .filter((k) => /^mamet_v[34]_.*_layout_/.test(k))
      .map((k) => {
        let v = null;
        try { v = JSON.parse(localStorage.getItem(k)); } catch {  }
        return {
          kunci: k,
          kiri: v?.left_workbench ?? null,
          kanan: v?.right_workbench ?? null,
          bawah: v?.bottom_workbench ?? null,
          mengambang: Array.isArray(v?.floating_windows) ? v.floating_windows.length : null,
        };
      });

    const tugasPanjang = [];
    let obs = null;
    try {
      obs = new PerformanceObserver((l) => l.getEntries().forEach((e) => tugasPanjang.push(Math.round(e.duration))));
      obs.observe({ type: 'longtask', buffered: false });
    } catch {  }
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
