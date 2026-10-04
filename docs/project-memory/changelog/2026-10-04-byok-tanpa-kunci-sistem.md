# 4 Oktober 2026 — Cadangan kunci sistem yang terlewat, dan dua catatan yang salah

## Asalnya: satu pertanyaan Owner

> *"check-keys itu merupakan fitur test koneksi?"*

Jawabannya ya — dan menjawabnya dengan jujur menuntut memeriksa **kunci siapa** yang diujinya.
Pemeriksaan itulah yang menemukan sisanya.

## 1. OpenAI adalah penyedia yang TERLEWAT saat BYOK ditutup

Keputusan Owner 2026-09-10 menutup cadangan kunci sistem untuk provider chat, dengan dua alasan
yang Owner tulis sendiri di `request_pipeline.ts`:

1. belanja pengguna eksternal ditanggung Owner **tanpa jejak kepemilikan**, dan ikut memakan
   plafon harian Owner;
2. ketika kunci sistem itu mati — terbukti 10 Sep, OpenRouter menjawab 401 *"User not found"* —
   **setiap** pengguna tanpa BYOK tertutup total, dan tak ada yang tahu karena Owner selalu punya
   kunci sendiri sehingga tak pernah menyentuh jalur itu.

Gemini, Groq, dan OpenRouter ditutup. **OpenAI tidak.** Sampai hari ini:

```ts
openAI: finalProvider === 'openai' ? finalApiKey : openAIKey,   // openAIKey = kunci SERVER
```

Setiap pengguna yang penyedianya **bukan** openai membawa kunci OpenAI Owner di dalam
`rctx.keys.openAI`.

### Ditelusuri sampai habis sebelum dilaporkan sebagai bahaya

Saya sempat menyebutnya *"lubang yang nyata"* di tengah penelusuran — **terlalu cepat**, dan
dikoreksi di percakapan yang sama. Hasil lengkapnya: hari ini **tak ada yang memakainya**.

| Jalur | Keadaan |
|---|---|
| `getAdapter(name)` | **nol pemanggil** di seluruh agent-process |
| `getAvailableAIAdapters(preferredOrder)` | satu pemanggil, daftarnya `['openrouter','gemini','groq']` — tanpa openai |
| `env.OPENAI_API_KEY` yang dititipkan ke sub-agent | **tidak pernah dibaca** di mana pun |

Jadi bukan kebocoran yang sedang berjalan, melainkan **pistol terisi tanpa pelatuk**:
menambahkan `'openai'` ke satu daftar `preferredOrder` sudah cukup melepaskannya — dan yang
terlepas adalah akibat nomor 1 yang justru dilarang keputusan itu sendiri.

Ditutup sebelum pelatuknya terpasang: `: openAIKey` → `: ''`, dan variabelnya dicabut, sehingga
`OPENAI_API_KEY` **tidak lagi dibaca sama sekali** di agent-process.

## 2. Komentar basi yang nyaris menyesatkan laporan ini

`runtime_context.ts:42` berbunyi: `openRouter` *"jatuh ke OPENROUTER_API_KEY sistem bila provider
chat pengguna bukan openrouter"*. Saya membacanya dan **melaporkannya sebagai keadaan sekarang**.

Kodenya mengatakan lain:

```ts
openRouter: finalProvider === 'openrouter' ? finalApiKey
          : (request.headers.get('x-byok-openrouter') || '').trim(),
```

Jatuhnya ke **header pengguna**. Perilaku yang komentar itu gambarkan dihapus 15 September;
komentarnya tertinggal sembilan belas hari. Komentar diperbaiki, **beserta catatan kenapa** —
bukan dihapus diam-diam, supaya alasannya bertahan.

## 3. T11 ternyata baru separuh ditutup

INDEX mencatat `check-keys` *"dihapus dari repo & dari Supabase"* dan menandainya ✅ DITUTUP
29 Sep. Diperiksa lewat API Supabase hari ini:

| | |
|---|---|
| Repo | ✅ terhapus (`23b8714`), nol pemanggil di klien |
| Supabase | ❌ **masih ACTIVE** — versi 60, terakhir disentuh 10 Sep, sumber ter-deploy **sama persis** dengan yang di riwayat git |

