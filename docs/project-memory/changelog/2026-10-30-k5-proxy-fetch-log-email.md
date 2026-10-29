# 30 Oktober 2026 — K5: `proxy_fetch` wajib token & hanya alamat publik; log autentikasi tanpa email (ADR-0022)

Dua temuan keamanan dari uji isolasi K4 ([log](./2026-10-29-k4-isolasi-dua-akun.md)), dikerjakan atas keputusan Owner 30 Okt.

## Temuan

- **`proxy_fetch` terbuka untuk seluruh internet.** `agent-process` di-deploy `--no-verify-jwt`, dan blok `proxy_fetch` di
  `index.ts` berjalan SEBELUM pemeriksaan token apa pun. **Live 29 Okt:** tanpa token, server mengambilkan `example.com`.
  Pemanggil satu-satunya di repo: `WebComparisonService._safeFetch` (web Tier 3 versi web, lewat `supabase.functions.invoke`
  yang selalu membawa token pengguna) — **bukan crawler** (diperiksa di `capability/ecosystem-crawler/`).
- **`auth_middleware.ts` menulis seluruh objek pengguna ke log** (`JSON.stringify(user)`: email & metadata akun) di setiap
  permintaan.

## Yang dibuat

- **`lib/request/proxy_fetch_endpoint.ts`** (baru) — blok dipindah dari `index.ts`, pola sama dengan `embed_endpoint.ts`:
  `handleAuth` dulu (tanpa pengguna sah → 401); **`alamatBolehDiambil`**: hanya `http`/`https` ke host publik — localhost,
  127/10/192.168/172.16–31, 169.254 (metadata), IPv6 lokal, `file:`/`ftp:` ditolak 400 (SSRF, juga untuk pengguna yang masuk).
- **`index.ts`**: blok lama dibuang; satu panggilan `handleProxyFetchRequest` di deretan endpoint yang memeriksa JWT sendiri.
- **`auth_middleware.ts`**: log hanya `User ID`.

## Bukti

- `uji/uji-proxy-fetch-aman.mjs` (baru, modul asli dibundel; `handleAuth` & `fetch` ditiru): tanpa token → 401 dan **nol
  permintaan keluar**; dengan token → RSS tetap diambilkan (web Tier 3 tak rusak); 10 alamat internal ditolak; log tanpa
  email. **Mutasi 4/4 menggigit.** `uji-catch-diam` hijau (catch pemeriksa alamat diberi keterangan). Suite **132/132**;
  bundel esbuild berhasil.
- **Deploy (Owner, 30 Okt) — diperiksa di platform:** `agent-process` **539 → 540**, ACTIVE, `verify_jwt` tetap `false`,
  100 berkas (+1), 0 dari `frontend/`; `proxy_fetch_endpoint.ts`, `index.ts`, `auth_middleware.ts` **sama persis** dengan
  repo (setelah CRLF → LF); `body?.action === 'proxy_fetch'` & `JSON.stringify(user)` tak ada lagi di paket.
- **Live:** permintaan tanpa token ke `example.com` yang 29 Okt berhasil → kini **HTTP 401**.

Skill `openai-security-best-practices` (trailofbits) tidak dipakai — lingkup sudah terbukti live; disimpan untuk review
keamanan menyeluruh sisa K5.
