
export const SUBAGEN = Object.freeze([
  Object.freeze({ nama: 'researcher', label: 'Penelusuran web', mametlite: true, khususPemilik: false }),
  Object.freeze({ nama: 'deep_research', label: 'Riset mendalam', mametlite: true, khususPemilik: false }),
  Object.freeze({ nama: 'scraper', label: 'Pengekstrak halaman', mametlite: false, khususPemilik: false }),
  Object.freeze({ nama: 'coder', label: 'Eksekusi kode', mametlite: false, khususPemilik: false }),
  Object.freeze({ nama: 'communicator', label: 'Pemanggil API & webhook', mametlite: false, khususPemilik: false }),
  Object.freeze({ nama: 'logika', label: 'Analisis logis', mametlite: false, khususPemilik: false }),
  Object.freeze({ nama: 'bahasa', label: 'Nuansa bahasa', mametlite: false, khususPemilik: false }),
  Object.freeze({ nama: 'debate', label: 'Simulasi dewan direksi', mametlite: false, khususPemilik: false }),
  Object.freeze({ nama: 'youtube_analyst', label: 'Ringkasan YouTube', mametlite: false, khususPemilik: true }),
  Object.freeze({ nama: 'cron_manager', label: 'Jadwal otomatis', mametlite: false, khususPemilik: false }),
  Object.freeze({ nama: 'shopee_ninja', label: 'Afiliasi Shopee', mametlite: false, khususPemilik: false }),
]);

export const ALIAS_TOOLS = Object.freeze({
  web_search: 'researcher',
  code_executor: 'coder',
  web_scraper: 'scraper',
});

export const SUBAGEN_MAMETLITE = Object.freeze(SUBAGEN.filter((s) => s.mametlite).map((s) => s.nama));
export const SUBAGEN_KHUSUS_PEMILIK = Object.freeze(SUBAGEN.filter((s) => s.khususPemilik).map((s) => s.nama));
