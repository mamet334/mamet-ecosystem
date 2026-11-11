
import { buildSourceTraceText } from './confidence_engine.ts';


import {
  EvidenceReport,
  ConfidenceReport,
  IdentityBlock,
  MemoryBlock,
  KnowledgeBlock,
  RuntimeBlock,
  ConstraintBlock,
  OutputContractBlock,
  UniversalEvidenceContract,
  ContractBuilderInput,
} from './types.ts';


export function buildUniversalContract(params: ContractBuilderInput): UniversalEvidenceContract {
  const {
    mode, appSource, evidenceReport, confidenceReport,
    brain1Entries, brain2Tasks, brain2Gaps, brain2Verifications,
    ragArray, memoryArray, memoryContextText, brain1ContextText,
    brain2ContextText, ragContextText, policyConstraints, policyForbidden,
    systemBasePrompt, activeConflicts = 0,
  } = params;

  const capabilities: string[] = [];
  const restrictions: string[] = [];

  if (mode === 'ENGINEER') {
    capabilities.push(
      'Membaca Brain 1 (ADR, Solution, Lesson)',
      'Membaca Brain 2 (Task, Gap, Verification)',
      'MEMBACA KODE SUMBER REPO lewat [MAMET_CMD: …] — git grep, git show, git log, git blame, git ls-files. Perintah BACA dijalankan sendiri, tanpa menunggu persetujuan siapa pun',
      'Analisis teknikal mendalam',
    );
    restrictions.push(
      'Tidak boleh menulis memory otomatis',
      'Tidak boleh menggunakan web search',
      'Perintah yang MENJALANKAN KODE (node -e, python -c, npm) perlu persetujuan Owner — usulkan lewat [MAMET_CMD: …] dan tunggu hasilnya; jangan mengaku sudah menjalankannya',
      'WAJIB memiliki evidence sebelum menjawab. Untuk pertanyaan tentang KODE, evidence diperoleh dengan MENENGOK repo lebih dulu — bukan dengan menyatakan tidak ada',
    );
  } else if (mode === 'LITE') {
    capabilities.push('Menjawab pertanyaan umum', 'RAG retrieval dari Knowledge Base');
    restrictions.push('Tidak boleh membaca/menulis User Memory', 'Tidak boleh menggunakan tool otomasi');
  } else {
    capabilities.push('RAG retrieval', 'Membaca User Memory', 'Web search', 'Menjalankan Sub-Agent');
    if (evidenceReport.verdict === 'WARNING') {
      restrictions.push('Sampaikan keterbatasan jika evidence pendukung tidak mencukupi');
    } else {
      restrictions.push('Prioritaskan dokumen evidence yang tersedia sebagai rujukan utama');
    }
  }

  const identity: IdentityBlock = {
    name: 'Mamet AI',
    version: '2.1.0',
    mode,
    appSource,
    capabilities,
    restrictions,
  };

  const memory: MemoryBlock = {
    hasMemory: memoryArray.length > 0,
    memoryCount: memoryArray.length,
    memoryContext: memoryContextText,
  };

  const brain1Kembar = mode === 'ENGINEER' && brain1Entries.length > 0;
  const brain1Ringkas = brain1Kembar
    ? brain1Entries.map((e: any) => `[${e.entry_type}] ${e.title}`).join('\n')
      + `\n(Isi lengkap ${brain1Entries.length} entri ini ada di blok [MAMET ENGINEER CONTEXT] di atas — tidak diulang di sini.)`
    : brain1ContextText;

  const knowledge: KnowledgeBlock = {
    hasBrain1: brain1Entries.length > 0,
    brain1Count: brain1Entries.length,
    brain1Summary: brain1Ringkas,
    hasBrain2: (brain2Tasks.length + brain2Gaps.length + brain2Verifications.length) > 0,
    brain2Count: brain2Tasks.length + brain2Gaps.length + brain2Verifications.length,
    brain2Summary: brain2ContextText,
    hasRAG: ragArray.length > 0,
    ragCount: ragArray.length,
    ragSummary: ragContextText,
  };

  const runtime: RuntimeBlock = {
    evidenceGateVerdict: evidenceReport.verdict,
    totalEvidence: evidenceReport.totalEvidence,
    confidenceScore: confidenceReport.score,
    confidenceGrade: confidenceReport.grade,
    activeConflicts,
    versionStatus: confidenceReport.signals.versionStatus,
    requestId: evidenceReport.requestId,
    timestamp: new Date().toISOString(),
  };

  const constraint: ConstraintBlock = {
    canCallLLM: evidenceReport.isValid,
    canWriteMemory: mode === 'AI',
    canReadMemory: mode !== 'LITE',
    canUseWebSearch: mode !== 'ENGINEER',
    canUseAutomation: mode === 'AI',
    canUseDesktopTools: false,
    canWriteKnowledge: false,
    activeConstraints: policyConstraints,
    forbidden: mode === 'ENGINEER'
      ? [
        'Mengaku tahu isi kode tanpa menengoknya lebih dulu lewat perintah git baca',
        'Menyatakan "tidak ada evidence" atau "tidak ditemukan" untuk pertanyaan tentang KODE tanpa pernah menjalankan satu pun pencarian di repo',
        'Menyebut ADR, Task, atau knowledge yang tidak ada di bagian KNOWLEDGE di atas',
        'Memberikan informasi yang tidak dapat ditelusuri ke evidence — kode sumber repo TERMASUK evidence yang sah, asalkan alamat berkas dan nomor barisnya disebut',
        ...policyForbidden,
      ]
      : [
        'Menyebut dokumen, judul, atau sumber yang tidak ada di BLOK 4 atau di hasil alat percakapan ini',
        'Menyajikan dugaan atau pengetahuan sendiri seolah-olah berasal dari dokumen pengguna',
        ...policyForbidden,
      ],
  };

  const labelVariant: 'full' | 'short' = mode === 'LOOKUP' ? 'short' : 'full';
  const outputContract: OutputContractBlock = {
    language: 'id',
    expectedFormat: mode === 'ENGINEER' ? 'structured_technical' : 'conversational',
    requireSourceTrace: mode === 'ENGINEER',
    requireConfidenceStatement: mode === 'ENGINEER' && confidenceReport.score < 70,
    forbiddenPatterns: [
      'Mengarang data teknikal yang tidak ada di evidence',
      'Menyebut "berdasarkan pengetahuan umum saya" di Engineer mode',
    ],
    labelVariant,
  };


  const contract: UniversalEvidenceContract = {
    identity,
    memory,
    knowledge,
    runtime,
    constraint,
    outputContract,
    systemBasePrompt,
    hasilAlatFolder: params.hasilAlatFolder === true,
    keluaranPerintah: params.keluaranPerintah === true,
    asSystemPromptText: () => renderContractAsText(contract, confidenceReport),
  };

  return contract;
}


