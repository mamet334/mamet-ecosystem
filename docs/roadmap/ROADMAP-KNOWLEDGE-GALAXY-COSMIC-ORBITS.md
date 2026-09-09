# ROADMAP: KNOWLEDGE GALAXY — COSMIC ORBITS & LIVE THOUGHT PULSE

**Tipe Dokumen:** Engineering Roadmap & UI/UX Architectural Specification  
**Area:** Frontend Knowledge Graph (`ActivityGraph.jsx`) & Assistant Integration (`ConversationEngine.jsx`)  
**Authority:** MAEF Constitution (23_HOME_DASHBOARD_SPEC.md & 22_MUS_UI_SPECIFICATION.md)  
**Status:** ✅ **SELESAI & Diverifikasi (2026-09-08)** — lihat [`2026-09-08-knowledge-galaxy-cosmic-orbits-implementation.md`](../project-memory/changelog/2026-09-08-knowledge-galaxy-cosmic-orbits-implementation.md)
**Tanggal:** 2026-09-04 (dieksekusi 2026-09-08)

---

## 1. Latar Belakang & Visi Desain

Berdasarkan diskusi arsitektur dan inspirasi dari sistem visualisasi agen otonom modern (seperti *Hermes AI / Nous Research*), antarmuka **MAMET KNOWLEDGE GRAPH** (Home Dashboard) dirancang untuk berkembang melampaui diagram simpul statis konvensional menjadi sebuah **"Living AI Neural Universe"**.

Setelah eliminasi konsep kabut/nebula (Pilar 1) guna mempertahankan kejernihan dan kontras tinggi kanvas hitam *Obsidian-style*, terpilih **dua pilar utama** yang akan direalisasikan:

1. **Pilar A — Jalur Orbit Gravitasi Kosmik (*Cosmic Filaments & Stardust Flow*):**
   * Menggantikan garis lurus kaku (*polygonal lines*) dengan kelengkungan orbit dinamis (`linkCurvature`).
   * Mengalirkan partikel debu cahaya anggun sepanjang lintasan gravitasi untuk menggambarkan sirkulasi energi pengetahuan antar-entitas.
2. **Pilar B — Pijaran Simpul Pikiran Aktif (*Live Thought Pulsing & Active Memory Illumination*):**
   * Membangun jembatan visual antara mode Chat Asisten dan Home Dashboard.
   * Ketika asisten memanggil memori atau dokumen ke dalam *Memory Context* saat percakapan, simpul bintang yang bersangkutan di kanvas graf akan memancarkan pendaran denyut lembut (*pulsing halo ring*), memperlihatkan simpul pengetahuan mana yang sedang aktif dipikirkan oleh AI.

---

## 2. Prinsip Rekayasa (Engineering Principles)

1. **Zero-Token & Zero-Cost Realtime:**
   * Sama sekali tidak memanggil model bahasa LLM ($0.00). Seluruh status aktif didorong melalui event browser lokal (*EventBus*).
2. **High-Performance 60 FPS Canvas:**
   * Memanfaatkan akselerasi HTML5 Canvas 2D murni (`requestAnimationFrame`), tanpa menambahkan dependensi pustaka 3D yang berat pada GPU laptop/desktop.
3. **Konstitusi 23 Compliant:**
   * Mempertahankan 5 palet warna semantik resmi: Hijau Memori (`#22c55e`), Ungu Dokumen RAG (`#a855f7`), Kuning Percakapan (`#eab308`), Putih Inti Supabase (`#ffffff`), dan Merah Konflik (`#ef4444`).
4. **Non-Intrusive & Clear Contrast:**
   * Menjaga kanvas latar belakang tetap gelap gulita murni (*Obsidian Deep Space*), memastikan teks nama bintang tetap mudah terbaca pada semua tingkat pembesaran (*zoom scale*).

---

## 3. Rincian Arsitektur & Spesifikasi Teknis

### A. Pilar A: Cosmic Filaments & Flowing Stardust (`ActivityGraph.jsx`)
* **Kelengkungan Orbit Dinamis (`linkCurvature`):**
  * Setiap relasi antar-node diberi nilai lengkungan geometris (misal `0.12` – `0.16`), menciptakan busur gravitasi yang menyerupai lintasan orbit benda langit mengitari pusat massa.
