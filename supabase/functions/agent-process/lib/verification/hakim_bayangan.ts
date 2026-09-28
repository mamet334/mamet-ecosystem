/**
 * HAKIM BAYANGAN — penilaian per kalimat oleh model, TANPA menyentuh label (T13, 2026-09-28)
 *
 * ── Kenapa ada ──────────────────────────────────────────────────────────────────────────────
 * Dua kali pendekatan leksikal gagal memisahkan "kalimat bersandar dokumen" dari "kalimat pendapat":
 * CHIMERA WASM (5 dari 6 kasus Mamet salah) lalu `klaim_sumber.ts` (melewatkan ekstrapolasi di porsi
 * 0,18; menuduh "Semoga membantu, Pak Slamet." pada 24% jawaban VERIFIED). Sebabnya satu: kedua
 * sebaran itu BERIRISAN, sehingga tak ada ambang yang bisa memisahkannya.
 *
 * Bentuk tembok yang sama sudah pernah dihadapi proyek ini di Item 55 (`judge_endpoint.ts`):
 * kemiripan vektor tidak bisa memisahkan konflik memori dari penajaman (0,8780 BENTROK vs 0,8323
 * TAJAM — beririsan). Jalan keluarnya waktu itu: berhenti mengukur, tanya model. Berkas ini memakai
 * jalan yang sama, untuk alasan yang sama.
 *
 * ── Kenapa BAYANGAN ─────────────────────────────────────────────────────────────────────────
 * Vonis hakim di sini TIDAK PERNAH mengubah label, teks jawaban, atau apa pun yang Owner lihat.
 * Ia hanya dicatat. Sesudah beberapa puluh pesan, tiga pertanyaan yang hari ini masih dikira-kira
 * bisa dijawab dengan angka:
 *   1. benarkah sebagian jawaban HYPOTHESIS sebenarnya campuran yang layak PARTIAL?
 *   2. seberapa sering hakim tidak sepakat dengan `label_sumber.ts`, dan siapa yang benar?
 *   3. berapa biayanya sungguhan per hari?
 * Naik pangkat dari bayangan menjadi penentu label adalah keputusan Owner, bukan keputusan kode.
 *
 * ── Tiga pagar ──────────────────────────────────────────────────────────────────────────────
 * 1. MATI SECARA BAWAAN. Butuh env `HAKIM_BAYANGAN=1`. Tanpa itu tak ada panggilan, tak ada biaya.
 * 2. TIDAK MENGEMBALIKAN APA PUN (`Promise<void>`). Mustahil dipakai mengubah label tanpa mengubah
 *    tanda tangannya lebih dulu — dan perubahan itu akan terlihat di diff.
 * 3. GAGAL DENGAN DIAM. Seluruh isinya dibungkus try/catch; kegagalan hanya dicatat di log.
 *
 * ── Biaya ───────────────────────────────────────────────────────────────────────────────────
 * Satu panggilan model tambahan per jawaban RAG, memakai kunci pengguna (BYOK, Item 51), dicatat ke
 * `api_usage` lewat `logApiUsage` — celah yang diperbaiki 24 September di `padatkan_endpoint.ts` dan
 * `judge_endpoint.ts` tidak diulang di sini. Ditunggu sebelum respons dikirim (`tasks.awaitAll` di
 * `index.ts`), jadi ia MENAMBAH waktu tunggu. Itu harga uji coba, dan sebabnya ia mati secara bawaan.
 */

import { pecahKlaim } from './klaim_sumber.ts';

/** Batas supaya satu pesan tidak pernah menjadi prompt raksasa — dan supaya biayanya bisa diduga. */
export const MAKS_KALIMAT = 40;
export const MAKS_POTONGAN = 8;
export const MAKS_HURUF_POTONGAN = 1200;
/** Kalimat sependek ini tidak dikirim ke hakim: tidak ada yang bisa dinilai, hanya menambah biaya. */
export const MIN_HURUF_KALIMAT = 12;

export type VonisKalimat = 'BERSANDAR' | 'TIDAK' | 'PERCAKAPAN';

export type PutusanHakim = {
  /** nomor kalimat, 1-based, sesuai urutan di prompt */
  n: number;
  v: VonisKalimat;
  /** indeks potongan penyandar (0-based), null bila tidak ada */
  p: number | null;
};

