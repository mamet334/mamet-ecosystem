# ROADMAP MAMET OS ECOSYSTEM: FASE FINALISASI
**Filosofi Utama:** *"Ringan, Bebas, dan Tangguh seperti Linux"*

**Status keseluruhan:** ✅ Sebagian besar selesai — diverifikasi terhadap kode aktual 2026-09-08

> [!NOTE]
> **Rekonsiliasi 2026-09-08:** Dokumen ini semula ditulis sebagai proposal tanpa penanda status sama sekali, padahal 3 dari 4 fase ternyata sudah diimplementasikan. Status per fase kini ditambahkan berdasarkan verifikasi langsung ke kode.
>
> | Fase | Status |
> |---|---|
> | 1. Cleanup & Konsolidasi | ⚠️ Sebagian — arsip ada, berkas ringkasan eksperimen belum |
> | 2. Anti-Kernel Panic (Graceful Degradation) | ✅ Selesai (2.1 & 2.2) |
> | 3. Pencegahan AI Coding Berbahaya | ⚠️ Sebagian — 2 aturan belum ditambahkan |
> | 4. Observability UI | ⚠️ Sebagian — 4.1 selesai, 4.2 belum |

---

## FASE 1: CLEANUP & KONSOLIDASI KODE ("Spring Cleaning") — ⚠️ SEBAGIAN SELESAI
**Tujuan:** Menghilangkan *noise* (gangguan) dari folder proyek agar *Engineer* AI tidak membaca data usang dan Vercel build menjadi lebih cepat.

### 1.1 Strategi Pengarsipan Pengetahuan (Bukan Menghapus)
Karena *Engineer* internal butuh belajar dari masa lalu, kita tidak akan menghapus file, tapi **memindahkannya ke folder `_knowledge_archive/`**.
1. Buat folder `_knowledge_archive/` di root proyek.
2. **Pindahkan folder:** `scratch/`, `mametlite/`.
3. **Pindahkan file mesin memori usang:** `chaos_memory_v3.ts`, `memory_hardening_v2.ts`, `behaviorMemoryEngine.ts`, `semantic_memory_v4.ts`.
4. **Pindahkan script audit/tes sekali pakai:** `check_agent_logs.js`, `check_db.js`, `audit_supabase.mjs`, `convert_pdf.mjs`, `fix_memory.js`, `read_pdf.js`, `test_groq.js`, `test_rag.mjs`, `test_health.js`, `python.py`, `python1.py`, dll.

### 1.2 Membuat Indeks Pengetahuan (Knowledge Distillation) — ❌ BELUM
> **Verifikasi 2026-09-08:** Folder `_knowledge_archive/` **sudah ada** beserta isinya (`changelog/`, `handoff/`, `lib_deprecated_cognition/`, `scripts/`, `mametlite/`, dll) sehingga §1.1 terpenuhi. Namun berkas indeksnya bernama `00_INDEX.md`, dan isinya berupa **inventaris folder** — bukan ringkasan 1–2 paragraf per eksperimen gagal seperti yang dispesifikasikan di bawah. Distilasi pengetahuan ini masih menjadi gap terbuka.

Agar AI tidak bingung membaca kode usang, buatlah satu file `_knowledge_archive/00_EXPERIMENT_HISTORY.md`. Isinya adalah ringkasan 1-2 paragraf untuk setiap eksperimen yang gagal.
> *Contoh:* "Semantic Memory v4: Dikembangkan pada Juli 2026. Tujuan: Menggantikan memoryEngine dengan grafik berbasis vektor. Masalah: Memory leak parah di lingkungan browser. Kesimpulan: Dibatalkan."

---

## FASE 2: IMPLEMENTASI ANTI-KERNEL PANIC (GRACEFUL DEGRADATION) — ✅ SELESAI
**Tujuan:** Memastikan Mamet OS **tidak crash total** (layar merah) saat satu layanan gagal, melainkan masuk ke mode *Degraded* (terbatas) yang bisa dipulihkan.

### 2.1 Modifikasi `_handleBootFailure()` di `Kernel.js` — ✅ SELESAI
> **Verifikasi 2026-09-08:** Terimplementasi di `frontend/src/core/runtime/Kernel.js:611–617` — `this.status = 'DEGRADED'`, `this.config.mode = 'SAFE_MODE'`, dan emit `System:Degraded`, persis seperti rancangan di bawah. Log mode degradasi ada di `:143`.
Ganti logika `throw error` menjadi pemancaran status `DEGRADED` ke sistem agar OS tetap jalan.

**Kode yang harus diterapkan:**
```javascript
// Di dalam Kernel.js
async _handleBootFailure(error) {
  this.status = 'DEGRADED'; // Ubah dari 'ERROR' ke 'DEGRADED'
  this.config.mode = 'SAFE_MODE';
  this.log('ERROR', 'Entering SAFE_MODE due to failure', error);

  // Emit event untuk UI agar menampilkan notifikasi, BUKAN layar crash!
  this._emitEvent(this.serviceManager, 'System:Degraded', { 
    reason: error.message, 
    phase: this.currentPhase,
    severity: 'critical'
  });

  // Biarkan kernel tetap "running" dalam mode degradasi
  this.status = 'RUNNING';
}
```

