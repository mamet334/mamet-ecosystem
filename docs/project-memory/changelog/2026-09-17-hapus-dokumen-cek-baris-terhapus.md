# Hapus Dokumen RAG: Cek Baris yang Benar-Benar Terhapus (Item 91)

**Tanggal:** 17 September 2026
**Roadmap:** Item 91 (perbaikan kecil; sisa temuan di [`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md) T5)
**Status:** selesai (`bf93a17`) — web live terbukti; tampilan jam di desktop terbukti; hapus di desktop & mametlite
belum teruji (lihat Verifikasi).

## Masalah (terbukti di edge_logs Supabase, 2026-09-17)

Desktop (`npm run desktop`) memuat daftar dokumen **sebelum** ada unggahan baru dari web live. Owner "menghapus"
dokumen yang sebenarnya sudah terhapus: `DELETE` dijawab **204 dengan 0 baris**, layar menampilkan sukses,
sedangkan duplikat yang benar-benar ada tetap tersimpan di database.

Penyebab: supabase-js **tidak melempar error**. `handleDelete` di `ResearchApp.jsx` mengabaikan `{ error }`,
tidak menghitung baris terhapus, lalu membuang item dari layar tanpa syarat. `mametlite` sudah mengecek
`{ error }` tetapi punya celah yang sama (0 baris dianggap sukses, item dibuang tanpa muat ulang).

## Perubahan

| Berkas | Sebelum | Sesudah |
|---|---|---|
| `frontend/src/components/research/ResearchApp.jsx` `handleDelete` | hasil DELETE diabaikan; item dibuang dari state | cek `{ error }` pada `document_chunks` & `documents`; `documents` memakai `.delete().eq('id').select('id')` → 0 baris = pesan "Dokumen tidak ditemukan di server…"; **selalu** `loadDocuments()` sesudahnya |
| `ResearchApp.jsx` `formatDate` | tanggal saja | tanggal + jam (`toLocaleString('id-ID')`) — dua unggahan berjudul sama di hari yang sama bisa dibedakan |
| `mametlite/src/App.jsx` `handleDeleteDocument` | cek error saja; item dibuang tanpa syarat | `.select('id')` + pesan 0 baris; **selalu** `fetchDocuments()` sesudahnya |
| `mametlite/src/App.jsx` daftar dokumen | judul saja | `created_at` ikut diambil; tanggal + jam tampil sebagai tooltip judul (tata letak tidak berubah) |

Hapus potongan (`document_chunks`) dengan 0 baris **tidak** dianggap gagal — dokumen tanpa potongan itu wajar.

## Verifikasi

- `npm run build` di `frontend` dan `mametlite`: lolos.
- Tidak ada data yang dihapus/diubah oleh AI selama pengerjaan (semua cek database baca-saja).

Bukti live (edge_logs + SQL baca-saja, 2026-09-17):

| Jalur | Bukti | Hasil |
|---|---|---|
| Web live (browser, bukan Electron) 08:45:58 UTC | `DELETE /documents?id=eq.ed84dfce…&select=id`, `Prefer: return=representation` → **200**; baris tidak ada lagi di DB | ✅ kode baru live |
| Desktop 08:46:17 UTC | `DELETE` **tanpa** `select=id` (204) — checkout utama masih `3cb4f27` | ❌ kode lama; Owner `git pull` → `bf93a17` |
| Desktop sesudah pull + unggah ulang KEP | daftar menampilkan "17 Sep 2026, 15.51"; isi DB = layar (2 dokumen, tanpa duplikat) | ✅ jam tampil |
| Hapus di desktop dengan kode baru | — | ⏳ belum teruji (tak ada dokumen yang perlu dihapus) |
| mametlite.vercel.app | — | ⏳ belum teruji |

## Catatan

- `.select('id')` sesudah DELETE butuh izin baca (RLS SELECT) atas `documents`. Kedua daftar sudah membaca tabel
  itu, jadi aman; bila kebijakan itu kelak berubah, gejalanya pesan "tidak ditemukan" palsu, bukan gagal diam-diam.
- **Cascade potongan (T5) — ditutup:** `document_chunks_document_id_fkey` ber-`ON DELETE CASCADE` (`confdeltype = c`
  di `pg_constraint`); potongan yatim = 0. Hapus baris `documents` saja di mametlite sudah cukup.
- **Dampak ke uji mutu RAG (Item 90):** dokumen KEP diunggah ulang (`b604d31b…`, 19 potongan). Total potongan kini
  106 (87 HCDP + 19 KEP) vs 105 saat acuan Tahap B diukur → angka recall@8 14/14 perlu diukur ulang sebelum Tahap C.
