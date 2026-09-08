# [SELESAI] Architectural Decoupling & Memory Isolation for Mametlite

**Status:** ✅ **Selesai & Deployed ke Production (2026-09-08)** — lihat [`2026-09-08-fix-mametlite-memory-read-leak.md`](../project-memory/changelog/2026-09-08-fix-mametlite-memory-read-leak.md).
**Type:** Architectural Refactor / Critical Bug Fix
**Prioritas:** Tinggi — ini temuan kebocoran data privat antar sistem (Mamet Full vs Mametlite)

**Catatan implementasi:** solusi aktual TIDAK memakai hard-block `appSource !== 'mametlite'` eksplisit seperti diusulkan di bawah — arsitektur yang sudah berkembang di kode (flag `isMametLite` turunan `appSource`/`mode`, mengalir lewat objek `policy` di `execution_context.ts`) sudah menutup Temuan #2 (Context Override, via `memoryPriority: "balanced"`) dan #3 (Background Persistence Leakage, via `canWriteMemory: false` untuk LITE) sebelum audit ulang ini — hanya Temuan #1 (Memory Injection Leakage, via `canReadMemory`) yang masih perlu ditutup, diperbaiki dengan satu baris (`canReadMemory: ... ?? !isMametLite`), konsisten dengan pola yang sudah ada untuk flag policy lain.

## 📌 Deskripsi Masalah (Berdasarkan Audit Arsitektur)
Berdasarkan hasil investigasi forensik kode pada `agent-process/index.ts` dan `mametlite/src/lib/callAgentSimple.js`, ditemukan bahwa arsitektur **Mamet Full** dan **Mametlite** mengalami **Critical Architectural Coupling** (Keterikatan Arsitektur Level Kritis).

Meskipun Mametlite diiklankan sebagai versi ringan (*light system*) yang hanya berfokus pada RAG dan *Web Search*, secara fundamental ia memanggil *Edge Function* backend yang sama persis tanpa parameter pemisah batas (*boundary parameter*).

### 🚨 Temuan Kritis (Kebocoran Memori)
1. **Memory Injection Leakage:** Mametlite mengirimkan `userId` di *payload*. Begitu backend menerima `userId`, ia secara buta memanggil fungsi `retrieveMemories()` dan menyuntikkannya ke dalam `buildContextFusion()`.
2. **Context Override:** Di dalam `context_fusion.ts` terdapat aturan `Always prioritize memory over RAG`. Akibatnya, pencarian RAG murni di Mametlite terancam gagal karena dikalahkan oleh injeksi memori personal.
3. **Background Persistence Leakage:** Fungsi `processMemoryWriteQueue()` selalu dieksekusi di akhir *request*. Artinya, setiap kali user mengobrol di Mametlite, sistem secara diam-diam terus merekam fakta ke tabel `user_memories`.

---

## 🛠️ Solusi & Proposal Perbaikan (Refactoring Plan)

Untuk mencapai prinsip **Fully Isolated** tanpa harus memecah *Edge Function* menjadi dua direktori terpisah, kita akan menerapkan **Explicit Context Routing**:

### 1. Modifikasi Payload Frontend (`callAgentSimple.js`)
Mametlite wajib mengirimkan identitas *origin* secara eksplisit.
```javascript
  const payload = {
    message,
    tools: effectiveTools,
    model: 'gemini-2.5-flash',
    userId,
    userName,
    ragEnabled,
    appSource: 'mametlite', // <--- PENANDA ISOLASI BARU
    stream: true,
    history: history.slice(-5)
  };
```

### 2. Modifikasi Bypass Memori di Backend (`agent-process/index.ts`)
Baca parameter `appSource` dari *payload* dan blokir seluruh jalur akses memori jika asalnya dari Mametlite.
```typescript
let { message, tools, model, userId, userName, file, history, stream, appSource, ragEnabled } = await req.json();

// ...

// Bypass Memory Retrieval untuk Mametlite
let memoryArray = [];
if (appSource !== 'mametlite') {
    memoryArray = await retrieveMemories(finalMessage, userId, ...);
}

// ...

// Bypass Background Memory Writer untuk Mametlite
if (appSource !== 'mametlite' && ENABLE_ASYNC_MEMORY_WRITE) {
    await processMemoryWriteQueue(userId, finalMessage, supUrl, supKey).catch(e => console.error(e));
}
```

### 3. Pemisahan Ruang RAG (Opsional tapi Direkomendasikan)
Saat ini Mamet Full dan Mametlite berbagi tabel `documents`. Jika dokumen dari Mamet Full tidak ingin terbaca oleh Mametlite, tambahkan parameter `app_source` ke tabel `documents` dan sesuaikan filter RPC `match_documents` di `setup_rag.sql`.

---

## ✅ Kriteria Penerimaan (Acceptance Criteria) — Status per 2026-09-08
- [x] Pengguna Mametlite tidak mendapatkan injeksi memori personal di prompt LLM. — `canReadMemory: !isMametLite` di `execution_context.ts:36` (perbaikan sesi ini).
- [x] Obrolan di Mametlite tidak memicu penambahan data di tabel `user_memories`. — `canWriteMemory: false` untuk LITE mode, sudah ada sebelum sesi ini, dikonfirmasi benar-benar di-gate di `memory_subscriber.ts:8`.
- [ ] Koordinator LLM Mametlite bekerja jauh lebih cepat karena konteks *prompt* menjadi lebih bersih dan pendek. — belum diukur; secara logis seharusnya sedikit lebih cepat sekarang (satu panggilan `retrieveMemories()` lebih sedikit per request Mametlite), tapi belum ada benchmark before/after.
- [x] RAG menjadi fungsi tunggal yang absolut di Mametlite. — `memoryPriority: "balanced"` (bukan lagi `"memory_first"`) untuk Mametlite, sudah ada sebelum sesi ini; ditambah memori personal sekarang benar-benar tidak diambil sama sekali untuk Mametlite (bukan cuma kalah prioritas).

**Disusun oleh:** Forensic Runtime Auditor AI (tanggal asli tidak tercantum di dokumen sumber)

**Catatan migrasi:** dokumen ini sebelumnya tergabung dalam `PR_MAMETLITE.MD` di `_knowledge_archive/`, bersama 2 update lain (23 Juni 2026) yang topiknya berbeda dan sudah selesai/terverifikasi — dipisah ke `docs/project-memory/changelog/2026-06-23-execution-engine-stabilization-and-fail-fast-architecture.md`.
