# 00_EXPERIMENT_HISTORY — Ringkasan Eksperimen Arsip

**Dibuat:** 2026-09-08
**Tujuan:** Memberi Engineer internal (dan AI mana pun) pemahaman ringkas tentang arsitektur masa lalu **tanpa perlu membaca kode usang**. Baca berkas ini saja; jangan membaca kode raw di dalam `lib_deprecated_cognition/`.

> [!IMPORTANT]
> Berkas di folder ini **sudah tidak aktif**. Tidak ada satu pun yang di-import oleh kode produksi (diverifikasi 2026-09-01, lihat `lib_deprecated_cognition/README.md`). Jangan menyalin pola dari sini ke kode aktif tanpa alasan kuat — arsitektur aktif sudah berbeda.

---

## Klaster 1 — Legacy Cognition Layer (18 berkas + 3 route API)

**Periode:** dikembangkan sebelum Agustus 2026 · upaya arsip pertama 2026-08-05 · diarsipkan tuntas 2026-09-01
**Lokasi:** `lib_deprecated_cognition/`

**Tujuan.** Membangun lapisan kognitif berlapis yang **sepenuhnya deterministik tanpa LLM** untuk memutuskan memori mana yang layak dikirim ke model. Gagasannya: alih-alih menyerahkan penilaian relevansi ke LLM (mahal dan tidak konsisten), sistem menghitung sendiri *truth score* tiap memori lewat rantai pipeline `Memory Engine → Memory Governor → OCB → Decision Engine`, dengan hierarki arbitrase ketat `CMG > TSE > G-CFL > Decision Engine > Behavior > Memory`. Setiap berkas sengaja dibatasi satu tanggung jawab dan dilarang mengambil keputusan di luar perannya (mis. `truthGraphMemory.ts` hanya menyimpan graf, tidak boleh memutuskan kebenaran; `memoryGovernor.ts` hanya menyaring dan memeringkat, tanpa otoritas final).

**Masalah / Alasan ditinggalkan.** Lapisan ini **tidak gagal secara teknis** — ia ditinggalkan karena *duplikasi tanggung jawab* dan biaya pemeliharaan. Arsitektur runtime baru (MAEF Kernel + Service layer) memindahkan fungsi yang sama ke dua service yang lebih sederhana dan terintegrasi dengan Supabase secara langsung, sehingga 18 berkas ini menjadi jalur mati yang tetap harus dirawat. Jejak penonaktifannya masih terlihat pada `memoryStabilityCore.ts` yang mengekspor sakelar mati `LEGACY_COGNITION_ENABLED = false` sebelum akhirnya diarsipkan seluruhnya.

**Kesimpulan.** Digantikan oleh:
- `frontend/src/core/runtime/services/CognitiveMemoryGovernorService.js` — pengganti seluruh berkas cognitive layer (filter memori berbasis `truth_score` sebelum prompt injection).
- `frontend/src/core/runtime/services/MemoryGovernorService.js` — mengakses Supabase langsung, tidak lagi lewat `memoryEngine.ts`.

**Gagasan yang tetap hidup di arsitektur aktif:**
- Konsep `truth_score` sebagai penyaring memori → dipertahankan di `CognitiveMemoryGovernorService.js`.
- Prinsip satu berkas satu tanggung jawab → menjadi prinsip payung "One File, One Responsibility" di `docs/roadmap/INDEX-ROADMAP.md`.
- Pemisahan penyimpanan memori vs otoritas keputusan → menjadi pemisahan Memory vs RAG/Knowledge di PR#9.

**Rincian peran per berkas (untuk rujukan cepat, tanpa perlu membuka kodenya):**

| Kelompok | Berkas | Peran singkat |
|---|---|---|
| Input & Intent | `intentPreprocessor.ts`, `semanticBridge.ts` | Normalisasi input, deteksi intent semantik, dan deteksi gaya bahasa (formal/slang, berbasis daftar kata Indonesia). Dilarang mengakses memori. |
| Penyimpanan memori | `memoryEngine.ts`, `shortTermMemory.ts`, `truthGraphMemory.ts`, `supabaseClient.ts` | Baca/tulis memori ke Supabase, buffer percakapan sesi (tanpa tulis DB), dan Truth Graph Memory Layer (TGML) sebagai graf node–edge murni. |
| Penilaian kebenaran | `truthScorer.ts`, `truthScoringEngine.ts` | Hitung ulang `truth_score` per kunci; TSE menilai multi-sinyal (source, structure, semantic, cross_source) menjadi label `TRUSTED`/`LATENT`/`REJECTED`. |
| Penyaringan & ranking | `memoryGovernor.ts`, `cognitiveMemoryGovernor.ts`, `ocb.ts` | Buang memori bernilai `truth_score < 0.3`, peringkat sisanya; CMG sebagai gerbang terakhir sebelum LLM; OCB memampatkan konteks ke maksimal 3 item demi hemat token. |
| Keputusan & orkestrasi | `decisionEngine.ts`, `singleCognitiveCore.ts`, `unifiedCognition.ts`, `globalCognitionLoop.ts`, `contextUnifier.ts` | Menyusun prompt final, arbitrase antar-engine (SCC), otak eksekutif pusat (UCL), dan tinjauan mandiri sebelum output dikirim (G-CFL). |
| Perilaku pengguna | `behaviorMemoryEngine.ts` | Melacak preferensi gaya interaksi (formal/casual/technical) sebagai cache sesi, tanpa Supabase maupun LLM. |
| Stabilitas | `memoryStabilityCore.ts` | Perawatan TGML di latar belakang; memuat sakelar `LEGACY_COGNITION_ENABLED = false`. |
| Route API mati | `api_memory/read.ts`, `write.ts`, `override.ts` | Endpoint `/api/memory/{read,write,override}` versi Node.js lama. Nol pemanggil saat diverifikasi. |
| Utilitas arsip | `_check_archived_deps.js` | Script deteksi sisa import ke `lib/`, dibuat saat upaya arsip pertama (2026-08-05). |

---

## Catatan Konsistensi Arsip

Beberapa dokumen roadmap lama (`docs/roadmap/roadmap-lanjutan.md` §1.1) menyebut berkas eksperimen bernama `chaos_memory_v3.ts`, `memory_hardening_v2.ts`, `semantic_memory_v4.ts`, serta folder `scratch/` dan `mametlite/` sebagai kandidat arsip. **Berkas dan folder tersebut tidak ada di arsip ini** — kemungkinan dihapus permanen, tidak pernah dibuat, atau bernama lain. Isi arsip yang benar-benar terlacak di git hanyalah Klaster 1 di atas, `00_INDEX.md`, dan `rencana better stack.txt`.

Folder kosong `changelog/`, `handoff/`, dan `scripts/` masih ada di disk tetapi **tidak berisi berkas apa pun** yang terlacak git.