### 2.2 Pasang "Circuit Breaker" (Pemutus Sirkuit) di `engineer.js` — ✅ SELESAI
> **Verifikasi 2026-09-08:** Terimplementasi di `frontend/src/core/runtime/services/engineer.js:1389–1398` — penghitung `_apiCallCount`, reset per 60 detik, dan pemutusan pada ambang 5 panggilan per menit, sesuai rancangan di bawah.
Ini mencegah AI memanggil API tak terbatas (loop) yang menyebabkan saldo OpenRouter habis.

**Kode yang harus ditambahkan di bagian awal `_handlePatchTask()`:**
```javascript
// --- CIRCUIT BREAKER: Cegah Panggilan API Berlebih ---
if (!this._apiCallCount) this._apiCallCount = 0;
this._apiCallCount++;

const now = Date.now();
if (now - this._lastApiReset > 60000) { // Reset hitungan setiap 1 menit
  this._apiCallCount = 1;
  this._lastApiReset = now;
}

if (this._apiCallCount > 5) { // Maks 5 panggilan per menit
  console.error('[Engineer] 🚨 CIRCUIT BREAKER TRIPPED! API Limit Exceeded.');
  this.capability = 'OBSERVER';
  this.eventBus.emit('System:Error', { message: 'Loop detected! AI Suspended.' });
  return; // Hentikan proses!
}
// --- END CIRCUIT BREAKER ---
```

---

## FASE 3: SISTEM PENCEGAHAN AI CODING BERBAHAYA & BIAS — ⚠️ SEBAGIAN SELESAI
**Tujuan:** Mencegah AI (Otak Pinjaman) menulis kode yang merusak sistem core atau terjebak dalam *Hallucination* (halusinasi).

### 3.1 Memperketat ATURAN KODE dalam `_buildPatchPrompt()` — ⚠️ SEBAGIAN
> **Verifikasi 2026-09-08:** Blok `### ATURAN KODE (WAJIB DIPATUHI) ###` sudah ada di `engineer.js:2483–2491`, mencakup 3 dari 4 aturan di bawah: larangan `eval()`/`new Function()` (`:2488`), larangan panggil API vendor langsung (`:2490`), dan larangan modifikasi file core Kernel/EventBus/ServiceManager (`:2491`).
>
> **Belum ada (gap terbuka):**
> 1. Larangan menambahkan `eventBus.emit("Engineer:GeneratePatch", ...)` di file yang diubah (proteksi anti *infinite loop*).
> 2. Larangan membaca kode raw dari `_knowledge_archive/` (hanya boleh baca berkas ringkasan) — bergantung pada §1.2 yang juga belum selesai.
Di dalam `engineer.js` -> `_buildPatchPrompt`, perkuat bagian **`### ATURAN KODE (WAJIB DIPATUHI) ###`** dengan instruksi berikut (ini adalah pancingan untuk mencegah AI membuat patch berbahaya):

```text
- DILARANG KERAS memodifikasi file core: Kernel.js, EventBus.js, ServiceManager.js, StorageManager.js.
- DILARANG KERAS menambahkan kode yang memanggil `eventBus.emit("Engineer:GeneratePatch", ...)` di file yang Anda ubah (untuk mencegah infinite loop).
- DILARANG KERAS menggunakan `eval()`, `new Function()`, atau memanggil API vendor (OpenAI, Gemini) secara langsung tanpa Adapter Layer.
- Sebelum menulis kode, Anda HANYA boleh membaca `_knowledge_archive/00_EXPERIMENT_HISTORY.md` (ringkasan eksperimen). Jangan membaca kode raw dari folder `_knowledge_archive`.
```

### 3.2 Maksimalkan `VerificationEngine`
Sistem `VerificationEngine.js` yang sudah Anda buat adalah tameng utama. Pastikan fungsinya `verifyPatchEngineering()` dijalankan sebelum mengeksekusi patch apa pun. Jika *VerificationEngine* menemukan pelanggaran MAEF (seperti mencoba modifikasi Kernel atau menggunakan `eval`), **patch otomatis ditolak dan AI menerima feedback langsung**.

---

## FASE 4: OBSERVABILITY UI (SISTEM NOTIFIKASI INTERNAL) — ⚠️ SEBAGIAN SELESAI
**Tujuan:** Memberikan visibilitas penuh kepada User mengenai status OS dan error tanpa harus membuka *Console Web* (DevTools/F12).

### 4.1 Buat Komponen `SystemNotificationCenter.jsx` — ✅ SELESAI
> **Verifikasi 2026-09-08:** Komponen ada di `frontend/src/components/os/SystemNotificationCenter.jsx` (listener `System:Degraded` `:51` dan `System:Error` `:56`) dan sudah terpasang di `OSDesktopShell.jsx:26`.
Ini adalah komponen React yang dipasang di dalam `OSDesktopShell.jsx` (pojok layar). Komponen ini otomatis menangkap event `System:Error` atau `System:Degraded` dari Kernel.

