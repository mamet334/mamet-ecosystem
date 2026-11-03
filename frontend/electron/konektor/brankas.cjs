// BRANKAS KREDENSIAL KONEKTOR (Item 129 Tahap G1, 2026-11-03) — satu tugas: menyimpan kredensial server MCP (K18).
//
// Token GitHub, kunci Notion, dsb. diisi Owner di Settings dan disimpan DI PERANGKAT, terenkripsi Windows
// (`safeStorage` Electron = DPAPI, terikat akun Windows). Tidak ikut akun Supabase, tidak pernah ke model atau log.
//
// Aturan:
//   - Enkripsi DISUNTIKKAN (titik sambung S9): proses utama memberi `safeStorage`, uji memberi tiruan. Bila enkripsi
//     tidak tersedia, brankas MENOLAK menyimpan — tidak pernah jatuh diam-diam ke teks biasa di disk.
//   - Layar hanya MENGIRIM nilai (S10). `status` mengembalikan "terisi/kosong", tidak pernah nilainya; `ambil`
//     dipanggil proses utama sendiri saat menyusun transport server pemiliknya.
//   - Berkas rusak / tak terbaca → dianggap kosong (konektor yang butuh kredensial menolak menyala, terlihat di
//     Settings), bukan galat yang merobohkan proses utama.

const fs = require('fs');
const path = require('path');

const POLA_ID = /^[a-z][a-z0-9-]{1,39}$/;
const BATAS_NILAI = 4096;
const tolak = (alasan) => ({ ok: false, alasan });

/**
 * @param {{berkas: string, enkripsi: {tersedia: () => boolean, sandikan: (teks: string) => Buffer, buka: (b: Buffer) => string}}} opsi
 */
function buatBrankas({ berkas, enkripsi }) {
  if (!berkas) throw new Error('brankas butuh alamat berkas');
  if (!enkripsi || typeof enkripsi.sandikan !== 'function' || typeof enkripsi.buka !== 'function') {
    throw new Error('brankas butuh enkripsi (safeStorage)');
  }

  function baca() {
    try {
      const isi = JSON.parse(fs.readFileSync(berkas, 'utf8'));
      return isi && typeof isi === 'object' && !Array.isArray(isi) ? isi : {};
    } catch {
      return {}; // belum pernah disimpan atau rusak — lihat kepala berkas
    }
  }

  function tulis(isi) {
    fs.mkdirSync(path.dirname(berkas), { recursive: true });
    const sementara = `${berkas}.${process.pid}.baru`;
    fs.writeFileSync(sementara, JSON.stringify(isi, null, 2), 'utf8');
    fs.renameSync(sementara, berkas); // ganti utuh: berkas tidak pernah setengah tertulis
  }

  const tersedia = () => {
    try { return enkripsi.tersedia() === true; }
    catch { return false; /* safeStorage belum siap (sebelum app ready) = tidak tersedia → simpan menolak, aman */ }
  };

  /** Simpan satu kredensial. Nilai kosong = hapus kredensial itu. */
  function simpan(serverId, kredId, nilai) {
    if (!POLA_ID.test(String(serverId || '')) || !POLA_ID.test(String(kredId || ''))) return tolak('id server/kredensial tidak sah');
    if (typeof nilai !== 'string') return tolak('nilai kredensial harus teks');
    const bersih = nilai.trim();
    if (bersih.length > BATAS_NILAI) return tolak(`nilai kredensial lebih dari ${BATAS_NILAI} huruf`);
    if (/[\r\n\0]/.test(bersih)) return tolak('nilai kredensial tidak boleh memuat baris baru'); // juga mencegah sisipan header
    const isi = baca();
    if (!bersih) {
      if (isi[serverId]) { delete isi[serverId][kredId]; if (!Object.keys(isi[serverId]).length) delete isi[serverId]; tulis(isi); }
      return { ok: true, terisi: false };
    }
    if (!tersedia()) return tolak('enkripsi Windows tidak tersedia — kredensial tidak disimpan');
    let sandi;
    try { sandi = enkripsi.sandikan(bersih); } catch (e) { return tolak(`enkripsi gagal: ${e.message}`); }
    (isi[serverId] ||= {})[kredId] = Buffer.from(sandi).toString('base64');
    tulis(isi);
    return { ok: true, terisi: true };
  }

  /** Untuk layar: kredensial mana yang terisi. TIDAK pernah nilainya. */
  function status(serverId) {
    const s = baca()[serverId] || {};
    return Object.fromEntries(Object.keys(s).map((k) => [k, true]));
  }

  /** Untuk proses utama saja (transport server `serverId`): id kredensial → nilai asli. Gagal dibuka → tidak ada. */
  function ambil(serverId) {
    const s = baca()[serverId] || {};
    const hasil = {};
    if (!tersedia()) return hasil;
    for (const [k, v] of Object.entries(s)) {
      try { hasil[k] = enkripsi.buka(Buffer.from(String(v), 'base64')); }
      catch { /* sandi dari akun Windows lain / rusak — dianggap kosong, Owner mengisi ulang */ }
    }
    return hasil;
  }

  /** Server dihapus Owner → kredensialnya ikut hilang. */
  function hapusServer(serverId) {
    const isi = baca();
    if (!isi[serverId]) return { ok: true };
    delete isi[serverId];
    tulis(isi);
    return { ok: true };
  }

  return { simpan, status, ambil, hapusServer, tersedia };
}

module.exports = { buatBrankas, BATAS_NILAI };
