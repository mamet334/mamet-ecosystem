# 19 Oktober 2026 — seluruh aplikasi memakai palet LampLogin (Item 127, Tahap 3)

Item 127 ([`ROADMAP-TAMPILAN-MENU-GAME.md`](../../roadmap/ROADMAP-TAMPILAN-MENU-GAME.md)), bagian palet Tahap 3.
Permintaan Owner: *"sesuaikan atau samakan warnanya agar sama dengan tema lamblogin"*.

## Hasil

Aplikasi punya **dua sistem warna**: 47 token gaya Material (568 pemakaian) dan `slate-*` mentah (615 pemakaian).
Keduanya abu-abu kebiruan dengan cahaya biru `#0052ff`, berlawanan dengan ruangan kayu dan lampu emas di layar
masuk. Perbaikannya **di sumbernya**, bukan di 1.183 tempat pemakaian:

| Berkas | Perubahan |
|---|---|
| `frontend/tailwind.config.js` | nilai 47 token diganti palet LampLogin; skala `slate` 50–950 **ditimpa** ke kayu-krem, jadi 615 pemakaian `slate-*` ikut tanpa disentuh |
| `frontend/src/index.css` | latar & teks `body`, `.glass-panel`, `.rim-light`, `.input-etched`, `.btn-glow`, sorotan sentuh — cahaya biru → emas lampu |
| `frontend/src/main.jsx` | layar panik boot ikut ruangan kayu; **merah galat dipertahankan** |

Palet diambil dari `LampLogin.jsx`, bukan dikarang: latar `#0b0806`, emas lampu `#f0ca6d`, krem `#f3e7d3`
(diredam dari `#fff8ec`), kayu `#3e2b1b`. Warna galat sengaja tidak dihangatkan. `LampLogin.jsx` tidak berubah
(uji penjaga hash lulus).

## Kontras diukur (WCAG 2.2 AA)

Terendah: `slate-500` di `slate-900` **4,88:1** (dulu `slate-500` lama **3,77:1, gagal**). Teks utama di latar
16,34:1; emas di latar 12,72:1; garis 5,19:1.

## Uji

`uji-palet-lamplogin.mjs` v1 (baru) menjaga **sifat** palet, bukan kode hex-nya: setiap warna non-galat hangat
(merah ≥ hijau ≥ biru), 15 pasangan kontras, latar & aksen bersumber dari LampLogin, galat tetap merah, tak ada
biru `#0052ff` tersisa di `index.css`. Enam mutasi dibuktikan menggigit. Angka ciri tampilan generik
(`uji-ciri-tampilan`) tidak naik. Suite 107/107.

## Penilaian Owner — belum selesai

Owner: *"sama sih tapi kurang nyaman di mata"*. Palet ini disimpan sebagai **titik pulih**; kenyamanan mata
dikerjakan sesudahnya sebagai percobaan terpisah. Dugaan penyebab (urut dari terberat): simbol markdown tampil
mentah (`**`, `| tabel |`) karena jawaban ditampilkan sebagai teks polos; kontras teks 16:1 terlalu tajam untuk
tema gelap; terlalu banyak garis tepi terang; jarak baris di kolom lebar.
