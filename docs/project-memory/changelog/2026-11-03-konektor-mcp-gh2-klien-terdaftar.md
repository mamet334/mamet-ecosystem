# 3 November 2026 — Konektor MCP GH2: klien OAuth terdaftar (GitHub) + hasil percobaan GitHub jarak jauh

[Rancangan §10 · GitHub lewat OAuth](../../roadmap/ROADMAP-KONEKTOR-MCP.md) · Item 129. Desktop saja, server tidak
berubah. Keputusan K24–K27 disetujui Owner pada 3 Nov.

## Yang dibangun

GitHub tidak punya pendaftaran klien otomatis (DCR). Karena itu Mamet didaftarkan sekali sebagai **GitHub App
"Mamet Ecosystem"** oleh Owner, sebagai penerbit (GH1). Client ID-nya `Iv23li3SbHZO7UlcxipI`. Client ID bukan rahasia,
karena memang ikut tampil di alamat login. Rahasia klien **tidak dibuat**.

- **`resep.cjs`:** bidang baru `oauthKlienId`. Hanya berlaku untuk resep OAuth, tanpa spasi, dan rahasia klien tidak
  pernah ada di resep (K25).
- **`oauthPenyedia.cjs`:**
  - `clientInformation` memakai pendaftaran tersimpan (DCR) bila ada; bila tidak, memakai `{ client_id }` dari resep;
  - pada mode diam, klien terdaftar memakai alamat balikan baku, supaya pembaruan token tetap berjalan.
- **`alurOAuth.cjs`:**
  - server tanpa `registration_endpoint` yang resepnya tanpa `oauthKlienId` ditolak **sebelum** browser dibuka,
    dengan pesan yang jelas;
  - `client_id` diteruskan ke login, ke pembaruan token, dan ke pencabutan.
- **`sesiUmum.cjs`:** penyedia mode diam menerima `client_id` resep.
- **`KartuServerUmum.jsx`:** kalau penyedia tidak punya alamat pencabutan (seperti GitHub), Putuskan **menyatakan
  terus terang** bahwa token di laptop sudah dihapus tetapi izinnya masih harus dicabut di situs penyedia (GitHub:
  Settings › Applications › Authorized GitHub Apps).

## Bukti uji

- **`uji-konektor-oauth-f1.mjs` v2**, bagian 7 "gaya GitHub". Server tiruan dijalankan tanpa DCR (`/register` 404),
  dengan satu klien terdaftar, alamat balikan loopback yang menerima port berapa pun, dan tanpa alamat pencabutan.
  Yang diuji:
  - resep `oauthKlienId`;
  - penolakan dini bila `client_id` tidak ada;
  - login tanpa pendaftaran otomatis;
  - port acak diterima;
  - tidak ada rahasia, dan klien terdaftar tidak disimpan di brankas;
  - server menyala dan token diperbarui di mode diam;
  - Putuskan dengan `dicabut = null`.
- **Mutasi pada salinan: 29/29 mati** (6 baru untuk GH2). Satu mutan lama sempat dilewati karena barisnya berubah;
  polanya diperbarui, lalu semuanya diulang.
- G1, G2, F2, penjaga `catch`, dan `uji-ikon-subset` lulus. Berkas yang disunting bebas karakter kendali.

## Percobaan dengan akun GitHub Owner (3 Nov)

Resep percobaan `github-jauh.json` ditaruh di folder resep Owner (data, bukan kode), dengan jalur penuh
`https://api.githubcopilot.com/mcp/` (K26). Owner menekan Hubungkan akun.

| Pertanyaan | Hasil |
|---|---|
| Port `127.0.0.1` acak diterima GitHub? | ✅ **Ya.** GitHub mengembalikan browser ke penerima Mamet dengan kode login |
| Login browser tanpa rahasia? | ❌ **Tidak.** Kartu menampilkan galat skema SDK (`access_token … undefined`), karena GitHub menjawab galat dengan status 200. Penukaran dengan kode palsu dan Client ID tanpa rahasia mendapat **`incorrect_client_credentials`**, sama seperti dengan rahasia palsu. Artinya web flow GitHub App **mewajibkan client secret** |
| Device flow tanpa rahasia? | ✅ **Ya.** `POST github.com/login/device/code` dengan Client ID saja memberi `device_code`, kode pengguna 9 huruf, `verification_uri` `https://github.com/login/device`, masa berlaku 899 detik, dan interval 5 detik |
| Butuh langganan Copilot? | ⏳ Belum terjawab, karena perlu token |

**Kesimpulan:** sesuai K25, langkah berikutnya adalah **GH3 (device flow)**. Pembaruan token pada device flow (token
GitHub App habis ±8 jam) diuji di GH3. Kalau ternyata butuh rahasia juga, pilihannya: hubungkan ulang, atau Owner
mematikan "Expire user authorization tokens" di pengaturan App.

GitHub `.exe` (stdio) di laptop Owner tetap berjalan seperti biasa, sebagai konektor terpisah.