Ia alat uji koneksi dari era ketika **server** memegang kunci; penggantinya sudah hidup
(`Settings.jsx:214`, tombol Test Connection, memakai kunci **pengguna** lewat
`x-byok-{provider}` dan menuntut login). Yang masih diujinya hanyalah rahasia yang tak lagi
dipakai untuk pekerjaan: Gemini/Groq sudah dihapus sebagai secret 15 Sep, dan
`OPENROUTER_API_KEY` dibaca di satu tempat saja — hanya untuk mencetak `'CONFIGURED'`/`'MISSING'`
pada muatan status.

Biaya membiarkannya: tiap panggilan memicu panggilan API **berbayar** ke empat penyedia, dan
jawabannya memuat **8 huruf pertama** tiap kunci Gemini, tanpa pemeriksaan pengguna. Nol panggilan
dalam 24 jam terakhir — tetapi log Supabase hanya menyimpan 24 jam, jadi riwayat lamanya **tak
bisa diketahui**, dan itu dikatakan apa adanya alih-alih disimpulkan sebagai "tak pernah dipakai".

**SELESAI hari yang sama:** Owner menghapusnya dari dashboard, dan diperiksa ulang lewat API —
tinggal **6 fungsi**, `check-keys` tidak lagi terdaftar. T11 kini ✅ sungguhan.

**Pelajaran yang disimpan:** *"dihapus dari repo"* dan *"dihapus dari platform"* adalah dua klaim
berbeda, dan hanya yang pertama bisa dibuktikan dari kode. Catatan 29 Sep menggabungkan keduanya
dalam satu ✅, lalu bertahan lima hari tanpa diperiksa — karena memeriksanya menuntut keluar dari
repo. Bila sebuah klaim menyebut platform, periksa platformnya.

## Yang diperiksa dan TIDAK jadi temuan

Advisor keamanan Supabase menandai `match_memories`, `get_active_knowledge`, dan
`check_daily_quota` sebagai `SECURITY DEFINER` yang bisa dipanggil klien dengan id pengguna
sebagai argumen. Ketiganya dibaca, karena *menyebut* `auth.uid` bukan *menjaga*. Ternyata dijaga
sungguhan:

```sql
IF auth.role() IS DISTINCT FROM 'service_role'
   AND auth.uid() IS DISTINCT FROM target_user_id THEN
    RAISE EXCEPTION 'Unauthorized: access denied to other users memories';
```

Ketiganya juga memakai `SET search_path TO 'public','pg_temp'`. Dan
`match_documents`/`match_documents_hybrid` ternyata `SECURITY INVOKER`, jadi RLS tetap berlaku —
ketiadaan `auth.uid` di sana justru benar. Advisor mencocokkan **pola**, bukan menemukan lubang;
tidak diteruskan sebagai temuan.

## Uji

`uji/uji-byok-tanpa-kunci-sistem.mjs` (baru) — 22 asersi. Penjaganya **sengaja dibuat umum**:
memeriksa "openAI tidak memakai kunci sistem" hanya menutup penyedia yang kebetulan ketahuan hari
ini. Yang diuji adalah bentuk invariannya — **di seluruh blok `keys:`, tak satu pun nilai boleh
berasal dari `Deno.env`** — ditambah lapis kedua yang melarang variabel kunci perantara selain
`finalApiKey`, karena begitulah cacat ini dulu masuk. Penyedia kelima yang ditambahkan nanti ikut
terjaga tanpa menyentuh berkas uji.

| Mutasi | Asersi jatuh |
|---|---|
| M1 cacat aslinya dipasang kembali (`openAIKey`) | 5 |
| M2 `Deno.env` langsung di dalam blok `keys:` | 2 |
| M3 penyedia **lain** (gemini) diberi cadangan sistem | 2 |
| M4 komentar basi dikembalikan | 1 |

**M3 adalah yang membuktikan penjaganya umum**, bukan tambalan khusus OpenAI.

76/76 berkas uji hijau. Bundel `agent-process` bersih (505,3 kb).

## Perlu DEPLOY

`request_pipeline.ts` dan `runtime_context.ts` ada di `agent-process`. Tidak ada perubahan
renderer, jadi **tidak perlu rilis klien**.

**Cara memastikan live:** ini perubahan yang tidak terlihat dari luar kalau benar — tidak ada
gejala yang hilang, karena jalurnya memang belum pernah terpakai. Yang membuktikannya adalah
ujinya dan ketiadaan `Deno.env.get('OPENAI_API_KEY')` di kode. Satu-satunya pemeriksaan live yang
masuk akal: pengguna dengan penyedia **openai** harus tetap bisa chat memakai kuncinya sendiri —
kalau itu rusak, `finalApiKey` yang salah, bukan cadangannya.
