# INDEX: Mamet OS Knowledge Archive

Folder ini berisi file-file yang sudah tidak digunakan lagi di production (dead code), tetapi disimpan sebagai "Pengetahuan Sejarah" agar Engineer Internal bisa belajar dari eksperimen masa lalu.

## 📂 Daftar Arsip (diverifikasi 2026-09-08)

| Folder / File | Deskripsi Singkat |
| :--- | :--- |
| [`00_EXPERIMENT_HISTORY.md`](./00_EXPERIMENT_HISTORY.md) | **Mulai dari sini.** Ringkasan tujuan, alasan ditinggalkan, dan kesimpulan tiap eksperimen — pengganti membaca kode mentah. |
| `lib_deprecated_cognition/` | Legacy Cognition Layer: 18 berkas lapisan kognitif deterministik tanpa LLM + 3 route API memori lama (`api_memory/`) + `_check_archived_deps.js`. |
| `rencana better stack.txt` | Catatan rencana observability stack versi lama. |
| `changelog/`, `handoff/`, `scripts/` | Folder kosong — tidak berisi berkas terlacak git. |

> [!NOTE]
> **Koreksi 2026-09-08:** Versi sebelumnya mendaftarkan `api/`, `graphify-out/`, `lib/`, `mametlite/`, `scratch/`, `frontend_*.js/cjs`, `*.sql`, `*.py`, dan `*.txt` sebagai isi arsip. Entri-entri tersebut **tidak akurat** — folder/berkas itu tidak ada di sini (`graphify-out/` justru berada di root proyek, bukan di arsip). Daftar di atas mencerminkan isi yang benar-benar terlacak git.

> **Instruksi untuk Engineer Internal:**
> Jangan gunakan kode mentah dari folder ini sebagai referensi produksi. **Baca [`00_EXPERIMENT_HISTORY.md`](./00_EXPERIMENT_HISTORY.md)** untuk memahami apa yang pernah dicoba dan mengapa ditinggalkan — berkas itu dirancang agar Anda tidak perlu membuka kode usang sama sekali. Jangan pernah menyalin (copy-paste) kode dari arsip ini ke produksi.