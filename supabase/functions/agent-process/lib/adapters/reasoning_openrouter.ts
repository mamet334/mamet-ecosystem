


export const MAKS_TOKEN_JAWABAN = 8192;

export const MIN_TOKEN_LAYAK = 128;

export function pesanTerpotongPlafon(plafon: number): string {
  return `\n\n⚠️ [JAWABAN TERPOTONG] Plafon token jawaban habis (max_tokens=${plafon}) sebelum model selesai menulis. Kalimat terakhir terputus di tengah — ini BUKAN model gagal atau kehabisan bahan. Saldo OpenRouter sedang tipis; isi ulang untuk jawaban utuh.`;
}

export function terpotongKarenaPlafon(data: any): boolean {
  const sebab = data?.sebabSelesai ?? data?.choices?.[0]?.finish_reason;
  return sebab === 'length';
}

export const MARGIN_SALDO = 0.9;

export function tokenTerjangkau(teks: string): number | null {
  const semua = [...String(teks || '').matchAll(/can only afford\s+([\d,.]+)/gi)]
    .map((m) => Math.floor(Number(m[1].replace(/,/g, ''))))
    .filter((n) => Number.isFinite(n) && n > 0);
  return semua.length ? Math.min(...semua) : null;
}

export function plafonUlang(teks: string): number | null {
  const n = tokenTerjangkau(teks);
  return n === null ? null : Math.floor(n * MARGIN_SALDO);
}

export function batasPrompt(teks: string): { dipakai: number; batas: number } | null {
  const m = String(teks || '').match(/Prompt tokens limit exceeded:\s*([\d,.]+)\s*>\s*([\d,.]+)/i);
  if (!m) return null;
  const dipakai = Math.floor(Number(m[1].replace(/,/g, '')));
  const batas = Math.floor(Number(m[2].replace(/,/g, '')));
  return Number.isFinite(dipakai) && Number.isFinite(batas) ? { dipakai, batas } : null;
}

export function tabrakanPermintaanSerentak(teks: string): boolean {
  return /in-flight requests/i.test(String(teks || ''));
}

export function pesanSaldoTakCukup(teks: string, diminta: number): string {
  if (tabrakanPermintaanSerentak(teks)) {
    return 'Dua permintaan ke OpenRouter berjalan BERSAMAAN dan saldo tidak cukup menanggung keduanya sekaligus (402, in-flight). Ini bukan saldo habis — permintaan yang satunya masih berjalan dan belum diperhitungkan. Tunggu beberapa detik lalu kirim ulang. Bila sering terjadi saat saldo tipis: Hakim Bayangan menambah satu panggilan per jawaban dan bisa dimatikan lewat secret HAKIM_BAYANGAN di Supabase; atau isi ulang saldo.';
  }
  const p = batasPrompt(teks);
  if (p) {
    const lebih = p.dipakai - p.batas;
    return `Prompt terlalu besar untuk saldo OpenRouter saat ini: ${p.dipakai} token dikirim, sedangkan saldo hanya menanggung ${p.batas} — kelebihan ${lebih} token. Menurunkan panjang jawaban TIDAK menolong di sini; yang kebesaran adalah prompt-nya. Lihat log [PROMPT_KOMPOSISI] untuk ukuran tiap bagian — di mode Engineer yang terbesar biasanya konteks Engineer dan sisipan peta repo, keduanya dikirim ulang di SETIAP pesan. Atau isi ulang saldo.`;
  }

  const n = tokenTerjangkau(teks);
  const plafon = plafonUlang(teks);
  if (n === null || plafon === null) {
    return `Saldo OpenRouter tidak cukup untuk permintaan ini (402). Isi ulang saldo. Pesan asli: ${String(teks || '').slice(0, 200)}`;
  }
  if (plafon < MIN_TOKEN_LAYAK) {
    const kelonggaran = Math.round((1 - MARGIN_SALDO) * 100);
    return `Saldo OpenRouter hanya cukup untuk ${n} token jawaban; sesudah kelonggaran ${kelonggaran}% plafon ulangnya ${plafon} token — di bawah minimal ${MIN_TOKEN_LAYAK} untuk jawaban yang layak. Permintaan TIDAK diulang dengan plafon sekecil itu — jawaban terpotong akan terlihat seperti model gagal, bukan seperti saldo habis. Isi ulang saldo.`;
  }
  return `Saldo OpenRouter hanya cukup untuk ${n} token jawaban (diminta ${diminta}); sudah diulang dengan ${plafon} dan tetap ditolak. Saldonya memang terlalu tipis untuk jawaban yang berguna — isi ulang saldo.`;
}

export function teksNalar(obj: any): string {
  if (!obj) return '';
  if (typeof obj.reasoning === 'string' && obj.reasoning) return obj.reasoning;
  const detail = Array.isArray(obj.reasoning_details) ? obj.reasoning_details : [];
  return detail
    .map((d: any) => (d?.type === 'reasoning.summary' ? d?.summary : d?.text))
    .filter((t: any) => typeof t === 'string' && t)
    .join('');
}

export function sisipkanNalar(jawaban: string, nalar?: string): string {
  const n = String(nalar || '').trim();
  if (!n || /<think>/i.test(jawaban || '')) return jawaban;
  return `<think>\n${n}\n</think>\n\n${jawaban}`;
}

