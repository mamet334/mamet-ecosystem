# MAMET KNOWLEDGE GRAPH DASHBOARD CONSTITUTION

> **Revisi 2 November 2026 (Item 130, keputusan Owner).** Revisi pertama — dihasilkan AI dan menjadikan `SUPABASE`
> "node pusat mutlak" — cocok untuk melihat **pengetahuan** Mamet, tetapi tidak untuk memahami **sistem dan fiturnya**:
> Supabase adalah basis data, ingatan bersama, bukan otak. Pusatnya kini **MAMET**, dan Supabase pindah ke fondasi.
> Rancangan & tahap: `docs/roadmap/ROADMAP-GRAF-HOME-PETA-SISTEM.md`.

## Context
Mamet OS bukan admin dashboard.
Mamet OS adalah AI Operating System.
Dashboard Home bukan digunakan untuk KPI bisnis, chart penjualan, atau analytics tradisional.

Dashboard Home adalah:
> Visualisasi otak Mamet secara realtime — apa yang ia ketahui **dan bagaimana ia bekerja**.

Tujuan dashboard adalah membuat Owner dapat melihat:
* apa yang diketahui Mamet
* bagaimana pengetahuan saling terhubung
* kemampuan apa yang dimiliki Mamet, dan di belahan mana kemampuan itu berjalan
* rute nyata sebuah pesan: kemampuan → alat → data → model
* bagaimana memory dan RAG berkembang
* apakah fondasinya (basis data, penyedia model, desktop) sehat

---

## SUPREME VISUAL INSPIRATION
Primary inspiration:
* Obsidian Graph View
* Hermes Knowledge Graph
* Neural Network Visualization
* Knowledge Constellation

Bukan:
* ERP Dashboard
* Admin Panel
* SaaS Metrics Dashboard
* CRM Dashboard

---

## CORE PRINCIPLE
Dashboard harus terasa seperti:
> melihat otak Mamet dari luar.

Owner harus dapat melihat:
* neuron
* koneksi
* cluster
* pertumbuhan pengetahuan
* pusat gravitasi pengetahuan

---

## CENTRAL NODE
Node pusat:
`MAMET` — orkestrator yang menerima pesan, memilih jalur, mengambil dokumen, memanggil alat, bertanya ke model, dan
memeriksa label jawaban.

Otak Mamet **terbelah dua**, dan graf menggambarkannya apa adanya:
* **Belahan Desktop / Klien** — `AssistantService`, jendela konteks, alat folder, Data Tabel ASN, konektor MCP (Electron).
* **Belahan Server** — `agent-process` (`core_engine`): RAG, memori, model, pemeriksaan label.

Penyambung kedua belahan (digambar sebagai garis di antara keduanya):
* **jalur pesan** — satu permintaan, satu jawaban (kontrak permintaan/jawaban);
* **putaran alat** — alat lokal dijalankan desktop, hasilnya dikirim balik sebagai pesan hasil mesin.

Yang dipegang bersama kedua belahan: `shared/` (satu buku aturan) dan Supabase (ingatan bersama).

---

## LAYERS
**Lingkar 1 — kemampuan inti** (inti ADR-0022 + Engineer + Memori), masing-masing bergaris ke belahan tempat kodenya
berjalan:
* Chat — desktop & server
* RAG Dokumen — server
* Data Tabel ASN — desktop (NIP & nama tetap di laptop)
* Engineer — desktop & server
* Memori — server

**Lingkar 2 — alat** (lapisan **Kemampuan**, dibuka lewat tombol; tidak selalu tampil):
* alat chat (registry `tools/`), alat folder (`shared/folderKerjaAlat.js`)
* MCP berekor: MCP → konektor → alat; konektor baru muncul sendiri (hanya desktop)
* sub-agent dari **daftar resmi di `shared/`** yang juga dibaca server

**Data = ekor dari pemakainya:**
* dokumen → RAG Dokumen
* memori → Memori
* percakapan → Chat atau Engineer (menurut workspace-nya)
* pesan → percakapannya, dan ke alat yang benar-benar dipakai (dimuat saat percakapan diklik)

**Fondasi (lingkar luar), dengan lampu status:**
* Supabase — basis data, Auth, Storage, Realtime, Edge Function
* OpenRouter — penyedia model & embedding
* Electron — aplikasi desktop

---

## TATA SURYA (tata letak)

> Ditambahkan 3 November 2026 (Item 130 Tahap F, keputusan Owner): graf adalah tata surya — matahari, planet beserta
> bulannya. Menggantikan tata letak gaya fisika yang memantul & menggumpalkan data.

* **Matahari = bintang ganda MAMET** (Desktop & Server), disambung jalur pesan.
* **Planet = kemampuan inti** di satu orbit, sudut dibagi rata; jari-jari orbit dihitung dari ukuran sistemnya sehingga
  sistem bertetangga tak pernah bersentuhan.
