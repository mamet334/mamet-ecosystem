
import { pecahKlaim } from './klaim_sumber.ts';

export const MAKS_KALIMAT = 40;
export const MAKS_POTONGAN = 8;
export const MAKS_HURUF_POTONGAN = 1200;
export const MIN_HURUF_KALIMAT = 12;

export type VonisKalimat = 'BERSANDAR' | 'TIDAK' | 'PERCAKAPAN';

export type PutusanHakim = {
  n: number;
  v: VonisKalimat;
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

export function kalimatUntukHakim(jawaban: string): string[] {
  return pecahKlaim(jawaban, { sertakanTabel: true })
    .filter((k) => k.length >= MIN_HURUF_KALIMAT)
    .slice(0, MAKS_KALIMAT);
}

export function labelTerlihat(teks: string): string {
  const t = String(teks || '');
  if (t.includes('[STATUS: VERIFIED]')) return 'VERIFIED';
  if (t.includes('[STATUS: PARTIAL')) return 'PARTIAL';
  if (t.includes('[STATUS: HYPOTHESIS')) return 'HYPOTHESIS';
  if (t.includes('[STATUS: INSUFFICIENT')) return 'INSUFFICIENT';
  if (t.includes('[Pengetahuan umum AI')) return 'PENGETAHUAN_UMUM';
  return 'TANPA_LABEL';
}

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
    if (terpakai.has(n)) continue;
    terpakai.add(n);
    const pMentah = (baris as any).p;
    const p = Number.isInteger(pMentah) && Number(pMentah) >= 0 ? Number(pMentah) : null;
    hasil.push({ n, v: v as VonisKalimat, p: v === 'BERSANDAR' ? p : null });
  }
  return hasil.sort((a, b) => a.n - b.n);
}

export type RingkasanHakim = { bersandar: number; tidak: number; percakapan: number; takTerbaca: number };

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
  jawaban: string;
  jawabanAkhir: string;
  isiDokumen: string[];
  diturunkan: boolean;
  chatId?: string;
};

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
    console.error('[HakimBayangan] gagal (diabaikan):', e?.message);
  }
}

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
