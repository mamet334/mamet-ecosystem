/**
 * DAFTAR RESMI SUB-AGENT SERVER — satu sumber untuk server (izin T1) dan graf Home (Item 130 Tahap D, 2 Nov 2026,
 * keputusan Owner: pilihan (a) "daftar resmi di shared/ dipakai server & graf").
 *
 * Dulu daftarnya hanya tersirat di `agent-process/plugins/registry.ts` (11 plugin) dan aturannya di
 * `lib/orchestration/izin_subagent.ts`; klien tak punya daftar sama sekali, jadi graf tak bisa menampilkannya tanpa
 * mengarang. Nama di sini = `name` plugin (dijaga `uji-daftar-subagen.mjs`: sama persis dengan registry).
 *
 * Berkas ini ikut ke bundel klien dan repo PUBLIK: hanya nama, label, dan sifat. JANGAN menaruh ID pemilik
 * (`MAMET_PEMILIK_IDS` adalah rahasia server), token, atau alamat di sini.
 */

/** label = ringkasan deskripsi plugin; mametlite = boleh diminta Mametlite; khususPemilik = memakai layanan berbayar Owner. */
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

/** Nama di `tools` klien → nama sub-agent. */
export const ALIAS_TOOLS = Object.freeze({
  web_search: 'researcher',
  code_executor: 'coder',
  web_scraper: 'scraper',
});

export const SUBAGEN_MAMETLITE = Object.freeze(SUBAGEN.filter((s) => s.mametlite).map((s) => s.nama));
export const SUBAGEN_KHUSUS_PEMILIK = Object.freeze(SUBAGEN.filter((s) => s.khususPemilik).map((s) => s.nama));
