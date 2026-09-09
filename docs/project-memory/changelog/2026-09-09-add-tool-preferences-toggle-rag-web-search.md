# Changelog: Fitur Baru — Toggle Preferensi Tool (RAG & Web Search)

**Tanggal:** 2026-09-09
**Status:** ✅ Selesai — build production sukses; verifikasi runtime *live* belum dilakukan (lihat §5)
**Scope:** `frontend/src/core/runtime/services/ToolPreferencesService.js` (baru), `Kernel.js`, `AssistantService.js`, `Settings.jsx`

---

## 1. Latar Belakang

Owner menemukan dialog "Human-in-Command" untuk web search (`WebComparisonService.js`) membingungkan karena selalu muncul tiap kali, tanpa cara untuk mengatur default perilakunya. Diskusi lanjutan mengarah ke kebutuhan sistem toggle per-tool yang lebih umum — dimulai dari RAG (pengetahuan yang akan di-upload sendiri oleh Owner, fitur upload belum ada) dan Web Search, dengan skema yang bisa diperluas ke tool lain (`deep_research`, `memory_manager`, `file_reader`) di masa depan tanpa mengubah struktur data.

Skema dirancang dan didiskusikan dulu dengan Owner sebelum implementasi (lihat riwayat percakapan) — dua keputusan desain yang dikonfirmasi Owner:
1. Web Search: 2 status (on/off), bukan 3 status. On = dicari otomatis tanpa dialog konfirmasi (`autoConfirm: true`). Off = tidak pernah dicari.
2. Cakupan: default global + override opsional per workspace.

## 2. Yang Dibangun

### 2.1 `ToolPreferencesService.js` (baru)
Service baru, terdaftar di `Kernel.js` Phase 3 (setelah `SemanticContextService`). Menyimpan:
- `globalDefaults: { rag: boolean, web_search: boolean }`
- `workspaceOverrides: { [workspaceId]: { [toolName]: boolean } }`

Disimpan di `localStorage` (key `mamet:toolPreferences`) — preferensi per-perangkat, tidak disinkron ke server. Method utama: `getEffective(workspaceId, toolName)` (override workspace > default global), `setGlobalDefault()`, `setWorkspaceOverride()` (nilai `null` = hapus override, ikut default lagi), `listToolNames()` (untuk render UI generik tanpa hardcode daftar tool).

### 2.2 Wiring ke `AssistantService.js` (`_handleConversation`)
- `ragToolEnabled` dan `webSearchToolEnabled` dihitung dari `ToolPreferencesService.getEffective(workspaceId, ...)` sebelum memanggil `RetrievalOrchestrator.retrieve()`.
- `enableWebComparison`/`autoConfirmWebSearch` yang sebelumnya hardcode `true`/`false` sekarang mengikuti `webSearchToolEnabled` (dua-duanya, karena keputusan Owner: on = auto-confirm).
- `ragEnabled` di payload ke Edge Function (sebelumnya hardcode `true`) sekarang mengikuti `ragToolEnabled`.
- **Keterbatasan arsitektur yang disengaja (bukan bug):** karena `RetrievalOrchestrator.retrieve()` mengeskalasi Tier 1→2→3 secara berurutan (Tier 3 web search hanya terpicu setelah Tier 1/2 dicoba lebih dulu), mematikan RAG (`ragToolEnabled=false`) menyebabkan seluruh pemanggilan `retrieve()` di-skip — termasuk Tier 3 web search — walau `web_search` sedang `enabled: true`. Artinya kombinasi "RAG off + Web Search on" saat ini berperilaku sama seperti "keduanya off" (LLM murni, tanpa web). Ini didiskusikan sebagai edge case yang jarang dipakai; memisahkannya butuh restrukturisasi `RetrievalOrchestrator` agar Tier 3 bisa dipanggil independen dari Tier 1 — di luar scope perubahan ini.
- Dua payload lain yang sudah hardcode `ragEnabled: false` (mode LOOKUP baris ~407, mode SKILL baris ~548) **tidak diubah** — keduanya bukan bagian dari alur chat umum yang jadi target toggle ini.

