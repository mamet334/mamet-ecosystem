// UJI MUTU JAWABAN RAG — K1 & K2 fase hardening (ADR-0022), versi skrip k1-1 (2026-11-03).
// Membangun ulang penguji Item 78 (`jalankan-uji-rag.js`, hilang bersama `frontend/node_modules/.uji-rag/` sejak
// 24 Sep) dengan set yang sah: `uji/data-lokal/set-uji-mutu-k1.json` (22 pertanyaan pokok + 4 tidak_ada — susunan
// disetujui Owner 3 Nov). Penilai: `uji/lib/penilaiMutuRag.mjs` (diuji di suite: `uji-penilai-mutu-rag.mjs`).
//
// Pemakaian — dari konsol DevTools `npm run desktop` (mode dev), sudah login, saldo OpenRouter > 0:
//   await (await import(`/@fs/D:/SLAMET/other/mamet os ecosystem/uji/uji-mutu-rag-k1.js?t=${Date.now()}`)).uji()
//   (`?t=` melewati cache Vite bila skrip baru diubah.)
// Opsi: .uji({ ulang: 2 })            → tiap pertanyaan dijalankan 2 kali (bawaan 2; model tidak deterministik)
//       .uji({ hanya: ['HCDP-01'] })  → sebagian soal saja
//
// Yang dilakukan:
//  1. Tiap pertanyaan dikirim lewat `AssistantService.processMessage` — jalur chat yang sama (tier otomatis, model,
//     header BYOK, payload). Kunci OpenRouter tidak dibaca skrip.
//  2. Selama uji, DI MEMORI saja (dipulihkan di `finally`, tak ada yang disimpan ke setelan): RAG nyala, Web/Deep
//     Research/Data Tabel/Memory mati — yang diukur hanya jawaban dari dokumen. Folder kerja & konektor dianggap
//     tidak aktif supaya putaran alat tidak ikut.
//  3. `userId` sengaja kosong → memori sesi tidak disentuh. Jawaban TIDAK disimpan ke `chats` (yang menyimpan adalah
//     ConversationEngine, bukan processMessage).
//  4. Nilai tiap jawaban (BENAR / JUJUR / PERLU_CEK / SALAH), label jujur, dan apakah bukti ada di konteks
//     `[SYSTEM CONTEXT FINAL]`. Konteks itu sendiri tidak ikut ke berkas hasil.
// Biaya: 26 soal × 2 putaran = 52 jawaban chat dengan model tier otomatis. Hasil: tabel konsol + berkas
// `uji-mutu-k1-<waktu>.json` (pertanyaan, jawaban, label, penilaian, penyedia).

const VERSI = 'k1-3'; // k1-3 (5 Nov): catat blok TABEL CENTANG di konteks; penilai: "tidak ada…" + fakta kunci sebagian = PERLU_CEK · k1-2 (3 Nov): galat = TIDAK_TERUKUR
const DIR = new URL('./data-lokal', import.meta.url).href;
const WS = 'ws-assistant';
const ALAT_UJI = { rag: true, web_search: false, deep_research: false, data_tabel: false, memory_manager: false };

/** Satu jawaban lewat jalur chat. Mengembalikan { teks, langkah, penyedia, galat, detik }. */
function tanya(asisten, { soal, token, workspaceManager }) {
  const mulai = Date.now();
  return new Promise((selesai) => {
    asisten.processMessage({
      userMsg: soal.pertanyaan,
      history: [],
      workspaceId: WS,
      userId: null,
      token,
      workspaceManager,
      onChunk: () => {},
      onNalar: () => {},
      onDone: (teks, langkah, data) => selesai({
        teks: String(teks || ''),
        langkah: Array.isArray(langkah) ? langkah.map(String) : [],
        penyedia: typeof data?.penyedia === 'string' ? data.penyedia : null,
        detik: Math.round((Date.now() - mulai) / 1000),
      }),
      onError: (g) => selesai({
        galat: [g?.kode, g?.status, g?.pesan || g?.teknis].filter(Boolean).join(' · ') || 'galat',
        detik: Math.round((Date.now() - mulai) / 1000),
      }),
    }).catch((e) => selesai({ galat: e?.message || String(e), detik: Math.round((Date.now() - mulai) / 1000) }));
  });
}

