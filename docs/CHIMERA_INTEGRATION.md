# 🧠 CHIMERA Engine Integration (MAEF Capability Provider)

Dokumen ini menjelaskan bagaimana Mamet OS terhubung ke **CHIMERA Engine** sebagai penyedia kapabilitas kognitif tingkat lanjut (*Living Knowledge, Memory, and Anti-Hallucination Verification*).

---

## 1. Status Integrasi

* **Adapter**: `backend/adapters/chimera-adapter.js`
* **Port Hub**: Terhubung ke `server.js` pada rute `/api/chat` dan `/api/chimera/*`.
* **MAEF Ports Implemented**:
  * `Knowledge Port` (Metabolism & Living Facts)
  * `Verification Port` (Anti-Hallucination Gate)
  * `Memory Port` (Effective Confidence & Half-Life Decay)

---

## 2. Cara Menjalankan

1. **Jalankan CHIMERA Engine Daemon (Rust):**
   ```powershell
   cd d:\SLAMET\other\hack\engine
   cargo run --release -p chimera-server
   ```
   *Daemon berjalan di `http://127.0.0.1:7777`.*

2. **Jalankan Mamet OS Backend:**
   ```powershell
   cd "d:\SLAMET\other\mamet os ecosystem\backend"
   node server.js
   ```

Setelah kedua service berjalan:
* Setiap panggilan `/api/chat` akan memverifikasi jawaban AI dengan CHIMERA Engine.
* Endpoint proxy CHIMERA aktif di `/api/chimera/health`, `/api/chimera/verify`, `/api/chimera/ingest`, dll.
