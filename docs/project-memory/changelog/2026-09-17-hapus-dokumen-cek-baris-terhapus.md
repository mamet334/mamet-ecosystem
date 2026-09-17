# Hapus Dokumen RAG: Cek Baris yang Benar-Benar Terhapus (Item 91)

**Tanggal:** 17 September 2026
**Roadmap:** Item 91 (perbaikan kecil; sisa temuan di [`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md) T5)
**Status:** selesai — build `frontend` & `mametlite` lolos; belum diuji langsung oleh Owner sebelum push.

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
- Tidak ada data yang dihapus/diubah selama pengerjaan.

## Catatan

- `.select('id')` sesudah DELETE butuh izin baca (RLS SELECT) atas `documents`. Kedua daftar sudah membaca tabel
  itu, jadi aman; bila kebijakan itu kelak berubah, gejalanya pesan "tidak ditemukan" palsu, bukan gagal diam-diam.
- Sisa temuan: mametlite hanya menghapus baris `documents`; cascade ke `document_chunks` tidak terlihat di berkas
  migrasi → dicatat sebagai T5.
