
const { urlBolehDibuka } = require('./oauthPenyedia.cjs');

const tolakGalat = (pesan) => { const e = new Error(pesan); e.galatLogin = true; return e; };

function tidurBisaBatal(ms, sinyal) {
  return new Promise((ok, gagal) => {
    if (sinyal?.dibatalkan) { gagal(tolakGalat('login dibatalkan')); return; }
    const t = setTimeout(() => { sinyal?.lepas?.(); ok(); }, ms);
    if (sinyal) sinyal.saatBatal = () => { clearTimeout(t); gagal(tolakGalat('login dibatalkan')); };
  });
}

async function kirimForm(fetchFn, url, isi) {
  const r = await fetchFn(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(isi),
  });
  let j = {};
  try { j = await r.json(); } catch { j = {};  }
  return { ok: r.ok, status: r.status, j };
}

async function loginPerangkat({ meta, klienId, scope = '', fetchFn = null, bukaBrowser = null, onKode = () => {}, sinyal = null, tambahLambatMs = 5000, sekarang = Date.now }) {
  if (!meta?.device_authorization_endpoint || !urlBolehDibuka(meta.device_authorization_endpoint)) {
    throw tolakGalat('server tidak menyediakan login perangkat (device flow)');
  }
  if (!klienId) throw tolakGalat('login perangkat butuh client_id terdaftar (oauthKlienId)');
  if (typeof fetchFn !== 'function') throw tolakGalat('login perangkat butuh pengambil jaringan');

  const awal = await kirimForm(fetchFn, meta.device_authorization_endpoint, { client_id: klienId, ...(scope ? { scope } : {}) });
  const d = awal.j;
  if (!awal.ok || d.error || !d.device_code || !d.user_code || !d.verification_uri) {
    throw tolakGalat(`kode login perangkat tidak didapat${d.error ? ` (${d.error}${d.error_description ? `: ${d.error_description}` : ''})` : ''}`);
  }
  const kodePengguna = String(d.user_code).slice(0, 24);
  const alamat = String(d.verification_uri);
  const berlakuSampai = sekarang() + Math.min(Math.max(Number(d.expires_in) || 900, 60), 1800) * 1000;
  let jedaMs = Math.min(Math.max(Number(d.interval) || 5, 1), 60) * 1000;
  onKode({ kodePengguna, alamat, berlakuSampai });

  let asalLogin = null;
  try { asalLogin = new URL(meta.authorization_endpoint).origin; } catch { asalLogin = null;  }
  if (bukaBrowser && urlBolehDibuka(alamat) && asalLogin && new URL(alamat).origin === asalLogin) await bukaBrowser(alamat);

  for (;;) {
    if (sekarang() > berlakuSampai) throw tolakGalat('kode login kedaluwarsa — tekan Hubungkan akun lagi');
    await tidurBisaBatal(jedaMs, sinyal);
    const t = await kirimForm(fetchFn, meta.token_endpoint, {
      client_id: klienId, device_code: d.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
    const g = t.j.error;
    if (t.j.access_token && !g) return t.j;
    if (g === 'authorization_pending') continue;
    if (g === 'slow_down') { jedaMs += tambahLambatMs; continue; }
    if (g === 'access_denied') throw tolakGalat('login ditolak di halaman penyedia');
    if (g === 'expired_token') throw tolakGalat('kode login kedaluwarsa — tekan Hubungkan akun lagi');
    throw tolakGalat(`token tidak didapat${g ? ` (${g}${t.j.error_description ? `: ${t.j.error_description}` : ''})` : ` (HTTP ${t.status})`}`);
  }
}

module.exports = { loginPerangkat };
