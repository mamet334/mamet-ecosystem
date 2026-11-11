
const VERSI = 'k1-4';
const DIR = new URL('./data-lokal', import.meta.url).href;
const WS = 'ws-assistant';
const ALAT_UJI = { rag: true, web_search: false, deep_research: false, data_tabel: false, memory_manager: false };

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
        const { data: { session: sesiKini } } = await supabase.auth.getSession();
        const j = await tanya(asisten, { soal, token: sesiKini?.access_token, workspaceManager: sm.get('WorkspaceManager') });
        if (j.galat) {
          putaran.push({ ...P.hasilGalat(j.galat), detik: j.detik });
          console.warn(`[uji-mutu-k1] ${soal.id} #${i + 1} galat: ${j.galat}`);
          continue;
        }
        const konteks = j.langkah.find((l) => l.startsWith('[SYSTEM CONTEXT FINAL]')) ?? null;
        const ragGagal = j.langkah.some((l) => l.includes('[RAG TIER 1 FALLBACK]'));
        const n = P.nilaiJawaban(soal, j.teks, { konteks, ragGagal });
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
    `label bohong ${putusan.label_bohong} · label turun ${putusan.label_turun} · RAG turun ${putusan.rag_turun} · RAG gagal ${putusan.rag_gagal.putaran}/${putusan.rag_gagal.dari} putaran`);

  const keluaran = { versi_skrip: VERSI, set: set.versi, waktu: new Date().toISOString(), ulang, putusan, baris };
  const berkas = new Blob([JSON.stringify(keluaran, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(berkas);
  a.download = `uji-mutu-k1-${keluaran.waktu.replace(/[:.]/g, '-')}.json`;
  a.click();
  return putusan;
}
