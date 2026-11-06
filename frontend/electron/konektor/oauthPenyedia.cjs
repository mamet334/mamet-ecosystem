
const crypto = require('crypto');

const KUNCI_KLIEN = 'oauth-klien';
const KUNCI_TOKEN = 'oauth-token';
const BATAS_SIMPAN = 16384;

function urlBolehDibuka(u) {
  let url;
  try { url = new URL(String(u)); } catch { return false;  }
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
}

function buatPenyediaOAuth({ id, brankas, redirectUrl = null, mode = 'diam', bukaBrowser = null, asalOtorisasi = null, versi = '0', klienId = null }) {
  let verifier = null;
  let stateTerakhir = null;
  let perluHubungkanUlang = false;

  const bacaJson = (kunci) => {
    const t = brankas.ambil(id)[kunci];
    if (!t) return undefined;
    try { return JSON.parse(t); } catch { return undefined;  }
  };
  const simpanJson = (kunci, nilai) => {
    const h = brankas.simpan(id, kunci, JSON.stringify(nilai), { maks: BATAS_SIMPAN });
    if (!h.ok) throw new Error(`brankas: ${h.alasan}`);
  };

  const alamatBalikan = () => redirectUrl || bacaJson(KUNCI_KLIEN)?.redirect_uris?.[0] || (klienId ? 'http://127.0.0.1/balikan' : undefined);

  const penyedia = {
    get redirectUrl() { return alamatBalikan(); },
    get clientMetadata() {
      const balikan = alamatBalikan();
      return {
        client_name: 'Mamet Ecosystem',
        redirect_uris: balikan ? [balikan] : [],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        software_id: 'mamet-ecosystem',
        software_version: versi,
      };
    },
    state() {
      stateTerakhir = crypto.randomBytes(24).toString('base64url');
      return stateTerakhir;
    },
    clientInformation: () => bacaJson(KUNCI_KLIEN) || (klienId ? { client_id: klienId } : undefined),
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