**Kode Komponen Notifikasi:**
```jsx
import React, { useEffect, useState } from 'react';
import { useService } from '../../core/runtime/hooks/useService.js';

export const SystemNotificationCenter = () => {
  const serviceManager = useService(); 
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!serviceManager) return;
    const eventBus = serviceManager.get('EventBus');
    if (!eventBus) return;

    const handleSystemEvent = (eventData) => {
      setNotifications(prev => [
        {
          id: Date.now(),
          message: eventData.reason || 'Terjadi kesalahan sistem',
          severity: eventData.severity || 'warning',
          phase: eventData.phase
        },
        ...prev
      ].slice(0, 10)); // Batasi 10 notifikasi terbaru
    };

    eventBus.on('System:Degraded', handleSystemEvent);
    eventBus.on('System:Error', handleSystemEvent);

    return () => {
      eventBus.off('System:Degraded', handleSystemEvent);
      eventBus.off('System:Error', handleSystemEvent);
    };
  }, [serviceManager]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-black/80 border border-red-500/50 text-white p-4 rounded-lg shadow-2xl backdrop-blur-sm">
      <h3 className="text-red-400 font-bold mb-2 text-sm uppercase tracking-wider">⚠️ System Degraded</h3>
      {notifications.map(notif => (
        <div key={notif.id} className="mb-2 text-xs font-mono bg-white/10 p-2 rounded border-l-4 border-red-400">
          <p className="text-red-300">Error: {notif.message}</p>
          {notif.phase && <p className="text-gray-400 opacity-70">Phase: {notif.phase}</p>}
        </div>
      ))}
    </div>
  );
};
```
*(Masukkan komponen ini ke `OSDesktopShell.jsx` Anda agar selalu aktif di layar).*

### 4.2 Bangun "System Diagnostic App" — ❌ BELUM
> **Verifikasi 2026-09-08:** Tidak ada aplikasi `SystemLogsApp` (atau sejenisnya) yang terdaftar di *AppRegistry*. Fungsi `kernel.getHealth()` sudah tersedia (`Kernel.js:647`, dengan `getLogs()` yang menggabungkan `health.errors` + `health.warnings` di `:430`) dan saat ini hanya dirender di `Settings.jsx:19,37`. Aplikasi "Event Viewer" tersendiri seperti spesifikasi di bawah masih menjadi gap terbuka.

Buat sebuah aplikasi di dalam *AppRegistry* (misalnya bernama `SystemLogsApp`). Di dalamnya, panggil `kernel.getHealth()` dan render daftar `health.errors` dan `health.warnings` yang ada. Ini akan menjadi "Event Viewer" Mamet OS, persis seperti `dmesg` di Linux.

---

## KESIMPULAN & FILOSOFI TERAPAN

Dengan mengikuti roadmap finalisasi di atas, Mamet OS Ecosystem akan memiliki karakteristik berikut:

1.  **Bersih:** Tidak ada lagi *Noise* dari sampah file eksperimen. *Engineer* internal hanya membaca ringkasan, bukan kode usang.
2.  **Tangguh:** Tidak ada lagi layar *Kernel Panic* mematikan. Sistem akan mendeteksi error, mencatatnya, menampilkan notifikasi ke User, dan tetap berjalan dalam mode terbatas (Degraded) sampai masalah diperbaiki.
3.  **Hemat:** *Circuit Breaker* dan *Session Artifact* akan melindungi saldo OpenRouter dari *infinite loop* dan pemborosan token.
4.  **Cerdas dan Etis:** AI tidak akan menulis kode yang merusak core dan sistem akan mempelajari masa lalu tanpa terjebak oleh masa lalu (menggunakan *Summary*).

**Pesan Pengantar (asli, 2026):** Arsitektur modular `core/runtime`sudah sangat kokoh. Satu-satunya yang hilang hanyalah lapisan "Graceful Degradation" (Fase 2 & 4). Implementasikan Fase 2 terlebih dahulu ke `Kernel.js` dan `engineer.js`, lalu lanjutkan ke Fase 4 untuk UI. Setelah itu, Mamet OS sudah siap menjadi fondasi *Self-Improving AI* yang benar-benar bebas dan mandiri!

---

> [!NOTE]
> **Pembaruan Rekonsiliasi 2026-09-08:** Arahan di paragraf pengantar di atas **sudah dikerjakan** — lapisan Graceful Degradation (Fase 2.1 & 2.2) dan notifikasi UI (Fase 4.1) kini aktif di kode.
>
> **Sisa gap terbuka dari dokumen ini (3 item):**
> 1. §1.2 — Berkas distilasi `00_EXPERIMENT_HISTORY.md` (ringkasan per eksperimen gagal) belum dibuat.
> 2. §3.1 — Dua aturan prompt belum ditambahkan: larangan emit `Engineer:GeneratePatch` (anti infinite loop) & larangan baca kode raw dari `_knowledge_archive/`.
> 3. §4.2 — Aplikasi "System Diagnostic App" (Event Viewer ala `dmesg`) belum dibangun di AppRegistry.
>
> Ketiganya terdaftar di Bagian 6 [`INDEX-ROADMAP.md`](./INDEX-ROADMAP.md).