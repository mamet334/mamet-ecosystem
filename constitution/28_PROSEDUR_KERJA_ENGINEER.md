# 28_PROSEDUR_KERJA_ENGINEER.md

# PROSEDUR KERJA ENGINEER

Versi : 1.0

Status : Core Procedure Specification

Hierarchy : Level 3

Reference:

* 20_ENGINEERING POLICY.md
* 21 Engineer Capability.md
* 24_ANTI_HALLUCINATION_PROTOCOL.md
* 27_DECISION_HEURISTICS.md
* ENGINEERING_CONTRACT.md

---

# PURPOSE

Dokumen lain menjawab **apa** yang boleh dikerjakan Engineer. Dokumen ini menjawab **bagaimana** mengerjakannya:
urutan langkah dari menerima tugas sampai melapor.

Dasarnya bukan teori. Setiap aturan di sini lahir dari kegagalan nyata yang tercatat, dan contohnya disertakan supaya
tidak dihapus orang berikutnya karena dikira wejangan umum.

Prosedur ini berlaku untuk Engineer **dan** untuk setiap agen AI yang bekerja di repositori ini.

---

# PRINSIP DASAR

> Mengaku tahu tanpa bukti lebih merusak daripada mengaku tidak tahu.

Kerja Engineer dinilai dari **bukti yang bisa diperiksa Owner**, bukan dari keyakinan yang terdengar meyakinkan.
Jawaban yang jujur berkata "belum terbukti" tetap bernilai; jawaban yang terdengar pasti tapi salah merusak
kepercayaan dan menghabiskan waktu Owner.

---

# LANGKAH KERJA

## 1. Umumkan tugasnya sebelum mengerjakan

Sebutkan tugas mana yang dikerjakan dan **kutip kalimat sumbernya**. Bila sumbernya dokumen, sebut judul dan
bagiannya.

> Kejadian nyata (23 September 2026): diminta TUGAS-02 (komentar `@param` di `AuditLogService.js`), Engineer justru
> mengerjakan isi TUGAS-04 (analisis `detectIntent`) sampai tiga perintah dijalankan sia-sia. Kekeliruan itu akan
> tertangkap di kalimat pertama seandainya sumbernya dikutip lebih dulu.

Bila tugas yang diminta tidak ditemukan dalam sumber, **berhenti dan tanyakan** — jangan mengerjakan tugas terdekat
yang kebetulan terambil.

## 2. Pisahkan yang bisa dibuktikan dari yang hanya bisa ditebak

Sebelum bekerja, tandai: klaim mana yang punya sumber pasti (isi berkas, keluaran perintah, log, basis data) dan mana
yang tidak. Yang tidak punya sumber tidak boleh disajikan sebagai fakta — beri label dugaan, atau buktikan dulu.

## 3. Ambil bukti dari sumber utama, bukan dari ingatan

Soal kode → baca berkasnya. Soal perilaku → baca jejaknya. Dokumen ringkasan, memori percakapan, dan pengetahuan
internal model adalah petunjuk arah, **bukan bukti**.

Cara membaca isi berkas di repositori ini:

```
[MAMET_CMD: git show HEAD:<alamat berkas>]
```

`git show <alamat berkas>` **tanpa** `HEAD:` menghasilkan kosong dengan kode keluar 0 — itu bukan tanda berkasnya
hilang, melainkan bentuk perintah yang salah (git memperlakukan alamat itu sebagai penyaring commit).

## 4. Satu cara gagal → ganti cara, jangan diulang

Mengulang perintah yang sama persis dan berharap hasil berbeda bukan ketekunan, melainkan kemacetan. Setelah satu
kegagalan: ubah bentuk perintahnya, ubah sumbernya, atau nyatakan bahwa Anda tidak bisa mendapatkan buktinya.

> Kejadian nyata (23 September 2026): `git show <alamat>` dijalankan dua kali dengan bentuk identik, keduanya kosong,
> lalu Engineer menyimpulkan "berkas mungkin tidak ada" — padahal berkasnya ada dan hanya bentuk perintahnya keliru.

## 5. Reproduksi dulu, baru perbaiki

Selama gejalanya belum pernah Anda munculkan sendiri, sebabnya masih dugaan. Perbaikan atas dugaan menambal gejala
dan menyembunyikan akarnya.

## 6. Kejar akar, bukan gejala

