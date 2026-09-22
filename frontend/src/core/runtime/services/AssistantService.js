/**
 * AssistantService.js — Assistant Brain Mamet AI
 *
 * Peran:
 * - Memproses pesan user (handleSend logic)
 * - Inject memory & semantic context ke payload AI
 * - Memanggil Supabase Edge Function (agent-process) dengan streaming/JSON
 * - Menyimpan dan memuat riwayat chat ke/dari Supabase
 * - Menjadi "rumah arsitektur" resmi untuk PR#2 (CognitiveMemoryGovernor), PR#5 (RetrievalStrategy), PR#6 (TokenEfficiency)
 *
 * Prinsip: Satu file, satu tanggung jawab — tidak ada JSX, tidak ada useState.
 * Komponen React (ConversationEngine) hanya memanggil service ini dan menampilkan hasil.
 *
 * Mengikuti pola engineer.js:
 * - Constructor menerima serviceManager
 * - initialize() async untuk setup
 * - Terdaftar resmi di Kernel.js Phase 3
 */

const AGENT_ENDPOINT = 'https://uuyzdjifhdfyyvpxsofu.supabase.co/functions/v1/agent-process';

import { supabase } from '../../../supabase.js';
import { statusLaptop, kirimKeLaptop, sidikJari, cariDiCache, KUOTA_CACHE_MB } from './remoteConversionClient.js';
import { ambilPermintaanAlat, susunPesanHasil, susunPesanKoreksi, namaFolderAman, buangKakiTiruan, peringatanKlaimTanpaAlat, peringatanKlaimEngineer, blokKodeKeMametCmd, MAKS_PUTARAN } from './folderKerjaAlat.js';

// Folder kerja (Item 85 Tahap 1): batas total isi berkas yang dibaca per pertanyaan (semua putaran) — riwayat ikut
// membawa hasil putaran sebelumnya, jadi tanpa batas ini 4 putaran × 5 berkas × 60 KB bisa ±1,2 MB ke model.
const FOLDER_BATAS_BACA_BYTE = 150 * 1024;

// PR#2: Import governor dari versi JS lokal (bukan cross-boundary ke lib/ TypeScript)
import {
  runCognitiveMemoryGovernor,
  LEGACY_COGNITION_ENABLED
} from './CognitiveMemoryGovernorService.js';

// PR#6: Token estimator sederhana (~4 chars per token, standar Anthropic/OpenAI approximation)
// Dipakai untuk logging before/after context optimization
function estimateTokens(text = '') {
  return Math.ceil(text.length / 4);
}

// Zona waktu browser (mis. "Asia/Jakarta"), dikirim bersama pesan supaya server tahu jam lokal pengguna
// sebagai DATA, bukan tebakan model. undefined bila browser tak mendukung — server lalu menyatakan
// jam lokal tidak diketahui.
function zonaWaktuBrowser() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch (_) { return undefined; }
}

// PR#6: Batas maksimal karakter untuk RAG/memory context yang dikirim ke Edge Function
// Cegah bloat — context besar tidak selalu = jawaban lebih baik
const MAX_RAG_CONTEXT_CHARS = 4000;   // ~1000 token
const MAX_SEMANTIC_CONTEXT_CHARS = 2000; // ~500 token

