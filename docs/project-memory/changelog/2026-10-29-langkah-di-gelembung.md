# 29 Oktober 2026 — Baris "🔍 Dicari" & "📋 Rencana" tampil langsung di gelembung jawaban (ADR-0021 §2.3, Varian B)

Lanjutan [panel Monitor](./2026-10-29-langkah-terlihat-monitor.md): langkah proses tadinya hanya terlihat bila panel
Monitor dibuka manual — gelembung chat tak pernah menggambarnya. ADR-0021 §2.3 meminta hasil olahan LLM **selalu
terlihat, satu baris**.

## Pratinjau & pilihan Owner

Pratinjau di peramban bawaan memakai CSS build aplikasi SUNGGUHAN + empat tema dari `themes.json` (`aturanCssTema()`);
kelas gelembung & blok Berpikir disalin dari `ConversationEngine.jsx`; 38 kelas dipastikan ada di CSS build. Tiga varian:
A blok lipat terbuka (baris penting), **B baris tipis langsung tanpa lipat (baris penting)**, C blok lipat tertutup (semua
langkah). **Owner memilih B.**

## Yang dibuat (klien saja)

- **`components/workbench/langkahPenting.js`** (baru): hanya baris berawalan `🔍 Dicari` (klien "web" & researcher
  "berita") dan `📋 Rencana`. "🔍 Menganalisis permintaan…" dan langkah teknis lain tetap di panel Monitor.
- **`ConversationEngine.jsx`**: baris-baris itu tampil sebagai teks tipis (`mb-3 text-body-sm text-on-surface-variant
  leading-relaxed [overflow-wrap:anywhere]` — gaya isi blok Berpikir, tanpa lipat/garis) **tepat di atas blok Berpikir**,
  hanya untuk jawaban, juga saat jawaban masih mengalir.
- **Chat lama ikut tampil:** `steps` tersimpan utuh di tabel `chats`. Baris rencana sebelum v539 hanya memuat nama
  sub-agent (tanpa tugas).

## Bukti

- `uji/uji-langkah-terlihat.mjs` **v2** bagian 5: penyaring baris penting; posisi di atas Berpikir & bukan di pesan
  pengguna; gaya baris; 5 kelas **dikompilasi Tailwind sungguhan**. **Mutasi 5/5 menggigit** — termasuk kelas di luar
  skala yang dibuang Tailwind diam-diam dan blok yang dipindah.
- Suite penuh **128/128**; `vite build` berhasil (kelas `[overflow-wrap:anywhere]` ada di CSS build); nol karakter kendali.
- **Belum dilihat di gelembung chat sungguhan** — butuh masuk aplikasi & satu chat; tampilan dibuktikan lewat pratinjau
  dengan CSS yang sama. Uji cepat Owner: buka chat lama yang memakai researcher/web di `npm run desktop`.

Berlaku di `npm run desktop` (muat ulang halaman); aplikasi terpasang lewat rilis berikutnya.