function renderContractAsText(
  contract: UniversalEvidenceContract,
  confidenceReport: ConfidenceReport
): string {
  const { identity, memory, knowledge, runtime, constraint, outputContract, systemBasePrompt } = contract;

  let text = systemBasePrompt + '\n';

  text += `\n\n[UNIVERSAL EVIDENCE CONTRACT v2.0]\n`;
  text += `System: ${identity.name} | Mode: ${identity.mode} | v${identity.version}\n`;
  text += `Request ID: ${runtime.requestId} | Waktu server (DATA SISTEM, bukan dokumen): ${runtime.timestamp}\n\n`;

  text += `[BLOK 1: IDENTITY]\n`;
  text += `Mode Aktif: ${identity.mode}\n`;
  if (identity.mode === 'ENGINEER' || identity.mode === 'LITE') text += `Kapabilitas: ${identity.capabilities.join(', ')}\n`;
  text += `Batasan: ${identity.restrictions.join(' | ')}\n\n`;

  text += `[BLOK 2: RUNTIME STATUS]\n`;
  text += `Evidence Gate: ${runtime.evidenceGateVerdict} | Total Evidence: ${runtime.totalEvidence}\n`;
  text += `Backend Confidence: ${runtime.confidenceScore}% (Grade: ${runtime.confidenceGrade})\n`;
  if (runtime.activeConflicts > 0) {
    text += `⚠️ Konflik Aktif: ${runtime.activeConflicts} — perlu kehati-hatian\n`;
  }
  if (runtime.versionStatus === 'OUTDATED') {
    text += `⚠️ Beberapa knowledge bukan versi terkini\n`;
  }
  text += '\n';

  if (memory.hasMemory) {
    text += `[BLOK 3: USER MEMORY — ${memory.memoryCount} node]\n`;
    text += memory.memoryContext + '\n\n';
  }

  text += `[BLOK 4: KNOWLEDGE]\n`;

  if (knowledge.hasBrain1) {
    text += `--- Brain 1 (Static Knowledge: ADR, Lesson, Vision) ---\n`;
    text += knowledge.brain1Summary + '\n';
  } else if (identity.mode === 'ENGINEER') {
    text += `--- Brain 1: KOSONG (tidak ada static knowledge yang qualified) ---\n\n`;
  }

  if (knowledge.hasBrain2) {
    text += `--- Brain 2 (Dynamic Context: Task, Gap, Verification) ---\n`;
    text += knowledge.brain2Summary + '\n';
  } else if (identity.mode === 'ENGINEER') {
    text += `--- Brain 2: KOSONG (tidak ada task/gap aktif) ---\n\n`;
  }

  if (!knowledge.hasRAG && !knowledge.hasBrain1 && !knowledge.hasBrain2 && identity.mode !== 'ENGINEER') {
    text += `(tidak ada dokumen yang disertakan pada pesan ini)\n\n`;
  }

  if (knowledge.hasRAG) {
    text += `--- RAG Documents (${knowledge.ragCount} dokumen) ---\n`;
    text += `<RAG>\n${knowledge.ragSummary}\n</RAG>\n\n`;

    text += `ATURAN KUTIPAN PERSIS (berlaku untuk dokumen di atas):\n`;
    text += `- Perintah, kode, jalur file, flag/parameter, nama fungsi, kunci konfigurasi, pesan error, dan URL WAJIB ditulis ulang PERSIS huruf demi huruf seperti di dokumen: jangan diterjemahkan, jangan dirapikan ejaannya, jangan diganti tanda kutip/tanda hubungnya, jangan ditambah atau dikurangi spasi.\n`;
    text += `- Bahasa penjelasan mengikuti bahasa pertanyaan user, tetapi bagian yang dikutip TETAP dalam bahasa aslinya (dokumen berbahasa Inggris tetap dikutip dalam bahasa Inggris).\n`;
    text += `- Tulis perintah di dalam blok kode tersendiri, bukan disisipkan ke tengah kalimat.\n`;
    text += `- Bila dokumen tidak memuat perintah yang diminta, katakan apa adanya. Jangan menyusun perintah dari ingatan sendiri lalu menyebutnya berasal dari dokumen.\n\n`;
  }

  text += `\n[BLOK 5: CONSTRAINT]\n`;
  text += `Dilarang keras:\n`;
  for (const f of constraint.forbidden) {
    text += `  ✗ ${f}\n`;
  }
  if (constraint.activeConstraints.length > 0) {
    text += `Batasan aktif:\n`;
    for (const c of constraint.activeConstraints) {
      text += `  ⚠ ${c}\n`;
    }
  }
  text += '\n';

    if (outputContract.requireSourceTrace) {
    text += `WAJIB: Sertakan SOURCE TRACE di bagian AKHIR jawaban Anda menggunakan format berikut PERSIS:\n`;
    text += `\n`;
    text += `SOURCE TRACE:\n`;
    text += `- [ID-XXXX] Nama atau deskripsi singkat evidence\n`;
    text += `\n`;
    text += `Contoh yang BENAR:\n`;
    text += `SOURCE TRACE:\n`;
    text += `- [ADR-0006] Decision record arsitektur two-brain context\n`;
    text += `- [GAP-0012] Gap analisis verifikasi engine\n`;
    text += `\n`;
    text += `PENTING: Gunakan ID yang PERSIS sama dengan evidence di BLOK 4 KNOWLEDGE di atas. Jangan mengarang ID.\n`;
    text += `\n`;
    text += `ATURAN TAMBAHAN:\n`;
    text += `- SOURCE TRACE HARUS menjadi baris terakhir dari jawaban Anda. Jangan tambahkan kalimat penutup, kesimpulan, atau teks apapun setelahnya.\n`;
    text += `- Jika tidak ada evidence yang relevan dari daftar KNOWLEDGE, tulis: "SOURCE TRACE: - [NONE]".\n`;
  }
  if (confidenceReport.sourceTrace.length > 0 && outputContract.requireSourceTrace) {
    text += buildSourceTraceText(confidenceReport.sourceTrace);
  }

  text += `\n[BLOK 6: OUTPUT FORMAT & STATUS LABEL]\n`;
  const isShortVariant = outputContract.labelVariant === 'short';

  if (runtime.evidenceGateVerdict === 'PASSED') {
    text += `WAJIB: pilih TEPAT SATU label di baris PALING AKHIR jawaban Anda:\n`;
    text += `- [STATUS: VERIFIED] — HANYA bila isi jawaban benar-benar berasal dari dokumen di BLOK 4 / <RAG> di atas. Bila memakai label ini, sertakan Sumber: "judul dokumen persis seperti tertulis di BLOK 4" — boleh di baris sebelum label atau pada baris label itu sendiri. Sebut nomor halaman HANYA bila potongan yang dikutip memuat penanda [Halaman N]; bila tidak ada penanda, JANGAN menulis nomor halaman.\n`;
    text += `- [STATUS: HYPOTHESIS - Rekomendasi AI] — bila dokumen yang tersedia tidak memuat jawabannya dan Anda menjawab dari pengetahuan sendiri.\n`;
    text += `- [STATUS: INSUFFICIENT] — bila jawabannya tidak diketahui.\n`;
    text += `Waktu, tanggal, zona waktu pengguna (KONTEKS WAKTU), dan Request ID di header kontrak adalah DATA SISTEM, bukan dokumen — jangan dijadikan Sumber dan jangan menjadi dasar label VERIFIED.\n`;
    text += `Bila INTI jawaban berasal dari data sistem atau pengetahuan Anda sendiri, dan dokumen hanya melengkapi sebagian, JANGAN pakai VERIFIED: pakai [STATUS: HYPOTHESIS - Rekomendasi AI] dan sebutkan bagian mana yang berasal dari dokumen.\n`;
    text += `Dokumen terlampir TIDAK otomatis berarti VERIFIED. Label VERIFIED tanpa baris Sumber yang cocok diturunkan otomatis oleh sistem.\n`;
    if (String(knowledge.ragSummary || '').includes('[TABEL CENTANG')) {
      text += `TABEL CENTANG: blok [TABEL CENTANG — …] dibaca dari posisi tanda centang di PDF. Untuk baris yang tercantum di blok itu, nilai kolomnya (mis. Mutlak/Penting/Perlu) WAJIB diambil dari blok, BUKAN dari tabel Markdown/OCR di atasnya — tabel itu bisa bergeser kolom. Butir "(label perkiraan)": kolomnya pasti, cocokkan barisnya dengan tabel. Bila halaman sumber memuat [TABEL CENTANG TIDAK PASTI — …], JANGAN pakai VERIFIED untuk nilai kolom dari halaman itu; katakan bahwa tingkat/kolomnya perlu dicek di dokumen asli halaman tersebut.\n`;
    }
  } else if (runtime.evidenceGateVerdict === 'WARNING') {
    if (isShortVariant) {
      text += `WAJIB: Karena request ini adalah mode LOOKUP dan Evidence Gate berstatus WARNING (retrieval di-skip by design), Anda WAJIB mencantumkan label ringkas berikut di baris PALING AKHIR jawaban Anda:\n`;
      text += `[Pengetahuan umum AI — tidak diverifikasi dari dokumen Anda]\n`;
    } else {
      text += `WAJIB: Karena Evidence Gate berstatus WARNING (tidak ada dokumen bukti spesifik), Anda WAJIB mencantumkan salah satu label berikut di baris PALING AKHIR jawaban Anda:\n`;
      text += `- [STATUS: HYPOTHESIS - Rekomendasi AI] (jika memberikan jawaban dari analisis/pengetahuan internal)\n`;
      text += `- [STATUS: INSUFFICIENT] (jika tidak tahu atau data tidak ditemukan)\n`;
    }
  }

  if (contract.hasilAlatFolder) {
    text += `\n[LABEL UNTUK HASIL ALAT FOLDER KERJA]\n`;
    text += `Pesan "[HASIL ALAT FOLDER]" di percakapan ini dicatat oleh proses utama aplikasi di laptop pengguna — untuk label, statusnya SETARA dokumen BLOK 4: isi berkas yang dibaca (folder_read), perubahan yang tercatat BERHASIL atau DITOLAK, dan keluaran perintah (folder_run). Aturan ini menggantikan syarat "dokumen BLOK 4/<RAG>" di atas khusus untuk hasil alat folder.\n`;
    text += `- Inti jawaban melaporkan isi berkas, perubahan, penolakan, atau keluaran perintah persis seperti tercatat → [STATUS: VERIFIED] dengan baris Sumber: yang menyebut alamat berkas atau perintah persis seperti di kepala hasil, mis. Sumber: \`app.py\`, \`python app.py\`. Angka yang Anda sebut harus tertulis di hasil itu.\n`;
    text += `- Inti jawaban berupa saran, tafsiran, atau rencana Anda sendiri → [STATUS: HYPOTHESIS - Rekomendasi AI].\n`;
  }

  if (contract.keluaranPerintah) {
    text += `\n[LABEL UNTUK KELUARAN PERINTAH ENGINEER]\n`;
    text += `Pesan "[TERMINAL OUTPUT for: <perintah>]" di percakapan ini adalah keluaran perintah yang dijalankan proses utama di laptop Owner setelah Owner menyetujui dialog izin — untuk label, statusnya SETARA dokumen BLOK 4. Aturan ini menggantikan syarat "dokumen BLOK 4/<RAG>" di atas khusus untuk keluaran perintah.\n`;
    text += `- Inti jawaban melaporkan isi berkas atau keluaran itu persis seperti tercatat → [STATUS: VERIFIED] dengan baris Sumber: yang menyebut PERINTAHNYA persis seperti di kepala keluaran, mis. Sumber: \`git show HEAD:frontend/src/....js\`. Angka, nomor baris, dan nama yang Anda sebut harus benar-benar ada di keluaran itu.\n`;
    text += `- Inti jawaban berupa usulan, tafsiran, atau rencana Anda sendiri → [STATUS: HYPOTHESIS - Rekomendasi AI].\n`;
    text += `- Perintah yang DITOLAK Owner atau tidak dijalankan BUKAN sumber: jangan pernah melabeli VERIFIED atas dasar itu.\n`;
  }


  return text;
}