export const SISTEM_HAKIM = `Anda adalah pemeriksa sandaran dokumen. Anda menerima POTONGAN DOKUMEN bernomor dan KALIMAT JAWABAN bernomor.

Untuk SETIAP kalimat, tentukan satu vonis:
- "BERSANDAR": isi kalimat itu didukung oleh salah satu potongan. Sebutkan nomor potongannya.
- "TIDAK": kalimat itu menyatakan sesuatu tentang pokok bahasan, tetapi tidak ada potongan yang mendukungnya (pengetahuan umum, pendapat, rekomendasi, ekstrapolasi).
- "PERCAKAPAN": kalimat itu bukan pernyataan tentang pokok bahasan sama sekali — sapaan, basa-basi, tawaran bantuan, pengantar, penutup, atau kalimat tentang jawaban itu sendiri. Contoh: "Semoga membantu, Pak Slamet.", "Kalau perlu saya bedah lebih lanjut, silakan beri tahu.", "Berikut ringkasannya:", "Bagian pertama jawaban di atas bersumber dari dokumen X."

Jawab HANYA JSON tanpa markdown, satu objek per kalimat:
[{"n":1,"v":"BERSANDAR","p":0},{"n":2,"v":"PERCAKAPAN","p":null}]

Aturan penting:
- Parafrase yang setia tetap "BERSANDAR". Tidak perlu kata yang sama persis.
- Angka, nomor peraturan, dan nomor halaman BUKAN urusan Anda — jangan menilai benar-salahnya.
- Anda TIDAK pernah menyatakan sebuah kalimat salah. Hanya: didukung, tidak didukung, atau bukan pernyataan.
- Kalau ragu antara "BERSANDAR" dan "TIDAK", pilih "BERSANDAR". Salah menuduh lebih merugikan daripada melewatkan.
- Kalau ragu antara "TIDAK" dan "PERCAKAPAN", pilih "PERCAKAPAN".`;

/**
 * Kalimat yang layak dikirim ke hakim.
 *
 * `sertakanTabel: true` — terbukti perlu 2026-09-28. Satu jawaban campuran menulis bagian yang
 * bersandar dokumen sebagai TABEL; `pecahKlaim` membuangnya, jadi hakim hanya menerima paragraf
 * rekomendasinya dan menyimpulkan HYPOTHESIS. Vonisnya benar atas apa yang ia lihat — yang salah
 * adalah apa yang dikirimkan kepadanya.
 */
export function kalimatUntukHakim(jawaban: string): string[] {
  return pecahKlaim(jawaban, { sertakanTabel: true })
    .filter((k) => k.length >= MIN_HURUF_KALIMAT)
    .slice(0, MAKS_KALIMAT);
}

/**
 * Label yang BENAR-BENAR terlihat di jawaban akhir. Versi pertama tabel ini menyimpan apakah sistem
 * *mengubah* sesuatu (`(diam)` / `diturunkan`) — bukan labelnya. Akibatnya tabelnya sendiri tidak bisa
 * menjawab "seberapa sering hakim tidak sepakat"; perbandingannya harus digabung manual dengan
 * `chats`. Untuk sebuah alat ukur, itu cacat pokok.
 */
export function labelTerlihat(teks: string): string {
  const t = String(teks || '');
  if (t.includes('[STATUS: VERIFIED]')) return 'VERIFIED';
  if (t.includes('[STATUS: PARTIAL')) return 'PARTIAL';
  if (t.includes('[STATUS: HYPOTHESIS')) return 'HYPOTHESIS';
  if (t.includes('[STATUS: INSUFFICIENT')) return 'INSUFFICIENT';
  if (t.includes('[Pengetahuan umum AI')) return 'PENGETAHUAN_UMUM';
  return 'TANPA_LABEL';
}

/**
 * Masukan untuk `adapter.execute`. `thinking: false` WAJIB dan bukan penghematan kecil.
 *
 * Terukur pada panggilan hakim pertama yang berhasil (2026-09-28 05:37), yang mewarisi `thinking`
 * dari model Owner:
 *
 *   prompt=2550t completion=5146t reasoning=4993t biaya=$0,002213  durasi=107.910 ms
 *
 * **97% keluarannya nalar**, 108 detik, dan biayanya 3,3× biaya jawaban chat itu sendiri. Karena hakim
 * ditunggu sebelum respons dikirim, ia ikut membuat sambungan Owner terputus di tengah jawaban.
 *
 * Menilai kalimat terhadap potongan tidak menuntut nalar panjang; ia menuntut membaca. `ai_adapter.ts`
 * memang menyediakan penimpaan per panggilan untuk itu — dipakai Intent Router, Coordinator, dan
 * peringkas dengan alasan yang sama.
 */
