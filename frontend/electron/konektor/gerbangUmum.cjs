// GERBANG IZIN KONEKTOR UMUM (Item 129 Tahap G3, 2026-11-03) — satu tugas: setiap pemanggilan alat server MCP umum
// lewat persetujuan Owner (K17). Satu-satunya jalan dari layar ke `sesiUmum.panggil`.
//
// Dialog per alat: Tolak · Izinkan sekali · Izinkan selama percakapan ini. Izin "selama percakapan" berlaku untuk
// (workspace, server, ALAT, percakapan) itu saja — tidak menyebar ke alat lain, server lain, workspace lain, atau
// percakapan lain; hidup selama aplikasi terbuka. Tanpa id percakapan (titik sambung S6) pilihan itu tidak ditawarkan:
// setiap pemanggilan ditanyakan (aman ke arah tanya).
//
// Isi dialog disusun di sini dari data permintaan (bukan teks model bebas): server, workspace, alat, argumen, dan
// pengingat bahwa hasilnya dibaca model & ikut ke penyedia model (T12).

const LABEL_WS = { 'ws-assistant': 'Assistant', 'ws-engineer': 'Engineer' };
const POLA_PERCAKAPAN = /^[A-Za-z0-9_-]{1,80}$/;
const tolak = (alasan) => ({ ok: false, alasan });

/** Isi dialog persetujuan untuk satu pemanggilan. */
function susunDialogUmum({ ws, nama, id, alat, argumen, bisaPercakapan }) {
  let teksArgumen;
  try { teksArgumen = JSON.stringify(argumen, null, 1); } catch { teksArgumen = '(argumen tidak bisa ditampilkan)'; /* objek melingkar — tetap ditanyakan */ }
  return {
    judul: `${nama} — izinkan "${alat}"? (${LABEL_WS[ws] || ws})`,
    rincian: [
      `Konektor: ${nama} (${id})`,
      `Alat: ${alat}`,
      `Argumen: ${String(teksArgumen).slice(0, 800)}`,
      '',
      'Hasil alat ini akan dibaca model dan ikut terkirim ke penyedia model.',
      bisaPercakapan ? '"Selama percakapan ini" = alat ini saja, di percakapan ini saja; alat lain tetap ditanyakan.' : null,
    ].filter((b) => b !== null).join('\n'),
    tombol: bisaPercakapan ? ['Tolak', 'Izinkan sekali', 'Izinkan selama percakapan ini'] : ['Tolak', 'Izinkan sekali'],
  };
}

/**
 * @param {{sesi: object, namaServer: (id: string) => string|null, mintaIzin: (d: {judul: string, rincian: string, tombol: string[]}) => Promise<number>, log?: Function}} opsi
 *   `mintaIzin` mengembalikan indeks tombol (0 = Tolak).
 */
function buatGerbangUmum({ sesi, namaServer, mintaIzin, log = () => {} }) {
  const izin = new Set(); // `${ws}::${id}::${alat}::${percakapan}`

  async function panggil(ws, id, alat, argumen = {}, percakapan = null) {
    if (!argumen || typeof argumen !== 'object' || Array.isArray(argumen)) return { ...tolak('argumen harus objek'), alat };
    const nama = namaServer(id);
    if (!nama) return { ...tolak(`konektor ${id} tidak terpasang`), alat };
    const bisaPercakapan = typeof percakapan === 'string' && POLA_PERCAKAPAN.test(percakapan);
    const k = `${ws}::${id}::${alat}::${bisaPercakapan ? percakapan : ''}`;
    const sudah = bisaPercakapan && izin.has(k);
    if (!sudah) {
      let pilihan = 0;
      try { pilihan = await mintaIzin(susunDialogUmum({ ws, nama, id, alat, argumen, bisaPercakapan })); }
      catch (e) { log(`[KONEKTOR-UMUM] dialog persetujuan gagal: ${e.message}`); }
      if (pilihan !== 1 && !(pilihan === 2 && bisaPercakapan)) {
        log(`[KONEKTOR-UMUM] ${ws}::${id} ${alat} DITOLAK OWNER`);
        return { ok: false, ditolakOwner: true, alat, alasan: 'ditolak Owner di dialog persetujuan' };
      }
      if (pilihan === 2) izin.add(k);
    }
    const h = await sesi.panggil(ws, id, alat, argumen);
    log(`[KONEKTOR-UMUM] ${ws}::${id} ${alat} → ${h.ok ? `OK${sudah ? ' (izin percakapan)' : ''}` : h.alasan}`);
    return { ...h, alat };
  }

  /** Izin percakapan yang masih hidup (untuk uji/diagnosis) — tanpa argumen apa pun. */
  const daftarIzin = () => [...izin];

  return { panggil, daftarIzin };
}

module.exports = { buatGerbangUmum, susunDialogUmum };
