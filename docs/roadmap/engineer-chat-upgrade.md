# 🧠 Engineer Chat Upgrade — Seperti Antigravity

**Tanggal:** 2026-08-07
**Status:** ✅ Diimplementasikan — diverifikasi terhadap kode aktual 2026-09-08

> [!NOTE]
> **Rekonsiliasi 2026-09-08:** Perilaku yang dijelaskan dokumen ini terbukti akurat, namun **lokasi implementasinya sudah berpindah** sejak dokumen ditulis. Deteksi marker `[MAMET_PATCH_READY]` kini berada di `AssistantService.js:846–847` dan `:919–921` (bukan lagi di `ConversationEngine.jsx`); `ConversationEngine.jsx` kini hanya merender tombol Apply Patch berdasarkan flag `hasPatchProposal` (`:1234–1252`). Lihat koreksi rinci di bagian "Perubahan yang Dilakukan".

---

## Latar Belakang

Engineer mode sebelumnya sangat kaku — setiap pesan langsung memicu pipeline patch
(keyword matching → capability guard → reasoning lock → patch → approval).
User tidak bisa ngobrol natural, tanya tentang codebase, atau minta analisis tanpa
langsung memicu pipeline yang panjang dan sering gagal di capability check.

Yang diinginkan: **Engineer bisa ngobrol seperti Antigravity** — menjawab pertanyaan
secara alami, memberikan analisis dengan pengetahuan arsitektur (ADR, Two-Brain), dan
**hanya trigger patch pipeline ketika user setuju untuk apply**.

---

## Root Cause Masalah Lama

Di `ConversationEngine.jsx` baris 495–529, ada early-return:
```js
if (isEngineerMode && kernel.status === 'RUNNING') {
  eventBus.emit('Engineer:GeneratePatch', {...});
  return;  // ← Ini yang membuat LLM tidak pernah dipanggil
}
```

Padahal Supabase backend sudah punya system prompt Engineer yang kaya:
- **Two-Brain Model** (Brain 1: ADR/Rules statis, Brain 2: Tasks/Gaps dinamis)
- MAEF compliance checking
- Confidence reporting
- Context dari `project_memory_entries`, `engineering_tasks`, `architecture_gaps`

Tapi system prompt itu tidak pernah dipakai karena LLM tidak pernah dipanggil di Engineer mode.

---

## Arsitektur Baru

```
User kirim pesan di ws-engineer
        ↓
Supabase LLM dipanggil (ENGINEER mode + Two-Brain system prompt)
        ↓
LLM merespons natural: ngobrol, analisis, atau propose patch
        ↓
Apakah respons mengandung marker [MAMET_PATCH_READY]?
  ├─ TIDAK → tampilkan respons teks biasa (selesai)
  └─ YA    → tampilkan tombol "Apply Patch"
                ↓ (user klik Apply)
           Engineer:GeneratePatch di-emit
                ↓
           engineer.js: Reasoning Lock → patch → approval → apply
```

**Opsi dipilih: Opsi A** — Reasoning Lock tetap dipertahankan setelah user klik Apply.

---

## Perubahan yang Dilakukan

### 1. `engineer_context.ts` — Tambah Rule 5

Instruksi ke LLM tentang cara mengakhiri proposal patch dengan marker `[MAMET_PATCH_READY]`.
LLM sekarang tahu: kalau mau propose code change, jelaskan dulu, tunjukkan kode yang akan diubah,
lalu tutup dengan marker supaya frontend bisa deteksi dan tampilkan tombol Apply.

### 2. `ConversationEngine.jsx` — 3 perubahan

a. **Hapus early-return** — Engineer mode tidak lagi memotong alur ke LLM.
b. **Tambah patch detector** — setelah LLM merespons, cek ada `[MAMET_PATCH_READY]`.
c. **Tambah Apply Patch button** — di pesan yang mengandung patch proposal.

> **Koreksi lokasi kode (verifikasi 2026-09-08):**
> - (a) ✅ Terverifikasi — early-return sudah tidak ada. `Engineer:GeneratePatch` kini hanya dipancarkan satu kali di `ConversationEngine.jsx:1240`, yaitu di dalam handler klik tombol Apply Patch, bukan sebagai pemotong alur sebelum LLM dipanggil.
> - (b) ⚠️ **Pindah lokasi** — patch detector kini berada di `AssistantService.js:846–847` (jalur streaming) dan `:919–921` (jalur non-streaming). Keduanya menghapus marker dari teks lalu menyetel flag `hasPatch`/`hasPatchProposal`.
> - (c) ✅ Terverifikasi — tombol Apply Patch dirender di `ConversationEngine.jsx:1234–1252` berdasarkan flag `m.hasPatchProposal`.

---

## Format Patch Proposal LLM

LLM Engineer diinstruksikan untuk mengakhiri setiap patch proposal dengan:
```
[MAMET_PATCH_READY]
```

Contoh respons LLM yang akan trigger tombol Apply:
```
Berdasarkan analisis saya, `Settings.jsx` perlu diupdate di bagian handleTestConnection.

Perubahan yang diusulkan:
```js
// Sebelum:
body: JSON.stringify({ apiKey: aiKey })

// Sesudah:
headers: { [`x-byok-${aiProvider}`]: aiKey }
```

[MAMET_PATCH_READY]
```

Frontend mendeteksi marker ini → hapus marker dari tampilan → tampilkan tombol ⚙️ Apply Patch.
