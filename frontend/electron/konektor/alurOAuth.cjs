// ALUR OAUTH (Item 129 Tahap F1, 2026-11-03) — satu tugas: "Hubungkan akun" dan "Putuskan" untuk server MCP yang
// meminta login (resep `oauth: true`).
//
// HUBUNGKAN (Owner menekan tombol; akun dipilih Owner sendiri di browser):
//   1. temukan metadata dari server MCP itu (RFC 9728 → RFC 8414) — tak ada metadata / tak ada PKCE S256 → ditolak;
//   2. buka penerima balikan di 127.0.0.1 (port yang dulu didaftarkan bila ada, supaya pendaftaran klien bisa dipakai
//      ulang; port itu terpakai → daftar ulang dengan port baru);
//   3. token lama dihapus (login ulang = login segar, bukan diam-diam memperbarui token lama);
//   4. SDK `auth()` mendaftarkan klien (DCR) bila perlu, membuat PKCE, lalu penyedia membuka browser sistem;
//   5. balikan diterima → `state` WAJIB sama dengan yang dibuat penyedia → kode ditukar token (PKCE) → brankas.
// PUTUSKAN (K22): cabut token di server (RFC 7009, `revocation_endpoint`) bila ada, lalu hapus token & pendaftaran klien
// dari brankas. Gagal mencabut tidak menghalangi penghapusan lokal — hasilnya dilaporkan apa adanya.

const { auth, discoverOAuthServerInfo } = require('@modelcontextprotocol/sdk/client/auth.js');
const { buatPenyediaOAuth, urlBolehDibuka } = require('./oauthPenyedia.cjs');
const { mulaiPenerima } = require('./penerimaBalikan.cjs');

const tolak = (alasan) => ({ ok: false, alasan });

/**
 * @param {{daftar: object, brankas: object, bukaBrowser: (url: string) => Promise<void>|void, versi?: string,
 *   log?: Function, fetchFn?: Function, batasMs?: number}} opsi
 */
function buatAlurOAuth({ daftar, brankas, bukaBrowser, versi = '0', log = () => {}, fetchFn = undefined, batasMs = undefined }) {
  const sedang = new Map(); // id → janji: tombol ditekan dua kali tidak membuka dua login

  async function metadata(url) {
    const info = await discoverOAuthServerInfo(url, fetchFn ? { fetchFn } : undefined);
    return info?.authorizationServerMetadata || null;
  }

  async function hubungkanSekali(id) {
    const entri = daftar.ambil(id);
    if (!entri) return tolak(`server ${id} tidak terpasang`);
    if (!entri.oauth) return tolak(`server ${id} tidak memakai login (OAuth)`);
    const url = entri.http.url;

    let meta;
    try { meta = await metadata(url); } catch (e) { return tolak(`metadata OAuth tidak terbaca: ${e.message}`); }
    if (!meta?.authorization_endpoint || !meta?.token_endpoint) return tolak('server tidak mengumumkan metadata OAuth');
    if (!(meta.code_challenge_methods_supported || []).includes('S256')) return tolak('server tidak mendukung PKCE S256 — tidak dihubungkan');
    if (!urlBolehDibuka(meta.authorization_endpoint)) return tolak('alamat login server bukan https');

    const lama = buatPenyediaOAuth({ id, brankas });
    let portLama = 0;
    try { portLama = Number(new URL(lama.klien()?.redirect_uris?.[0] || '').port) || 0; } catch { portLama = 0; /* belum pernah mendaftar */ }
    let penerima;
    try {
      penerima = await mulaiPenerima({ port: portLama, ...(batasMs ? { batasMs } : {}) });
    } catch {
      // Port pendaftaran lama sedang dipakai program lain → daftar ulang dengan port baru (alamat balikan berubah).
      lama.penyedia.invalidateCredentials('client');
      penerima = await mulaiPenerima({ port: 0, ...(batasMs ? { batasMs } : {}) });
    }
    lama.penyedia.invalidateCredentials('tokens'); // login segar

    const p = buatPenyediaOAuth({
      id, brankas, redirectUrl: penerima.url, mode: 'interaktif', bukaBrowser, versi,
      asalOtorisasi: new URL(meta.authorization_endpoint).origin,
    });
    try {
      let r = await auth(p.penyedia, { serverUrl: url, ...(fetchFn ? { fetchFn } : {}) });
      if (r === 'REDIRECT') {
        const b = await penerima.tunggu();
        if (b.galat) return tolak(`login dibatalkan di halaman penyedia (${b.galat})`);
        if (!b.state || b.state !== p.stateTerakhir()) return tolak('balikan login tidak cocok (state) — diabaikan');
        r = await auth(p.penyedia, { serverUrl: url, authorizationCode: b.code, ...(fetchFn ? { fetchFn } : {}) });
      }
      if (r !== 'AUTHORIZED' || !p.terhubung()) return tolak('login tidak selesai');
      log(`[KONEKTOR-UMUM] ${id}: akun terhubung (OAuth)`); // tanpa token
      return { ok: true, terhubung: true };
    } catch (e) {
      return tolak(e.message); // dinaikkan ke layar: alasan gagal login tampil di kartu konektor
    } finally {
      penerima.tutup();
    }
  }

  function hubungkan(id) {
    if (sedang.has(id)) return sedang.get(id);
    const j = hubungkanSekali(id).finally(() => sedang.delete(id));
    sedang.set(id, j);
    return j;
  }

  async function putuskan(id) {
    const entri = daftar.ambil(id);
    const p = buatPenyediaOAuth({ id, brankas });
    const tok = p.token();
    const klien = p.klien();
    let dicabut = null;
    if (entri?.oauth && tok && (tok.refresh_token || tok.access_token)) {
      try {
        const meta = await metadata(entri.http.url);
        const rev = meta?.revocation_endpoint;
        if (rev && urlBolehDibuka(rev)) {
          const badan = new URLSearchParams({
            token: tok.refresh_token || tok.access_token,
            token_type_hint: tok.refresh_token ? 'refresh_token' : 'access_token',
            ...(klien?.client_id ? { client_id: klien.client_id } : {}),
          });
          const res = await (fetchFn || fetch)(rev, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: badan });
          dicabut = res.ok;
        }
      } catch (e) {
        dicabut = false;
        log(`[KONEKTOR-UMUM] ${id}: pencabutan token gagal — ${e.message}`);
      }
    }
    p.lupakan();
    log(`[KONEKTOR-UMUM] ${id}: akun diputuskan (dicabut di server: ${dicabut === null ? 'tak ada alamat' : dicabut})`);
    return { ok: true, dicabut };
  }

  const status = (id) => ({ terhubung: buatPenyediaOAuth({ id, brankas }).terhubung() });

  return { hubungkan, putuskan, status };
}

module.exports = { buatAlurOAuth };