export function masukanHakim(prompt: string) {
  return {
    promptText: prompt,
    systemPromptText: SISTEM_HAKIM,
    chatHistory: [] as unknown[],
    forceDefaultModel: false,
    thinking: false
  };
}

export function susunPromptHakim(kalimat: string[], isiDokumen: string[]): string {
  const potongan = (isiDokumen || [])
    .filter((t) => typeof t === 'string' && t.trim())
    .slice(0, MAKS_POTONGAN)
    .map((t, i) => `[POTONGAN ${i}]\n${t.slice(0, MAKS_HURUF_POTONGAN)}`)
    .join('\n\n');
  const daftar = kalimat.map((k, i) => `${i + 1}. ${k}`).join('\n');
  return `POTONGAN DOKUMEN:\n\n${potongan}\n\n---\n\nKALIMAT JAWABAN:\n\n${daftar}`;
}

const VONIS_SAH = new Set<string>(['BERSANDAR', 'TIDAK', 'PERCAKAPAN']);

/**
 * Membaca balasan model menjadi daftar putusan. Model sering membungkus JSON dengan pagar markdown
 * atau kalimat pengantar, jadi potongan `[` … `]` terluar yang diambil — pola yang sama dipakai
 * `bersihkanRingkasan` di `padatkan_endpoint.ts`.
 *
 * Balasan yang tidak bisa dibaca menghasilkan daftar KOSONG, bukan lemparan: ini jalur bayangan,
 * kegagalannya tidak boleh merembet ke jawaban Owner.
 */