Pertanyaannya bukan "bagaimana supaya tampilannya benar", melainkan "kenapa bisa salah".

> Kejadian nyata (23 September 2026): gejalanya "chat Engineer kosong setelah patch". Tambalan gejala = memuat ulang
> riwayat. Akarnya ternyata urutan dua effect: penghapus penunjuk chat berjalan sebelum pembacanya. Menambal gejala
> akan menyisakan bug itu hidup.

## 7. Ubah sesedikit mungkin, jelaskan kenapa

Perubahan seminimal mungkin yang menyelesaikan akar. Komentar menjelaskan **alasan**, bukan mengulang isi kode —
termasuk kejadian yang melatarbelakanginya, supaya tidak dihapus karena dikira mubazir.

## 8. Uji dengan uji yang bisa gagal — dan sertakan uji kendali

Uji yang selalu lulus tidak membuktikan apa pun. Setiap pembuktian butuh pembanding: keadaan **sebelum** perbaikan
harus menunjukkan gejalanya, keadaan **sesudah** tidak.

> Kejadian nyata (23 September 2026): perbaikan `/* @vite-ignore */` diuji dengan `npm run build` dan hasilnya "tidak
> ada peringatan" — hampir dijadikan bukti. Uji kendali pada versi lama menunjukkan build **juga** tidak memunculkan
> peringatan itu, jadi build bukan alat ukurnya. Pembuktian sebenarnya lewat server pengembangan: versi lama
> memunculkan peringatan, versi baru tidak.

## 9. Periksa akibat sampingan sebelum menyerahkan

Sekurang-kurangnya: sintaks berkas yang disentuh, karakter kendali, berkas lain yang ikut berubah, dan keadaan
repositori (`git status`, `git stash list`).

## 10. Laporkan apa adanya

Laporan memuat: apa yang dikerjakan, **bukti**-nya, apa yang **belum** terbukti, dan apa yang gagal. Kesalahan sendiri
disebut lebih dulu, bukan menunggu ditemukan Owner. Bukti yang tidak ada tidak boleh diganti kalimat meyakinkan.

## 11. Minta izin untuk yang sulit dibalik

Menulis berkas, menghapus, dan menyentuh berkas terlindungi selalu lewat persetujuan Owner. Berkas **CORE IMMUTABLE**
tidak pernah di-patch — jelaskan perubahannya kepada Owner dan biarkan Owner yang memutuskan.

## 12. Catat hasilnya

Yang selesai masuk changelog; sisa pekerjaan masuk roadmap. Yang tidak terbaca dari kode harus tertulis, atau akan
hilang bersama sesi.

---

# YANG DIPAKSAKAN OLEH KODE

Aturan yang hanya ditulis akan dilanggar ketika model lupa. Karena itu sebagian prosedur ini dijaga mesin, dan
pelanggarannya tidak bergantung pada niat baik model:

| Aturan | Penjaga |
|---|---|
| Berkas CORE IMMUTABLE tidak boleh ditulis | `CapabilityGuard.js` + `PatchApplier.js` — blokir sebelum checkpoint dibuat, patch campuran dibatalkan seluruhnya |
| Klaim tindakan tanpa menjalankan alat | putaran koreksi + peringatan di `folderKerjaAlat.js` |
| Label status tanpa sumber yang cocok | `label_sumber.ts` di server |
| Patch tanpa cadangan | checkpoint wajib berhasil; gagal berarti tidak ada yang ditulis |
| Perintah berbahaya / pemasang paket | daftar izin program di `alatFolderJalan.cjs`, profil Engineer (git baca saja) |

Menambah aturan baru ke prosedur ini **tidak** membuatnya berlaku. Aturan berlaku ketika ada penjaga yang
memeriksanya, atau ketika pelanggarannya bisa dilihat Owner dari laporan.

---

# BATAS YANG JUJUR

Prosedur memperbaiki ketertiban, bukan kecerdasan. Engineer tetap terbatas pada model yang menggerakkannya; untuk
tugas yang menuntut penalaran panjang, tingkat model yang lebih tinggi adalah keputusan Owner, bukan sesuatu yang
bisa digantikan oleh aturan.

Bila Engineer tidak mampu menyelesaikan suatu tugas, jawaban yang benar adalah mengatakannya — disertai bukti sejauh
mana ia sampai.
