
const AGENT_ENDPOINT = 'https://uuyzdjifhdfyyvpxsofu.supabase.co/functions/v1/agent-process';

import { supabase } from '../../../supabase.js';
import { statusLaptop, kirimKeLaptop, sidikJari, cariDiCache, KUOTA_CACHE_MB } from './remoteConversionClient.js';
import { ambilPermintaanAlat, susunPesanHasil, susunPesanKoreksi, namaFolderAman, buangKakiTiruan, peringatanKlaimTanpaAlat, peringatanKlaimEngineer, blokKodeKeMametCmd, MAKS_PUTARAN } from '../../../../../shared/folderKerjaAlat.js';
import { ambilPermintaanKonektor, susunPesanHasilKonektor, catatanHasilKonektor, MAKS_PUTARAN_KONEKTOR } from '../../../../../shared/konektorAlat.js';
import { bacaKonektorAktif, petaAlatAktif, muatanKonektor, panggilKonektor, labelAlat } from './konektorAktif.js';
import { cekPerintahBerulang, petunjukHasilKosong, petunjukKeluaranTerpotong, petunjukGrepSebagian, peringatanTugasTakDiumumkan, adaPenandaPatch, buangPenandaPatch } from './engineer/ProsedurEngineer.js';
import { peringatanKlaimTakTeruji } from './engineer/UjiKlaim.js';
import { anggaranKonteks, pilihPesanKonteks, bacaMulaiDari, bagiAnggaranKonteks } from './KonteksChat.js';
import { rampingkanPesan, pesanUntukServer } from './pesanRamping.js';
import { susunJejakKlien } from './JejakKlien.js';
import { bacaGalatRespons } from './galatRespons.js';

const FOLDER_BATAS_BACA_BYTE = 150 * 1024;

import { dibatalkanPemakai } from './pembatalan.js';

function estimateTokens(text = '') {
  return Math.ceil(text.length / 4);
}

function zonaWaktuBrowser() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch (_) { return undefined; }
}