export function bacaPutusanHakim(mentah: string, jumlahKalimat: number): PutusanHakim[] {
  const teks = String(mentah || '');
  const mulai = teks.indexOf('[');
  const akhir = teks.lastIndexOf(']');
  if (mulai < 0 || akhir <= mulai) return [];

  let mentahJson: unknown;
  try {
    mentahJson = JSON.parse(teks.slice(mulai, akhir + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(mentahJson)) return [];

  const terpakai = new Set<number>();
  const hasil: PutusanHakim[] = [];
  for (const baris of mentahJson) {
    if (!baris || typeof baris !== 'object') continue;
    const n = Number((baris as any).n);
    const v = String((baris as any).v || '').toUpperCase();
    if (!Number.isInteger(n) || n < 1 || n > jumlahKalimat) continue;
    if (!VONIS_SAH.has(v)) continue;
    if (terpakai.has(n)) continue; // putusan ganda untuk kalimat yang sama: yang pertama dipakai
    terpakai.add(n);
    const pMentah = (baris as any).p;
    const p = Number.isInteger(pMentah) && Number(pMentah) >= 0 ? Number(pMentah) : null;
    hasil.push({ n, v: v as VonisKalimat, p: v === 'BERSANDAR' ? p : null });
  }
  return hasil.sort((a, b) => a.n - b.n);
}

export type RingkasanHakim = { bersandar: number; tidak: number; percakapan: number; takTerbaca: number };

/** Hitungan ringkas untuk kolom tabel — kalimat tanpa putusan dihitung `takTerbaca`, bukan diam-diam hilang. */
export function ringkasPutusan(putusan: PutusanHakim[], jumlahKalimat: number): RingkasanHakim {
  const r: RingkasanHakim = { bersandar: 0, tidak: 0, percakapan: 0, takTerbaca: 0 };
  for (const p of putusan) {
    if (p.v === 'BERSANDAR') r.bersandar++;
    else if (p.v === 'TIDAK') r.tidak++;
    else r.percakapan++;
  }
  r.takTerbaca = Math.max(0, jumlahKalimat - putusan.length);
  return r;
}

/**
 * Label yang AKAN diusulkan hakim seandainya ia berwenang — dicatat untuk dibandingkan, tidak dipakai.
 *
 * `labelModel` = label yang terlihat di jawaban. INSUFFICIENT berarti model menyatakan **tidak
 * menemukan jawabannya**, dan jawaban semacam itu TIDAK berada di tangga VERIFIED–PARTIAL–HYPOTHESIS
 * sama sekali: kalimat-kalimatnya bercerita tentang isi dokumen, bukan menjawab pertanyaannya.
 *
 * Terukur 2026-09-28: pertanyaan tunjangan kinerja (tidak ada di dokumen mana pun) dijawab
 * INSUFFICIENT oleh model, tetapi penggulungan lama mengubahnya jadi **VERIFIED** — karena ketiga
 * kalimat "dokumen hanya memuat X dan Y" memang bersandar. Vonis per kalimatnya benar; rumusnya yang
 * salah. Karena itu kasus ini dikeluarkan dari perbandingan, bukan dipaksa masuk.
 */
export function labelUsulan(
  r: RingkasanHakim,
  labelModel?: string
): 'VERIFIED' | 'PARTIAL' | 'HYPOTHESIS' | 'TAK_PASTI' | 'TIDAK_BERLAKU' {
  if (labelModel === 'INSUFFICIENT') return 'TIDAK_BERLAKU';
  const diputus = r.bersandar + r.tidak;
  if (diputus === 0) return 'TAK_PASTI';
  if (r.tidak === 0) return 'VERIFIED';
  if (r.bersandar === 0) return 'HYPOTHESIS';
  return 'PARTIAL';
}

export const HAKIM_AKTIF = (env: Record<string, unknown> | undefined): boolean =>
  String((env as any)?.hakimBayangan ?? '') === '1';

/**
 * Nama kunci di `rctx.keys` TIDAK sama dengan id penyedia, dan itu berbeda antar-jalur:
 *
 *   `request_pipeline.ts` (jalur chat)  → keys.openRouter, keys.openAI, keys.gemini, keys.groq
 *   `judge_endpoint.ts`   (endpoint)    → keys[provider] DAN alias camelCase, keduanya
 *
 * Versi pertama berkas ini hanya membaca `keys[provider]`, disalin dari `judge_endpoint`. Akibatnya
 * di jalur chat `keys['openrouter']` selalu undefined dan hakim berhenti dengan
 * "tidak ada kunci pengguna" walau kuncinya ada — terbukti live 2026-09-28 05:22, chat pertama
 * sesudah bendera dinyalakan. Karena itu kedua bentuk dicoba di sini.
 */
export function kunciPengguna(rctx: any): string {
  const provider = String(rctx?.model?.provider || '');
  if (!provider) return '';
  const keys = rctx?.keys || {};
  const alias: Record<string, string[]> = {
    openrouter: ['openRouter', 'openRouterByok'],
    openai: ['openAI'],
    gemini: ['gemini'],
    groq: ['groq']
  };
  const calon = [provider, ...(alias[provider] || [])];
  for (const nama of calon) {
    const nilai = keys[nama];
    if (typeof nilai === 'string' && nilai.trim()) return nilai.trim();
  }
  return '';
}

type BahanHakim = {
  /** teks yang dinilai hakim (jawaban model, sebelum label dikoreksi sistem) */
  jawaban: string;
  /** teks akhir yang BENAR-BENAR dilihat Owner — dari sinilah label pembanding dibaca */
  jawabanAkhir: string;
  isiDokumen: string[];
  /** true bila `periksaLabelSumber` menurunkan label model */
  diturunkan: boolean;
  chatId?: string;
};

/**
 * Menjalankan hakim dan MENCATATNYA. Tidak mengembalikan apa pun, dengan sengaja — lihat pagar 2.
 */
export async function jalankanHakimBayangan(rctx: any, bahan: BahanHakim): Promise<void> {
  const mulai = Date.now();
  try {
    if (!HAKIM_AKTIF(rctx?.env)) return;

    const provider = String(rctx?.model?.provider || '');
    const kunci = kunciPengguna(rctx);
    if (!provider || !kunci) {
      console.log('[HakimBayangan] dilewati — tidak ada kunci pengguna (BYOK) untuk penyedia ini.');
      return;
    }

    const isi = (bahan.isiDokumen || []).filter((t) => typeof t === 'string' && t.trim());
    const kalimat = kalimatUntukHakim(bahan.jawaban);
    // Batas SATU kalimat, bukan dua. Batas lama membuat jawaban pendek tak pernah dinilai sama sekali
    // — terukur 2026-09-28: "berapa jumlah pegawai yang diintervensi?" dijawab ringkas, dilewati diam-diam,
    // dan tidak ada barisnya di tabel. Justru jawaban pendek yang paling mudah diperiksa.
    if (!isi.length || kalimat.length < 1) {
      console.log(`[HakimBayangan] dilewati — potongan=${isi.length} kalimat=${kalimat.length}`);
      return;
    }

    const prompt = susunPromptHakim(kalimat, isi);
    const masukan = masukanHakim(prompt);
    const { CapabilityRegistry } = await import('../adapters/adapter_registry.ts');
    const adapters = CapabilityRegistry.getAvailableAIAdapters([provider]);
    if (!adapters.length) {
      console.warn(`[HakimBayangan] tidak ada adapter untuk "${provider}".`);
      return;
    }

    let mentah = '';
    let biayaAsliUsd: number | undefined;
    let modelTercatat = '';
    for (const adapter of adapters) {
      try {
        const res = await adapter.execute(masukan, { trace_id: rctx?.traceId || 'hakim' });
        if (res?.result) {
          mentah = String(res.result);
          biayaAsliUsd = typeof (res as any).usageCostUsd === 'number' ? (res as any).usageCostUsd : undefined;
          modelTercatat = String((res as any).modelUsed || '');
          break;
        }
      } catch (e: any) {
        console.warn(`[HakimBayangan] adapter ${adapter.name} gagal:`, e?.message);
      }
    }
    if (!mentah) {
      console.warn('[HakimBayangan] semua adapter gagal menjawab.');
      return;
    }

    // Biaya WAJIB tercatat walau ini jalur bayangan: pengeluaran yang tak terlihat anggaran adalah
    // persis celah yang diperbaiki 24 September di padatkan_endpoint.ts & judge_endpoint.ts.
    rctx.logger?.logApiUsage?.(
      provider,
      modelTercatat || rctx?.model?.model || '',
      `${SISTEM_HAKIM}\n${prompt}`,
      mentah,
      biayaAsliUsd
    );

    const putusan = bacaPutusanHakim(mentah, kalimat.length);
    const ringkas = ringkasPutusan(putusan, kalimat.length);
    const labelSistem = labelTerlihat(bahan.jawabanAkhir);
    const usulan = labelUsulan(ringkas, labelSistem);
    const ms = Date.now() - mulai;

    console.log(
      `[HakimBayangan] sistem=${labelSistem}${bahan.diturunkan ? '(diturunkan)' : ''} usulan=${usulan} ` +
      `bersandar=${ringkas.bersandar} tidak=${ringkas.tidak} percakapan=${ringkas.percakapan} ` +
      `takTerbaca=${ringkas.takTerbaca} kalimat=${kalimat.length} ${ms}ms`
    );

    await simpanPutusan(rctx, bahan, kalimat, putusan, ringkas, labelSistem, usulan, modelTercatat, biayaAsliUsd, ms);
  } catch (e: any) {
    // Pagar 3: jalur bayangan tidak boleh merembet ke jawaban Owner, apa pun yang terjadi.
    console.error('[HakimBayangan] gagal (diabaikan):', e?.message);
  }
}

/**
 * Menulis satu baris ke `hakim_bayangan`. Kalimatnya DIPOTONG 160 huruf: tabel ini untuk membandingkan
 * vonis, bukan arsip kedua isi chat — kuota basis data proyek ini pernah dimakan log (Item 93).
 */
async function simpanPutusan(
  rctx: any,
  bahan: BahanHakim,
  kalimat: string[],
  putusan: PutusanHakim[],
  ringkas: RingkasanHakim,
  labelSistem: string,
  usulan: string,
  model: string,
  biayaUsd: number | undefined,
  ms: number
): Promise<void> {
  const url = String(rctx?.env?.supabaseUrl || '');
  const kunciLayanan = String(rctx?.env?.supabaseServiceKey || '');
  if (!url || !kunciLayanan) return;

  const petaVonis = new Map(putusan.map((p) => [p.n, p]));
  const rinci = kalimat.map((k, i) => {
    const p = petaVonis.get(i + 1);
    return { n: i + 1, v: p?.v ?? null, p: p?.p ?? null, k: k.slice(0, 160) };
  });

  // Alamat esm.sh yang sama dengan seluruh berkas lain di fungsi ini (12 pemakai) — bukan `jsr:`,
  // yang tidak bisa diselesaikan esbuild saat pemeriksaan bundel sebelum deploy.
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
  const db = createClient(url, kunciLayanan);
  const { error } = await db.from('hakim_bayangan').insert({
    user_id: rctx?.userId || null,
    trace_id: rctx?.traceId || null,
    chat_id: bahan.chatId || null,
    model,
    label_sistem: labelSistem,
    diturunkan: !!bahan.diturunkan,
    label_usulan: usulan,
    sepakat: labelSistem === usulan,
    jumlah_kalimat: kalimat.length,
    jumlah_potongan: Math.min((bahan.isiDokumen || []).length, MAKS_POTONGAN),
    bersandar: ringkas.bersandar,
    tidak: ringkas.tidak,
    percakapan: ringkas.percakapan,
    tak_terbaca: ringkas.takTerbaca,
    biaya_usd: typeof biayaUsd === 'number' ? biayaUsd : null,
    durasi_ms: ms,
    rinci
  });
  if (error) console.warn('[HakimBayangan] gagal menyimpan:', error.message);
}
