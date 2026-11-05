// FETCH OAUTH YANG JUJUR (Item 129 GH3, 2026-11-05) — satu tugas: galat OAuth yang dikirim dengan status 200 diubah
// menjadi status 400, supaya SDK MCP membacanya sebagai galat OAuth dengan alasannya.
//
// Kenapa: GitHub menjawab galat penukaran token (mis. `incorrect_client_credentials`, `bad_verification_code`) dengan
// HTTP **200** dan badan `{"error": "...", "error_description": "..."}`. SDK menganggap 200 = berhasil, lalu gagal
// memeriksa skema: Owner melihat `access_token … received undefined` (percobaan GH2, 3 Nov) — alasan sebenarnya
// tertutup. Dengan status 400, SDK mem-parse galatnya (`parseErrorResponse`) dan pesannya menyebut alasan asli.
//
// Hanya jawaban JSON dengan `error` berupa TEKS dan tanpa `access_token` yang diubah. Galat JSON-RPC MCP berbentuk
// objek (`{"jsonrpc":"2.0","error":{...}}`) dan tidak tersentuh; jawaban lain diteruskan apa adanya.
// Membungkus pengambil yang DIBERIKAN (jaringanKonektor = net.fetch di produksi) — tidak memanggil fetch() Node sendiri.

/** @param {(input: any, init?: object) => Promise<Response>} dasar */
function buatFetchOAuthJujur(dasar) {
  return async function fetchOAuthJujur(masukan, init) {
    const r = await dasar(masukan, init);
    if (r.status !== 200 || !/json/i.test(r.headers.get('content-type') || '')) return r;
    let teks;
    try { teks = await r.clone().text(); } catch { return r; /* badan tak terbaca — teruskan apa adanya */ }
    let isi;
    try { isi = JSON.parse(teks); } catch { return r; /* bukan JSON — teruskan apa adanya */ }
    if (!isi || typeof isi.error !== 'string' || isi.access_token || isi.jsonrpc) return r;
    return new Response(teks, { status: 400, statusText: 'galat OAuth (dikirim penyedia dengan status 200)', headers: r.headers });
  };
}

module.exports = { buatFetchOAuthJujur };
