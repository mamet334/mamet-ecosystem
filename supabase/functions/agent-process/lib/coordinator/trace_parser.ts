import { TraceParseResult } from './types.ts';

export function extractSourceTrace(msg: string): TraceParseResult {
  const lines = msg.split('\n');
  const formatRegex = /[A-Z]{2,3}-\d{4}/;
  const keywordRegex = /^(?:\W|_)*(?:source\s*trace|sources?|referensi)\b/i;
  
  // Scan 30 baris terakhir (diperluas dari 15 — ADR-0012, 2026-07-23)
  // Instruksi prompt baru menaruh SOURCE TRACE di akhir, tapi jawaban panjang
  // memerlukan window yang lebih besar untuk memastikan parser bisa menemukan format ID.
  const scanLimit = Math.max(0, lines.length - 30);
  let headerIndex = -1;
  let firstIdIndex = -1;

  // BARIS DI DALAM PAGAR KODE (```) TIDAK PERNAH DIANGGAP SOURCE TRACE.
  //
  // SOURCE TRACE adalah ekor jawaban dalam bentuk prosa; isi blok kode adalah muatan, bukan kutipan.
  // Tanpa aturan ini, ID apa pun yang KEBETULAN ada di dalam blok kode memotong muatannya.
  //
  // Terbukti live 2026-09-24 01:37: Engineer menyusun patch JSON untuk memperbaiki komentar yang
  // BERISI teks "[ADR-0017 Fase 7]". Potongan "ADR-0017" cocok dengan formatRegex, jadi pemotongan
  // terjadi DI TENGAH patch JSON: sisa jawaban tinggal 112 huruf dengan "{" tanpa "}" →
  // CHECK_P02_VALID_JSON_PATCH_FORMAT gagal → HARD GATE memblokir, dan patch yang sebenarnya benar
  // ditolak. Penjaga lama hanya mencegah jawaban jadi KOSONG; jawaban yang TERPOTONG tetap lolos.
  const diDalamPagar: boolean[] = [];
  let pagarTerbuka = false;
  for (const l of lines) {
    if (/^\s*```/.test(l)) {
      // Baris pagar itu sendiri bukan isi kode, tapi juga bukan trace.
      diDalamPagar.push(true);
      pagarTerbuka = !pagarTerbuka;
      continue;
    }
    diDalamPagar.push(pagarTerbuka);
  }

  for (let i = scanLimit; i < lines.length; i++) {
    if (diDalamPagar[i]) continue;
    const line = lines[i].trim();
    if (headerIndex === -1 && keywordRegex.test(line)) headerIndex = i;
    if (firstIdIndex === -1 && formatRegex.test(line)) firstIdIndex = i;
  }
  
  let startIndex = -1;
  if (headerIndex !== -1) {
    let hasId = false;
    for (let i = headerIndex; i < lines.length; i++) {
      // Aturan pagar berlaku di sini juga: ID di dalam blok kode bukan bukti adanya trace.
      if (!diDalamPagar[i] && formatRegex.test(lines[i])) { hasId = true; break; }
    }
    if (hasId) startIndex = headerIndex;
    else if (firstIdIndex !== -1) startIndex = firstIdIndex;
  } else if (firstIdIndex !== -1) {
    startIndex = firstIdIndex;
  }
  
  if (startIndex !== -1) {
    const replyWithoutTrace = lines.slice(0, startIndex).join('\n').trim();
    // Penjaga: SOURCE TRACE adalah EKOR jawaban, jadi memotongnya tidak boleh menghabiskan seluruh jawaban.
    // Tanpa penjaga ini, satu ID di BARIS PERTAMA membuat seluruh jawaban dianggap trace dan teks jawaban jadi
    // kosong → CHECK_001_RESPONSE_NOT_EMPTY gagal → HARD GATE memblokir, Owner tidak menerima jawaban apa pun.
    // Terbukti live 2026-09-23 01:53: baris pertama "TUGAS YANG DIKERJAKAN: TASK-0014 — …" cocok dengan
    // formatRegex (potongan "ASK-0014"), jawaban Engineer yang utuh hilang seluruhnya.
    // Bila pemotongan menyisakan jawaban kosong, anggap saja tidak ada trace yang bisa dipisahkan.
    // PENJAGA KEDUA: pemotongan yang meninggalkan KURUNG TERBUKA bukan pemotongan trace.
    //
    // SOURCE TRACE adalah prosa di ekor jawaban, jadi membuangnya tidak pernah membelah struktur.
    // Kalau sesudah dipotong masih ada "{" atau "[" yang tak tertutup, titik potongnya ada DI DALAM
    // sebuah struktur — artinya yang dipotong itu muatan, bukan kutipan sumber.
    //
    // Terbukti live 2026-09-24 01:37 dan 01:42 (dua kali, dua putaran berbeda): PatchGenerator meminta
    // model menulis patch sebagai JSON TELANJANG — tanpa pagar ``` — dan patch itu memperbaiki komentar
    // yang BERISI teks "[ADR-0017 Fase 7]". Potongan "ADR-0017" cocok dengan formatRegex, pemotongan
    // jatuh di tengah JSON, dan yang tersisa 112 huruf dengan "{"=3, "}"=0 →
    // CHECK_P02_VALID_JSON_PATCH_FORMAT gagal → HARD GATE memblokir patch yang isinya benar.
    //
    // Penjaga pagar kode di atas TIDAK menolong di sini justru karena balasannya tidak berpagar.
    // Harganya disadari: jawaban prosa dengan kurung yang memang tidak seimbang akan menahan trace-nya
    // menempel di badan jawaban. Itu kerugian tampilan; membelah patch adalah kerugian fungsi.
    const terbuka = (t: string, buka: string, tutup: string) =>
      (t.split(buka).length - 1) > (t.split(tutup).length - 1);
    const kurungTakSeimbang = terbuka(replyWithoutTrace, '{', '}') || terbuka(replyWithoutTrace, '[', ']');

    if (replyWithoutTrace.length > 0 && !kurungTakSeimbang) {
      return {
        replyWithoutTrace,
        sourceTrace: lines.slice(startIndex).join('\n').trim()
      };
    }
  }

  return { replyWithoutTrace: msg, sourceTrace: undefined };
}