export class AssistantService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this._initialized = false;
  }

  async initialize() {
    this._initialized = true;
    console.log('[AssistantService] Initialized');
  }

  // =============================================
  // MODE RESOLUTION
  // =============================================

  /**
   * Resolusi mode berdasarkan workspaceId aktif.
   * @param {string} workspaceId
   * @returns {{ resolvedMode: string, resolvedAppSource: string }}
   */
  resolveMode(workspaceId) {
    if (workspaceId === 'ws-engineer' || workspaceId === 'ENGINEER') {
      return { resolvedMode: 'ENGINEER', resolvedAppSource: 'engineer' };
    }
    if (workspaceId === 'ws-lite' || workspaceId === 'MAMETLITE' || workspaceId === 'LITE') {
      return { resolvedMode: 'LITE', resolvedAppSource: 'mametlite' };
    }
    return { resolvedMode: 'ASSISTANT', resolvedAppSource: 'assistant' };
  }

  // =============================================
  // FILE PATH EXTRACTION (untuk Engineer mode)
  // =============================================

  /**
   * Extract file path dari pesan user untuk Engineer mode.
   * @param {string} message
   * @returns {string|null}
   */
  extractFilePathFromMessage(message) {
    if (!message) return null;
    const pattern1 = /(?:di\s+)?(?:file|berkas)\s+([a-zA-Z0-9_\-\/\.]+\.(jsx?|tsx?|ts|js))/i;
    const match1 = message.match(pattern1);
    if (match1) return match1[1];

    const pattern2 = /([a-zA-Z0-9_\-\/]+\.(jsx?|tsx?))/g;
    const match2 = message.match(pattern2);
    if (match2 && match2.length > 0) {
      const withSlash = match2.find(m => m.includes('/'));
      return withSlash || match2[0];
    }
    return null;
  }

  // =============================================
  // MEMORY: Store Handler (PR#8 Unification)
  // =============================================

  /**
   * Handle intent MEMORY_STORE dari RequestClassifierService.
   * Menyimpan teks memori bersih ke MemoryGovernorService / MemoryService.
   * @private
   */
  async _handleMemoryStore({ userMsg, contentToStore, category, workspaceId, userId, onDone }) {
    if (!contentToStore || contentToStore.length === 0) {
      onDone?.('⚠️ Konten memori tidak valid atau terlalu pendek.', [], null);
      return;
    }

    const governor = this.serviceManager.has('MemoryGovernorService')
      ? this.serviceManager.get('MemoryGovernorService')
      : null;
    const memoryService = this.serviceManager.get('MemoryService');

    const goldenMeta = {
      source_type: 'assistant_chat',
      // Dulu semua memori chat memakai satu nilai konstan 'assistant_chat_trigger'. Karena
      // detectAndMarkConflict() menganggap "source_reference sama + isi beda + versi tidak
      // berurutan" sebagai konflik, SETIAP fakta baru menendang fakta lama yang sama sekali
      // tidak berhubungan ke CONFLICT_PENDING_REVIEW (mis. "nama panggilan pak slamet"
      // dianggap berbenturan dengan "menyukai clean architecture"). Aturan itu memang
      // dirancang untuk memori turunan file (satu path = satu isi kanonik), bukan untuk
      // fakta chat yang saling independen. Dengan menyertakan kategori, benturan hanya
      // mungkin terjadi antar fakta sejenis.
      source_reference: `assistant_chat:${category || 'general'}`,
      chat_id: workspaceId || null,
      version_code: `AST-${Date.now()}`,
      category: category || 'general',
      useGovernor: true
    };

    try {
      if (governor && userId && typeof governor.storeGoldenMemory === 'function') {
        // Deteksi konflik TIDAK lagi dipanggil di sini (Item 55).
        //
        // Sejak deteksinya berbasis vektor, ia dijalankan di dalam
        // storeGoldenMemory memakai embedding yang memang sudah dihitung di sana.
        // Memanggilnya terpisah berarti dua embedding untuk teks yang sama, dan
        // membuat jalur penyimpanan lain (mis. MemoryService) luput dari
        // pemeriksaan. Satu memori = satu embedding = satu pemeriksaan.
        const stored = await governor.storeGoldenMemory({
          user_id: userId,
          content: contentToStore,
          summary: contentToStore,
          source_type: goldenMeta.source_type,
          source_reference: goldenMeta.source_reference,
          chat_id: goldenMeta.chat_id,
          version_code: goldenMeta.version_code,
          category: goldenMeta.category
        });

        if (stored?._duplicateSkipped) {
          // Jujur: tidak ada yang disimpan. Mengklaim "sudah disimpan" untuk sesuatu yang
          // dilewati adalah over-claiming yang dilarang 24_ANTI_HALLUCINATION_PROTOCOL.
          onDone?.(`ℹ️ Info itu sudah ada di memori saya, jadi tidak saya simpan lagi: "${contentToStore}"`, [], null);
          return;
        }
        if (stored) {
          onDone?.(`✅ Saya telah menyimpan: "${contentToStore}" ke memori (kategori: ${category || 'general'}).`, [], null);
          return;
        }
      } else if (memoryService) {
        const stored = await memoryService.storeMemory(contentToStore, contentToStore, goldenMeta);
        if (stored) {
          onDone?.(`✅ Saya telah menyimpan: "${contentToStore}" ke memori.`, [], null);
          return;
        }
      }
    } catch (err) {
      console.warn('[AssistantService] _handleMemoryStore error:', err);
    }

    onDone?.(`⚠️ Gagal menyimpan ke memori. Silakan coba lagi.`, [], null);
  }

  // =============================================
  // CONTEXT INJECTION: Memory + Semantic
  // =============================================

  /**
   * Bangun localContext (memory) dan semanticContext untuk payload.
   * @param {string} userMsg
   * @param {string} resolvedMode
   * @param {string} userId
   * @returns {Promise<{ localContext: string, semanticContext: string }>}
   */
  async buildContextInjection(userMsg, resolvedMode, userId, memoryEnabled = true) {
    let localContext = '';
    let semanticContext = '';

    if (resolvedMode === 'LITE') {
      console.log('[AssistantService] Mode LITE — Memory & Semantic injection dilewati.');
      return { localContext, semanticContext };
    }

    // Cek apakah kueri adalah pertanyaan berita/temporal murni
    const retrievalOrchestrator = this.serviceManager?.get('RetrievalOrchestrator');
    const isTemporal = retrievalOrchestrator?.isTemporalQuery?.(userMsg) || false;

    // Memory injection — dilewati bila tombol Memory mati (2026-09-15); server juga memutus baca & tulis memorinya.
    let memoryService = memoryEnabled ? this.serviceManager.get('MemoryService') : null;
    if (!memoryEnabled) {
      console.log('[AssistantService] Tombol Memory mati — memori tidak diambil.');
    } else if (!memoryService) {
      await new Promise(r => setTimeout(r, 1000));
      memoryService = this.serviceManager.get('MemoryService');
    }

    if (memoryService) {
      try {
        const memories = await memoryService.getMemory(userMsg);
        if (memories && memories.length > 0) {
          // Jika kueri temporal/berita eksternal, cegah pencemaran kueri dengan memori profil/preferensi personal yang tidak relevan
          const filteredMemories = isTemporal
            ? memories.filter(m => (m.similarity && m.similarity >= 0.8) || m.category === 'knowledge')
            : memories;

          if (filteredMemories.length > 0) {
            localContext = filteredMemories.map(m => m.summary || m.content || '').filter(Boolean).join('\n');
          }
        }
      } catch (e) {
        console.warn('[AssistantService] MemoryService query failed:', e);
      }
    }

    // Semantic context injection
    try {
      const semanticContextService = this.serviceManager.get('SemanticContextService');
      if (semanticContextService && userId) {
        const intentResult = semanticContextService.parseIntent(userMsg);
        if (intentResult.entities && intentResult.entities.length > 0) {
          semanticContextService.updateGraph(userId, intentResult.entities);
          const contextResult = semanticContextService.getContext(userId, userMsg);
          semanticContext = contextResult.context;
        }
      }
    } catch (e) {
      console.warn('[AssistantService] SemanticContextService failed:', e);
    }

    return { localContext, semanticContext };
  }

  // =============================================
  // BUILD REQUEST HEADERS
  // =============================================

  /**
   * Bangun headers untuk fetch ke Edge Function.
   * @param {string} token - Supabase access token
   * @param {string} aiProvider - 'gemini' | 'openai' | 'openrouter' | 'groq'
   * @param {string} aiKey - BYOK key
   * @returns {Object}
   */
  buildHeaders(token, aiProvider, aiKey) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token.replace(/[^\x00-\x7F]/g, '')}`
    };

    if (aiKey) {
      const cleanKey = aiKey.replace(/[^\x00-\x7F]/g, '');
      if (aiProvider === 'openrouter') headers['x-byok-openrouter'] = cleanKey;
      else if (aiProvider === 'openai') headers['x-byok-openai'] = cleanKey;
      else if (aiProvider === 'groq') headers['x-byok-groq'] = cleanKey;
      else if (aiProvider === 'gemini') headers['x-byok-gemini'] = cleanKey;

      // Embedding (pencarian dokumen & memori di server) memakai kunci OpenRouter pengguna
      // (Item 63–65), apa pun provider chat-nya. Hanya ditambahkan bila kunci provider chat ada,
      // supaya request_pipeline tetap memakai provider pilihan pengguna — ia jatuh ke
      // x-byok-openrouter hanya saat kunci provider kosong.
      if (!headers['x-byok-openrouter']) {
        try {
          const vault = this.serviceManager?.has('VaultService') ? this.serviceManager.get('VaultService') : null;
          const kunciOpenRouter = vault?.getKey('openrouter');
          if (kunciOpenRouter) headers['x-byok-openrouter'] = kunciOpenRouter.replace(/[^\x00-\x7F]/g, '');
        } catch {
          // Vault belum siap — server jatuh ke pencocokan kata untuk dokumen.
        }
      }
    }

    return headers;
  }

  // =============================================
  // FILE ATTACHMENT: konversi ke base64
  // =============================================

  /**
   * Konversi File object ke payload base64 untuk dikirim ke API.
   * @param {File|null} attachedFile
   * @returns {Promise<Object|null>}
   */
  async buildFileData(attachedFile) {
    if (!attachedFile) return null;
    const buffer = await attachedFile.arrayBuffer();
    const base64String = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    return {
      name: attachedFile.name,
      type: attachedFile.type,
      size: attachedFile.size,
      data: base64String
    };
  }

  // =============================================
  // CORE: processMessage
  // =============================================

  /**
   * Proses pesan user — PR#8: Thin dispatcher (Linux-style).
   * Hanya: resolve mode → memory trigger → classify → dispatch.
   * Logic berat ada di _handleLookup() dan _handleConversation().
   */
  /** Folder kerja aktif dari proses utama Electron: {nama} atau null (bukan Assistant / bukan desktop / tidak dipilih). */
  async _statusFolderKerja(workspaceId) {
    if (workspaceId !== 'ws-assistant' || typeof window === 'undefined' || !window.electronAPI?.folderKerja) return null;
    try {
      const s = await window.electronAPI.folderKerja.status();
      const nama = s?.aktif ? namaFolderAman(s.nama) : null;
      return nama ? { nama } : null;
    } catch {
      return null;
    }
  }

  async processMessage({
    userMsg,
    history,
    workspaceId,
    userId,
    token,
    attachedFile = null,
    workspaceManager,
    onChunk,
    onDone,
    onError,
    onNalar, // hybrid: nalar mengalir sebelum jawaban (hanya jalur CONVERSATION dengan Thinking menyala)
    modelTierOverride = null,
    _isPostHocWebRetry = false,
    _injectedKnowledgeContext = '',
    // Folder kerja (Item 85 Tahap 1) — diisi putaran alat sendiri, bukan pemanggil luar.
    _folderPutaran = 0,
    _folderPertanyaan = null,
    _folderDibaca = null,
    _folderDiubah = null,
    _folderByte = 0,
    _folderKoreksi = false
  }) {
    if (!userMsg || !token) {
      onError?.('Pesan atau token tidak tersedia.');
      return;
    }

    console.log('[LIFECYCLE] Chat request sent');

    // 1. Resolve mode
    const { resolvedMode, resolvedAppSource } = this.resolveMode(workspaceId);

    // FOLDER KERJA (Item 85 Tahap 1): status dibaca dari PROSES UTAMA setiap pesan (bukan dari layar). Hanya
    // Assistant & hanya di Electron. Server menerima NAMA folder saja.
    const folderKerja = await this._statusFolderKerja(workspaceId);
    const pertanyaanAsli = _folderPertanyaan || userMsg;
    const dibaca = _folderDibaca || [];
    const diubah = _folderDiubah || [];
    // Diisi handler dengan tingkat model yang dipakai putaran ini — putaran lanjutan DIKUNCI ke tingkat itu (keputusan
    // Owner 2026-09-22): tanpa ini pesan hasil alat yang panjang membuat Auto memilih Besar (±5× biaya per pertanyaan).
    const infoFolder = folderKerja ? { nama: folderKerja.nama, putaran: _folderPutaran, tingkat: null } : null;
    if (folderKerja) {
      const onDoneAsli = onDone;
      onDone = async (finalText, steps, jsonMetadata, extras = {}) => {
        const { permintaan, galat } = ambilPermintaanAlat(finalText);
        if (permintaan.length && _folderPutaran < MAKS_PUTARAN) {
          const putaran = _folderPutaran + 1;
          const hasil = [];
          let byte = _folderByte;
          for (const p of permintaan) {
            const label = {
              folder_search: `🔎 mencari "${p.kueri}"`,
              folder_list: `📂 melihat isi \`${p.alamat || '.'}\``,
              folder_read: `📄 membaca \`${p.alamat}\``,
              folder_write: `✍️ menunggu izin Anda untuk menulis \`${p.alamat}\` (lihat dialog)`,
              folder_edit: `✏️ menunggu izin Anda untuk mengedit \`${p.alamat}\` (lihat dialog)`,
              folder_mkdir: `📁 menunggu izin Anda untuk membuat folder \`${p.alamat}\``,
              folder_rename: `🔀 menunggu izin Anda untuk memindah \`${p.alamat}\` → \`${p.ke}\``,
              folder_delete: `🗑️ menunggu izin Anda untuk memindah \`${p.alamat}\` ke Recycle Bin`,
              folder_run: `▶️ menunggu izin Anda untuk menjalankan \`${[p.program, ...(p.argumen || [])].join(' ')}\` (lihat dialog), lalu menunggu programnya selesai`,
            }[p.alat] || `⚙️ ${p.alat}`;
            onChunk?.(`${label}…`, `_${label}… (putaran ${putaran}/${MAKS_PUTARAN})_`, steps || []);
            let h;
            if (p.alat === 'folder_read' && byte >= FOLDER_BATAS_BACA_BYTE) {
              h = { ok: false, alat: p.alat, alamat: p.alamat, alasan: `batas baca per pertanyaan (${FOLDER_BATAS_BACA_BYTE / 1024} KB) tercapai — jawab dari yang sudah dibaca` };
            } else {
              try { h = await window.electronAPI.folderKerja.alat(p); }
              catch (e) { h = { ok: false, alat: p.alat, alamat: p.alamat, alasan: `alat gagal: ${e.message || e}` }; }
            }
            if (h?.ok && h.alat === 'folder_read') { byte += (h.isi || '').length; if (!dibaca.includes(h.alamat)) dibaca.push(h.alamat); }
            // Tahap 2: yang diubah dicatat dari HASIL proses utama (bukan dari klaim model) — ditolak Owner pun dicatat.
            if (h && ['folder_write', 'folder_edit', 'folder_mkdir', 'folder_rename', 'folder_delete'].includes(h.alat)) {
              diubah.push(`${h.ok ? '✅' : h.ditolakOwner ? '🚫 ditolak' : '⚠️ gagal'} \`${h.alamat}\``);
            }
            // Tahap 3: perintah dicatat dari hasil proses utama — kode keluar & habis waktu apa adanya.
            if (h?.alat === 'folder_run') {
              const ket = h.ok ? (h.habisWaktu ? '⏱️ dihentikan (batas waktu)' : h.kodeKeluar === 0 ? '▶️ kode 0' : `⚠️ kode ${h.kodeKeluar}`) : h.ditolakOwner ? '🚫 ditolak' : '⚠️ tidak dijalankan';
              diubah.push(`${ket} \`${h.perintah || h.alamat}\``);
              if (h.ok) byte += (h.keluaran || '').length;
            }
            hasil.push(h);
          }
          const pesanHasil = susunPesanHasil(hasil, { putaran, pertanyaanAsli, galat });
          return this.processMessage({
            userMsg: pesanHasil,
            history: [...(history || []), { role: 'model', content: finalText }, { role: 'user', content: pesanHasil }],
            workspaceId, userId, token, attachedFile: null, workspaceManager,
            onChunk, onDone: onDoneAsli, onError, onNalar,
            modelTierOverride: modelTierOverride || infoFolder.tingkat || null,
            _folderPutaran: putaran, _folderPertanyaan: pertanyaanAsli, _folderDibaca: dibaca, _folderDiubah: diubah, _folderByte: byte,
            _folderKoreksi, // koreksi hanya sekali per pertanyaan, termasuk sesudah putaran alat berikutnya
          });
        }
        // Jawaban akhir: tag yang tersisa (putaran habis) dibuang, berkas yang benar-benar dibaca disebut apa adanya.
        // Catatan kaki tiruan buatan model dibuang dulu — hanya catatan kaki di bawah ini yang berasal dari proses utama.
        let teks = buangKakiTiruan(permintaan.length ? ambilPermintaanAlat(finalText).teksTanpaTag : finalText);
        if (permintaan.length) teks += `\n\n_⚠️ Batas ${MAKS_PUTARAN} putaran alat folder tercapai — sebagian permintaan alat tidak dijalankan._`;
        // Klaim menjalankan/mengubah tanpa catatan proses utama untuk pertanyaan INI (bukan riwayat).
        const tercatat = {
          jalan: diubah.some((d) => /^(▶️|⚠️ kode|⏱️)/.test(d)),
          ubah: diubah.some((d) => d.startsWith('✅')),
        };
        const peringatan = peringatanKlaimTanpaAlat(teks, tercatat);
        // Live Tahap 3: aturan prompt saja kalah oleh kebiasaan meniru riwayat ("saya jalankan lagi… 27" tanpa tag,
        // dua kali). Maka SEKALI per pertanyaan jawaban karangan itu tidak ditampilkan: model diberi putaran koreksi
        // untuk benar-benar meminta alat (dialog izin muncul). Gagal lagi → jawaban ditampilkan dengan peringatan.
        if (peringatan && !_folderKoreksi && _folderPutaran < MAKS_PUTARAN) {
          const putaran = _folderPutaran + 1;
          onChunk?.('🔁 koreksi…', `_🔁 Jawaban mengaku menjalankan/mengubah tanpa alat — meminta model mengulang dengan alat (putaran ${putaran}/${MAKS_PUTARAN})…_`, steps || []);
          const pesanKoreksi = susunPesanKoreksi({ putaran, pertanyaanAsli, tercatat });
          return this.processMessage({
            userMsg: pesanKoreksi,
            history: [...(history || []), { role: 'model', content: finalText }, { role: 'user', content: pesanKoreksi }],
            workspaceId, userId, token, attachedFile: null, workspaceManager,
            onChunk, onDone: onDoneAsli, onError, onNalar,
            modelTierOverride: modelTierOverride || infoFolder.tingkat || null,
            _folderPutaran: putaran, _folderPertanyaan: pertanyaanAsli, _folderDibaca: dibaca, _folderDiubah: diubah, _folderByte,
            _folderKoreksi: true,
          });
        }
        if (peringatan) teks += `\n\n${peringatan}`;
        // Putaran koreksi bukan putaran alat: tanpa pengurangan ini jawaban tanpa alat apa pun bercatatan "(1 putaran):
        // daftar/pencarian saja" (live Tahap 3).
        const putaranAlat = _folderPutaran - (_folderKoreksi ? 1 : 0);
        if (putaranAlat > 0) {
          teks += `\n\n---\n📂 _Dibaca dari folder **${folderKerja.nama}** (${putaranAlat} putaran alat${_folderKoreksi ? ' + 1 koreksi sistem' : ''}): ${dibaca.length ? dibaca.map((d) => `\`${d}\``).join(', ') : 'daftar/pencarian saja'}_`;
          if (diubah.length) teks += `\n✍️ _Perubahan & perintah (dicatat dari proses utama, bukan dari kata model): ${diubah.join(', ')}_`;
        } else if (_folderKoreksi) {
          teks += `\n\n---\n🔁 _Koreksi sistem: jawaban pertama mengaku menjalankan/mengubah tanpa alat dan tidak ditampilkan; tidak ada alat folder yang dijalankan._`;
        }
        return onDoneAsli?.(teks, steps, jsonMetadata, extras);
      };
    }

    // ENGINEER (T8): klaim "sudah menjalankan" tanpa keluaran terminal dari proses utama → peringatan sistem. Usulan
    // patch (extras.hasPatch) dan jawaban yang masih mengusulkan [MAMET_CMD] tidak dinilai (peringatanKlaimEngineer).
    if (resolvedMode === 'ENGINEER') {
      const onDoneEngineer = onDone;
      onDone = (finalText, steps, jsonMetadata, extras = {}) => {
        let teks = finalText;
        if (!extras?.hasPatch && typeof teks === 'string') {
          // Blok ```bash satu baris → [MAMET_CMD: …] (disimpan begitu, jadi tombol tetap ada saat chat dibuka ulang).
          teks = blokKodeKeMametCmd(teks);
          const peringatan = peringatanKlaimEngineer(teks, userMsg);
          if (peringatan) teks += `\n\n${peringatan}`;
        }
        return onDoneEngineer?.(teks, steps, jsonMetadata, extras);
      };
    }

    // 2. PR#8: Classify request type (deterministic, 0 LLM cost). Putaran lanjutan folder kerja selalu CONVERSATION:
    // pesannya berisi hasil alat, bukan perintah pengguna (tidak boleh terbaca sebagai "ingat …" atau DOC_CONVERT).
    const classifier = this.serviceManager.has('RequestClassifierService')
      ? this.serviceManager.get('RequestClassifierService')
      : null;
    const classifiedResult = _folderPutaran > 0
      ? { type: 'CONVERSATION', metadata: {} }
      : (classifier?.classify(userMsg, history, resolvedMode) || { type: 'CONVERSATION', metadata: {} });
    const requestType = classifiedResult.type;
    const classifierMeta = classifiedResult.metadata || {};

    // 3. Dispatch ke handler yang sesuai
    const handlerParams = {
      userMsg, history, workspaceId, userId, token,
      attachedFile, workspaceManager, onChunk, onDone, onError, onNalar,
      resolvedMode, resolvedAppSource, modelTierOverride,
      _isPostHocWebRetry, _injectedKnowledgeContext,
      _folderKerja: infoFolder
    };

    // Dispatch MEMORY_STORE (PR#8 Intent Unification)
    if (requestType === 'MEMORY_STORE') {
      // Tombol Memory mati (2026-09-15): perintah "ingat …" tidak disimpan, dan pengguna diberi tahu alasannya.
      const preferensiTool = this.serviceManager?.get('ToolPreferencesService');
      if (preferensiTool && !preferensiTool.getEffective(workspaceId, 'memory_manager')) {
        console.log('[AssistantService] Tombol Memory mati — MEMORY_STORE tidak disimpan.');
        onDone?.('ℹ️ Memory sedang dimatikan, jadi info ini tidak saya simpan. Nyalakan kembali di menu Tools → Memory bila ingin saya mengingatnya.', [], null);
        return;
      }
      return this._handleMemoryStore({
        ...handlerParams,
        contentToStore: classifierMeta.contentToStore,
        category: classifierMeta.category
      });
    }

    if (requestType === 'DOC_CONVERT') {
      return this._handleDocConvert({ ...handlerParams, direction: classifierMeta.direction });
    }

    if (requestType === 'LOOKUP') {
      return this._handleLookup(handlerParams);
    }

    // Dispatch SKILL → _handleSkill()
    if (requestType === 'SKILL') {
      const skillReg = this.serviceManager.has('SkillRegistry')
        ? this.serviceManager.get('SkillRegistry')
        : null;
      const skill = skillReg?.getSkill(classifierMeta?.skillId);
      if (skill) {
        return this._handleSkill({ ...handlerParams, skill });
      }
      // Fallback ke CONVERSATION jika skill tidak ditemukan
      console.warn(`[processMessage] Skill "${classifierMeta?.skillId}" tidak ditemukan — fallback ke CONVERSATION`);
    }

    // COMMAND, ENGINEER, CONVERSATION → semua lewat ConversationHandler
    return this._handleConversation(handlerParams);
  }

  // =============================================
  // DOC_CONVERT — tool word_to_pdf
  // =============================================

  /**
   * Jalankan konversi dokumen langsung lewat ToolRegistry, tanpa LLM.
   *
   * Sengaja deterministik: perintahnya jelas, dan menyerahkannya ke LLM hanya membuka
   * peluang model MENGAKU sudah mengonversi tanpa berkas apa pun tercipta. Setiap klaim
   * berhasil di sini bersandar pada bukti dari skrip: berkas selesai ditulis dan jumlah
   * halaman PDF sama dengan jumlah halaman menurut Word.
   *
   * @private
   */
  async _handleDocConvert({ direction, attachedFile, workspaceId, onChunk, onDone }) {
    if (direction === 'pdf_to_word') {
      onDone?.(
        'ℹ️ Konversi **PDF → Word** belum tersedia.\n\n' +
        'Word 2007 di komputer ini tidak bisa membuka PDF, dan PDF tidak menyimpan susunan ' +
        'paragraf atau tabel, sehingga hasilnya selalu berupa tebakan. Yang sudah tersedia ' +
        'adalah arah sebaliknya: **Word → PDF**.',
        [], null
      );
      return;
    }

    if (!attachedFile) {
      onDone?.('📎 Lampirkan dulu dokumen Word-nya lewat tombol 📎 di kolom chat, lalu kirim ulang perintahnya.', [], null);
      return;
    }

    const toolPreferences = this.serviceManager.has('ToolPreferencesService')
      ? this.serviceManager.get('ToolPreferencesService')
      : null;
    if (toolPreferences && !toolPreferences.getEffective(workspaceId, 'word_to_pdf')) {
      onDone?.('⚠️ Tool **Word → PDF** sedang dimatikan untuk workspace ini. Aktifkan lewat tombol **Tools** di atas chat.', [], null);
      return;
    }

    // Versi WEB (mamet-ecosystem.vercel.app, termasuk dari HP): tidak ada Word di sini, jadi
    // dokumennya dikirim ke laptop lewat antrian Supabase (Item 57).
    if (typeof window === 'undefined' || typeof window.electronAPI?.wordToPdf !== 'function') {
      return this._handleDocConvertLewatLaptop({ attachedFile, onChunk, onDone });
    }

    const toolRegistry = this.serviceManager.has('ToolRegistryService')
      ? this.serviceManager.get('ToolRegistryService')
      : null;
    if (!toolRegistry?.getTool('word_to_pdf')) {
      onDone?.('⚠️ Tool `word_to_pdf` belum terdaftar. Pastikan berkas `tools/word_to_pdf.js` ada, lalu pindai ulang folder tools.', [], null);
      return;
    }

    const menunggu = `⏳ Mengubah **${attachedFile.name}** ke PDF lewat Microsoft Word...\n\n` +
      '_Dokumen dengan banyak grafik bisa butuh satu sampai beberapa menit. Berkas PDF akan ' +
      'tampak 0 KB selama proses berlangsung — itu normal, jangan dibuka dulu._';
    onChunk?.(menunggu, menunggu, []);

    const hasil = await toolRegistry.executeTool('word_to_pdf', { file: attachedFile });

    if (hasil?.ok) {
      const mb = (hasil.ukuran / (1024 * 1024)).toFixed(1);
      onDone?.(
        `✅ **Selesai.** PDF tersimpan di sebelah dokumen aslinya:\n\n` +
        `\`${hasil.output}\`\n\n` +
        `| | |\n|---|---|\n` +
        `| Halaman | ${hasil.halaman_pdf} (sama dengan di Word) |\n` +
        `| Ukuran | ${mb} MB |\n` +
        `| Waktu | ${hasil.detik} detik |\n` +
        `| Mesin | Microsoft Word ${hasil.word_versi || ''} → Microsoft Print to PDF |\n\n` +
        '_Tautan (hyperlink) di dalam dokumen tidak bisa diklik di PDF hasil cetak._',
        [], { toolsUsed: ['word_to_pdf'], toolExecution: { name: 'word_to_pdf', result: hasil } }
      );
      return;
    }

    // Gagal atau tidak terbukti — sebutkan tahap dan alasannya apa adanya.
    const tahap = {
      platform: 'aplikasi', input: 'berkas', sibuk: 'antrian', printer: 'printer',
      word: 'Microsoft Word', tunggu: 'penulisan PDF', selesai: 'pemeriksaan hasil',
      timeout: 'batas waktu', skrip: 'skrip konversi'
    }[hasil?.stage] || hasil?.stage || 'tidak diketahui';

    let pesan = `❌ **Konversi tidak berhasil** (tahap: ${tahap}).\n\n${hasil?.error || 'Tidak ada keterangan dari skrip.'}`;
    if (hasil?.stage === 'selesai' && hasil?.output) {
      pesan += `\n\nBerkas tetap dibuat di \`${hasil.output}\`, tapi **jangan dianggap benar** sebelum Anda periksa sendiri.`;
    }
    onDone?.(pesan, [], { toolsUsed: ['word_to_pdf'], toolExecution: { name: 'word_to_pdf', result: hasil } });
  }

  /**
   * Word → PDF dari versi web: kirim ke laptop-pekerja lewat antrian Supabase (Item 57).
   * Laptop harus online (aplikasi desktop terbuka); kalau tidak, katakan apa adanya — jangan
   * membuat antrian yang tidak akan dikerjakan siapa pun tanpa memberi tahu pengguna.
   * @private
   */
  async _handleDocConvertLewatLaptop({ attachedFile, onChunk, onDone }) {
    // CACHE DULU (Item 58), SEBELUM memeriksa laptop: dokumen yang isinya pernah dikonversi
    // langsung diberikan — tanpa antre, tanpa Word, dan tetap berhasil walau laptop mati.
    onChunk?.(`🔍 Memeriksa apakah **${attachedFile.name}** pernah dikonversi...`, `🔍 Memeriksa apakah **${attachedFile.name}** pernah dikonversi...`, []);
    let hash = null;
    try {
      hash = await sidikJari(attachedFile);
      const dariCache = await cariDiCache(hash);
      if (dariCache) {
        const r = dariCache.result || {};
        const mb = dariCache.output_size ? (dariCache.output_size / (1024 * 1024)).toFixed(1) : '?';
        const sejak = dariCache.finished_at ? new Date(dariCache.finished_at).toLocaleString('id-ID') : '?';
        onDone?.(
          `⚡ **Diambil dari cache** — isi dokumen ini sama persis dengan yang pernah dikonversi, jadi tidak diproses ulang.\n\n` +
          `| | |\n|---|---|\n` +
          `| Halaman | ${r.halaman_pdf ?? '?'} |\n` +
          `| Ukuran | ${mb} MB |\n` +
          `| Dikonversi | ${sejak} |\n` +
          (dariCache.source_name !== attachedFile.name ? `| Nama saat itu | ${dariCache.source_name} |\n` : '') +
          '\n_Dokumen dikenali dari isinya, bukan namanya. Kalau Anda mengubah isinya, dokumen akan dikonversi ulang._',
          [],
          {
            toolsUsed: ['word_to_pdf'],
            toolExecution: {
              name: 'word_to_pdf',
              result: r,
              cache: true,
              remote: { jobId: dariCache.id, outputPath: dariCache.output_path, sourceName: attachedFile.name }
            }
          }
        );
        return;
      }
    } catch (err) {
      // Cache hanya jalan pintas: gagal di sini tidak boleh menggagalkan konversi.
      console.warn('[AssistantService] Pemeriksaan cache konversi gagal, lanjut ke laptop:', err.message);
    }

    const laptop = await statusLaptop();
    if (!laptop?.online) {
      onDone?.(
        '💻 **Laptop Anda sedang offline.**\n\n' +
        'Konversi Word → PDF dikerjakan oleh Microsoft Word di laptop, jadi laptop harus menyala ' +
        'dan aplikasi desktop Mamet OS harus terbuka.' +
        (laptop ? `\n\n_Terakhir terlihat ${Math.round(laptop.detik_lalu / 60)} menit lalu._` : ''),
        [], null
      );
      return;
    }

    const teks = {
      mengirim: `📤 Mengirim **${attachedFile.name}** ke laptop Anda...`,
      pending: `⏳ **${attachedFile.name}** menunggu diambil laptop...`,
      processing: `⚙️ Laptop sedang mengubah **${attachedFile.name}** ke PDF lewat Microsoft Word...\n\n_Dokumen dengan banyak grafik bisa butuh satu sampai beberapa menit._`
    };
    const hasil = await kirimKeLaptop(attachedFile, (status) => {
      if (teks[status]) onChunk?.(teks[status], teks[status], []);
    }, hash);

    const job = hasil.job;
    if (hasil.ok && job?.output_path) {
      const r = job.result || {};
      const mb = r.ukuran ? (r.ukuran / (1024 * 1024)).toFixed(1) : '?';
      onDone?.(
        `✅ **Selesai.** PDF dibuat oleh laptop Anda dan siap diunduh.\n\n` +
        `| | |\n|---|---|\n` +
        `| Halaman | ${r.halaman_pdf ?? '?'} (sama dengan di Word) |\n` +
        `| Ukuran | ${mb} MB |\n` +
        `| Waktu di laptop | ${r.detik ?? '?'} detik |\n` +
        `| Mesin | Microsoft Word ${r.word_versi || ''} → Microsoft Print to PDF |\n\n` +
        `💾 PDF disimpan di **Riwayat konversi** (tombol di atas chat). Kalau dokumen yang sama dikirim lagi, PDF langsung diberikan tanpa diproses ulang. Penyimpanan dibatasi ${KUOTA_CACHE_MB} MB; bila penuh, yang paling lama tidak dipakai dibuang lebih dulu.\n\n` +
        '_Tautan (hyperlink) di dalam dokumen tidak bisa diklik di PDF hasil cetak._',
        [],
        {
          toolsUsed: ['word_to_pdf'],
          toolExecution: {
            name: 'word_to_pdf',
            result: r,
            remote: { jobId: job.id, outputPath: job.output_path, sourceName: job.source_name }
          }
        }
      );
      return;
    }

    onDone?.(
      `❌ **Konversi tidak berhasil.**\n\n${hasil.error || 'Tidak ada keterangan.'}`,
      [], { toolsUsed: ['word_to_pdf'], toolExecution: { name: 'word_to_pdf', result: job?.result || null, error: hasil.error } }
    );
  }

  // =============================================
  // PR#8 — LOOKUP HANDLER (ringan, cepat, murah)
  // =============================================

  /**
   * Handle pesan tipe LOOKUP — pertanyaan faktual singkat.
   * SKIP: memory retrieval, RAG, semantic context, CMG validation.
   * Hanya: get AI provider → build minimal payload → fetch → handle response.
   *
   * @private
   */
  async _handleLookup({
    userMsg, history, workspaceId, userId, token, workspaceManager,
    resolvedMode, resolvedAppSource, onChunk, onDone, onError, _folderKerja = null
  }) {
    console.log('[AssistantService] PR#8 → _handleLookup (skip memory/semantic; dokumen dicari server bila RAG nyala)');

    // LOOKUP tetap ringan, tapi TIDAK lagi buta dokumen (Item 65). Dulu ragEnabled selalu false,
    // sehingga pertanyaan faktual pendek — "berapa jumlah desa …", jenis pertanyaan yang paling
    // sering diajukan ke dokumen — tak pernah mencari di dokumen walau tombol RAG menyala.
    // Pencarian makna di server murah: satu embedding pertanyaan + potongan teratas.
    const toolPreferencesService = this.serviceManager?.get('ToolPreferencesService');
    const ragToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'rag') : true;
    // LOOKUP tidak mengambil memori di klien, tetapi server tetap membaca/menulis memori — tombol Memory ikut dikirim.
    const memoryToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'memory_manager') : true;
    // Data Tabel (Item 92 Tahap 3): pertanyaan pendek "berapa … / siapa …" sering lewat LOOKUP — bendera wajib ikut.
    const dataTabelToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'data_tabel') : false;
    const lookupLite = resolvedMode === 'LITE';

    // Get AI provider config
    // LOOKUP selalu memakai tier KECIL tanpa classifier: jalur ini memang sudah dirancang ringan
    // (tanpa memory/RAG/semantic) dan tidak menuntut penalaran berat — keputusan Owner 2026-09-09.
    let aiProvider = 'gemini';
    let formattedModel = '';
    let aiKey = '';
    let aiThinking; // undefined bila BrainService tak tersedia → server memakai bawaan model
    try {
      const brainService = this.serviceManager.get('BrainService');
      if (brainService) {
        const context = await brainService.getActiveBrainContext('KECIL');
        if (_folderKerja) _folderKerja.tingkat = 'KECIL'; // LOOKUP selalu Kecil → putaran lanjutan folder ikut Kecil
        aiProvider = context.provider || 'gemini';
        formattedModel = context.model || '';
        aiKey = context.key || '';
        aiThinking = context.thinking === true;
        console.log(`[AssistantService] Model tier: KECIL (LOOKUP selalu tier ringan) → ${aiProvider}/${formattedModel || '(default)'}${aiThinking === true ? ' [thinking: ON]' : aiThinking === false ? ' [thinking: OFF]' : ''}`);
      }
    } catch (e) {
      console.warn('[AssistantService] BrainService not available:', e);
    }

    // Payload minimal — tidak ada globalMemory atau semanticContext
    const payload = {
      message: userMsg,
      mode: 'LOOKUP',              // flag ke Edge Function
      appSource: resolvedAppSource,
      workspaceTarget: null,
      history: history.slice(-3),  // hanya 3 pesan terakhir (bukan 10)
      globalMemory: '',            // sengaja kosong — konteks klien tidak dibangun di jalur ringan
      semanticContext: '',         // sengaja kosong
      stream: false,
      ragEnabled: ragToolEnabled,  // dokumen dicari di server (Item 65)
      memoryEnabled: memoryToolEnabled,
      model: formattedModel || undefined,
      thinking: aiThinking, // true/false tier dikirim apa adanya; false kini mematikan nalar di OpenRouter (2026-09-13)
      clientTimezone: zonaWaktuBrowser(), // mis. "Asia/Jakarta" — server menghitung jam lokal (2026-09-13)
      // Data Tabel (Item 92 Tahap 3): bendera tersendiri, BUKAN lewat `tools` — daftar tools juga menyaring sub-agent
      // Coordinator, jadi ['data_tabel'] akan diam-diam mematikan pencarian web.
      dataTabel: dataTabelToolEnabled && !lookupLite ? true : undefined,
      // Folder kerja (Item 85 Tahap 1): NAMA saja — alamat lengkap tetap di proses utama desktop.
      folderKerja: _folderKerja || undefined,
      cache_hint: true,
      _request_type: 'LOOKUP'
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    const headers = this.buildHeaders(token, aiProvider, aiKey);

    let response;
    try {
      response = await fetch(AGENT_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload) });
    } catch (fetchErr) {
      onError?.(`Gagal menghubungi server: ${fetchErr.message}`);
      return;
    }

    console.log(`[LIFECYCLE] LOOKUP response received (HTTP ${response.status})`);

    if (!response.ok) {
      let errorText = `HTTP error! status: ${response.status}`;
      try { const e = await response.json(); errorText = e.error || errorText; } catch (_) { errorText = (await response.text()) || errorText; }
      onError?.(`⚠️ Error: ${errorText}`);
      return;
    }

    // Reuse response handler yang sama dengan ConversationHandler
    await this._handleResponseStream(response, { userMsg, isEngineerMode: false, workspaceManager, onChunk, onDone, onError });
  }

  // =============================================
  // PR#8 / Skill Impl — SKILL HANDLER
  // =============================================

  /**
   * Handle pesan tipe SKILL — eksekusi prosedur multi-step yang didefinisikan Owner.
   *
   * Alur:
   * 1. Ambil skill dari SkillRegistry
   * 2. Validasi via SkillGuardService
   * 3. Eksekusi steps berurutan:
   *    - 'ask'      → kirim prompt sebagai pesan AI, tunggu jawaban Owner
   *    - 'generate' → kirim ke Edge Function dengan context dari jawaban sebelumnya
   *    - 'write'    → belum didukung: dilaporkan apa adanya, tidak ada berkas yang ditulis
   *    - 'read'     → baca file (stub, dikembangkan berikutnya)
   * 4. Log ke AuditLogService
   *
   * @private
   */
  async _handleSkill({
    skill, userMsg, history, userId, token, workspaceManager,
    resolvedMode, resolvedAppSource, onChunk, onDone, onError
  }) {
    console.log(`[AssistantService] Skill → _handleSkill("${skill.id}")`);

    // 1. Validasi via SkillGuardService
    const guard = this.serviceManager.has('SkillGuardService')
      ? this.serviceManager.get('SkillGuardService')
      : null;

    const validation = guard ? guard.validate(skill) : { allowed: true, stepPolicies: [] };

    if (!validation.allowed) {
      const msg = `⚠️ Skill "${skill.name}" tidak bisa dijalankan: ${validation.reason}`;
      console.warn('[SkillHandler]', msg);
      onDone?.(msg, [], null);
      return;
    }

    this.eventBus.emit('Skill:Started', { skillId: skill.id, skillName: skill.name });
    const startedAt = Date.now();

    // 2. Context yang diakumulasi selama eksekusi multi-step
    const skillContext = {
      skillId: skill.id,
      skillName: skill.name,
      answers: [],    // Jawaban dari Owner untuk step 'ask'
      outputs: [],    // Output generate dari setiap step
      currentStep: 0
    };

    // 3. Eksekusi steps berurutan
    for (let i = 0; i < skill.steps.length; i++) {
      const step = skill.steps[i];
      const stepPolicy = validation.stepPolicies?.[i]?.policy || 'ALLOW';
      skillContext.currentStep = i + 1;

      console.log(`[SkillHandler] Step ${i + 1}/${skill.steps.length}: action=${step.action}`);

      // — STEP: ask — kirim prompt, tunggu jawaban di pesan berikutnya
      if (step.action === 'ask') {
        // Format pesan tanya yang jelas — sertakan progress step
        const askMsg = `**[Skill: ${skill.name} — Langkah ${i + 1}/${skill.steps.length}]**\n\n${step.prompt}`;

        // Simpan jawaban dari history jika sudah ada (multi-turn skill)
        // Untuk sekarang: kirim pertanyaan pertama, berikutnya lewat history
        if (i === 0) {
          // Step pertama: kirim pertanyaan ke Owner
          onDone?.(askMsg, [], null, { isSkillStep: true, skillId: skill.id, stepIndex: i });
          this.eventBus.emit('Skill:StepDone', { skillId: skill.id, step: i + 1, action: 'ask' });
          // Skill multi-turn akan dilanjutkan di pesan berikutnya via history
          // Untuk versi ini, selesaikan skill sampai di sini dan beri tahu Owner
          const continueMsg = `\n\n_Jawab pertanyaan di atas, kemudian saya akan melanjutkan ke langkah berikutnya._`;
          // Simpan state skill ke EventBus untuk dilanjutkan
          this.eventBus.emit('Skill:AwaitingAnswer', {
            skillId: skill.id,
            stepIndex: i,
            remainingSteps: skill.steps.slice(i + 1)
          });
          return;
        } else {
          // Step berikutnya: ambil jawaban dari history terakhir
          const lastUserMsg = history.slice().reverse().find(m => m.role === 'user')?.content || '';
          skillContext.answers.push({ step: i + 1, answer: lastUserMsg });
        }
      }

      // — STEP: generate — kirim ke LLM dengan context terkumpul
      if (step.action === 'generate') {
        // Bangun prompt yang menyertakan semua jawaban yang terkumpul
        let contextSummary = '';
        if (skillContext.answers.length > 0) {
          contextSummary = skillContext.answers
            .map(a => `Jawaban langkah ${a.step}: ${a.answer}`)
            .join('\n');
        }

        const generatePrompt = contextSummary
          ? `${step.prompt}\n\nKonteks dari jawaban sebelumnya:\n${contextSummary}`
          : step.prompt;

        // Kirim ke Edge Function dengan payload minimal
        const { aiProvider, formattedModel, aiKey } = await this._resolveAIProvider();
        const payload = {
          message: generatePrompt,
          mode: resolvedMode || 'STANDARD',
          appSource: resolvedAppSource,
          history: history.slice(-5),
          globalMemory: '',
          semanticContext: '',
          stream: false,
          ragEnabled: false,
          model: formattedModel || undefined,
          cache_hint: true,
          _request_type: 'SKILL',
          _skill_id: skill.id
        };
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

        const headers = this.buildHeaders(token, aiProvider, aiKey);
        let response;
        try {
          response = await fetch(AGENT_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload) });
        } catch (fetchErr) {
          onError?.(`Gagal menghubungi server saat eksekusi skill: ${fetchErr.message}`);
          this.eventBus.emit('Skill:Error', { skillId: skill.id, step: i + 1, reason: fetchErr.message });
          return;
        }

        if (!response.ok) {
          onError?.(`⚠️ Skill error HTTP ${response.status}`);
          this.eventBus.emit('Skill:Error', { skillId: skill.id, step: i + 1, reason: `HTTP ${response.status}` });
          return;
        }

        await this._handleResponseStream(response, {
          userMsg: generatePrompt,
          isEngineerMode: false,
          workspaceManager,
          onChunk,
          onDone,
          onError
        });

        skillContext.outputs.push({ step: i + 1, done: true });
        this.eventBus.emit('Skill:StepDone', { skillId: skill.id, step: i + 1, action: 'generate' });
      }

      // — STEP: write — butuh konfirmasi (PR#1 flow)
      if (step.action === 'write') {
        if (stepPolicy === 'REQUIRE_CONFIRMATION') {
          const confirmMsg = `⚠️ Skill "${skill.name}" ingin menulis file — menulis dari skill belum didukung, jadi TIDAK ada berkas yang ditulis.`;
          onDone?.(confirmMsg, [], null);
          this.eventBus.emit('Skill:StepDone', { skillId: skill.id, step: i + 1, action: 'write', requiresConfirmation: true });
        }
      }

      // — STEP: read — stub (belum implementasi penuh)
      if (step.action === 'read') {
        console.log(`[SkillHandler] Step read — stub, path: ${step.path || '(tidak ada)'}`);
        skillContext.answers.push({ step: i + 1, answer: `[read: ${step.path || 'tidak ada path'}]` });
        this.eventBus.emit('Skill:StepDone', { skillId: skill.id, step: i + 1, action: 'read' });
      }
    }

    // 4. Skill selesai
    const duration = Date.now() - startedAt;
    this.eventBus.emit('Skill:Completed', {
      skillId: skill.id,
      totalSteps: skill.steps.length,
      duration
    });
    console.log(`[SkillHandler] Skill "${skill.id}" selesai dalam ${duration}ms`);

    // 5. Log ke AuditLogService jika tersedia
    const auditLog = this.serviceManager.has('AuditLogService')
      ? this.serviceManager.get('AuditLogService')
      : null;
    if (auditLog) {
      auditLog.log({
        type: 'SKILL_EXECUTED',
        skillId: skill.id,
        skillName: skill.name,
        steps: skill.steps.length,
        duration,
        triggeredBy: userMsg
      });
    }
  }

  /**
   * Helper: resolve AI provider dari BrainService.
   * Dipakai oleh _handleSkill dan _handleLookup.
   * @private
   */
  async _resolveAIProvider() {
    let aiProvider = 'gemini';
    let formattedModel = '';
    let aiKey = '';
    try {
      const brainService = this.serviceManager.get('BrainService');
      if (brainService) {
        const context = await brainService.getActiveBrainContext();
        aiProvider = context.provider || 'gemini';
        formattedModel = context.model || '';
        aiKey = context.key || '';
      }
    } catch (e) {
      console.warn('[AssistantService] BrainService not available:', e);
    }
    return { aiProvider, formattedModel, aiKey };
  }

  // =============================================
  // PR#8 — CONVERSATION HANDLER (alur penuh)
  // =============================================

  /**
   * Handle pesan tipe CONVERSATION/ENGINEER/COMMAND — alur lengkap.
   * Ini adalah logika yang sebelumnya ada di processMessage().
   *
   * @private
   */
  async _handleConversation({
    userMsg, history, workspaceId, userId, token,
    attachedFile, workspaceManager, resolvedMode, resolvedAppSource,
    onChunk, onDone, onError, onNalar, modelTierOverride = null,
    _isPostHocWebRetry = false, _injectedKnowledgeContext = '', _folderKerja = null
  }) {
    const isEngineerMode = resolvedMode === 'ENGINEER';
    // Putaran lanjutan folder kerja: pesannya = hasil alat (bisa puluhan KB) — RAG & Data Tabel tidak dijalankan ulang
    // atasnya (embedding & perencana atas isi berkas tak berguna dan berbayar).
    const folderLanjutan = (_folderKerja?.putaran || 0) > 0;
    const isLiteMode = resolvedMode === 'LITE';

    console.log(`[AssistantService] Mode check: workspace=${workspaceId}, resolvedMode=${resolvedMode}`);

    // 3. Get AI provider config dari BrainService
    // Adaptive Model Tiering: tingkat (KECIL/SEDANG/THINKING) ditentukan TierClassifierService
    // secara deterministik (0 biaya token). Engineer dikecualikan sepenuhnya — jalur BYOK-nya
    // tetap memakai model utama (getActiveBrainContext tanpa tier), lihat roadmap §3.
    let aiProvider = 'gemini';
    let formattedModel = '';
    let aiKey = '';
    let aiThinking; // undefined bila BrainService tak tersedia → server memakai bawaan model
    let selectedTier = null;
    let tierReason = '';
    try {
      const brainService = this.serviceManager.get('BrainService');
      if (brainService) {
        if (!isEngineerMode) {
          if (modelTierOverride) {
            // Owner mengunci tingkat lewat pil di kolom chat — classifier dilewati sepenuhnya.
            selectedTier = modelTierOverride;
            tierReason = 'override manual Owner';
          } else {
            const tierClassifier = this.serviceManager.get('TierClassifierService');
            if (tierClassifier) {
              const verdict = tierClassifier.classify(userMsg, history);
              selectedTier = verdict.tier;
              tierReason = verdict.reason;
            }
          }
        }
        const context = await brainService.getActiveBrainContext(selectedTier);
        // Folder kerja: tingkat putaran ini dicatat untuk dikunci di putaran lanjutan (lihat processMessage).
        if (_folderKerja && selectedTier) _folderKerja.tingkat = selectedTier;
        aiProvider = context.provider || 'gemini';
        formattedModel = context.model || '';
        aiKey = context.key || '';
        aiThinking = context.thinking === true;

        if (selectedTier) {
          // Model ikut dicetak supaya Owner bisa memverifikasi tier benar-benar mengganti model,
          // bukan cuma mengganti label tingkat.
          console.log(`[AssistantService] Model tier: ${selectedTier} (${tierReason}) → ${aiProvider}/${formattedModel || '(default)'}${aiThinking === true ? ' [thinking: ON]' : aiThinking === false ? ' [thinking: OFF]' : ''}`);
        }
      }
    } catch (e) {
      console.warn('[AssistantService] BrainService not available:', e);
    }

    // Tombol Memory (2026-09-15): kunci 'memory_manager' dari chip Tools; tanpa pilihan tersimpan bernilai nyala.
    const toolPreferencesService = this.serviceManager?.get('ToolPreferencesService');
    const memoryToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'memory_manager') : true;

    // PESAN HASIL MESIN (T8, live 2026-09-22): keluaran terminal Engineer "[TERMINAL OUTPUT for: …]" dan hasil alat
    // folder "[HASIL ALAT FOLDER]" (isi berkas!) BUKAN pertanyaan — tidak pernah dijadikan kueri Web (log: URL DuckDuckGo
    // memuat daftar berkas `git status`), RAG, maupun memori (memory_audit_log menyimpan 30 pesan hasil folder utuh, s.d.
    // 12 ribu huruf isi berkas). Pengetahuan putaran pertama tetap terbawa lewat riwayat percakapan.
    const pesanHasilMesin = folderLanjutan || /^\s*\[(TERMINAL OUTPUT for: |HASIL ALAT FOLDER\])/.test(userMsg || '');
    const memoryAktif = memoryToolEnabled && !pesanHasilMesin;

    // 4. Inject memory + semantic context
    const { localContext, semanticContext } = await this.buildContextInjection(
      userMsg, resolvedMode, userId, memoryAktif
    );

    // 4b. PR#9: 3-Tier Retrieval Orchestrator — ambil knowledge/RAG context (terpisah dari memory)
    // Toggle per-tool (ToolPreferencesService): RAG & Web Search independen. retrieve() tetap
    // dipanggil kalau salah satu nyala; RAG mati diteruskan sebagai skipLocalKnowledge supaya
    // Tier 1 (dokumen lokal) dilewati tapi Tier 3 (web) tetap bisa jalan kalau Web nyala.
    const ragToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'rag') : true;
    const webSearchToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'web_search') : true;
    const deepResearchToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'deep_research') : false;
    const dataTabelToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'data_tabel') : false;
    // "lanjutkan" untuk jawaban yang terpotong batas waktu server (2026-09-15): server meneruskan dari bahan & nalar yang
    // tersimpan di metadata pesan. Mencari web/RAG untuk teks "lanjutkan" hanya memasukkan dokumen tak relevan ke prompt
    // (live v444: berita saham & sepak bola membingungkan model). Pola sama dengan POLA_LANJUTKAN di server (batas_waktu.ts).
    const pesanModelTerakhir = [...(history || [])].reverse().find((m) => m?.role === 'model');
    const lanjutanTerpotong = pesanModelTerakhir?.metadata?.terpotong === true &&
      /^\s*(tolong\s+|mohon\s+)?(lanjut(kan|in)?|teruskan|terusin|continue)(\s+(lagi|jawaban(nya)?|laporan(nya)?|tulisan(nya)?))?\s*[.!]*\s*$/i.test(userMsg || '');

    const requestTraceId = crypto.randomUUID();
    let knowledgeContext = _injectedKnowledgeContext || '';
    const retrievalOrchestrator = this.serviceManager?.get('RetrievalOrchestrator');
    // DOKUMEN DICARI DI SERVER (Item 65, 2026-09-11): agent-process kini mencari dokumen
    // berdasarkan makna (ragEnabled di payload). Tier 1 di sini — pencocokan kata lewat
    // KnowledgeService — hanya menggandakan dokumen ke prompt, jadi selalu dilewati; orkestrator
    // dipanggil hanya untuk Web (Tier 3). Selama RAG menyala, panduan Tier 2 ("tidak ada dokumen
    // lokal") juga dilewati karena hanya server yang tahu apakah dokumen ditemukan.
    // PRIVASI: pesan hasil mesin (lihat pesanHasilMesin di atas) tidak dicari ke web sama sekali.
    if (!knowledgeContext && retrievalOrchestrator && !isLiteMode && webSearchToolEnabled && !lanjutanTerpotong && !pesanHasilMesin) {
      try {
        const retrievalResult = await retrievalOrchestrator.retrieve(userMsg, {
          userId,
          limit: 5,
          traceId: requestTraceId,
          skipLocalKnowledge: true,
          skipInternalFallback: ragToolEnabled,
          enableWebComparison: webSearchToolEnabled,
          autoConfirmWebSearch: webSearchToolEnabled
        });
        if (retrievalResult && retrievalResult.formattedContext) {
          knowledgeContext = retrievalResult.formattedContext;
          console.log(`[AssistantService] PR#9 RetrievalOrchestrator: Tier ${retrievalResult.tier}, strategy=${retrievalResult.strategy}, sufficiency=${retrievalResult.sufficiency}`);
        }
      } catch (err) {
        console.warn('[AssistantService] RetrievalOrchestrator query error (fallback):', err.message);
      }
    }

    // Gabungkan localContext (Memory) + knowledgeContext (RAG Knowledge & Berita Web)
    // Beri demarkasi tegas agar konteks berita tidak tertukar dengan preferensi personal
    let combinedContext = '';
    if (localContext && knowledgeContext) {
      combinedContext = `[PREFERENSI PERSONAL PENGGUNA (Gunakan hanya jika relevan dengan konteks)]:\n${localContext}\n\n[DOKUMEN PENGETAHUAN & REFERENSI BERITA/WEB]:\n${knowledgeContext}`;
    } else if (knowledgeContext) {
      combinedContext = `[DOKUMEN PENGETAHUAN & REFERENSI BERITA/WEB]:\n${knowledgeContext}`;
    } else if (localContext) {
      combinedContext = localContext;
    }

    let enhancedRagContext = combinedContext;

    // 4c. PR#2: Cognitive Memory Governor — validasi memory sebelum dikirim ke LLM
    if (enhancedRagContext && LEGACY_COGNITION_ENABLED) {
      try {
        const governorResult = runCognitiveMemoryGovernor({
          final_decision_context: { memory: { active: { content: enhancedRagContext } }, confidence_score: 0.8 },
          memory_context: { tgml_nodes: [], conflict_edges: [] },
          truth_score_bundle: null,
          behavior_profile: null,
          global_loop_result: null
        });
        if (governorResult.status === 'REJECT') {
          console.warn('[AssistantService] CMG REJECT — mengirim tanpa memory context');
          enhancedRagContext = '';
        } else if (governorResult.status === 'REWRITE') {
          console.warn('[AssistantService] CMG REWRITE — confidence diturunkan');
        }
      } catch (e) {
        console.warn('[AssistantService] CMG error (skip):', e.message);
      }
    }

    // 5. Build file data
    const fileData = await this.buildFileData(attachedFile);

    // 6. PR#6: Context trimming
    const rawRagLen = (enhancedRagContext || '').length;
    const rawSemLen = (semanticContext || '').length;

    let trimmedRagContext = enhancedRagContext || '';
    if (trimmedRagContext.length > MAX_RAG_CONTEXT_CHARS) {
      trimmedRagContext = trimmedRagContext.slice(0, MAX_RAG_CONTEXT_CHARS) +
        '\n[...konteks RAG dipotong untuk efisiensi token...]';
    }

    let trimmedSemanticContext = semanticContext || '';
    if (trimmedSemanticContext.length > MAX_SEMANTIC_CONTEXT_CHARS) {
      trimmedSemanticContext = trimmedSemanticContext.slice(0, MAX_SEMANTIC_CONTEXT_CHARS) +
        '\n[...konteks semantik dipotong...]';
    }

    const tokensBefore = estimateTokens(enhancedRagContext) + estimateTokens(semanticContext) + estimateTokens(userMsg);
    const tokensAfter  = estimateTokens(trimmedRagContext) + estimateTokens(trimmedSemanticContext) + estimateTokens(userMsg);
    const tokensSaved  = tokensBefore - tokensAfter;
    console.log(`[PR#6 TokenEfficiency] RAG: ${rawRagLen}→${trimmedRagContext.length} chars | Semantic: ${rawSemLen}→${trimmedSemanticContext.length} chars`);
    console.log(`[PR#6 TokenEfficiency] Estimasi token: ${tokensBefore} → ${tokensAfter} (hemat ~${tokensSaved} token)`);

    // 7. Build payload
    const payload = {
      message: userMsg,
      mode: resolvedMode,
      appSource: resolvedAppSource,
      workspaceTarget: workspaceId,
      traceId: requestTraceId,
      history: history.slice(isLiteMode ? -5 : -10),
      globalMemory: trimmedRagContext,
      semanticContext: trimmedSemanticContext,
      stream: false,
      // Hybrid (2026-09-14): nalar dialirkan lebih dulu, jawaban tetap JSON utuh — hanya bila Thinking menyala.
      streamNalar: aiThinking === true,
      ragEnabled: ragToolEnabled && !lanjutanTerpotong && !pesanHasilMesin,
      memoryEnabled: memoryAktif, // false → server tidak membaca/menulis memori & blok kesadaran menyesuaikan (juga untuk pesan hasil mesin)
      model: formattedModel || undefined,
      thinking: aiThinking, // true/false tier dikirim apa adanya; false kini mematikan nalar di OpenRouter (2026-09-13)
      clientTimezone: zonaWaktuBrowser(), // mis. "Asia/Jakarta" — server menghitung jam lokal (2026-09-13)
      file: fileData || undefined,
      requestedFilePath: isEngineerMode ? this.extractFilePathFromMessage(userMsg) : undefined,
      // Tombol Deep Research (2026-09-15): dikirim ke server tanpa 'web_search' — pencarian web desktop tetap jalan di
      // perangkat — sehingga server mengalihkan tugas riset Coordinator ke sub-agent deep_research.
      tools: isLiteMode
        ? ['rag_search', 'web_search', 'deep_research']
        : (deepResearchToolEnabled && !isEngineerMode ? ['deep_research'] : undefined),
      // Data Tabel (Item 92 Tahap 3): bendera tersendiri, BUKAN lewat `tools` — daftar tools juga menyaring sub-agent
      // Coordinator, jadi ['data_tabel'] akan diam-diam mematikan pencarian web.
      dataTabel: dataTabelToolEnabled && !isLiteMode && !isEngineerMode && !folderLanjutan ? true : undefined,
      // Folder kerja (Item 85 Tahap 1): NAMA saja — alamat lengkap tetap di proses utama desktop.
      folderKerja: _folderKerja || undefined,
      cache_hint: true,
      _token_meta: { estimated_before: tokensBefore, estimated_after: tokensAfter, saved: tokensSaved },
      _request_type: 'CONVERSATION'
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    // 8. Build headers & fetch
    const headers = this.buildHeaders(token, aiProvider, aiKey);
    let response;
    try {
      response = await fetch(AGENT_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload) });
    } catch (fetchErr) {
      onError?.(`Gagal menghubungi server: ${fetchErr.message}`);
      return;
    }

    console.log(`[LIFECYCLE] LLM response received (HTTP Status: ${response.status})`);

    if (!response.ok) {
      let errorText = `HTTP error! status: ${response.status}`;
      try { const errorData = await response.json(); errorText = errorData.error || errorText; }
      catch (_) { errorText = (await response.text()) || errorText; }
      console.error('[LIFECYCLE] Edge Function Error:', errorText);
      onError?.(`⚠️ Error: ${errorText}`);
      return;
    }

    await this._handleResponseStream(response, {
      userMsg, isEngineerMode, workspaceManager, onChunk, onDone, onError, userId,
      history, workspaceId, token, attachedFile, resolvedMode, resolvedAppSource,
      _isPostHocWebRetry, onNalar, hybrid: payload.streamNalar === true
    });
  }

  /**
   * HYBRID — baca aliran dari agent-process: event `nalar` (potongan nalar), `nalar_selesai` (jawaban mulai
   * ditulis), lalu `hasil` (isi Response JSON yang biasa) atau `galat`. Baris `: detak` diabaikan.
   * Mengembalikan data JSON jawaban, atau null bila gagal (onError sudah dipanggil).
   * @private
   */
  async _bacaAliranHybrid(response, { onNalar, onError }) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let nalar = '';
    let hasil = null;
    const olah = (baris) => {
      if (!baris.startsWith('data: ')) return;
      let ev;
      try { ev = JSON.parse(baris.slice(6)); } catch { return; }
      if (ev.tipe === 'nalar' && ev.teks) { nalar += ev.teks; onNalar?.(nalar, false); }
      else if (ev.tipe === 'nalar_selesai') onNalar?.(nalar, true);
      else if (ev.tipe === 'hasil') hasil = ev;
      else if (ev.tipe === 'galat') hasil = { galat: ev.pesan || 'galat tidak diketahui' };
    };
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const l of lines) olah(l.trim());
    }
    if (buffer.trim()) olah(buffer.trim());
    if (!hasil) { onError?.('⚠️ Error: Aliran jawaban terputus sebelum selesai.'); return null; }
    if (hasil.galat) { onError?.(`⚠️ Error: ${hasil.galat}`); return null; }
    if (hasil.status >= 400) { onError?.(`⚠️ Error: ${hasil.data?.error || `HTTP ${hasil.status}`}`); return null; }
    return hasil.data;
  }

  // =============================================
  // SHARED — Response Stream Handler
  // =============================================

  /**
   * Handle JSON/streaming response dari Edge Function.
   * Dipakai bersama oleh _handleLookup dan _handleConversation.
   * @private
   */
  async _handleResponseStream(response, {
    userMsg, isEngineerMode, workspaceManager, onChunk, onDone, onError, userId,
    history, workspaceId, token, attachedFile, resolvedMode, resolvedAppSource,
    _isPostHocWebRetry = false, onNalar, hybrid = false
  }) {
    const contentType = response.headers.get('content-type') || '';

    // HYBRID: nalar dialirkan lebih dulu; jawaban (event `hasil`) diproses PERSIS seperti jalur JSON di bawah.
    let jsonHybrid = null;
    if (hybrid && contentType.includes('text/event-stream')) {
      jsonHybrid = await this._bacaAliranHybrid(response, { onNalar, onError });
      if (!jsonHybrid) return;
    }

    if (jsonHybrid || contentType.includes('application/json')) {
      console.log(jsonHybrid ? '[LIFECYCLE] Received JSON response (HYBRID mode)' : '[LIFECYCLE] Received JSON response (DIRECT mode)');
      const jsonData = jsonHybrid || await response.json();
      const rawContent = typeof (jsonData.message || jsonData) === 'string'
        ? (jsonData.message || jsonData)
        : JSON.stringify(jsonData.message || jsonData);

      const hasPatch = isEngineerMode && rawContent.includes('[MAMET_PATCH_READY]');
      const cleanContent = hasPatch ? rawContent.replace('[MAMET_PATCH_READY]', '').trim() : rawContent;

      onDone?.(cleanContent, jsonData.processingSteps || [], jsonData, { hasPatch, patchOriginalTask: hasPatch ? userMsg : undefined });

      // MAEF Monitor TIDAK lagi dibuka otomatis di sini — dulu tiap respons AI memaksa panel
      // ini terbuka kembali walau Owner baru saja menutupnya (minimize jadi terasa tidak
      // berfungsi). Sekarang murni dikendalikan manual lewat tombol "Monitor" di toolbar chat
      // (ConversationEngine.jsx handleToggleMaefMonitor).

      // Verifikasi integritas memori sesi Assistant (golden source alignment) tepat 1x di akhir turn
      if (userId) {
        await this.finalizeAssistantSession({ userId });
      }
      return;
    }

    // Streaming path
    let reader, decoder;
    try {
      reader = response.body.getReader();
      decoder = new TextDecoder('utf-8');
    } catch (streamErr) {
      console.error('[LIFECYCLE] Failed to get stream reader:', streamErr);
      onError?.('⚠️ Error: Gagal membaca aliran data.');
      return;
    }

    let done = false;
    let aiResponseText = '';
    let processingSteps = [];
    let buffer = '';

    console.log('[LIFECYCLE] Stream started');
    onChunk?.('', '', []);

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.step) processingSteps.push(parsed.step);

              let chunkText = '';
              if (parsed.text) {
                chunkText = parsed.text;
              } else if (parsed.choices?.[0]?.delta?.content) {
                chunkText = parsed.choices[0].delta.content;
              }

              if (chunkText) aiResponseText += chunkText;
              onChunk?.(chunkText, aiResponseText, [...processingSteps]);
            } catch (err) {
              console.error('[LIFECYCLE] Exception during chunk processing:', err);
              aiResponseText += `\n\n[System Error: Gagal memproses aliran data. Root Cause: ${err.message}]`;
              onChunk?.('', aiResponseText, [...processingSteps]);
              done = true;
            }
          }
        }
      }
    }

    console.log('[LIFECYCLE] Stream completed');

    const hasPatch = isEngineerMode && aiResponseText.includes('[MAMET_PATCH_READY]');
    const finalText = hasPatch
      ? aiResponseText.replace('[MAMET_PATCH_READY]', '').trim()
      : aiResponseText;

    onDone?.(finalText, processingSteps, null, {
      hasPatch,
      patchOriginalTask: hasPatch ? userMsg : undefined
    });

    // Post-Hoc Re-Evaluation (PR#9 Fase 3):
    // Jika jawaban LLM mengandung [STATUS: INSUFFICIENT] atau menyatakan tidak tahu/kurang info terkini,
    // eskalasikan konfirmasi Tier 3 Web Comparison ke Owner
    const isInsufficient = /\[STATUS:\s*INSUFFICIENT\]/i.test(finalText) ||
      /\b(saya tidak dapat memberikan informasi terbaru|tidak ditemukan di database.*tidak memiliki informasi|informasi.*tidak cukup.*\[STATUS:\s*INSUFFICIENT\])\b/i.test(finalText);

    // Pesan hasil mesin (isi berkas folder / keluaran terminal) tidak pernah dijadikan kueri web, termasuk lewat tawaran ini.
    if (isInsufficient && !_isPostHocWebRetry && !isEngineerMode && !/^\s*\[(TERMINAL OUTPUT for: |HASIL ALAT FOLDER\])/.test(userMsg || '')) {
      const webService = this.serviceManager?.get('WebComparisonService');
      if (webService && typeof webService.requestConfirmation === 'function') {
        const traceId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
          ? crypto.randomUUID()
          : `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        webService.requestConfirmation({
          query: userMsg,
          traceId,
          reason: 'Jawaban model menyatakan informasi tidak mencukupi ([STATUS: INSUFFICIENT]). Ingin mencari pembanding dari web?'
        }).then(async (approved) => {
          if (approved) {
            console.log('[AssistantService] ✅ Owner menyetujui web search post-hoc. Mengambil data web dan memperbarui jawaban...');
            onChunk?.('\n\n_🌐 Mengambil data pembanding dari web..._\n', finalText + '\n\n_🌐 Mengambil data pembanding dari web..._\n', processingSteps);
            const webRes = await webService.searchWeb(userMsg, { autoConfirm: true });
            if (webRes.status === 'SUCCESS' && webRes.chunks?.length > 0) {
              const orchestrator = this.serviceManager?.get('RetrievalOrchestrator');
              const webContext = orchestrator ? orchestrator.formatAsContext(webRes.chunks) : '';
              await this._handleConversation({
                userMsg, history, workspaceId, userId, token,
                attachedFile, workspaceManager, resolvedMode, resolvedAppSource,
                onChunk, onDone, onError,
                _isPostHocWebRetry: true,
                _injectedKnowledgeContext: webContext
              });
            }
          }
        }).catch(e => {
          console.warn('[AssistantService] Post-hoc web confirmation error:', e);
        });
      }
    }

    // Verifikasi integritas memori sesi Assistant (golden source alignment) tepat 1x di akhir turn
    if (userId) {
      await this.finalizeAssistantSession({ userId });
    }
    // Interceptor OS lama (<terminal>/<edit_file>/<search_disk>/<run_airdrop>) dihapus 2026-09-15 (Item 85):
    // tidak pernah aktif (butuh cap:code-execution) dan tanpa pagar folder. Folder kerja Assistant dibangun ulang,
    // lihat docs/roadmap/ROADMAP-FOLDER-KERJA-ASSISTANT.md.
  }

  // =============================================
  // CHAT PERSISTENCE
  // =============================================

  /**
   * Simpan riwayat chat ke Supabase.
   * @param {Object} params
   * @param {Array}  params.messages
   * @param {string|null} params.chatId - null untuk INSERT baru
   * @param {string} params.userId
   * @param {string} params.workspaceId
   * @param {Function} params.onNewChatId - callback(newId) saat INSERT berhasil
   * @returns {Promise<void>}
   */
  async saveChatToDB({ messages, chatId, userId, workspaceId, onNewChatId }) {
    if (!messages || messages.length === 0) return;
    if (!userId) return;

    // Gunakan supabase client statis
    const title = messages[0]?.content?.substring(0, 50) || 'Percakapan Baru';
    const payload = {
      user_id: userId,
      title,
      messages,
      updated_at: new Date().toISOString(),
      workspace_type: workspaceId || 'ws-assistant'
    };

    let result;
    let finalChatId = chatId;
    if (chatId) {
      result = await supabase.from('chats').update(payload).eq('id', chatId);
    } else {
      result = await supabase.from('chats').insert(payload).select('id').single();
      if (result.data?.id) {
        finalChatId = result.data.id;
        onNewChatId?.(finalChatId);
      }
    }

    if (result?.error) {
      console.error('[AssistantService] Gagal menyimpan chat:', result.error);
      return;
    }

    // [FIX: ChatHistory realtime] Pancarkan event Chat:Updated via EventBus agar
    // ChatHistory.jsx langsung memanggil fetchChats() tanpa mengandalkan
    // window.addEventListener('storage') yang hanya berfungsi antar-tab/jendela.
    try {
      const eventBus = this.serviceManager?.get('EventBus');
      if (eventBus && finalChatId) {
        eventBus.emit('Chat:Updated', { chatId: finalChatId, workspaceId: workspaceId || 'ws-assistant', title });
      }
    } catch (e) {
      // EventBus opsional — jangan gagalkan operasi save jika emit gagal
      console.warn('[AssistantService] Gagal emit Chat:Updated:', e.message);
    }
  }

  /**
   * Finalisasi sesi Assistant: memverifikasi integritas golden memory yang disimpan selama sesi.
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} [params.chatId]
   * @returns {Promise<Object|null>}
   */
  async finalizeAssistantSession({ userId, chatId }) {
    try {
      const governor = this.serviceManager.has('MemoryGovernorService')
        ? this.serviceManager.get('MemoryGovernorService')
        : null;

      if (governor && typeof governor.verifyAssistantSession === 'function' && userId) {
        const res = await governor.verifyAssistantSession({ userId, chatId });
        console.log('[AssistantService] Sesi Assistant difinalisasi:', res);
        return res;
      }
    } catch (e) {
      console.warn('[AssistantService] Finalisasi sesi error:', e.message);
    }
    return null;
  }

  /**
   * Muat riwayat chat dari Supabase.
   * @param {string} chatId
   * @returns {Promise<Array|null>} - array messages atau null jika tidak ditemukan
   */
  async loadChat(chatId) {
    if (!chatId) return null;
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (error) {
      console.error('[AssistantService] loadChat error:', error);
      return null;
    }
    return data?.messages || [];
  }

  // =============================================
  // ENGINEER COMMAND — tombol [MAMET_CMD: …] (T8, 2026-09-22)
  // =============================================

  /**
   * Jalankan SATU perintah dari penanda [MAMET_CMD: …] Engineer lewat proses utama: kalimat dipecah tanpa shell,
   * program dari daftar izin, folder asal = repo Mamet, dialog izin asli (bawaan Tolak). Menggantikan CommandRegistry
   * (PowerShell dirakit dari alamat mentah; selalu "tidak terdaftar" untuk perintah nyata) dan jalur cadangan yang
   * meneruskan kalimat mentah ke shell.
   *
   * @param {string} perintah - mis. "npm test", "git status"
   * @returns {Promise<{ output: string, success: boolean, ditolakOwner?: boolean }>}
   */
  async runCommand(perintah) {
    if (!window.electronAPI?.engineer?.jalankan) {
      return { output: 'Menjalankan perintah hanya tersedia di aplikasi desktop.', success: false };
    }
    let h;
    try { h = await window.electronAPI.engineer.jalankan(String(perintah || '')); }
    catch (err) { return { output: err?.message || String(err), success: false }; }

    let output;
    if (h?.ok) {
      const kaki = h.habisWaktu
        ? `⏱️ Dihentikan — melewati batas waktu ${h.waktuBatasS} detik.`
        : `Kode keluar ${h.kodeKeluar} (${((h.waktuMs || 0) / 1000).toFixed(1).replace('.', ',')} s)${h.terpotong ? ` — keluaran dipotong dari ${h.byteKeluaran} byte` : ''}.`;
      output = `${h.keluaran || '(tanpa keluaran)'}\n\n${kaki}`;
    } else if (h?.ditolakOwner) {
      output = 'DITOLAK OWNER di dialog izin — perintah TIDAK dijalankan.';
    } else {
      output = `TIDAK DIJALANKAN: ${h?.alasan || 'alasan tidak diketahui'}`;
    }
    const success = !!h?.ok && !h.habisWaktu && h.kodeKeluar === 0;

    // Jejak audit Engineer (SessionArtifact) — dari hasil proses utama, bukan dari kata model.
    try {
      this.serviceManager.get('EventBus')?.emit('Engineer:CommandExecuted', {
        command: perintah, status: success ? 'success' : 'error', output
      });
    } catch (_) {}
    // ditolakAturan: pecahPerintah/daftar izin/profil menolak SEBELUM dialog — hasilnya pasti sama tiap kali, jadi UI
    // tidak mengirimnya balik ke model (live: "npm install lodash" diusulkan ulang 3× setelah tiap penolakan).
    return { output, success, ditolakOwner: !!h?.ditolakOwner, ditolakAturan: !h?.ok && !h?.ditolakOwner };
  }

  /**
   * Rollback patch via git stash.
   * @param {string|null} checkpointRef
   * @returns {Promise<{ success: boolean, output?: string, error?: string, cancelled?: boolean }>}
   */
  async rollback(checkpointRef) {
    if (!window.electronAPI?.gitRollback) {
      return { success: false, error: 'Rollback tidak tersedia (bukan desktop mode).' };
    }
    try {
      const result = await window.electronAPI.gitRollback(checkpointRef);
      return result;
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Refresh memory untuk query tertentu.
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async refreshMemory(query) {
    const memoryService = this.serviceManager.get('MemoryService');
    if (!memoryService || !query) return [];
    try {
      return await memoryService.getMemory(query) || [];
    } catch (err) {
      console.warn('[AssistantService] refreshMemory gagal:', err);
      return [];
    }
  }
}
