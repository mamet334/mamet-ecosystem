// PENYEDIA OAUTH (Item 129 Tahap F1, 2026-11-03) — satu tugas: memenuhi kontrak `OAuthClientProvider` SDK MCP untuk
// satu server, dengan penyimpanan di brankas (K18).
//
// Yang disimpan di brankas (terenkripsi DPAPI, per server):
//   - `oauth-klien` — hasil pendaftaran klien otomatis (DCR) beserta `issuer`;
//   - `oauth-token` — token akses + token pembaru beserta `issuer`.
// Verifier PKCE dan `state` hanya di memori (berumur satu kali login).
//
// DUA MODE (K23):
//   - `interaktif` (Owner menekan "Hubungkan akun") — `redirectToAuthorization` membuka BROWSER SISTEM, setelah URL-nya
//     diperiksa: https (http hanya ke mesin ini, untuk uji), dan asalnya sama dengan `authorization_endpoint` yang
//     ditemukan dari metadata server itu. URL dari tempat lain tidak dibuka.
//   - `diam` (server dinyalakan / token diperbarui) — tidak pernah membuka browser. Bila SDK butuh login ulang, penyedia
//     menandai `perluHubungkanUlang` dan melempar galat: status Settings "perlu hubungkan ulang", bukan tab yang tiba-tiba
//     terbuka.

const crypto = require('crypto');

const KUNCI_KLIEN = 'oauth-klien';
const KUNCI_TOKEN = 'oauth-token';
const BATAS_SIMPAN = 16384; // token JWT + token pembaru bisa melebihi batas kredensial ketik (4.096)

/** URL boleh dibuka di browser: https, atau http ke mesin ini (server uji). */
function urlBolehDibuka(u) {
  let url;
  try { url = new URL(String(u)); } catch { return false; /* bukan URL — tidak dibuka */ }
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
}

/**
 * @param {{id: string, brankas: object, redirectUrl?: string|null, mode?: 'interaktif'|'diam',
 *   bukaBrowser?: (url: string) => void|Promise<void>, asalOtorisasi?: string|null, versi?: string}} opsi
 *   `asalOtorisasi` = origin `authorization_endpoint` dari metadata (diisi alurOAuth sebelum login).
 */
function buatPenyediaOAuth({ id, brankas, redirectUrl = null, mode = 'diam', bukaBrowser = null, asalOtorisasi = null, versi = '0' }) {
  let verifier = null;
  let stateTerakhir = null;
  let perluHubungkanUlang = false;

  const bacaJson = (kunci) => {
    const t = brankas.ambil(id)[kunci];
    if (!t) return undefined;
    try { return JSON.parse(t); } catch { return undefined; /* rusak = dianggap belum ada; Owner menghubungkan ulang */ }
  };
  const simpanJson = (kunci, nilai) => {
    const h = brankas.simpan(id, kunci, JSON.stringify(nilai), { maks: BATAS_SIMPAN });
    if (!h.ok) throw new Error(`brankas: ${h.alasan}`);
  };

  // Mode diam tidak membuka penerima, tetapi tetap WAJIB menyebut alamat balikan yang dulu didaftarkan: tanpa itu SDK
  // menganggap alurnya non-interaktif (client_credentials) dan tidak pernah memakai token pembaru (temuan uji F1).
  const alamatBalikan = () => redirectUrl || bacaJson(KUNCI_KLIEN)?.redirect_uris?.[0] || undefined;

  const penyedia = {
    get redirectUrl() { return alamatBalikan(); },
    get clientMetadata() {
      const balikan = alamatBalikan();
      return {
        client_name: 'Mamet Ecosystem',
        redirect_uris: balikan ? [balikan] : [],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none', // klien publik: tanpa rahasia, keamanannya dari PKCE
        software_id: 'mamet-ecosystem',
        software_version: versi,
      };
    },
    state() {
      stateTerakhir = crypto.randomBytes(24).toString('base64url');
      return stateTerakhir;
    },
    clientInformation: () => bacaJson(KUNCI_KLIEN),
    saveClientInformation: (info) => simpanJson(KUNCI_KLIEN, info),
    tokens: () => bacaJson(KUNCI_TOKEN),
    saveTokens: (t) => { simpanJson(KUNCI_TOKEN, t); perluHubungkanUlang = false; },
    saveCodeVerifier: (v) => { verifier = v; },
    codeVerifier: () => {
      if (!verifier) throw new Error('verifier PKCE tidak ada — login harus dimulai ulang');
      return verifier;
    },
    async redirectToAuthorization(url) {
      if (mode !== 'interaktif' || !bukaBrowser) {
        perluHubungkanUlang = true;
        throw new Error('akun perlu dihubungkan ulang di Settings › Konektor');
      }
      if (!urlBolehDibuka(url)) throw new Error('alamat login bukan https — tidak dibuka');
      if (!asalOtorisasi || new URL(String(url)).origin !== asalOtorisasi) {
        throw new Error('alamat login tidak sama dengan server otorisasi yang ditemukan — tidak dibuka');
      }
      await bukaBrowser(String(url));
    },
    invalidateCredentials(cakupan) {
      if (cakupan === 'all' || cakupan === 'tokens') brankas.simpan(id, KUNCI_TOKEN, '');
      if (cakupan === 'all' || cakupan === 'client') brankas.simpan(id, KUNCI_KLIEN, '');
      if (cakupan === 'all' || cakupan === 'verifier') verifier = null;
    },
  };

  return {
    penyedia,
    stateTerakhir: () => stateTerakhir,
    perluHubungkanUlang: () => perluHubungkanUlang,
    terhubung: () => !!bacaJson(KUNCI_TOKEN)?.access_token,
    token: () => bacaJson(KUNCI_TOKEN),
    klien: () => bacaJson(KUNCI_KLIEN),
    lupakan: () => { brankas.simpan(id, KUNCI_TOKEN, ''); brankas.simpan(id, KUNCI_KLIEN, ''); verifier = null; },
  };
}

module.exports = { buatPenyediaOAuth, urlBolehDibuka, KUNCI_KLIEN, KUNCI_TOKEN, BATAS_SIMPAN };
