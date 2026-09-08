# Changelog: Implementasi Knowledge Galaxy — Cosmic Orbits & Live Thought Pulse

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai & Diverifikasi (build + round-trip EventBus di browser live)
**Scope:** [`ROADMAP-KNOWLEDGE-GALAXY-COSMIC-ORBITS.md`](../../roadmap/ROADMAP-KNOWLEDGE-GALAXY-COSMIC-ORBITS.md)
**Komponen Terdampak:** `frontend/src/components/dashboard/ActivityGraph.jsx`, `frontend/src/components/workbench/ConversationEngine.jsx`

---

## 1. Ringkasan

Implementasi kedua pilar visual dari roadmap: **Pilar A** (lengkungan orbit gravitasi + partikel semantik) dan **Pilar B** (denyut cahaya pada simpul memori yang sedang aktif dipikirkan AI).

## 2. Audit Sebelum Eksekusi — Pilar A Sebagian Sudah Ada

Sebelum menulis kode baru, diaudit dulu state kode saat ini (menghindari duplikasi seperti temuan di Dashboard Observability sehari sebelumnya):
- `linkDirectionalParticles`/`linkDirectionalParticleColor` **sudah ada** di `ActivityGraph.jsx` — dan ternyata **sudah** memakai warna semantik dari node sumber (`getNodeColor(link.source)`) persis seperti diusulkan §3.A, hanya dipakai untuk keperluan lain (menyorot jalur aktif saat breaking-change/timeout terdeteksi).
- `linkCurvature` (lengkungan orbit) — **tidak ada sama sekali**, semua garis relasi masih lurus (`polygonal lines`).

Jadi Pilar A **hanya butuh satu penambahan**: prop `linkCurvature={0.14}` (nilai konstan di tengah rentang usulan 0.12-0.16). Particle flow semantik yang sudah ada dibiarkan sebagaimana adanya (tidak diubah, tidak diduplikasi).

## 3. Pilar B — Live Thought Pulsing

**Sumber data sudah tersedia:** `ConversationEngine.jsx` sudah punya state `activeMemories` (diisi dari event `Memory:Retrieved` yang di-emit `MemoryService.js`), dan tiap itemnya adalah baris `user_memories` mentah — punya `.id` yang persis sama dengan yang dipakai `useDashboardData.js` untuk membangun node graph (`mem-${m.id}`). Tidak ada perubahan backend/data yang diperlukan.

**Perubahan:**
- `ConversationEngine.jsx`: `useEffect` baru yang meng-emit `Brain:ActiveThoughts` (payload: `{ memoryIds, timestamp }`) setiap kali `activeMemories` berubah.
- `ActivityGraph.jsx`: `useEffect` baru yang subscribe event tersebut, menyimpan `activeThoughtIds` (Set berisi `mem-${id}`). Di `nodeCanvasObject`, node yang ID-nya ada di set ini mendapat cincin cahaya berosilasi (`R = R_base × (1.3 + 0.35 × sin(time/200))`, warna semantik node itu sendiri via `getNodeColor(node)`, dengan `shadowBlur` untuk efek glow) — digambar **terpisah** dari cabang konflik/orphan supaya tetap tampil bersamaan dengan status lain.
- Legenda baru ditambahkan: "● Berpijar: Simpul Aktif Percakapan (Live Thought)".

## 4. Bug Ditemukan & Diperbaiki Saat Verifikasi Live

Percobaan pertama round-trip EventBus **gagal** — `capturedSet` kosong. Ditelusuri ke `EventBus.js:73-77` ("Anti-Spoofing: Wrap payload with metadata"): **setiap** `emit()` membungkus payload asli di dalam `{ source, timestamp, data: payload }`, tanpa kecuali. Handler awal saya salah akses `payload?.memoryIds` (payload level teratas), seharusnya `payload?.data?.memoryIds`. Diperbaiki, verifikasi ulang berhasil.

Ini murni bug di kode BARU yang saya tulis sendiri (bukan pre-existing) — ditemukan tepat karena live-testing round-trip EventBus sungguhan, bukan cuma baca kode.

## 5. Verifikasi

1. **Build production:** sukses (dua kali — sebelum dan sesudah fix bug unwrap payload).
2. **Round-trip EventBus live:** disimulasikan persis logika emit (`ConversationEngine.jsx`) dan handler (`ActivityGraph.jsx`) di browser sungguhan terhadap `EventBus` instance live — `memoryIds: ['abc-123', 'xyz-789']` → `activeThoughtIds` berisi `{'mem-abc-123', 'mem-xyz-789'}` persis sesuai konvensi node ID yang dipakai `useDashboardData.js`.
3. Kedua modul (`ActivityGraph.jsx`, `ConversationEngine.jsx`) dikonfirmasi resolve tanpa error via dynamic import langsung di browser.
4. **Keterbatasan:** tidak bisa memverifikasi secara visual (screenshot render kanvas) karena Home Dashboard ada di balik layar login dan tidak ada kredensial untuk masuk — verifikasi dilakukan sampai batas logika data/event, bukan piksel di layar.
5. Console bersih dari error baru (error yang tampil adalah keterbatasan CSP GitHub API pra-eksisting, tidak terkait perubahan ini).

## 6. Tidak Dikerjakan / Di Luar Scope

Detail visual lain di §3.A (mis. variasi kecepatan/warna partikel per cluster) tidak diubah karena sudah ada dan berfungsi — perubahan dibatasi seminimal mungkin sesuai apa yang benar-benar hilang dari implementasi sebelumnya.