* **Aliran Partikel Semantik (`linkDirectionalParticles`):**
  * Partikel debu bintang bergerak perlahan sepanjang lengkungan orbit (`speed: 0.004`).
  * Warna partikel mengadopsi warna semantik dari node asal (*source node*), memberikan kesan aliran informasi yang hidup:
    - Partikel hijau mengalir dari/menuju node memori.
    - Partikel ungu mengalir dari/menuju dokumen RAG.
    - Partikel putih mengalir melintasi inti kernel Supabase.

### B. Pilar B: Live Thought Pulsing (`ConversationEngine.jsx` ➔ `ActivityGraph.jsx`)
* **Penyampaian Sinyal Pikiran Aktif (EventBus / State Bridge):**
  * Saat `ConversationEngine` memuat `activeMemories` (berdasarkan kueri pengguna atau konteks percakapan terakhir), ia memancarkan event:
    ```javascript
    kernel.eventBus?.emit('Brain:ActiveThoughts', {
      memoryIds: activeMemories.map(m => m.id),
      timestamp: Date.now()
    });
    ```
  * `ActivityGraph` berlangganan event tersebut dan menyimpan daftar ID bintang yang sedang aktif (`activeThoughtIds`).
* **Render Efek Denyut Kosmik (*Sine Wave Pulsing Halo*):**
  * Pada siklus penggambaran kanvas (`nodeCanvasObject`):
    * Jika `activeThoughtIds.has(node.id)`:
      * Sistem menggambar cincin cahaya tambahan di sekeliling node dengan radius berosilasi:
        $$R = R_{\text{base}} \times (1.3 + 0.35 \times \sin(\text{time} / 200))$$
      * Warna cincin: Cincin pendaran semantik berintensitas tinggi dengan efek pendar (*glow stroke*).
* **Indikator Legenda Baru:**
  * Menambahkan indikator di legenda header Konstitusi 23:
    * `● Berpijar: Simpul Aktif Percakapan (Live Thought)`

---

## 4. Rencana File yang Terlibat

| File | Tipe Aksi | Tanggung Jawab |
| :--- | :---: | :--- |
| `frontend/src/components/dashboard/ActivityGraph.jsx` | Modifikasi | Menambahkan `linkCurvature`, penyesuaian partikel stardust, dan render denyut simpul aktif |
| `frontend/src/components/workbench/ConversationEngine.jsx` | Modifikasi | Memancarkan event `Brain:ActiveThoughts` saat `activeMemories` terisi/berubah |
| `docs/roadmap/INDEX-ROADMAP.md` | Modifikasi | Pendaftaran dokumen roadmap baru ke dalam indeks utama |

---

## 5. Kriteria Keberhasilan (Definition of Done)

> Status per 2026-09-09 (checkbox di bawah dulu dibiarkan kosong padahal header dokumen sudah "SELESAI" — dirapikan sekarang, ditandai sesuai bukti yang benar-benar ada, bukan diasumsikan).

- [x] Seluruh garis penghubung di kanvas graf melengkung — `linkCurvature={ORBIT_CURVATURE}` di [`ActivityGraph.jsx:176`](../../frontend/src/components/dashboard/ActivityGraph.jsx); terlihat melengkung pada screenshot Home Dashboard Owner (2026-09-09).
- [x] Partikel stardust mengalir mengikuti lengkungan orbit — `linkDirectionalParticles` di [`ActivityGraph.jsx:196`](../../frontend/src/components/dashboard/ActivityGraph.jsx) (sudah ada sebelumnya, memakai warna semantik node sumber). **Catatan jujur:** klaim "60 FPS, tidak memberatkan CPU" tidak pernah diukur — tidak ada profiling yang dilakukan.
- [ ] Bintang memori terkait terlihat **berdenyut** saat berpindah dari chat ke Home Dashboard — jalur datanya terbukti (round-trip EventBus live: `memoryIds` → `activeThoughtIds` dengan konvensi `mem-${id}` yang benar) dan legenda "Berpijar: Simpul Aktif Percakapan" terlihat di screenshot Owner, tapi **efek denyutnya sendiri belum pernah dikonfirmasi secara visual**.
- [x] Lolos verifikasi build produksi — sukses dua kali (sebelum & sesudah perbaikan bug unwrap payload EventBus).
- [x] Tidak ada pelanggaran Konstitusi 23 dan tidak ada biaya token LLM — seluruh mekanisme berjalan lewat EventBus browser lokal, nol panggilan LLM.