* **Bulan = data milik planet** dalam cincin-cincin rapi (terbesar paling dalam): percakapan → Chat/Engineer, dokumen →
  RAG Dokumen, memori → Memori. **Pesan = bulan dari percakapannya**, muncul saat percakapan dibuka.
* **Planet luar = fondasi**, di sela planet. **Satelit = lapisan Kemampuan**, di luar sistem induknya, menyamping.
* Posisi **dihitung dan dipaku**, bukan dicari gaya fisika: graf **diam**, tak memantul, tak berputar.
* Planet atau bulan diseret → **seluruh sistemnya ikut bergeser** (bulan, satelit, pesan), dan tetap di tempat barunya
  sampai Home dibuka ulang.
* **Tanpa garis orbit.** Garis relasi (bulan → planet, planet → belahan, memori → asalnya, pesan → alat) adalah
  fiturnya: **jaring laba-laba** yang selalu tampil, lurus. Simpul dipilih → garisnya menyala, jaring lain meredup.

---

## DYNAMIC GROWTH
Jumlah node harus mengikuti isi database.

Contoh:
- Jika user memiliki `10 memories`, maka graph kecil.
- Jika user memiliki `1000 memories`, maka graph membesar.
- Jika user memiliki `10000 memories`, maka graph terlihat seperti Obsidian Graph.

Semakin pintar Mamet, semakin besar graph.

---

## RELATIONSHIP RULE
Setiap garis harus mewakili relasi nyata — di basis data (memori ↔ percakapan/dokumen asalnya, dokumen ↔ potongannya)
atau di kode (kemampuan ↔ belahan tempat ia berjalan, alat ↔ daftar resminya).

Jika relasinya tidak ada: jangan digambar.
Graph harus berasal dari data & daftar sebenarnya.
Bukan dummy data, bukan label kosong.

---

## STATUS LIGHTS
* Lampu dinilai dari **sinyal yang sudah tersimpan** (catatan permintaan terakhir, panggilan berhasil/gagal, langganan
  Realtime) — bukan ditebak.
* Tak ada sinyal → **abu-abu (UNKNOWN)**. Merah hanya untuk **bukti** kegagalan.
* Alasan setiap lampu dapat dibaca Owner.

---

## FREE & SAFE
* Menampilkan graph **tidak boleh memakan biaya**: tanpa panggilan model, tanpa Edge Function demi graph, tanpa
  polling, kolom seperlunya, hitungan di basis data.
* Teks data (judul, nama berkas, isi pesan, ringkasan) **selalu tampil sebagai teks**, tidak pernah sebagai HTML.
* Data Tabel ASN: graph hanya tahu alatnya ada — tidak pernah NIP, nama, atau lampiran.
* Konektor MCP dibaca **baca-saja**; graph tidak pernah menjalankan alat.

---

## NODE COLORS
* **White:** MAMET (dua belahan) & fondasi
* **Blue:** kemampuan
* **Green:** Memory
* **Purple:** RAG
* **Yellow:** Conversation
* **Red:** Errors / Alerts / Conflict

Lampu fondasi & jalur pesan: hijau (sehat) · kuning (menurun) · merah (gagal, ada bukti) · abu-abu (tak ada sinyal).

---

## HOME SCREEN LAYOUT

```text
┌──────────────────────────────────────────────────────┐
│ MAMET KNOWLEDGE GRAPH            [Knowledge Directory▼]│
│        ○ Electron      ∘∘∘                ○ Supabase  │
│   Engineer ⊙∘∘∘       Chat ⊙∘∘∘                       │
│                                       Memori ⊙∘       │
│              DESKTOP ●══● SERVER                      │
│                                                      │
│     Tabel ASN ⊙              RAG Dokumen ⊙∘∘∘∘∘       │
│                     ○ OpenRouter                     │
│ [MENU]                                [Kemampuan]    │
└──────────────────────────────────────────────────────┘
```
⊙ planet · ∘ bulan dalam cincin · ○ fondasi (planet luar) · tanpa garis orbit.

Knowledge Directory dan kotak Menu **tertutup saat Home dibuka** — dibuka dengan klik.

---

## RIGHT PANEL
Tampilkan informasi realtime:
* Total Memories
* Total Documents
* Total Embeddings
* Total Conversations
* Total Workspaces
* Database Size
* API Usage
* Health Score

---

## LIVE MODE
* Jika memory bertambah: node baru muncul.
* Jika document diupload: cluster baru muncul.
* Jika memory relation dibuat: garis baru muncul.

Dashboard harus terasa hidup.

---

## EMOTIONAL GOAL
Ketika Owner membuka Home Dashboard, Owner harus merasakan:
> "Saya sedang melihat otak Mamet hidup dan tumbuh."

Bukan:
> "Saya sedang melihat dashboard admin."

Graph tersebut bisa menjadi debugger memory, debugger RAG, debugger relasi, observability tool, health monitor, dan knowledge explorer—sehingga Home benar-benar menjadi jendela menuju otak Mamet.