export function pembungkusNalarStream() {
  let terbuka = false;
  return {
    potong(nalar: string, isi: string): string {
      let keluar = '';
      if (nalar) { if (!terbuka) { keluar += '<think>\n'; terbuka = true; } keluar += nalar; }
      if (isi) { if (terbuka) { keluar += '\n</think>\n\n'; terbuka = false; } keluar += isi; }
      return keluar;
    },
    akhir(): string {
      if (!terbuka) return '';
      terbuka = false;
      return '\n</think>\n\n';
    }
  };
}

export async function bacaSseOpenRouter(
  res: Response,
  opsi: { onNalar?: (teks: string) => void; onIsiMulai?: () => void; tenggat?: number } = {}
): Promise<any> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No body');
  const dekoder = new TextDecoder();
  let sisa = ''; let isi = ''; let nalar = ''; let usage: any; let provider: string | undefined; let isiMulai = false;
  let terpotong = false;
  let sebabSelesai = '';
  const HABIS = Symbol('tenggat');
  const olah = (baris: string) => {
    if (!baris.startsWith('data: ') || baris.includes('[DONE]')) return;
    let data: any;
    try { data = JSON.parse(baris.slice(6)); } catch { return; }
    if (data.error) throw new Error(`OpenRouter stream error: ${JSON.stringify(data.error).slice(0, 300)}`);
    if (!provider && typeof data.provider === 'string' && data.provider) provider = data.provider;
    if (data.usage) usage = data.usage;
    const fr = data.choices?.[0]?.finish_reason;
    if (typeof fr === 'string' && fr) sebabSelesai = fr;
    const delta = data.choices?.[0]?.delta;
    const n = teksNalar(delta);
    if (n) { nalar += n; opsi.onNalar?.(n); }
    const c = delta?.content || '';
    if (c) { if (!isiMulai) { isiMulai = true; opsi.onIsiMulai?.(); } isi += c; }
  };
  const baca = async (): Promise<any> => {
    if (typeof opsi.tenggat !== 'number') return reader.read();
    const sisaMs = opsi.tenggat - Date.now();
    if (sisaMs <= 0) return HABIS;
    let t: number | undefined;
    try {
      return await Promise.race([reader.read(), new Promise((ok) => { t = setTimeout(() => ok(HABIS), sisaMs); })]);
    } finally {
      if (t !== undefined) clearTimeout(t);
    }
  };
  while (true) {
    const bacaan = await baca();
    if (bacaan === HABIS) {
      terpotong = true;
      reader.cancel().catch(() => {  });
      break;
    }
    const { done, value } = bacaan;
    if (done) break;
    sisa += dekoder.decode(value, { stream: true });
    const baris = sisa.split('\n');
    sisa = baris.pop() || '';
    for (const b of baris) olah(b.trim());
  }
  if (sisa.trim()) olah(sisa.trim());
  return { choices: [{ message: { content: isi, reasoning: nalar } }], usage, provider, terpotong, sebabSelesai };
}

export const MODEL_WAJIB_NALAR = new Set<string>();

export function badanReasoningOpenRouter(body: Record<string, any>, thinking?: boolean): Record<string, any> {
  if (thinking === true) {
    console.log(`[Thinking] Reasoning dinyalakan untuk provider openrouter, model ${body.model}`);
    return { ...body, reasoning: { enabled: true } };
  }
  if (thinking === false && !MODEL_WAJIB_NALAR.has(String(body.model))) {
    return { ...body, reasoning: { enabled: false } };
  }
  return body;
}

export function ditolakKarenaReasoning(status: number, teks: string): boolean {
  return status === 400 && /reasoning/i.test(teks || '');
}

export async function kirimOpenRouterDenganReasoning(
  body: Record<string, any>,
  thinking: boolean | undefined,
  kirim: (b: Record<string, any>) => Promise<Response>,
  jejak?: { plafonDipakai?: number }
): Promise<Response> {
  const badan = badanReasoningOpenRouter(body, thinking);
  if (jejak) jejak.plafonDipakai = Number(badan.max_tokens) || 0;
  const res = await kirim(badan);
  if (res.ok) return res;

  if (res.status === 402) {
    const teks = await res.clone().text().catch(() => '');
    const n = tokenTerjangkau(teks);
    const plafon = plafonUlang(teks);
    const diminta = Number(badan.max_tokens) || 0;
    if (plafon !== null && plafon >= MIN_TOKEN_LAYAK && diminta > plafon) {
      console.warn(`[Saldo] 402: plafon ${diminta} token tidak terjangkau. Terkecil yang dikutip ${n}, diulang SEKALI dengan max_tokens: ${plafon} (margin ${MARGIN_SALDO})`);
      if (jejak) jejak.plafonDipakai = plafon;
      return kirim({ ...badan, max_tokens: plafon });
    }
    console.warn(`[Saldo] 402 tidak diulang — terkecil terjangkau: ${n === null ? 'tak terbaca' : n}, plafon ulang: ${plafon}, diminta: ${diminta}, lantai: ${MIN_TOKEN_LAYAK}`);
    return res;
  }

  if (!badan.reasoning || badan.reasoning.enabled !== false || res.status !== 400) return res;

  const teks = await res.clone().text().catch(() => '');
  if (!ditolakKarenaReasoning(res.status, teks)) return res;

  MODEL_WAJIB_NALAR.add(String(body.model));
  console.log(`[Thinking] Model ${body.model} menolak reasoning dimatikan (${teks.slice(0, 120)}) — diulang tanpa parameter, nalar tetap berjalan`);
  return kirim(body);
}