export async function uji({ ulang = 2, hanya = null } = {}) {
  console.log(`[uji-mutu-k1] versi skrip ${VERSI}`);
  const sm = window.__mamet?.serviceManager;
  if (!sm) throw new Error('window.__mamet tidak ada — jalankan dari `npm run desktop` (mode dev).');
  const asisten = sm.get('AssistantService');
  const preferensi = sm.get('ToolPreferencesService');
  if (!asisten || !preferensi) throw new Error('AssistantService / ToolPreferencesService tidak terdaftar.');
  const { supabase } = await import('/src/supabase.js');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Belum login.');
  const P = await import(new URL('./lib/penilaiMutuRag.mjs', import.meta.url).href);
  const set = await (await fetch(`${DIR}/set-uji-mutu-k1.json`)).json();
  const soalUji = set.pertanyaan.filter((s) => !hanya || hanya.includes(s.id));

  // Penggantian sementara — hanya di objek yang sedang berjalan, dipulihkan di finally.
  const asli = {
    getEffective: Object.prototype.hasOwnProperty.call(preferensi, 'getEffective') ? preferensi.getEffective : null,
    folder: Object.prototype.hasOwnProperty.call(asisten, '_statusFolderKerja') ? asisten._statusFolderKerja : null,
    konektor: Object.prototype.hasOwnProperty.call(asisten, '_statusKonektor') ? asisten._statusKonektor : null,
  };
  const pulihkan = () => {
    if (asli.getEffective) preferensi.getEffective = asli.getEffective; else delete preferensi.getEffective;
    if (asli.folder) asisten._statusFolderKerja = asli.folder; else delete asisten._statusFolderKerja;
    if (asli.konektor) asisten._statusKonektor = asli.konektor; else delete asisten._statusKonektor;
  };
  const efektifAsli = preferensi.getEffective.bind(preferensi);
  preferensi.getEffective = (ws, alat) => (alat in ALAT_UJI ? ALAT_UJI[alat] : efektifAsli(ws, alat));
  asisten._statusFolderKerja = async () => null;
  asisten._statusKonektor = async () => null;

  const baris = [];
  try {
    for (const soal of soalUji) {
      const putaran = [];
      for (let i = 0; i < ulang; i++) {
        // Token diambil ulang tiap pertanyaan (pelajaran Item 78): 52 jawaban bisa melewati penyegaran sesi.
        const { data: { session: sesiKini } } = await supabase.auth.getSession();
        const j = await tanya(asisten, { soal, token: sesiKini?.access_token, workspaceManager: sm.get('WorkspaceManager') });
        if (j.galat) {
          putaran.push({ ...P.hasilGalat(j.galat), detik: j.detik }); // bukan SALAH — tidak ada jawaban untuk dinilai
          console.warn(`[uji-mutu-k1] ${soal.id} #${i + 1} galat: ${j.galat}`);
          continue;
        }
        const konteks = j.langkah.find((l) => l.startsWith('[SYSTEM CONTEXT FINAL]')) ?? null;
        const n = P.nilaiJawaban(soal, j.teks, { konteks });
        // k1-3 (5 Nov, diagnosis BUKU-10): apakah blok [TABEL CENTANG …] (posisi centang dari pdf.js, Item 88) ikut
        // dibaca model — hanya tandanya, isi konteks tetap tidak disimpan.
        const blokCentang = konteks == null ? null : konteks.includes('[TABEL CENTANG —') ? 'ada' : konteks.includes('[TABEL CENTANG') ? 'hanya-tidak-pasti' : 'tidak';
        putaran.push({ ...n, jawaban: j.teks, penyedia: j.penyedia, detik: j.detik, konteks_ada: konteks != null, blok_centang: blokCentang });
        console.log(`[uji-mutu-k1] ${soal.id} #${i + 1} ${n.hasil} · label ${n.label || '—'} · ${j.detik} dtk${n.alasan.length ? ' · ' + n.alasan.join('; ') : ''}`);
      }
      baris.push({ id: soal.id, jenis: soal.jenis, pertanyaan: soal.pertanyaan, putaran });
    }
  } finally {
    pulihkan();
  }

  const putusan = P.putusanK1K2(baris);
  console.table(baris.map((b) => ({
    id: b.id,
    hasil: b.putaran.map((p) => p.hasil).join(' / '),
    label: b.putaran.map((p) => p.label || '—').join(' / '),
    bukti_konteks: b.putaran.map((p) => (p.bukti_di_konteks == null ? '—' : p.bukti_di_konteks ? 'ya' : 'TIDAK')).join(' / '),
    alasan: [...new Set(b.putaran.flatMap((p) => p.alasan))].join('; '),
  })));
  console.log(`[uji-mutu-k1] K1 ${putusan.k1} · K2 ${putusan.k2}`, putusan.dokumen, putusan.tidak_ada,
    `label bohong ${putusan.label_bohong} · label turun ${putusan.label_turun} · RAG turun ${putusan.rag_turun}`);

  const keluaran = { versi_skrip: VERSI, set: set.versi, waktu: new Date().toISOString(), ulang, putusan, baris };
  const berkas = new Blob([JSON.stringify(keluaran, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(berkas);
  a.download = `uji-mutu-k1-${keluaran.waktu.replace(/[:.]/g, '-')}.json`;
  a.click();
  return putusan;
}