### 2.3 UI — dua tempat

**`Settings.jsx`** (konfigurasi, dikunjungi sesekali): section "Tools & Capabilities" —
- Toggle default global untuk tiap tool dari `listToolNames()` — otomatis render `rag` dan `web_search`, dan tool baru di masa depan tanpa ubah UI.
- Tabel override per workspace (`ws-assistant`, `ws-lite`, `ws-engineer`) — dropdown "Ikuti Default" / "Nyalakan" / "Matikan" per kombinasi workspace×tool.

**`ConversationEngine.jsx`** (Session Toolbar, di dalam sesi chat — **koreksi dari desain awal**): Owner mengoreksi bahwa toggle cuma di Settings kurang praktis karena harus bolak-balik keluar dari chat. Ditambahkan 2 tombol chip "RAG"/"Web" langsung di toolbar chat (sebelah tombol riwayat & percakapan baru), yang:
- Menampilkan nilai *efektif* untuk workspace yang sedang aktif (`osState.workspaceId`) — override kalau ada, kalau tidak ikut default global.
- Klik langsung menulis **override untuk workspace ini** (`setWorkspaceOverride`), bukan mengubah default global — supaya cepat tanpa perlu pindah ke Settings, dan tidak sengaja mengubah workspace lain.
- Settings.jsx tetap berguna untuk mengatur default global lintas-workspace di awal, tombol chat untuk penyesuaian cepat harian per sesi.

## 3. Catatan Penting untuk Owner (soal ekspektasi RAG)

RAG di sini murni gerbang untuk `RetrievalOrchestrator` (Tier 1: pencarian dokumen pengetahuan yang di-upload Owner — fitur upload belum ada, jadi basis pengetahuannya kosong untuk saat ini). Ini **tidak** memengaruhi pengetahuan bawaan Engineer (`engineer.js` `_loadStaticKnowledge()` / Brain 1 — constitution, ADR, aturan enjinering) yang dimuat lewat jalur terpisah dan selalu aktif untuk mode ENGINEER, tidak peduli toggle RAG ini di-set apa. Sudah dikonfirmasi ke Owner sebelum implementasi.

## 4. File yang Diubah/Ditambah

- `frontend/src/core/runtime/services/ToolPreferencesService.js` — **baru**
- `frontend/src/core/runtime/Kernel.js` — import + registrasi service baru
- `frontend/src/core/runtime/services/AssistantService.js` — wiring `ragToolEnabled`/`webSearchToolEnabled` ke `_handleConversation`
- `frontend/src/components/Settings.jsx` — section UI "Tools & Capabilities" (default global + tabel override)
- `frontend/src/components/workbench/ConversationEngine.jsx` — toggle chip RAG/Web langsung di Session Toolbar chat (override per-workspace cepat)
- `docs/roadmap/INDEX-ROADMAP.md` — Backlog Item baru didaftarkan

## 5. Verifikasi & Keterbatasan

**Sudah diverifikasi:**
- `npm run build`: sukses, 31.07s, 0 error.
- Alur baca kode ditelusuri manual: `getEffective()` dipanggil dengan `workspaceId` yang benar (parameter yang sudah ada di `_handleConversation`), tidak ada typo nama field antara `ToolPreferencesService` dan pemanggilnya.

**Belum diverifikasi (perlu Owner cek langsung di `npm run desktop`, sesuai Anti-Hallucination Protocol):**
- Toggle di Settings benar-benar mengubah perilaku Engineer/Assistant secara live (matikan Web Search lalu cek dialog konfirmasi tidak muncul lagi; matikan RAG lalu cek `ragEnabled: false` di payload — bisa dicek lewat Network tab atau console log `PR#9 RetrievalOrchestrator` yang seharusnya tidak muncul sama sekali saat RAG off).
- Preferensi tersimpan dan terbaca kembali dengan benar setelah reload aplikasi (localStorage persistence).
- Override per-workspace benar-benar dipakai (bukan cuma default global) saat pindah antar ws-assistant/ws-lite/ws-engineer.
