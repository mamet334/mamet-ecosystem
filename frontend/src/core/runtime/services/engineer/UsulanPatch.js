/**
 * UsulanPatch.js — jembatan jawaban chat Engineer → pipeline patch (T10 uji Engineer, 2026-09-22).
 *
 * Tombol "Apply Patch" dulu hanya meneruskan PESAN ASLI Owner ("kerjakan TUGAS-01 dari dokumen…") sebagai tugas:
 * `llmProposedContent` dikirim tapi tak dibaca siapa pun, `files` kosong. Akibat live: pesan tanpa kata kunci ubah →
 * IntentClassifier = CLARIFICATION ("Mohon diperjelas…"); seandainya lolos pun, berkas target (yang ada di dokumen RAG,
 * bukan di pesan) tidak ketemu. Modul ini mengambil berkas target & usulan dari jawaban yang Owner setujui.
 */

// Usulan panjang (berkas lengkap) cukup sebagai panduan — pipeline tetap membaca berkas asli dari disk dan meminta
// model menulis perubahan search-replace.
const BATAS_USULAN_HURUF = 8000;

/**
 * Alamat berkas dari blok ```json datar di jawaban Engineer ({"frontend/src/x.js": "…"}) — format usulan patch
 * menurut request_pipeline.ts [ENGINEER MODE — INSTRUKSI WAJIB]. Hanya kunci berbentuk alamat relatif repo.
 * @param {string} teks jawaban Engineer
 * @returns {string[]}
 */
export function berkasDariUsulan(teks) {
  const hasil = [];
  for (const m of String(teks || '').matchAll(/```(?:json)?[ \t]*\n([\s\S]*?)\n?```/gi)) {
    let obj;
    try { obj = JSON.parse(m[1]); } catch { continue; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
    for (const kunci of Object.keys(obj)) {
      const alamat = kunci.trim().replace(/\\/g, '/');
      // Relatif repo: ada folder & ekstensi, bukan absolut/keluar repo.
      if (/^[\w.-]+(\/[\w .-]+)+\.[a-z0-9]+$/i.test(alamat) && !alamat.split('/').includes('..') && !hasil.includes(alamat)) {
        hasil.push(alamat);
      }
    }
  }
  return hasil;
}

/**
 * Tugas untuk event Engineer:GeneratePatch dari tombol Apply Patch.
 * @param {{ pesanAsli: string, jawaban: string }} p
 */
export function tugasDariUsulan({ pesanAsli, jawaban }) {
  const files = berkasDariUsulan(jawaban);
  const usulan = String(jawaban || '');
  const potong = usulan.length > BATAS_USULAN_HURUF ? `${usulan.slice(0, BATAS_USULAN_HURUF)}\n… (usulan dipotong)` : usulan;
  return {
    id: `TASK-${Date.now()}`,
    title: String(pesanAsli || '').substring(0, 100),
    // Usulan di chat sering berupa POTONGAN (live: 3 baris komentar sebagai "isi" berkas 96 baris) — dijadikan panduan
    // MAKSUD, bukan isi berkas. Pipeline membaca berkas asli dan menulis perubahan cari-ganti.
    description: `${pesanAsli || ''}\n\nUSULAN ENGINEER YANG DISETUJUI OWNER — pakai sebagai panduan MAKSUD perubahan, bukan isi berkas. Baca berkas asli, ubah HANYA bagian yang dimaksud dengan cari-ganti, semua baris lain tetap sama persis:\n${potong}`,
    files,
    // Klik Apply = niat MENGUBAH yang eksplisit dari Owner — tebakan kata kunci dilewati.
    dariTombolApply: true,
    llmProposedContent: jawaban,
  };
}