export class AssistantService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this._initialized = false;
    this.riwayatJejak = [];
  }

  _catatJejakKlien(jejakKlien) {
    this.jejakKlienTerakhir = jejakKlien;
    this.riwayatJejak.push({ klien: jejakKlien, server: null });
    if (this.riwayatJejak.length > 50) this.riwayatJejak.shift();
  }

  _catatJejakServer(jejakServer) {
    if (!jejakServer || typeof jejakServer !== 'object') return;
    const pasangan = [...this.riwayatJejak].reverse().find((p) => p.server === null && (!jejakServer.traceId || p.klien?.traceId === jejakServer.traceId));
    if (pasangan) pasangan.server = jejakServer;
    else {
      this.riwayatJejak.push({ klien: null, server: jejakServer });
      if (this.riwayatJejak.length > 50) this.riwayatJejak.shift();
    }
  }

  async initialize() {
    this._initialized = true;
    console.log('[AssistantService] Initialized');
  }


  resolveMode(workspaceId) {
    if (workspaceId === 'ws-engineer' || workspaceId === 'ENGINEER') {
      return { resolvedMode: 'ENGINEER', resolvedAppSource: 'engineer' };
    }
    if (workspaceId === 'ws-lite' || workspaceId === 'MAMETLITE' || workspaceId === 'LITE') {
      return { resolvedMode: 'LITE', resolvedAppSource: 'mametlite' };
    }
    return { resolvedMode: 'ASSISTANT', resolvedAppSource: 'assistant' };
  }


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
      source_reference: `assistant_chat:${category || 'general'}`,
      chat_id: workspaceId || null,
      version_code: `AST-${Date.now()}`,
      category: category || 'general',
      useGovernor: true
    };

    try {
      if (governor && userId && typeof governor.storeGoldenMemory === 'function') {
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


  async buildContextInjection(userMsg, resolvedMode, userId, memoryEnabled = true) {
    let localContext = '';
    let semanticContext = '';

    if (resolvedMode === 'LITE') {
      console.log('[AssistantService] Mode LITE — Memory & Semantic injection dilewati.');
      return { localContext, semanticContext };
    }

    const retrievalOrchestrator = this.serviceManager?.get('RetrievalOrchestrator');
    const isTemporal = retrievalOrchestrator?.isTemporalQuery?.(userMsg) || false;

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

      if (!headers['x-byok-openrouter']) {
        try {
          const vault = this.serviceManager?.has('VaultService') ? this.serviceManager.get('VaultService') : null;
          const kunciOpenRouter = vault?.getKey('openrouter');
          if (kunciOpenRouter) headers['x-byok-openrouter'] = kunciOpenRouter.replace(/[^\x00-\x7F]/g, '');
        } catch {
        }
      }
    }

    return headers;
  }


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

  async _statusKonektor(workspaceId) {
    return bacaKonektorAktif(workspaceId);
  }

  async processMessage({
    userMsg,
    history,
    workspaceId,
    userId,
    token,
    signal = null,
    attachedFile = null,
    workspaceManager,
    onChunk,
    onDone,
    onError,
    onNalar,
    modelTierOverride = null,
    chatId = null,
    _isPostHocWebRetry = false,
    _injectedKnowledgeContext = '',
    _folderPutaran = 0,
    _folderPertanyaan = null,
    _folderDibaca = null,
    _folderDiubah = null,
    _folderByte = 0,
    _folderKoreksi = false,
    _konektorPutaran = 0,
    _konektorPertanyaan = null,
    _konektorCatatan = null
  }) {
    if (!userMsg || !token) {
      onError?.({ kode: 'PESAN_KOSONG', teknis: !userMsg ? 'pesan kosong' : 'token tidak ada' });
      return;
    }

    if (signal?.aborted) return;

    console.log('[LIFECYCLE] Chat request sent');

    const { resolvedMode, resolvedAppSource } = this.resolveMode(workspaceId);

    const konektor = await this._statusKonektor(workspaceId);
    const infoKonektor = konektor ? { ...konektor, putaran: _konektorPutaran, tingkat: null } : null;
    if (konektor) {
      const onDoneKonektor = onDone;
      const pertanyaanKonektor = _konektorPertanyaan || userMsg;
      const catatanKonektor = _konektorCatatan || [];
      onDone = async (finalText, steps, jsonMetadata, extras = {}) => {
        const { permintaan, galat, teksTanpaTag } = ambilPermintaanKonektor(finalText, petaAlatAktif(konektor));
        if (permintaan.length && _konektorPutaran < MAKS_PUTARAN_KONEKTOR) {
          const putaran = _konektorPutaran + 1;
          const hasil = [];
          for (const p of permintaan) {
            const label = labelAlat(p);
            onChunk?.(`${label}…`, `_${label}… (putaran konektor ${putaran}/${MAKS_PUTARAN_KONEKTOR})_`, steps || []);
            let h;
            try { h = await panggilKonektor(workspaceId, p, chatId); }
            catch (e) { h = { ok: false, alasan: `alat gagal: ${e.message || e}` }; }
            h = { ...h, konektor: p.konektor, alat: p.alat, argumen: p.argumen };
            catatanKonektor.push(catatanHasilKonektor(h));
            hasil.push(h);
          }
          const pesanHasil = susunPesanHasilKonektor(hasil, { putaran, pertanyaanAsli: pertanyaanKonektor, galat });
          return this.processMessage({
            userMsg: pesanHasil,
            history: [...(history || []), { role: 'model', content: finalText }, { role: 'user', content: pesanHasil }],
            workspaceId, userId, token, signal, attachedFile: null, workspaceManager, chatId,
            onChunk, onDone: onDoneKonektor, onError, onNalar,
            modelTierOverride: modelTierOverride || infoKonektor.tingkat || null,
            _konektorPutaran: putaran, _konektorPertanyaan: pertanyaanKonektor, _konektorCatatan: catatanKonektor,
          });
        }
        let teks = permintaan.length ? teksTanpaTag : finalText;
        if (permintaan.length) teks += `\n\n_⚠️ Batas ${MAKS_PUTARAN_KONEKTOR} putaran alat konektor tercapai — sebagian permintaan alat tidak dijalankan._`;
        if (catatanKonektor.length) {
          teks += `\n\n---\n🛰️ _${konektor.nama} (dicatat dari proses utama, bukan dari kata model): ${catatanKonektor.join(' · ')}_`;
        }
        return onDoneKonektor?.(teks, steps, jsonMetadata, extras);
      };
    }

    const folderKerja = await this._statusFolderKerja(workspaceId);
    const pertanyaanAsli = _folderPertanyaan || userMsg;
    const dibaca = _folderDibaca || [];
    const diubah = _folderDiubah || [];
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
            if (h && ['folder_write', 'folder_edit', 'folder_mkdir', 'folder_rename', 'folder_delete'].includes(h.alat)) {
              diubah.push(`${h.ok ? '✅' : h.ditolakOwner ? '🚫 ditolak' : '⚠️ gagal'} \`${h.alamat}\``);
            }
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
            workspaceId, userId, token, signal, attachedFile: null, workspaceManager,
            onChunk, onDone: onDoneAsli, onError, onNalar,
            modelTierOverride: modelTierOverride || infoFolder.tingkat || null,
            _folderPutaran: putaran, _folderPertanyaan: pertanyaanAsli, _folderDibaca: dibaca, _folderDiubah: diubah, _folderByte: byte,
            _folderKoreksi,
          });
        }
        let teks = buangKakiTiruan(permintaan.length ? ambilPermintaanAlat(finalText).teksTanpaTag : finalText);
        if (permintaan.length) teks += `\n\n_⚠️ Batas ${MAKS_PUTARAN} putaran alat folder tercapai — sebagian permintaan alat tidak dijalankan._`;
        const tercatat = {
          jalan: diubah.some((d) => /^(▶️|⚠️ kode|⏱️)/.test(d)),
          ubah: diubah.some((d) => d.startsWith('✅')),
        };
        const peringatan = peringatanKlaimTanpaAlat(teks, tercatat);
        if (peringatan && !_folderKoreksi && _folderPutaran < MAKS_PUTARAN) {
          const putaran = _folderPutaran + 1;
          onChunk?.('🔁 koreksi…', `_🔁 Jawaban mengaku menjalankan/mengubah tanpa alat — meminta model mengulang dengan alat (putaran ${putaran}/${MAKS_PUTARAN})…_`, steps || []);
          const pesanKoreksi = susunPesanKoreksi({ putaran, pertanyaanAsli, tercatat });
          return this.processMessage({
            userMsg: pesanKoreksi,
            history: [...(history || []), { role: 'model', content: finalText }, { role: 'user', content: pesanKoreksi }],
            workspaceId, userId, token, signal, attachedFile: null, workspaceManager,
            onChunk, onDone: onDoneAsli, onError, onNalar,
            modelTierOverride: modelTierOverride || infoFolder.tingkat || null,
            _folderPutaran: putaran, _folderPertanyaan: pertanyaanAsli, _folderDibaca: dibaca, _folderDiubah: diubah, _folderByte,
            _folderKoreksi: true,
          });
        }
        if (peringatan) teks += `\n\n${peringatan}`;
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

    if (resolvedMode === 'ENGINEER') {
      const onDoneEngineer = onDone;
      onDone = (finalText, steps, jsonMetadata, extras = {}) => {
        let teks = finalText;
        if (!extras?.hasPatch && typeof teks === 'string') {
          teks = blokKodeKeMametCmd(teks);
          const peringatan = peringatanKlaimEngineer(teks, userMsg);
          if (peringatan) teks += `\n\n${peringatan}`;
          const peringatanTugas = peringatanTugasTakDiumumkan(userMsg, teks);
          if (peringatanTugas) teks += `\n\n${peringatanTugas}`;
          const peringatanKlaim = peringatanKlaimTakTeruji(teks);
          if (peringatanKlaim) teks += `\n\n${peringatanKlaim}`;
        }
        return onDoneEngineer?.(teks, steps, jsonMetadata, extras);
      };
    }

    const classifier = this.serviceManager.has('RequestClassifierService')
      ? this.serviceManager.get('RequestClassifierService')
      : null;
    const classifiedResult = _folderPutaran > 0 || _konektorPutaran > 0
      ? { type: 'CONVERSATION', metadata: {} }
      : (classifier?.classify(userMsg, history, resolvedMode) || { type: 'CONVERSATION', metadata: {} });
    const requestType = classifiedResult.type;
    const classifierMeta = classifiedResult.metadata || {};

    const handlerParams = {
      userMsg, history, workspaceId, userId, token, signal,
      attachedFile, workspaceManager, onChunk, onDone, onError, onNalar,
      resolvedMode, resolvedAppSource, modelTierOverride, chatId,
      _isPostHocWebRetry, _injectedKnowledgeContext,
      _folderKerja: infoFolder,
      _konektor: infoKonektor
    };

    const jalurRinganTerlarang = resolvedMode === 'ENGINEER';

    if (requestType === 'MEMORY_STORE' && !jalurRinganTerlarang) {
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

    if (requestType === 'DOC_CONVERT' && !jalurRinganTerlarang) {
      return this._handleDocConvert({ ...handlerParams, direction: classifierMeta.direction });
    }

    if (requestType === 'LOOKUP' && !jalurRinganTerlarang) {
      return this._handleLookup(handlerParams);
    }

    if (requestType === 'SKILL' && !jalurRinganTerlarang) {
      const skillReg = this.serviceManager.has('SkillRegistry')
        ? this.serviceManager.get('SkillRegistry')
        : null;
      const skill = skillReg?.getSkill(classifierMeta?.skillId);
      if (skill) {
        return this._handleSkill({ ...handlerParams, skill });
      }
      console.warn(`[processMessage] Skill "${classifierMeta?.skillId}" tidak ditemukan — fallback ke CONVERSATION`);
    }

    return this._handleConversation(handlerParams);
  }


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

  async _handleDocConvertLewatLaptop({ attachedFile, onChunk, onDone }) {
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


  async _handleLookup({
    userMsg, history, workspaceId, userId, token, workspaceManager, signal = null,
    resolvedMode, resolvedAppSource, onChunk, onDone, onError, _folderKerja = null, _konektor = null
  }) {
    console.log('[AssistantService] PR#8 → _handleLookup (skip memory/semantic; dokumen dicari server bila RAG nyala)');

    const toolPreferencesService = this.serviceManager?.get('ToolPreferencesService');
    const ragToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'rag') : true;
    const memoryToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'memory_manager') : true;
    const dataTabelToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'data_tabel') : false;
    const lookupLite = resolvedMode === 'LITE';

    let aiProvider = 'gemini';
    let formattedModel = '';
    let aiKey = '';
    let aiThinking;
    try {
      const brainService = this.serviceManager.get('BrainService');
      if (brainService) {
        const context = await brainService.getActiveBrainContext('KECIL');
        if (_folderKerja) _folderKerja.tingkat = 'KECIL';
        if (_konektor) _konektor.tingkat = 'KECIL';
        aiProvider = context.provider || 'gemini';
        formattedModel = context.model || '';
        aiKey = context.key || '';
        aiThinking = context.thinking === true;
        console.log(`[AssistantService] Model tier: KECIL (LOOKUP selalu tier ringan) → ${aiProvider}/${formattedModel || '(default)'}${aiThinking === true ? ' [thinking: ON]' : aiThinking === false ? ' [thinking: OFF]' : ''}`);
      }
    } catch (e) {
      console.warn('[AssistantService] BrainService not available:', e);
    }

    const traceId = crypto.randomUUID();
    const angLookup = anggaranKonteks(await this.bahanAnggaranKonteks(formattedModel));
    const konteksLookup = pilihPesanKonteks(history, { anggaranToken: angLookup.token });
    const payload = {
      message: userMsg,
      mode: 'LOOKUP',
      traceId,
      pemilihModel: 'tier-auto',
      appSource: resolvedAppSource,
      workspaceTarget: null,
      history: konteksLookup.dikirim.map(pesanUntukServer),
      riwayatDilewati: konteksLookup.dilewati,
      globalMemory: '',
      semanticContext: '',
      stream: false,
      ragEnabled: ragToolEnabled,
      memoryEnabled: memoryToolEnabled,
      model: formattedModel || undefined,
      thinking: aiThinking,
      clientTimezone: zonaWaktuBrowser(),
      dataTabel: dataTabelToolEnabled && !lookupLite ? true : undefined,
      folderKerja: _folderKerja || undefined,
      ...muatanKonektor(_konektor),
      cache_hint: true,
      _request_type: 'LOOKUP'
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    this._catatJejakKlien(susunJejakKlien({ jalur: 'LOOKUP', traceId, riwayatTersedia: history, dikirim: payload.history, anggaran: { token: angLookup.token, terpakai: konteksLookup.tokenTerpakai, dilewati: konteksLookup.dilewati } }));

    const headers = this.buildHeaders(token, aiProvider, aiKey);

    let response;
    try {
      response = await fetch(AGENT_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload), signal });
    } catch (fetchErr) {
      if (dibatalkanPemakai(fetchErr, signal)) return;
      onError?.({ kode: 'JARINGAN', teknis: fetchErr.message });
      return;
    }

    console.log(`[LIFECYCLE] LOOKUP response received (HTTP ${response.status})`);

    if (!response.ok) {
      const galat = await bacaGalatRespons(response);
      console.error('[LIFECYCLE] Edge Function Error:', galat.kode || galat.teknis || `HTTP ${response.status}`);
      onError?.(galat);
      return;
    }

    await this._handleResponseStream(response, { userMsg, isEngineerMode: false, workspaceManager, onChunk, onDone, onError, signal, traceId });
  }


  async _handleSkill({
    skill, userMsg, history, userId, token, workspaceManager, signal = null,
    resolvedMode, resolvedAppSource, onChunk, onDone, onError
  }) {
    console.log(`[AssistantService] Skill → _handleSkill("${skill.id}")`);

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

    const skillContext = {
      skillId: skill.id,
      skillName: skill.name,
      answers: [],
      outputs: [],
      currentStep: 0
    };

    for (let i = 0; i < skill.steps.length; i++) {
      const step = skill.steps[i];
      const stepPolicy = validation.stepPolicies?.[i]?.policy || 'ALLOW';
      skillContext.currentStep = i + 1;

      console.log(`[SkillHandler] Step ${i + 1}/${skill.steps.length}: action=${step.action}`);

      if (step.action === 'ask') {
        const askMsg = `**[Skill: ${skill.name} — Langkah ${i + 1}/${skill.steps.length}]**\n\n${step.prompt}`;

        if (i === 0) {
          onDone?.(askMsg, [], null, { isSkillStep: true, skillId: skill.id, stepIndex: i });
          this.eventBus.emit('Skill:StepDone', { skillId: skill.id, step: i + 1, action: 'ask' });
          const continueMsg = `\n\n_Jawab pertanyaan di atas, kemudian saya akan melanjutkan ke langkah berikutnya._`;
          this.eventBus.emit('Skill:AwaitingAnswer', {
            skillId: skill.id,
            stepIndex: i,
            remainingSteps: skill.steps.slice(i + 1)
          });
          return;
        } else {
          const lastUserMsg = history.slice().reverse().find(m => m.role === 'user')?.content || '';
          skillContext.answers.push({ step: i + 1, answer: lastUserMsg });
        }
      }

      if (step.action === 'generate') {
        let contextSummary = '';
        if (skillContext.answers.length > 0) {
          contextSummary = skillContext.answers
            .map(a => `Jawaban langkah ${a.step}: ${a.answer}`)
            .join('\n');
        }

        const generatePrompt = contextSummary
          ? `${step.prompt}\n\nKonteks dari jawaban sebelumnya:\n${contextSummary}`
          : step.prompt;

        const { aiProvider, formattedModel, aiKey } = await this._resolveAIProvider();
        const traceIdLangkah = crypto.randomUUID();
        const angSkill = anggaranKonteks(await this.bahanAnggaranKonteks(formattedModel));
        const konteksSkill = pilihPesanKonteks(history, { anggaranToken: angSkill.token });
        const payload = {
          message: generatePrompt,
          mode: resolvedMode || 'STANDARD',
          traceId: traceIdLangkah,
          pemilihModel: 'owner-settings',
          appSource: resolvedAppSource,
          history: konteksSkill.dikirim.map(pesanUntukServer),
          riwayatDilewati: konteksSkill.dilewati,
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
        this._catatJejakKlien(susunJejakKlien({ jalur: 'SKILL', traceId: traceIdLangkah, riwayatTersedia: history, dikirim: payload.history, anggaran: { token: angSkill.token, terpakai: konteksSkill.tokenTerpakai, dilewati: konteksSkill.dilewati } }));

        const headers = this.buildHeaders(token, aiProvider, aiKey);
        let response;
        try {
          response = await fetch(AGENT_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload), signal });
        } catch (fetchErr) {
          if (dibatalkanPemakai(fetchErr, signal)) return;
          onError?.({ kode: 'JARINGAN_SKILL', teknis: fetchErr.message });
          this.eventBus.emit('Skill:Error', { skillId: skill.id, step: i + 1, reason: fetchErr.message });
          return;
        }

        if (!response.ok) {
          onError?.({ kode: 'SKILL_HTTP', status: response.status });
          this.eventBus.emit('Skill:Error', { skillId: skill.id, step: i + 1, reason: `HTTP ${response.status}` });
          return;
        }

        await this._handleResponseStream(response, {
          userMsg: generatePrompt,
          isEngineerMode: false,
          workspaceManager,
          onChunk,
          onDone,
          onError,
          signal,
          traceId: traceIdLangkah
        });

        skillContext.outputs.push({ step: i + 1, done: true });
        this.eventBus.emit('Skill:StepDone', { skillId: skill.id, step: i + 1, action: 'generate' });
      }

      if (step.action === 'write') {
        if (stepPolicy === 'REQUIRE_CONFIRMATION') {
          const confirmMsg = `⚠️ Skill "${skill.name}" ingin menulis file — menulis dari skill belum didukung, jadi TIDAK ada berkas yang ditulis.`;
          onDone?.(confirmMsg, [], null);
          this.eventBus.emit('Skill:StepDone', { skillId: skill.id, step: i + 1, action: 'write', requiresConfirmation: true });
        }
      }

      if (step.action === 'read') {
        console.log(`[SkillHandler] Step read — stub, path: ${step.path || '(tidak ada)'}`);
        skillContext.answers.push({ step: i + 1, answer: `[read: ${step.path || 'tidak ada path'}]` });
        this.eventBus.emit('Skill:StepDone', { skillId: skill.id, step: i + 1, action: 'read' });
      }
    }

    const duration = Date.now() - startedAt;
    this.eventBus.emit('Skill:Completed', {
      skillId: skill.id,
      totalSteps: skill.steps.length,
      duration
    });
    console.log(`[SkillHandler] Skill "${skill.id}" selesai dalam ${duration}ms`);

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


  async _handleConversation({
    userMsg, history, workspaceId, userId, token, signal = null,
    attachedFile, workspaceManager, resolvedMode, resolvedAppSource,
    onChunk, onDone, onError, onNalar, modelTierOverride = null,
    chatId = null,
    _isPostHocWebRetry = false, _injectedKnowledgeContext = '', _folderKerja = null, _konektor = null
  }) {
    const isEngineerMode = resolvedMode === 'ENGINEER';
    const folderLanjutan = (_folderKerja?.putaran || 0) > 0 || (_konektor?.putaran || 0) > 0;
    const isLiteMode = resolvedMode === 'LITE';

    console.log(`[AssistantService] Mode check: workspace=${workspaceId}, resolvedMode=${resolvedMode}`);

    let aiProvider = 'gemini';
    let formattedModel = '';
    let aiKey = '';
    let aiThinking;
    let selectedTier = null;
    let tierReason = '';
    try {
      const brainService = this.serviceManager.get('BrainService');
      if (brainService) {
        if (!isEngineerMode) {
          if (modelTierOverride) {
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
        if (_folderKerja && selectedTier) _folderKerja.tingkat = selectedTier;
        if (_konektor && selectedTier) _konektor.tingkat = selectedTier;
        aiProvider = context.provider || 'gemini';
        formattedModel = context.model || '';
        aiKey = context.key || '';
        aiThinking = context.thinking === true;

        if (selectedTier) {
          console.log(`[AssistantService] Model tier: ${selectedTier} (${tierReason}) → ${aiProvider}/${formattedModel || '(default)'}${aiThinking === true ? ' [thinking: ON]' : aiThinking === false ? ' [thinking: OFF]' : ''}`);
        }
      }
    } catch (e) {
      console.warn('[AssistantService] BrainService not available:', e);
    }

    const pemilihModel = isEngineerMode
      ? 'owner-settings'
      : modelTierOverride
        ? 'owner-override'
        : selectedTier
          ? 'tier-auto'
          : 'owner-settings';

    const toolPreferencesService = this.serviceManager?.get('ToolPreferencesService');
    const memoryToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'memory_manager') : true;

    const pesanHasilMesin = folderLanjutan || /^\s*\[(TERMINAL OUTPUT for: |HASIL ALAT FOLDER\]|HASIL ALAT KONEKTOR\])/.test(userMsg || '');
    const memoryAktif = memoryToolEnabled && !pesanHasilMesin;

    const { localContext, semanticContext } = await this.buildContextInjection(
      userMsg, resolvedMode, userId, memoryAktif
    );

    const ragToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'rag') : true;
    const webSearchToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'web_search') : true;
    const deepResearchToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'deep_research') : false;
    const dataTabelToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'data_tabel') : false;
    const pesanModelTerakhir = [...(history || [])].reverse().find((m) => m?.role === 'model');
    const lanjutanTerpotong = pesanModelTerakhir?.metadata?.terpotong === true &&
      /^\s*(tolong\s+|mohon\s+)?(lanjut(kan|in)?|teruskan|terusin|continue)(\s+(lagi|jawaban(nya)?|laporan(nya)?|tulisan(nya)?))?\s*[.!]*\s*$/i.test(userMsg || '');

    const requestTraceId = crypto.randomUUID();
    let knowledgeContext = _injectedKnowledgeContext || '';
    const retrievalOrchestrator = this.serviceManager?.get('RetrievalOrchestrator');
    const langkahKlien = [];
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
        if (retrievalResult?.kueriDicari) {
          const hasilWeb = retrievalResult.status === 'SUCCESS' ? `${retrievalResult.chunks?.length || 0} hasil` : (retrievalResult.status || 'gagal');
          langkahKlien.push(`🔍 Dicari (web): "${retrievalResult.kueriDicari}" → ${hasilWeb}`);
        }
      } catch (err) {
        console.warn('[AssistantService] RetrievalOrchestrator query error (fallback):', err.message);
      }
    }

    let combinedContext = '';
    if (localContext && knowledgeContext) {
      combinedContext = `[PREFERENSI PERSONAL PENGGUNA (Gunakan hanya jika relevan dengan konteks)]:\n${localContext}\n\n[DOKUMEN PENGETAHUAN & REFERENSI BERITA/WEB]:\n${knowledgeContext}`;
    } else if (knowledgeContext) {
      combinedContext = `[DOKUMEN PENGETAHUAN & REFERENSI BERITA/WEB]:\n${knowledgeContext}`;
    } else if (localContext) {
      combinedContext = localContext;
    }

    const enhancedRagContext = combinedContext;

    const fileData = await this.buildFileData(attachedFile);

    const rawRagLen = (enhancedRagContext || '').length;
    const rawSemLen = (semanticContext || '').length;

    const biaya = await this.bahanAnggaranKonteks(formattedModel);
    const ang = anggaranKonteks({ ...biaya, porsi: isLiteMode ? 0.02 : undefined });
    const ragDibagi = bagiAnggaranKonteks(ang.token, enhancedRagContext || '');
    const semantikDibagi = bagiAnggaranKonteks(Math.max(0, ang.token - 2 * ragDibagi.tokenTerpakai), semanticContext || '');
    const trimmedRagContext = ragDibagi.teks;
    const trimmedSemanticContext = semantikDibagi.teks;
    const tokenKonteksTambahan = ragDibagi.tokenTerpakai + semantikDibagi.tokenTerpakai;
    if (ragDibagi.hurufDipotong || semantikDibagi.hurufDipotong) {
      console.warn(`[Konteks] konteks tambahan melebihi separuh anggaran — ${ragDibagi.hurufDipotong + semantikDibagi.hurufDipotong} huruf tidak dikirim (dicatat jujur ke model)`);
    }

    const tokensBefore = estimateTokens(enhancedRagContext) + estimateTokens(semanticContext) + estimateTokens(userMsg);
    const tokensAfter  = estimateTokens(trimmedRagContext) + estimateTokens(trimmedSemanticContext) + estimateTokens(userMsg);
    const tokensSaved  = tokensBefore - tokensAfter;

    const konteks = pilihPesanKonteks(history, { anggaranToken: Math.max(0, ang.token - tokenKonteksTambahan), mulaiDari: bacaMulaiDari(chatId) });
    this.konteksTerakhir = { ...konteks, ...ang, chatId, dikirim: undefined };
    console.log(`[Konteks] ${konteks.tokenTerpakai} / ${ang.token} token (${konteks.dikirim.length} pesan dikirim, ${konteks.dilewati} dilewati) — ${ang.alasan}`);

    const payload = {
      message: userMsg,
      mode: resolvedMode,
      pemilihModel,
      appSource: resolvedAppSource,
      workspaceTarget: workspaceId,
      traceId: requestTraceId,
      history: konteks.dikirim.map(pesanUntukServer),
      riwayatDilewati: konteks.dilewati,
      globalMemory: trimmedRagContext,
      semanticContext: trimmedSemanticContext,
      stream: false,
      streamNalar: aiThinking === true,
      ragEnabled: ragToolEnabled && !lanjutanTerpotong && !pesanHasilMesin,
      memoryEnabled: memoryAktif,
      model: formattedModel || undefined,
      thinking: aiThinking,
      clientTimezone: zonaWaktuBrowser(),
      file: fileData || undefined,
      requestedFilePath: isEngineerMode ? this.extractFilePathFromMessage(userMsg) : undefined,
      tools: isLiteMode
        ? ['rag_search', 'web_search', 'deep_research']
        : (deepResearchToolEnabled && !isEngineerMode ? ['deep_research'] : undefined),
      dataTabel: dataTabelToolEnabled && !isLiteMode && !isEngineerMode && !folderLanjutan ? true : undefined,
      folderKerja: _folderKerja || undefined,
      ...muatanKonektor(_konektor),
      cache_hint: true,
      _token_meta: { estimated_before: tokensBefore, estimated_after: tokensAfter, saved: tokensSaved },
      _request_type: 'CONVERSATION'
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    this._catatJejakKlien(susunJejakKlien({
      jalur: 'CONVERSATION',
      traceId: requestTraceId,
      putaranAlat: pesanHasilMesin,
      riwayatTersedia: history,
      dikirim: payload.history,
      konteksRag: { sebelum: rawRagLen, sesudah: trimmedRagContext.length },
      semantik: { sebelum: rawSemLen, sesudah: trimmedSemanticContext.length },
      anggaran: { token: ang.token, terpakai: konteks.tokenTerpakai, dilewati: konteks.dilewati },
    }));

    const headers = this.buildHeaders(token, aiProvider, aiKey);
    let response;
    try {
      response = await fetch(AGENT_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload), signal });
    } catch (fetchErr) {
      if (dibatalkanPemakai(fetchErr, signal)) return;
      onError?.({ kode: 'JARINGAN', teknis: fetchErr.message });
      return;
    }

    console.log(`[LIFECYCLE] LLM response received (HTTP Status: ${response.status})`);

    if (!response.ok) {
      const galat = await bacaGalatRespons(response);
      console.error('[LIFECYCLE] Edge Function Error:', galat.kode || galat.teknis || `HTTP ${response.status}`);
      onError?.(galat);
      return;
    }

    await this._handleResponseStream(response, {
      userMsg, isEngineerMode, workspaceManager, onChunk, onDone, onError, userId,
      history, workspaceId, token, attachedFile, resolvedMode, resolvedAppSource,
      _isPostHocWebRetry, onNalar, hybrid: payload.streamNalar === true, signal, traceId: requestTraceId,
      langkahAwal: langkahKlien
    });
  }

  async _bacaAliranHybrid(response, { onNalar, onError, signal = null }) {
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
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const l of lines) olah(l.trim());
      }
    } catch (bacaErr) {
      if (dibatalkanPemakai(bacaErr, signal)) return null;
      throw bacaErr;
    }
    if (buffer.trim()) olah(buffer.trim());
    if (!hasil && signal?.aborted) return null;
    if (!hasil) { onError?.({ kode: 'ALIRAN_TERPUTUS', teknis: 'aliran berakhir tanpa blok hasil' }); return null; }
    if (hasil.galat) { onError?.({ teknis: hasil.galat }); return null; }
    if (hasil.status >= 400) {
      onError?.({ kode: hasil.data?.error || null, pesan: hasil.data?.message || null, status: hasil.status });
      return null;
    }
    return hasil.data;
  }


  async _handleResponseStream(response, {
    userMsg, isEngineerMode, workspaceManager, onChunk, onDone, onError, userId,
    history, workspaceId, token, attachedFile, resolvedMode, resolvedAppSource,
    _isPostHocWebRetry = false, onNalar, hybrid = false, signal = null,
    traceId = null,
    langkahAwal = [],
  }) {
    const contentType = response.headers.get('content-type') || '';

    let jsonHybrid = null;
    if (hybrid && contentType.includes('text/event-stream')) {
      jsonHybrid = await this._bacaAliranHybrid(response, { onNalar, onError, signal });
      if (!jsonHybrid) return;
    }

    if (jsonHybrid || contentType.includes('application/json')) {
      console.log(jsonHybrid ? '[LIFECYCLE] Received JSON response (HYBRID mode)' : '[LIFECYCLE] Received JSON response (DIRECT mode)');
      const jsonMentah = jsonHybrid || await response.json();
      const { jejakPrompt: jejakServer, ...jsonTanpaJejak } = jsonMentah && typeof jsonMentah === 'object' ? jsonMentah : {};
      const jsonData = jsonMentah && typeof jsonMentah === 'object' ? jsonTanpaJejak : jsonMentah;
      this._catatJejakServer(jejakServer);
      const rawContent = typeof (jsonData.message || jsonData) === 'string'
        ? (jsonData.message || jsonData)
        : JSON.stringify(jsonData.message || jsonData);

      const hasPatch = isEngineerMode && adaPenandaPatch(rawContent);
      const cleanContent = hasPatch ? buangPenandaPatch(rawContent) : rawContent;

      onDone?.(cleanContent, [...langkahAwal, ...(jsonData.processingSteps || [])], jsonData, { hasPatch, patchOriginalTask: hasPatch ? userMsg : undefined, traceId });


      if (userId) {
        await this.finalizeAssistantSession({ userId });
      }
      return;
    }

    let reader, decoder;
    try {
      reader = response.body.getReader();
      decoder = new TextDecoder('utf-8');
    } catch (streamErr) {
      console.error('[LIFECYCLE] Failed to get stream reader:', streamErr);
      onError?.({ kode: 'ALIRAN_TAK_TERBACA', teknis: streamErr?.message });
      return;
    }

    let done = false;
    let aiResponseText = '';
    let processingSteps = [...langkahAwal];
    let buffer = '';
    let penyedia = null;

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
              if (typeof parsed.penyedia === 'string' && parsed.penyedia) penyedia = parsed.penyedia;

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

    const hasPatch = isEngineerMode && adaPenandaPatch(aiResponseText);
    const finalText = hasPatch ? buangPenandaPatch(aiResponseText) : aiResponseText;

    onDone?.(finalText, processingSteps, penyedia ? { penyedia } : null, {
      hasPatch,
      patchOriginalTask: hasPatch ? userMsg : undefined,
      traceId,
    });

    const isInsufficient = /\[STATUS:\s*INSUFFICIENT\]/i.test(finalText) ||
      /\b(saya tidak dapat memberikan informasi terbaru|tidak ditemukan di database.*tidak memiliki informasi|informasi.*tidak cukup.*\[STATUS:\s*INSUFFICIENT\])\b/i.test(finalText);

    if (isInsufficient && !_isPostHocWebRetry && !isEngineerMode && !/^\s*\[(TERMINAL OUTPUT for: |HASIL ALAT FOLDER\]|HASIL ALAT KONEKTOR\])/.test(userMsg || '')) {
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
                userMsg, history, workspaceId, userId, token, signal,
                attachedFile, workspaceManager, resolvedMode, resolvedAppSource,
                onChunk, onDone, onError, chatId,
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

    if (userId) {
      await this.finalizeAssistantSession({ userId });
    }
  }


  async bahanAnggaranKonteks(model) {
    const sekarang = Date.now();
    if (this._anggaranCache && this._anggaranCache.model === model && sekarang - this._anggaranCache.waktu < 120000) {
      return this._anggaranCache.nilai;
    }
    const nilai = { batasHarianUsd: undefined, terpakaiHariIniUsd: 0, hargaInput1M: undefined, batasModel: undefined };
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const batas = Number(user?.user_metadata?.daily_budget_cap_usd);
      if (Number.isFinite(batas) && batas > 0) nilai.batasHarianUsd = batas;

      if (model) {
        const { data: harga } = await supabase.from('model_pricing')
          .select('input_price_per_1m, context_length').eq('model', model).maybeSingle();
        const h = Number(harga?.input_price_per_1m);
        if (Number.isFinite(h) && h > 0) nilai.hargaInput1M = h;
        const j = Number(harga?.context_length);
        if (Number.isFinite(j) && j > 0) nilai.batasModel = j;
      }
      if (user?.id) {
        const awalHari = new Date(); awalHari.setHours(0, 0, 0, 0);
        const { data: pakai } = await supabase.from('api_usage')
          .select('cost_usd').eq('user_id', user.id).gte('created_at', awalHari.toISOString());
        nilai.terpakaiHariIniUsd = (pakai || []).reduce((t, r) => t + (Number(r.cost_usd) || 0), 0);
      }
    } catch (e) {
      console.warn('[Konteks] gagal membaca bahan anggaran, memakai bawaan:', e.message);
    }
    this._anggaranCache = { model, waktu: sekarang, nilai };
    return nilai;
  }

  async padatkanKonteks(pesan, model) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sesi tidak aktif — masuk ulang lalu coba lagi.');

    const brain = this.serviceManager?.has('BrainService') ? this.serviceManager.get('BrainService') : null;
    const cfg = (await brain?.getActiveBrainContext?.()) || {};
    if (!cfg.key) throw new Error('Memadatkan konteks memerlukan API Key Anda sendiri. Buka Settings → AI Provider.');
    const headers = this.buildHeaders(session.access_token, cfg.provider, cfg.key);

    const { data, error } = await supabase.functions.invoke('agent-process', {
      body: { action: 'padatkan', pesan: (pesan || []).map((p) => ({ role: p.role, content: p.content })), model: model || cfg.model || '' },
      headers,
    });
    if (error) {
      let alasan = error.message;
      try {
        const isi = await error.context?.json?.();
        if (isi?.message || isi?.error) alasan = isi.message || isi.error;
      } catch {  }
      throw new Error(alasan);
    }
    if (data?.error) throw new Error(data.message || data.error);
    if (!data?.ringkasan) throw new Error('Server tidak mengembalikan ringkasan.');
    return { ringkasan: String(data.ringkasan), jumlahPesan: Number(data.jumlahPesan) || 0 };
  }

  async saveChatToDB({ messages, chatId, userId, workspaceId, onNewChatId }) {
    if (!messages || messages.length === 0) return;
    if (!userId) return;

    const title = messages[0]?.content?.substring(0, 50) || 'Percakapan Baru';
    const payload = {
      user_id: userId,
      title,
      messages: messages.map(rampingkanPesan),
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

    try {
      const eventBus = this.serviceManager?.get('EventBus');
      if (eventBus && finalChatId) {
        eventBus.emit('Chat:Updated', { chatId: finalChatId, workspaceId: workspaceId || 'ws-assistant', title });
      }
    } catch (e) {
      console.warn('[AssistantService] Gagal emit Chat:Updated:', e.message);
    }
  }

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

  async loadChat(chatId) {
    if (!chatId) return { messages: null, hilang: true, error: null };
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .maybeSingle();

    if (error) {
      console.error('[AssistantService] loadChat gagal membaca (chat TIDAK dianggap hilang):', error);
      return { messages: null, hilang: false, error: error.message || 'gagal membaca chat' };
    }
    if (!data) return { messages: null, hilang: true, error: null };
    return { messages: data.messages || [], hilang: false, error: null };
  }


  async runCommand(perintah, riwayatPerintah = []) {
    if (!window.electronAPI?.engineer?.jalankan) {
      return { output: 'Menjalankan perintah hanya tersedia di aplikasi desktop.', success: false };
    }

    const berulang = cekPerintahBerulang(perintah, riwayatPerintah);
    if (berulang.ulang) {
      return { output: berulang.pesan, success: false, ditolakOwner: false, ditolakAturan: false, ditolakProsedur: true };
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
      const petunjuk = petunjukHasilKosong(perintah, output);
      if (petunjuk) output += `\n\n${petunjuk}`;
      const petunjukPotong = petunjukKeluaranTerpotong(perintah, h);
      if (petunjukPotong) output += `\n\n${petunjukPotong}`;
      const petunjukGrep = petunjukGrepSebagian(perintah, h);
      if (petunjukGrep) output += `\n\n${petunjukGrep}`;
    } else if (h?.ditolakOwner) {
      output = 'DITOLAK OWNER di dialog izin — perintah TIDAK dijalankan.';
    } else {
      output = `TIDAK DIJALANKAN: ${h?.alasan || 'alasan tidak diketahui'}`;
    }
    const success = !!h?.ok && !h.habisWaktu && h.kodeKeluar === 0;

    try {
      this.serviceManager.get('EventBus')?.emit('Engineer:CommandExecuted', {
        command: perintah, status: success ? 'success' : 'error', output
      });
    } catch (_) {}

    try {
      const auditLog = this.serviceManager.has('AuditLogService')
        ? this.serviceManager.get('AuditLogService')
        : null;
      if (auditLog) {
        const { data: sesi } = await supabase.auth.getSession();
        await auditLog.logCommand({
          userMsg: '',
          commandName: String(perintah || ''),
          targetPath: h?.alamat || '(akar repo Engineer)',
          inWorkspace: true,
          isDestructive: false,
          success,
          output,
          tanpaPersetujuan: h?.tanpaIzin === true,
          alasan: h?.ditolakOwner ? 'Ditolak Owner di dialog izin.' : (h?.alasan || ''),
          userId: sesi?.session?.user?.id || null,
        });
      }
    } catch (err) {
      console.warn('[AssistantService] Jejak audit perintah gagal disimpan:', err?.message || err);
    }
    return { output, success, ditolakOwner: !!h?.ditolakOwner, ditolakAturan: !h?.ok && !h?.ditolakOwner };
  }

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
