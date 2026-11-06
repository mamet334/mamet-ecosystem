import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Ikon from '../Ikon';
import { useWorkspace } from '../../core/workspaces/WorkspaceContext';
import { supabase } from '../../supabase';
import { tautanUnduh } from '../../core/runtime/services/remoteConversionClient';
import RiwayatKonversi from './RiwayatKonversi';
import { kernel } from '../../core/runtime/Kernel';
import FolderKerjaTombol from './FolderKerjaTombol';
import MenuTambah from '../konektor/MenuTambah';
import AkarRepoTombol from './AkarRepoTombol';
import ChatHistory from './ChatHistory';
import MemoryContextPanel from './MemoryContextPanel';
import { tugasDariUsulan } from '../../core/runtime/services/engineer/UsulanPatch.js';
import { laporanSetelahMuatUlang, hapusCatatanPatch } from '../../core/runtime/services/engineer/CatatanPatch.js';
import { putusanPemulihan, bolehSimpanChat, kunciSimpan } from './pemulihanChat.js';
import { buatPenandaKiriman, tujuanTulis, pesanTerlantar, layakSimpanTerlantar } from './pengirimanChat.js';
import { riwayatPerintahDariPesan, catatanAkarRepo, catatanPetaRepo, pesanKeluaranPerintah, catatanKonstitusi } from '../../core/runtime/services/engineer/ProsedurEngineer.js';
import { ambilBlokKlaim, susunSkripUji, susunLaporanKlaim } from '../../core/runtime/services/engineer/UjiKlaim.js';
import { ambilBlokTemuan, bacaBerkasTemuan, susunBerkasTemuan, gabungTemuan, laporanTemuan, ringkasanUntukKonteks, keutuhanTemuan, ALAMAT_BERKAS as ALAMAT_TEMUAN } from '../../core/runtime/services/engineer/IngatanTemuan.js';
import { ambilBlokPengetahuan, pengetahuanBaru, barisBrain1 } from '../../core/runtime/services/engineer/PengetahuanBrain1.js';
import { anggaranKonteks, pilihPesanKonteks, meteranKonteks, bacaMulaiDari, simpanMulaiDari, pesanUntukDipadatkan, bolehPadatkan, bentukPesanRingkasan, tokenPesan, MIN_PESAN_PADATKAN, PATOK } from '../../core/runtime/services/KonteksChat.js';
import { jejakSisipan } from '../../core/runtime/services/jejakSisipan.js';
import { blokGalat } from '../../core/runtime/services/pesanGalat.js';
import { simpanUmpanBalik, nilaiBerikutnya, bolehDinilai } from '../../core/runtime/services/umpanBalikJawaban.js';
import TombolUmpanBalik from './TombolUmpanBalik.jsx';
import { useKeadaanTersimpan, useRefTersimpan } from '../../core/runtime/hooks/useKeadaanTersimpan.js';
import { penyimpanKeadaan } from '../../core/runtime/PenyimpanKeadaan.js';
import TeksMarkdown, { KotakKode } from './TeksMarkdown.jsx';
import { jejakUntukMonitor } from '../widgets/jejakMonitor.js';
import { langkahPenting } from './langkahPenting.js';
import { simpanBerurutan } from './simpanBerurutan.js';

const parseThinkingContent = (text) => {
  if (!text) return { thinking: '', answer: '', isThinkingComplete: false };
  const buka = text.search(/<think>/i);
  if (buka !== -1) {
    const tutup = text.search(/<\/think>/i);
    if (tutup === -1) return { thinking: text.slice(buka + 7).trim(), answer: text.slice(0, buka).trim(), isThinkingComplete: false };
    return {
      thinking: text.slice(buka + 7, tutup).trim(),
      answer: (text.slice(0, buka) + text.slice(tutup + 8)).trim(),
      isThinkingComplete: true
    };
  }
  const startIndex = text.indexOf(' thinking');
  const endIndex = text.indexOf(' response');
  if (startIndex !== -1) {
    if (endIndex !== -1) {
      return {
        thinking: text.substring(startIndex + 7, endIndex).trim(),
        answer: text.substring(endIndex + 8).trim(),
        isThinkingComplete: true
      };
    }
    return { thinking: text.substring(startIndex + 7).trim(), answer: '', isThinkingComplete: false };
  }
  return { thinking: '', answer: text, isThinkingComplete: true };
};

export default function ConversationEngine({ sessionId }) {
  const { manager: workspaceManager, osState } = useWorkspace();
  const kunciSesi = workspaceManager.appId;

  const chatStorageKey = osState?.workspaceId
    ? `mamet_v4_${osState.workspaceId}_current_chat_id`
    : null;

  const [toolTogglesVersion, setToolTogglesVersion] = useState(0);
  const toolPreferencesService = kernel.serviceManager?.get('ToolPreferencesService');
  const ragEnabledHere = (toolPreferencesService && osState?.workspaceId)
    ? toolPreferencesService.getEffective(osState.workspaceId, 'rag')
    : true;

  const toolRegistryService = kernel.serviceManager?.get('ToolRegistryService');
  const registeredTools = toolRegistryService ? toolRegistryService.listTools() : [];
  const KNOWN_TOOL_LABELS = {
    web_search: 'Web',
    memory_manager: 'Memory',
    deep_research: 'Deep Research',
    data_tabel: 'Data Tabel',
    word_to_pdf: 'Word → PDF'
  };
  const formatToolLabel = (name) => KNOWN_TOOL_LABELS[name]
    || name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const getToolEnabled = (toolName) => (toolPreferencesService && osState?.workspaceId)
    ? toolPreferencesService.getEffective(osState.workspaceId, toolName)
    : true;
  const toolsEnabledCount = (ragEnabledHere ? 1 : 0)
    + registeredTools.filter(tool => getToolEnabled(tool.name)).length;

  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const toolsPanelRef = useRef(null);

  const [modelTierOverride, setModelTierOverride] = useKeadaanTersimpan(kunciSesi, 'modelTierOverride', null);
  const [showTierPanel, setShowTierPanel] = useState(false);
  const tierPanelRef = useRef(null);
  const isEngineerWorkspace = osState?.workspaceId === 'ws-engineer';
  const instansiEngineerRef = useRef(false);
  instansiEngineerRef.current = osState?.workspaceId === 'ws-engineer';

  useEffect(() => {
    if (!showTierPanel) return;
    const handleClickOutside = (e) => {
      if (tierPanelRef.current && !tierPanelRef.current.contains(e.target)) {
        setShowTierPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTierPanel]);
  useEffect(() => {
    if (!showToolsPanel) return;
    const handleClickOutside = (e) => {
      if (toolsPanelRef.current && !toolsPanelRef.current.contains(e.target)) {
        setShowToolsPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showToolsPanel]);

  const [messages, setMessages] = useKeadaanTersimpan(kunciSesi, 'messages', []);
  const [input, setInput] = useKeadaanTersimpan(kunciSesi, 'input', '');
  const [isLoading, setIsLoading] = useKeadaanTersimpan(kunciSesi, 'isLoading', false);
  const kendaliKirimRef = useRefTersimpan(kunciSesi, 'kendaliKirim', null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [galatUmpanBalik, setGalatUmpanBalik] = useState(null);
  const [currentChatId, setCurrentChatId] = useKeadaanTersimpan(kunciSesi, 'currentChatId', null);
  const [initialRestoreDone, setInitialRestoreDone] = useKeadaanTersimpan(kunciSesi, 'initialRestoreDone', false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useKeadaanTersimpan(kunciSesi, 'attachedFile', null);

  const [activeMemories, setActiveMemories] = useKeadaanTersimpan(kunciSesi, 'activeMemories', []);
  const [lastMemoryQuery, setLastMemoryQuery] = useKeadaanTersimpan(kunciSesi, 'lastMemoryQuery', '');
  const [isMemoryPanelOpen, setIsMemoryPanelOpen] = useKeadaanTersimpan(kunciSesi, 'isMemoryPanelOpen', false);
  const [isMemoryLoading, setIsMemoryLoading] = useKeadaanTersimpan(kunciSesi, 'isMemoryLoading', false);

  const [engineerCmdStates, setEngineerCmdStates] = useKeadaanTersimpan(kunciSesi, 'engineerCmdStates', {});
  const cmdOtomatisRef = useRefTersimpan(kunciSesi, 'cmdOtomatis', () => new Set());
  const [lastCheckpoint, setLastCheckpoint] = useKeadaanTersimpan(kunciSesi, 'lastCheckpoint', null);
  const [rollbackState, setRollbackState] = useKeadaanTersimpan(kunciSesi, 'rollbackState', 'idle');

  const [webConfirmation, setWebConfirmation] = useKeadaanTersimpan(kunciSesi, 'webConfirmation', null);

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const isNewChatInitiatedByUser = useRef(false);
  const percakapanSeqRef = useRefTersimpan(kunciSesi, 'percakapanSeq', 0);
  const isInitialMount = useRef(true);
  const prevSessionIdRef = useRef(sessionId);

  const getAssistantService = () => kernel.serviceManager?.get('AssistantService');
  const getWebComparisonService = () => kernel.serviceManager?.get('WebComparisonService');

  const openLifecycleInspector = (stepName, logs) => {
    workspaceManager.openWidgetInWorkbench('right', 'widget:maef-monitor', {
      focusStep: stepName,
      logs
    });
  };

  const handleMinimizeSidePanels = () => {
    setIsMemoryPanelOpen(false);
    if (workspaceManager?.closeWidget) {
      const rightWidgets = osState?.layout?.right_workbench || [];
      rightWidgets.forEach((wId) => {
        workspaceManager.closeWidget(wId);
      });
    }
  };

  const handleToggleMaefMonitor = () => {
    const rightWidgets = osState?.layout?.right_workbench || [];
    if (rightWidgets.includes('widget:maef-monitor')) {
      workspaceManager?.closeWidget?.('widget:maef-monitor');
    } else {
      workspaceManager?.openWidgetInWorkbench?.('right', 'widget:maef-monitor');
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 192)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [isSidebarOpen]);

  const lastSavedKeyRef = useRefTersimpan(kunciSesi, 'lastSavedKey', '');
  const isSavingRef = useRefTersimpan(kunciSesi, 'isSaving', false);
  const simpanTertundaRef = useRefTersimpan(kunciSesi, 'simpanTertunda', false);
  const pemulihanGagalRef = useRefTersimpan(kunciSesi, 'pemulihanGagal', false);
  const osStateRef = useRefTersimpan(kunciSesi, 'osState', osState);
  osStateRef.current = osState;
  const timerSimpanRef = useRefTersimpan(kunciSesi, 'timerSimpan', null);

  useEffect(() => {
    const p = penyimpanKeadaan;
    const simpanOtomatis = () => {
      const messages = p.baca(kunciSesi, 'messages');
      const currentChatId = p.baca(kunciSesi, 'currentChatId');
      const isLoading = p.baca(kunciSesi, 'isLoading');
      const initialRestoreDone = p.baca(kunciSesi, 'initialRestoreDone');
      clearTimeout(timerSimpanRef.current);
      timerSimpanRef.current = null;

      if (!messages || messages.length === 0 || isLoading) return;

      if (!initialRestoreDone) return;

      if (!bolehSimpanChat({ currentChatId, messages })) return;

      const saveKey = kunciSimpan({ chatId: currentChatId, messages });

      if (saveKey === lastSavedKeyRef.current) {
        return;
      }

      timerSimpanRef.current = setTimeout(() => {
        timerSimpanRef.current = null;
        simpanBerurutan(isSavingRef, simpanTertundaRef, async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user?.id) return;
          const assistantService = getAssistantService();
          if (!assistantService) return;
          const currentWsId = osStateRef.current?.workspaceId;
          if (!currentWsId) return;
          await assistantService.saveChatToDB({
            messages,
            chatId: currentChatId,
            userId: session.user.id,
            workspaceId: currentWsId,
            onNewChatId: (newId) => {
              setCurrentChatId(newId);
              const wsId = osStateRef.current?.workspaceId;
              if (wsId) localStorage.setItem(`mamet_v4_${wsId}_current_chat_id`, newId);
            }
          });
          lastSavedKeyRef.current = saveKey;
        }, simpanOtomatis);
      }, 1000);
    };
    p.amati(kunciSesi, 'simpanOtomatis', ['messages', 'currentChatId', 'isLoading', 'initialRestoreDone'], simpanOtomatis);
  }, [kunciSesi]);

  useEffect(() => {
    if (!chatStorageKey) return;
    if (!initialRestoreDone) return;
    if (currentChatId) {
      localStorage.setItem(chatStorageKey, currentChatId);
    } else if (!pemulihanGagalRef.current) {
      localStorage.removeItem(chatStorageKey);
    }
  }, [currentChatId, chatStorageKey, initialRestoreDone]);

  useEffect(() => {
    if (initialRestoreDone) return;
    if (!chatStorageKey) return;

    const savedChatId = localStorage.getItem(chatStorageKey);
    if (!savedChatId) {
      setInitialRestoreDone(true);
      return;
    }

    setCurrentChatId(savedChatId);

    const loadSavedChat = async () => {
      const assistantService = getAssistantService();
      let hasil = null;
      if (assistantService) {
        hasil = await assistantService.loadChat(savedChatId);
      } else {
        const { data, error } = await supabase.from('chats').select('*').eq('id', savedChatId).maybeSingle();
        hasil = error
          ? { messages: null, hilang: false, error: error.message }
          : { messages: data ? (data.messages || []) : null, hilang: !data, error: null };
      }

      const putusan = putusanPemulihan(hasil);
      if (putusan === 'pakai') {
        setMessages(hasil.messages);
        lastSavedKeyRef.current = kunciSimpan({ chatId: savedChatId, messages: hasil.messages });
      } else if (putusan === 'lepas') {
        console.warn('[ConversationEngine] Chat tersimpan tidak ada lagi di DB, penunjuk dilepas');
        setCurrentChatId(null);
        localStorage.removeItem(chatStorageKey);
      } else {
        console.warn('[ConversationEngine] Riwayat chat gagal dimuat, penunjuk dipertahankan:', hasil.error);
        pemulihanGagalRef.current = true;
        setCurrentChatId(null);
        setMessages([{
          role: 'model',
          content: `⚠️ **Riwayat chat gagal dimuat** — ${hasil.error || 'sebab tidak diketahui'}.\n\nChat lama **tidak hilang**; buka dari daftar riwayat. Pesan baru di sini akan tersimpan sebagai chat baru.`,
        }]);
      }
      setInitialRestoreDone(true);
    };
    loadSavedChat();
  }, [chatStorageKey]);

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    prevSessionIdRef.current = sessionId;
  }, [sessionId]);

  const chatTierRef = useRefTersimpan(kunciSesi, 'chatTier', undefined);
  useEffect(() => {
    if (chatTierRef.current === currentChatId) return;
    chatTierRef.current = currentChatId;
    setModelTierOverride(null);
  }, [currentChatId]);

  const handleNewChat = () => {
    percakapanSeqRef.current += 1;
    isNewChatInitiatedByUser.current = true;
    pemulihanGagalRef.current = false;
    setMessages([]);
    setCurrentChatId(null);
    setModelTierOverride(null);
    if (chatStorageKey) localStorage.removeItem(chatStorageKey);
  };

  const handleLoadChat = async (chatId) => {
    const assistantService = getAssistantService();
    let hasil = null;
    if (assistantService) {
      hasil = await assistantService.loadChat(chatId);
    } else {
      const { data, error } = await supabase.from('chats').select('*').eq('id', chatId).maybeSingle();
      hasil = error
        ? { messages: null, hilang: false, error: error.message }
        : { messages: data ? (data.messages || []) : null, hilang: !data, error: null };
    }
    if (hasil.messages === null) {
      console.error('[ConversationEngine] Chat tidak bisa dibuka:', hasil.error || 'baris tidak ada');
      return;
    }
    percakapanSeqRef.current += 1;
    pemulihanGagalRef.current = false;
    lastSavedKeyRef.current = kunciSimpan({ chatId, messages: hasil.messages });
    setMessages(hasil.messages);
    setCurrentChatId(chatId);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const nilaiJawaban = async (idx, tombol) => {
    const pesan = messages[idx];
    if (!bolehDinilai(pesan)) return;
    const sebelum = pesan.umpanBalik || 0;
    const nilai = nilaiBerikutnya(sebelum, tombol);
    const ubah = (n) => setMessages((prev) => {
      if (prev[idx]?.traceId !== pesan.traceId) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], umpanBalik: n };
      return next;
    });
    setGalatUmpanBalik(null);
    ubah(nilai);
    const h = await simpanUmpanBalik(supabase, { traceId: pesan.traceId, nilai, workspace: workspaceManager?.activeWorkspaceId || null });
    if (!h.ok) {
      ubah(sebelum);
      setGalatUmpanBalik({ idx, alasan: h.alasan });
    }
  };

  const handleCopy = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.warn('[ConversationEngine] Gagal menyalin:', err);
    }
  };

  useEffect(() => {
    const eventBus = kernel.serviceManager?.get('EventBus');
    if (!eventBus) return;

    const handler = (wrappedPayload) => {
      if (!instansiEngineerRef.current) return;
      const rec = wrappedPayload?.data || wrappedPayload;
      if (rec.type === 'PATCH_REJECTED') {
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastIndex = newMsgs.length - 1;
          if (lastIndex >= 0 && newMsgs[lastIndex].content.includes('Engineer sedang menyiapkan patch')) {
            newMsgs[lastIndex] = { role: 'model', content: `❌ **Patch Ditolak**\n\n${rec.message}` };
            return newMsgs;
          }
          return [...prev, { role: 'model', content: `❌ **Patch Ditolak**\n\n${rec.message}` }];
        });
      } else if (['PATCH_VERIFICATION_FAILED', 'ERROR', 'PATCH_FAILED', 'SAFETY_REJECTION', 'CORE_MODIFICATION_BLOCKED'].includes(rec.type)) {
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastIndex = newMsgs.length - 1;
          if (lastIndex >= 0 && newMsgs[lastIndex].content.includes('Engineer sedang menyiapkan patch')) {
            newMsgs[lastIndex] = { role: 'model', content: `⚠️ **Patch Gagal**\n\n${rec.message || 'Terjadi kesalahan saat menerapkan patch.'}` };
            return newMsgs;
          }
          return [...prev, { role: 'model', content: `⚠️ **Patch Gagal**\n\n${rec.message || 'Terjadi kesalahan.'}` }];
        });
      } else if (rec.type === 'CAPABILITY_BLOCKED') {
        setMessages(prev => [...prev, { role: 'model', content: rec.message, isReasoningBlock: false }]);
      } else if (rec.type === 'REASONING_REJECTED') {
        setMessages(prev => [...prev, { role: 'model', content: rec.message, isReasoningBlock: false }]);
      } else if (rec.type === 'ASK_CLARIFICATION') {
        setMessages(prev => [...prev, { role: 'model', content: rec.message, isReasoningBlock: false }]);
      }
    };

    const unsubscribe = eventBus.on('Engineer:Recommendation', handler);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const eventBus = kernel.serviceManager?.get('EventBus');
    if (!eventBus) return;
    const patchAppliedHandler = (result) => {
      if (!instansiEngineerRef.current) return;
      const data = result?.data || result;
      if (data?.checkpointRef) {
        setLastCheckpoint({ ref: data.checkpointRef, patchId: data.patchId, appliedAt: new Date().toLocaleTimeString('id-ID') });
        setRollbackState('idle');
      }
      const dipulihkan = !!data?.verifikasi?.dipulihkan;
      const files = data?.files?.filter(f => f.status === (dipulihkan ? 'DIPULIHKAN' : 'APPLIED')).map(f => f.path) || [];
      const successMsg = dipulihkan
        ? `↩️ **Patch dibatalkan sendiri** — ${files.length} berkas sempat diubah lalu dikembalikan karena berkas uji gagal.${files.length > 0 ? '\n\n📁 ' + files.join('\n📁 ') : ''}`
        : data?.successCount > 0
          ? `✅ **Patch Berhasil!** ${data.successCount} file diubah${data.skippedCount > 0 ? `, ${data.skippedCount} dilewati` : ''}.${files.length > 0 ? '\n\n📁 ' + files.join('\n📁 ') : ''}${data.checkpointRef ? '\n\n💾 Checkpoint dibuat — Anda bisa rollback.' : ''}`
          : `⚠️ Patch selesai tapi ${data?.failCount || 0} file gagal.`;
      const isi = data?.verifikasi?.laporan ? `${successMsg}\n\n---\n\n${data.verifikasi.laporan}` : successMsg;
      setMessages(prev => [...prev, { role: 'model', content: isi, isPatchResult: true, checkpointRef: data?.checkpointRef || null }]);
    };
    const unsubPatch = eventBus.on('Engineer:PatchApplied', patchAppliedHandler);
    return unsubPatch;
  }, []);

  const [konteksInfo, setKonteksInfo] = useState(null);
  const [versiKonteks, setVersiKonteks] = useState(0);
  useEffect(() => {
    let batal = false;
    (async () => {
      const assistantService = getAssistantService();
      if (!assistantService || !messages.length) { setKonteksInfo(null); return; }
      const brain = kernel.serviceManager?.get('BrainService');
      const model = brain?.getBrainConfig?.()?.model || null;
      const bahan = await assistantService.bahanAnggaranKonteks?.(model).catch(() => ({}));
      if (batal) return;
      const ang = anggaranKonteks(bahan || {});
      const pilih = pilihPesanKonteks(messages, { anggaranToken: ang.token, mulaiDari: bacaMulaiDari(currentChatId) });
      setKonteksInfo({
        ...meteranKonteks({
          ...pilih,
          anggaranToken: ang.token,
          biayaPerkiraanUsd: ang.biayaPerkiraanUsd,
          sisaHarianUsd: ang.sisaHarianUsd,
          alasan: ang.alasan,
          batasModel: ang.batasModel,
          dibatasiJendelaModel: ang.dibatasiJendelaModel,
        }),
        dilewati: pilih.dilewati,
      });
    })();
    return () => { batal = true; };
  }, [messages, currentChatId, versiKonteks]);

  const bersihkanKonteks = () => {
    simpanMulaiDari(currentChatId, messages.length);
    setVersiKonteks((v) => v + 1);
    setMessages((prev) => [...prev, {
      role: 'model',
      isPatchResult: true,
      content: `🧹 **Konteks dibersihkan.** ${messages.length} pesan di atas tetap ada di layar dan tetap tersimpan — hanya berhenti dikirim ke model. Pesan berikutnya memulai jendela konteks baru untuk percakapan ini.`,
    }]);
  };

  const pulihkanKonteks = () => {
    simpanMulaiDari(currentChatId, 0);
    setVersiKonteks((v) => v + 1);
  };

  const [sedangMemadatkan, setSedangMemadatkan] = useKeadaanTersimpan(kunciSesi, 'sedangMemadatkan', false);
  const [panelKonteks, setPanelKonteks] = useState(false);
  const panelKonteksRef = useRef(null);
  const bisaPadatkan = bolehPadatkan(messages, bacaMulaiDari(currentChatId));
  useEffect(() => {
    if (!panelKonteks) return;
    const klikDiLuar = (e) => {
      if (panelKonteksRef.current && !panelKonteksRef.current.contains(e.target)) setPanelKonteks(false);
    };
    document.addEventListener('mousedown', klikDiLuar);
    return () => document.removeEventListener('mousedown', klikDiLuar);
  }, [panelKonteks]);

  const padatkanKonteks = async () => {
    if (sedangMemadatkan) return;
    const mulaiDari = bacaMulaiDari(currentChatId);
    const bahan = pesanUntukDipadatkan(messages, mulaiDari);
    if (!bolehPadatkan(messages, mulaiDari)) return;

    const assistantService = getAssistantService();
    if (!assistantService?.padatkanKonteks) {
      setMessages((prev) => [...prev, { role: 'model', isPatchResult: true, content: '⚠️ **Tidak bisa memadatkan** — layanan belum siap. Coba lagi sebentar lagi.' }]);
      return;
    }

    setSedangMemadatkan(true);
    try {
      const brain = kernel.serviceManager?.get('BrainService');
      const model = brain?.getBrainConfig?.()?.model || null;
      const { ringkasan, jumlahPesan } = await assistantService.padatkanKonteks(bahan, model);

      const tokenSebelum = bahan.reduce((t, p) => t + tokenPesan(p), 0);
      const pesanRingkas = bentukPesanRingkasan(ringkasan, {
        jumlahPesan: jumlahPesan || bahan.length,
        tokenSebelum,
        tokenSesudah: tokenPesan({ content: ringkasan }),
      });
      simpanMulaiDari(currentChatId, messages.length);
      setMessages((prev) => [...prev, pesanRingkas]);
      setVersiKonteks((v) => v + 1);
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'model',
        isPatchResult: true,
        content: `⚠️ **Gagal memadatkan konteks:** ${e.message}\n\nKonteks tidak diubah — percakapan ini tetap utuh seperti sebelumnya.`,
      }]);
    } finally {
      setSedangMemadatkan(false);
    }
  };

  const klaimDiprosesRef = useRefTersimpan(kunciSesi, 'klaimDiproses', () => new Set());
  useEffect(() => {
    if (workspaceManager?.activeWorkspaceId !== 'ws-engineer') return;
    const i = messages.length - 1;
    const pesan = messages[i];
    if (!pesan || pesan.role !== 'model' || pesan.isUjiKlaim) return;
    if (klaimDiprosesRef.current.has(i) || !String(pesan.content || '').includes('<uji_klaim')) return;
    klaimDiprosesRef.current.add(i);

    (async () => {
      const { blok, galat } = ambilBlokKlaim(pesan.content);
      if (!blok.length && !galat.length) return;
      const akar = await (window.electronAPI?.engineer?.akarRepo?.() ?? Promise.resolve(null));
      const jalan = [];
      for (const b of blok) {
        const hasil = window.electronAPI?.engineer?.ujiKlaim
          ? await window.electronAPI.engineer.ujiKlaim({ berkas: b.berkas, fungsi: b.fungsi, kasus: b.kasus, skrip: susunSkripUji(b, akar || '.') })
          : { galat: 'uji klaim hanya tersedia di aplikasi desktop' };
        jalan.push({ blok: b, hasil });
      }
      const laporan = susunLaporanKlaim(jalan, galat);
      if (laporan) setMessages((prev) => [...prev, { role: 'model', content: laporan, isUjiKlaim: true }]);
    })().catch((e) => console.error('[UjiKlaim] gagal:', e));
  }, [messages, workspaceManager?.activeWorkspaceId]);

  const [temuanTersimpan, setTemuanTersimpan] = useState([]);
  const temuanDiprosesRef = useRefTersimpan(kunciSesi, 'temuanDiproses', () => new Set());

  const [keutuhanTemuanRef, setKeutuhanTemuan] = useState(null);

  const bacaCatatanTemuan = async () => {
    const isi = await (window.electronAPI?.readFile?.(ALAMAT_TEMUAN) ?? Promise.resolve(null));
    setKeutuhanTemuan(isi ? keutuhanTemuan(isi) : null);
    return bacaBerkasTemuan(isi);
  };

  useEffect(() => {
    if (workspaceManager?.activeWorkspaceId !== 'ws-engineer') return;
    bacaCatatanTemuan().then(setTemuanTersimpan).catch(() => setTemuanTersimpan([]));
  }, [workspaceManager?.activeWorkspaceId]);

  useEffect(() => {
    if (workspaceManager?.activeWorkspaceId !== 'ws-engineer') return;
    const i = messages.length - 1;
    const pesan = messages[i];
    if (!pesan || pesan.role !== 'model' || pesan.isTemuan) return;
    if (temuanDiprosesRef.current.has(i) || !String(pesan.content || '').includes('<temuan')) return;
    temuanDiprosesRef.current.add(i);

    (async () => {
      const { temuan, galat } = ambilBlokTemuan(pesan.content);
      if (!temuan.length && !galat.length) return;
      const tersimpan = await bacaCatatanTemuan();
      const { baru, kembar, pernahDitutup } = gabungTemuan([...tersimpan, ...temuanBelumSimpan], temuan);
      setTemuanTersimpan(tersimpan);
      const laporan = laporanTemuan({ baru, kembar, pernahDitutup, galat });
      if (laporan) setMessages((prev) => [...prev, { role: 'model', content: laporan, isTemuan: true }]);
    })().catch((e) => console.error('[Temuan] gagal:', e));
  }, [messages, workspaceManager?.activeWorkspaceId]);

  const temuanBelumSimpan = useMemo(() => {
    if (!isEngineerWorkspace) return [];
    const semua = [];
    for (const p of messages) {
      if (p?.role !== 'model' || p.isTemuan) continue;
      const isi = String(p.content || '');
      if (!isi.includes('<temuan')) continue;
      semua.push(...ambilBlokTemuan(isi).temuan);
    }
    if (!semua.length) return [];
    const baru = gabungTemuan(temuanTersimpan, semua).baru;
    console.log(`[Temuan] blok terbaca: ${semua.length} · sudah tersimpan: ${temuanTersimpan.length} · belum tersimpan: ${baru.length}`);
    return baru;
  }, [messages, temuanTersimpan, isEngineerWorkspace]);

  const pengetahuanBelumSimpan = useMemo(() => {
    if (!isEngineerWorkspace) return [];
    const semua = [];
    for (const p of messages) {
      if (p?.role !== 'model' || p.isPengetahuan) continue;
      const isi = String(p.content || '');
      if (!isi.includes('<pengetahuan')) continue;
      const { pengetahuan, dilewati } = ambilBlokPengetahuan(isi);
      semua.push(...pengetahuan);
      for (const d of dilewati) console.warn(`[Brain1] blok dilewati — ${d.alasan}: ${d.potongan}`);
    }
    if (!semua.length) return [];
    const baru = pengetahuanBaru([], semua);
    console.log(`[Brain1] blok terbaca: ${semua.length} · siap disimpan: ${baru.length}`);
    return baru;
  }, [messages, isEngineerWorkspace]);

  const simpanPengetahuan = async () => {
    if (!pengetahuanBelumSimpan.length) return;
    try {
      const { data: sesi } = await supabase.auth.getSession();
      const uid = sesi?.session?.user?.id;
      if (!uid) throw new Error('belum masuk akun — Brain 1 menyimpan per pengguna');

      const { data: adaData, error: galatBaca } = await supabase
        .from('project_memory_entries').select('title').eq('user_id', uid);
      if (galatBaca) throw new Error(`gagal membaca Brain 1: ${galatBaca.message}`);

      const baru = pengetahuanBaru((adaData || []).map((r) => r.title), pengetahuanBelumSimpan);
      if (!baru.length) {
        setMessages((prev) => [...prev, {
          role: 'model', isPengetahuan: true,
          content: 'ℹ️ **Tidak ada yang disimpan** — semua judulnya sudah ada di Brain 1.',
        }]);
        return;
      }

      const { error } = await supabase.from('project_memory_entries').insert(baru.map((p) => barisBrain1(p, uid)));
      if (error) throw new Error(error.message);

      setMessages((prev) => [...prev, {
        role: 'model',
        isPengetahuan: true,
        content: `🧠 **${baru.length} pengetahuan disimpan** ke Brain 1 (\`project_memory_entries\`).\n\n${baru.map((p) => `- **[${p.jenis}]** ${p.judul}`).join('\n')}\n\n_Engineer membacanya pada percakapan berikutnya. Tercatat sebagai \`Hypothesis\` sampai terbukti — statusnya bisa Anda naikkan sendiri di database._`,
      }]);
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'model',
        isPengetahuan: true,
        content: `⚠️ **Gagal menyimpan pengetahuan:** ${e.message}\n\nBloknya masih ada di layar ini dan bisa dicoba lagi — tidak ada yang hilang.`,
      }]);
    }
  };

  const simpanTemuan = async () => {
    if (!temuanBelumSimpan.length) return;
    try {
      const tersimpan = await bacaCatatanTemuan();
      const { daftar, baru } = gabungTemuan(tersimpan, temuanBelumSimpan);
      const ok = await window.electronAPI?.writeFile?.(ALAMAT_TEMUAN, susunBerkasTemuan(daftar));
      if (!ok) throw new Error('penulisan berkas ditolak sistem berkas');
      setTemuanTersimpan(daftar);
      setMessages((prev) => [...prev, {
        role: 'model',
        isTemuan: true,
        content: `💾 **${baru.length} temuan disimpan** ke \`${ALAMAT_TEMUAN}\` (${daftar.filter((t) => t.status !== 'DITUTUP').length} terbuka seluruhnya).\n\nBerkasnya ikut di repo — silakan sunting, gabungkan, atau tutup temuan dengan tangan. Temuan berstatus \`DITUTUP\` tidak akan diangkat lagi oleh Engineer.`,
      }]);
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'model',
        isTemuan: true,
        content: `⚠️ **Gagal menyimpan temuan:** ${e.message}\n\nTemuannya masih tersimpan di layar ini dan bisa dicoba lagi — tidak ada yang hilang.`,
      }]);
    }
  };

  const iniInstansiEngineer = osState?.workspaceId === 'ws-engineer';
  const [laporanPatchTertunda, setLaporanPatchTertunda] = useState(null);

  useEffect(() => {
    const storageManager = kernel.serviceManager?.get('StorageManager');
    if (!storageManager || !iniInstansiEngineer || !initialRestoreDone) return;
    laporanSetelahMuatUlang((p) => storageManager.read(p), undefined, undefined, false).then((lap) => {
      if (!lap) return;
      if (lap.checkpointRef) setLastCheckpoint({ ref: lap.checkpointRef, patchId: lap.patchId, appliedAt: new Date().toLocaleTimeString('id-ID') });
      setLaporanPatchTertunda(lap);
    }).catch(() => {});
  }, [iniInstansiEngineer, initialRestoreDone]);

  useEffect(() => {
    if (!laporanPatchTertunda) return;
    const sudahAda = messages.some((m) => m.isPatchResult && m.patchId === laporanPatchTertunda.patchId);
    if (sudahAda) {
      hapusCatatanPatch();
      return;
    }
    setMessages((prev) => prev.some((m) => m.isPatchResult && m.patchId === laporanPatchTertunda.patchId)
      ? prev
      : [...prev, {
        role: 'model',
        content: laporanPatchTertunda.pesan,
        isPatchResult: true,
        patchId: laporanPatchTertunda.patchId,
        checkpointRef: laporanPatchTertunda.checkpointRef,
      }]);
  }, [laporanPatchTertunda, messages]);

  useEffect(() => {
    const eventBus = kernel.serviceManager?.get('EventBus');
    if (!eventBus) return;
    const persistedHandler = (wrappedPayload) => {
      if (!instansiEngineerRef.current) return;
      const data = wrappedPayload?.data || wrappedPayload;
      setMessages(prev => [...prev, { role: 'model', content: data.message || `📋 Ada patch pending dari sesi sebelumnya (ID: ${data.patchId}).`, isPatchPersisted: true, patchId: data.patchId }]);
    };
    const unsubPersisted = eventBus.on('Engineer:PatchPersisted', persistedHandler);
    return unsubPersisted;
  }, []);


  useEffect(() => {
    const eventBus = kernel.serviceManager?.get('EventBus');
    if (!eventBus) return;
    const reasoningReportHandler = (wrappedPayload) => {
      if (!instansiEngineerRef.current) return;
      const report = wrappedPayload?.data || wrappedPayload;
      const findingsText = report.findings?.length > 0 ? '\n\n📋 **Temuan Analisis:**\n' + report.findings.join('\n') : '';
      const violationsCount = report.compliance?.violations?.length || 0;
      const warningsCount = report.compliance?.warnings?.length || 0;
      const complianceText = (violationsCount > 0 || warningsCount > 0) ? `\n\n🛡️ **MAEF Compliance:** ${violationsCount} pelanggaran, ${warningsCount} peringatan` : '';
      const confLevel = report.confidence?.level || 'UNKNOWN';
      const confEmoji = confLevel === 'HIGH' ? '🟢' : confLevel === 'MEDIUM' ? '🟡' : '🔴';
      const confidenceText = `\n\n${confEmoji} **Confidence:** ${confLevel} (coverage: ${report.confidence?.coverage || 0}%, evidence: ${report.confidence?.evidence || 0}/100)`;
      const filesText = report.filesAnalyzed?.length > 0 ? `\n\n📁 **File Dianalisis:** ${report.filesAnalyzed.join(', ')}` : '';
      const modelText = `\n\n🤖 **Model:** ${report.modelName || 'unknown'}`;
      const recText = report.recommendation ? `\n\n💡 **Rekomendasi:** ${report.recommendation}` : '';
      const adrText = report.adrReferenced && report.adrReferenced !== 'None' ? `\n\n📐 **ADR Dirujuk:** ${report.adrReferenced}` : '';
      const fullMessage = `🧠 **Engineer Reasoning Report**${findingsText}${complianceText}${confidenceText}${filesText}${modelText}${recText}${adrText}\n\n⏳ _Menunggu konfirmasi Anda untuk melanjutkan ke pembuatan patch..._`;
      setMessages(prev => [...prev, { role: 'model', content: fullMessage, isReasoningBlock: true, reasoningReport: report }]);
    };
    const unsubscribeReasoning = eventBus.on('Engineer:ReasoningReport', reasoningReportHandler);
    return unsubscribeReasoning;
  }, []);

  useEffect(() => {
    const eventBus = kernel.serviceManager?.get('EventBus');
    if (!eventBus) return;
    const confirmationHandler = (wrappedPayload) => {
      if (!instansiEngineerRef.current) return;
      const request = wrappedPayload?.data || wrappedPayload;
      setMessages(prev => [...prev, {
        role: 'model',
        content: `🔔 **Konfirmasi Diperlukan**\n\nRingkasan: ${request.summary || 'Analisis selesai.'}\n\nApakah Anda ingin melanjutkan ke pembuatan patch?`,
        isConfirmationRequest: true,
        confirmationId: request.confirmationId,
        _reportForConfirmation: request
      }]);
    };
    const unsubscribeConfirm = eventBus.on('Engineer:RequestConfirmation', confirmationHandler);
    return unsubscribeConfirm;
  }, []);

  useEffect(() => {
    const eventBus = kernel.serviceManager?.get('EventBus');
    if (!eventBus) return;
    const memoryRetrievedHandler = (payload) => {
      const inner = payload?.data || payload;
      const result = inner?.result;
      setLastMemoryQuery(inner?.query || '');
      setActiveMemories(Array.isArray(result) ? result : []);
      setIsMemoryLoading(false);
    };
    const unsubscribeMemory = eventBus.on('Memory:Retrieved', memoryRetrievedHandler);
    return unsubscribeMemory;
  }, []);

  useEffect(() => {
    const eventBus = kernel.serviceManager?.get('EventBus');
    if (!eventBus) return;
    const memoryIds = (activeMemories || []).map(m => m.id).filter(Boolean);
    if (memoryIds.length > 0) {
      console.log(`[LiveThought] emit Brain:ActiveThoughts — ${memoryIds.length} memori aktif`, memoryIds);
    }
    eventBus.emit('Brain:ActiveThoughts', {
      memoryIds,
      timestamp: Date.now()
    });
  }, [activeMemories]);

  useEffect(() => {
    const eventBus = kernel.serviceManager?.get('EventBus');
    if (!eventBus) return;

    const requestHandler = (wrappedPayload) => {
      const payload = wrappedPayload?.data || wrappedPayload;
      if (payload?.requestId) {
        console.log('[ConversationEngine] 📥 Received WebConfirmation request:', payload.requestId, payload.query);
        setWebConfirmation(payload);
      }
    };

    const clearHandler = (wrappedPayload) => {
      const payload = wrappedPayload?.data || wrappedPayload;
      const targetId = payload?.requestId;
      setWebConfirmation(prev => {
        if (!prev) return null;
        const currentId = prev.requestId || prev.data?.requestId;
        if (!targetId || currentId === targetId) {
          return null;
        }
        return prev;
      });
    };

    const unsubReq = eventBus.on('Retrieval:RequestWebConfirmation', requestHandler);
    const unsubApp = eventBus.on('Retrieval:WebConfirmationApproved', clearHandler);
    const unsubRej = eventBus.on('Retrieval:WebConfirmationRejected', clearHandler);
    const unsubTimeout = eventBus.on('Retrieval:WebConfirmationTimeout', clearHandler);

    return () => {
      unsubReq?.();
      unsubApp?.();
      unsubRej?.();
      unsubTimeout?.();
    };
  }, []);

  const handleResolveWebConfirmation = useCallback((requestId, isApproved) => {
    const targetId = requestId || webConfirmation?.requestId || webConfirmation?.data?.requestId;
    console.log('[ConversationEngine] 📤 Resolving WebConfirmation:', { targetId, isApproved });
    if (!targetId) {
      console.warn('[ConversationEngine] handleResolveWebConfirmation dipanggil tanpa requestId yang valid:', { requestId, webConfirmation });
      return;
    }
    const webService = getWebComparisonService();
    if (webService && typeof webService.resolveConfirmation === 'function') {
      webService.resolveConfirmation(targetId, isApproved);
    }
    setWebConfirmation(null);
  }, [webConfirmation]);

  useEffect(() => {
    const eventBus = kernel.serviceManager?.get('EventBus');
    if (!eventBus) return;
    const openConflictsHandler = () => {
      setIsMemoryPanelOpen(true);
    };
    const unsub = eventBus.on('Memory:OpenConflicts', openConflictsHandler);
    return () => unsub?.();
  }, []);

  const handleRefreshMemory = useCallback(async () => {
    if (!lastMemoryQuery) return;
    setIsMemoryLoading(true);
    try {
      const assistantService = getAssistantService();
      if (assistantService) {
        const memories = await assistantService.refreshMemory(lastMemoryQuery);
        setActiveMemories(memories);
      }
    } catch (err) {
      console.warn('[ConversationEngine] Refresh memori gagal:', err);
    } finally {
      setIsMemoryLoading(false);
    }
  }, [lastMemoryQuery]);

  const hentikanKirim = () => {
    if (!kendaliKirimRef.current) return;
    kendaliKirimRef.current.abort();
    kendaliKirimRef.current = null;
    setIsLoading(false);
    setMessages((prev) => [...prev, {
      role: 'model',
      isPatchResult: true,
      content: '⏹️ **Dihentikan.** Jawaban yang sedang disusun tidak jadi ditampilkan.\n\n_Permintaan yang sudah sampai ke server tetap diselesaikan di sana dan tetap terhitung biayanya — yang berhenti adalah menunggunya._',
    }]);
  };

  const handleSend = async (e, autoOverrideMsg = null) => {
    if (e) e.preventDefault();
    const userMsg = autoOverrideMsg || input.trim();
    if (!userMsg || isLoading) return;

    if (!autoOverrideMsg) setInput('');
    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    kendaliKirimRef.current?.abort();
    const kendali = new AbortController();
    kendaliKirimRef.current = kendali;

    const penanda = buatPenandaKiriman({ seq: percakapanSeqRef.current, chatId: currentChatId, pesan: newMessages });
    const diLayar = () => tujuanTulis(penanda, percakapanSeqRef.current) === 'layar';

    const simpanTerlantar = async (jawaban) => {
      try {
        if (!layakSimpanTerlantar(penanda, jawaban)) return;
        const svc = getAssistantService();
        const wsId = osStateRef.current?.workspaceId;
        if (!svc || !wsId) return;
        const { data: { session: sesi } } = await supabase.auth.getSession();
        if (!sesi?.user?.id) return;
        await svc.saveChatToDB({
          messages: pesanTerlantar(penanda, jawaban),
          chatId: penanda.chatId,
          userId: sesi.user.id,
          workspaceId: wsId,
          onNewChatId: () => {}
        });
        console.warn('[ConversationEngine] Owner berpindah percakapan saat menunggu — jawaban disimpan ke percakapan asalnya.');
      } catch (err) {
        console.error('[ConversationEngine] Gagal menyimpan jawaban terlantar:', err);
      }
    };

    const assistantService = getAssistantService();
    if (!assistantService) {
      setMessages(prev => [...prev, { role: 'model', content: '⚠️ AssistantService belum siap. Coba lagi dalam beberapa saat.' }]);
      setIsLoading(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
    const userId = session?.user?.id || null;

    let streamingStarted = false;
    const waktuKirim = Date.now();
    const lamaBerpikirDari = (teks, lama) => lama ?? (/<\/think>/i.test(teks) ? Math.max(1, Math.round((Date.now() - waktuKirim) / 1000)) : undefined);
    let mulaiNalar = null;

    if (workspaceManager && osState) {
      workspaceManager.osState = osState;
    }

    const ringkasanTemuan = isEngineerWorkspace
      ? ringkasanUntukKonteks([...temuanTersimpan, ...temuanBelumSimpan], 20, keutuhanTemuanRef)
      : '';

    const akarRepoSekarang = isEngineerWorkspace
      ? await (window.electronAPI?.engineer?.akarRepo?.() ?? Promise.resolve('')).catch(() => '')
      : '';
    const catatanAkar = catatanAkarRepo(akarRepoSekarang);

    const peta = akarRepoSekarang
      ? await (window.electronAPI?.engineer?.petaRepo?.() ?? Promise.resolve('')).catch(() => '')
      : '';
    const catatanPeta = catatanPetaRepo(peta);

    const daftarKonstitusi = akarRepoSekarang
      ? await (window.electronAPI?.engineer?.indeksKonstitusi?.() ?? Promise.resolve([])).catch(() => [])
      : [];
    const catatanKons = catatanKonstitusi(daftarKonstitusi);

    const sisipan = [catatanAkar, catatanKons, catatanPeta, ringkasanTemuan].filter(Boolean).map((content) => ({ role: 'user', content, [PATOK]: true }));
    const historyKirim = sisipan.length ? [...sisipan, ...newMessages] : newMessages;

    {
      const jejak = jejakSisipan({
        engineer: isEngineerWorkspace,
        akarRepo: akarRepoSekarang,
        petaMentah: peta,
        catatanAkar, catatanPeta, ringkasanTemuan,
        mulaiDari: bacaMulaiDari(currentChatId),
        jumlahPesan: newMessages.length,
      });
      if (jejak) console.log(jejak);
    }

    try {
      await assistantService.processMessage({
        userMsg,
        signal: kendali.signal,
        history: historyKirim,
        workspaceId: isEngineerWorkspace ? 'ws-engineer' : (workspaceManager?.activeWorkspaceId || 'ws-assistant'),
        userId,
        token,
        attachedFile,
        modelTierOverride,
        chatId: currentChatId,
        workspaceManager,

        onNalar: (teksNalar, selesai) => {
          if (!diLayar()) return;
          if (mulaiNalar === null) mulaiNalar = Date.now();
          if (!streamingStarted) {
            streamingStarted = true;
            setMessages(prev => [...prev, { role: 'model', content: '', steps: [], isStreaming: true }]);
          }
          setMessages(prev => {
            const next = [...prev];
            const lama = next[next.length - 1] || {};
            const lamaBerpikir = selesai
              ? (lama.lamaBerpikir ?? Math.max(1, Math.round((Date.now() - mulaiNalar) / 1000)))
              : lama.lamaBerpikir;
            next[next.length - 1] = { ...lama, role: 'model', content: `<think>\n${teksNalar}${selesai ? '\n</think>\n\n' : ''}`, isStreaming: true, lamaBerpikir };
            return next;
          });
        },

        onChunk: (chunkText, allText, steps) => {
          if (!diLayar()) return;
          if (!streamingStarted) {
            streamingStarted = true;
            setMessages(prev => [...prev, { role: 'model', content: '', steps: [], isStreaming: true }]);
          }
          setMessages(prev => {
            const next = [...prev];
            const lamaBerpikir = lamaBerpikirDari(allText, next[next.length - 1]?.lamaBerpikir);
            next[next.length - 1] = { role: 'model', content: allText, steps: [...steps], isStreaming: true, lamaBerpikir };
            return next;
          });
        },

        onDone: (finalText, steps, jsonMetadata, extras = {}) => {
          const { hasPatch, patchOriginalTask, traceId } = extras;
          if (!diLayar()) {
            simpanTerlantar({ content: finalText, steps, metadata: jsonMetadata, hasPatchProposal: hasPatch || false, traceId });
            setIsLoading(false);
            return;
          }
          if (streamingStarted) {
            setMessages(prev => {
              const next = [...prev];
              next[next.length - 1] = {
                role: 'model',
                content: finalText,
                steps,
                isStreaming: false,
                lamaBerpikir: lamaBerpikirDari(finalText, next[next.length - 1]?.lamaBerpikir),
                hasPatchProposal: hasPatch || false,
                patchOriginalTask: hasPatch ? patchOriginalTask : undefined,
                metadata: jsonMetadata,
                traceId,
              };
              return next;
            });
          } else {
            setMessages(prev => [...prev, {
              role: 'model',
              content: finalText,
              steps,
              isStreaming: false,
              lamaRespons: Math.max(1, Math.round((Date.now() - waktuKirim) / 1000)),
              hasPatchProposal: hasPatch || false,
              patchOriginalTask: hasPatch ? patchOriginalTask : undefined,
              metadata: jsonMetadata,
              traceId,
            }]);
          }
          setIsLoading(false);
          const jejak = jejakUntukMonitor(steps, jsonMetadata);
          if (jejak && workspaceManager?.injectWidgetData) {
            workspaceManager.injectWidgetData('widget:maef-monitor', jejak);
          }
        },

        onError: (galat) => {
          const errorMsg = blokGalat(galat);
          if (!diLayar()) {
            simpanTerlantar({ content: errorMsg });
            setIsLoading(false);
            return;
          }
          if (streamingStarted) {
            setMessages(prev => {
              const next = [...prev];
              next[next.length - 1] = { role: 'model', content: errorMsg, isStreaming: false };
              return next;
            });
          } else {
            setMessages(prev => [...prev, { role: 'model', content: errorMsg }]);
          }
          setIsLoading(false);
        }
      });
    } catch (err) {
      if (kendali.signal.aborted) {
        console.log('[ConversationEngine] kiriman dihentikan Owner');
      } else {
        console.error('[ConversationEngine] handleSend error:', err);
        const pesanGalat = blokGalat(err);
        if (diLayar()) setMessages(prev => [...prev, { role: 'model', content: pesanGalat }]);
        else simpanTerlantar({ content: pesanGalat });
        setIsLoading(false);
      }
    } finally {
      if (kendaliKirimRef.current === kendali) kendaliKirimRef.current = null;
    }

    setAttachedFile(null);
  };

  const handleRunCommand = async (cmd, cmdKey) => {
    const assistantService = getAssistantService();
    if (!assistantService) {
      setEngineerCmdStates(prev => ({ ...prev, [cmdKey]: { status: 'error', output: 'Layanan Assistant belum siap — Kernel masih memuat. Tunggu beberapa detik lalu klik Jalankan lagi.' } }));
      return;
    }

    setEngineerCmdStates(prev => ({ ...prev, [cmdKey]: { status: 'running', output: '' } }));

    const { output, success, ditolakOwner, ditolakAturan, ditolakProsedur } =
      await assistantService.runCommand(cmd, riwayatPerintahDariPesan(messages));

    setEngineerCmdStates(prev => ({
      ...prev,
      [cmdKey]: { status: ditolakProsedur ? 'diulang' : ditolakAturan ? 'blocked' : ditolakOwner ? 'skipped' : success ? 'done' : 'error', output }
    }));

    if (ditolakAturan) return;


    setTimeout(() => handleSend(null, pesanKeluaranPerintah(cmd, output)), 300);
  };

  const chatOtomatisRef = useRef(null);
  useEffect(() => {
    if (!instansiEngineerRef.current || isLoading) return;

    const pesanAkhir = messages[messages.length - 1];
    const idx = messages.length - 1;

    if (chatOtomatisRef.current !== currentChatId) {
      chatOtomatisRef.current = currentChatId;
      if (typeof pesanAkhir?.content === 'string') {
        for (const m of pesanAkhir.content.matchAll(/\[MAMET_CMD:([^\]]+)\]/g)) {
          cmdOtomatisRef.current.add(`${idx}_${m[1].trim()}`);
        }
      }
      return;
    }

    if (!pesanAkhir || pesanAkhir.role !== 'model' || typeof pesanAkhir.content !== 'string') return;
    const daftar = [...pesanAkhir.content.matchAll(/\[MAMET_CMD:([^\]]+)\]/g)].map((m) => m[1].trim());
    if (!daftar.length) return;

    let batal = false;
    (async () => {
      const layanan = getAssistantService();
      if (!layanan) return;
      const hasil = [];
      for (const cmd of daftar) {
        const cmdKey = `${idx}_${cmd}`;
        if (cmdOtomatisRef.current.has(cmdKey)) continue;
        const aman = await (window.electronAPI?.engineer?.perintahAman?.(cmd) ?? Promise.resolve(false)).catch(() => false);
        if (batal) return;
        if (!aman) continue;

        cmdOtomatisRef.current.add(cmdKey);
        setEngineerCmdStates((prev) => ({ ...prev, [cmdKey]: { status: 'running', output: '' } }));
        const r = await layanan.runCommand(cmd, riwayatPerintahDariPesan(messages));
        if (batal) return;
        setEngineerCmdStates((prev) => ({
          ...prev,
          [cmdKey]: { status: (r.ditolakAturan || r.ditolakProsedur) ? 'blocked' : r.ditolakOwner ? 'skipped' : r.success ? 'done' : 'error', output: r.output },
        }));
        if (!r.ditolakAturan) hasil.push(pesanKeluaranPerintah(cmd, r.output));
      }
      if (!batal && hasil.length) handleSend(null, hasil.join('\n\n'));
    })();
    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, currentChatId, isLoading]);

  const handleRollback = async () => {
    setRollbackState('loading');
    try {
      const assistantService = getAssistantService();
      const result = assistantService?.rollback
        ? await assistantService.rollback(lastCheckpoint?.ref)
        : window.electronAPI?.gitRollback
          ? await window.electronAPI.gitRollback(lastCheckpoint?.ref)
          : { success: false, error: 'Undo hanya tersedia di aplikasi desktop.' };
      if (result?.cancelled) { setRollbackState('idle'); return; }
      if (result?.success) {
        setRollbackState('done');
        setLastCheckpoint(null);
        setMessages(prev => [...prev, { role: 'model', content: `↩️ **Rollback Berhasil!** Semua perubahan patch telah dikembalikan.\n\nOutput: ${result.output || 'selesai.'}` }]);
      } else {
        setRollbackState('error');
        setMessages(prev => [...prev, { role: 'model', content: `❌ **Undo gagal:** ${result?.error || 'sebab tidak diketahui'}\n\nIsi asli berkas masih tersimpan di checkpoint \`${lastCheckpoint?.ref || '(tidak diketahui)'}\` (folder \`eng-checkpoint\` di data aplikasi) — tidak ada yang hilang. Berkas yang berubah juga bisa dikembalikan dengan \`git checkout --\` pada berkas itu.` }]);
      }
    } catch (err) {
      setRollbackState('error');
    }
  };

  return (
    <div className="flex flex-1 min-w-0 min-h-0 h-full w-full font-body-base text-on-surface">

      <div className={`transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden'} shrink-0 z-[60] absolute left-0 top-0 h-full bg-background border-r border-outline-variant`}>
        <ChatHistory
          onSelectChat={handleLoadChat}
          onNewChat={handleNewChat}
          activeChatId={currentChatId}
          activeWorkspace={osState?.workspaceId}
          collapsed={false}
        />
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55]"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col relative min-w-0 min-h-0">

        <div className="relative z-50 flex flex-wrap items-center gap-2 px-6 pt-4 pb-2 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-10 h-10 flex items-center justify-center bg-surface-container-low border border-outline-variant rounded-xl hover:bg-surface-variant text-on-surface transition-all shadow-sm"
            title="Toggle Chat History"
          >
            <span className="material-symbols-outlined text-[20px]">{isSidebarOpen ? 'keyboard_double_arrow_left' : 'menu'}</span>
          </button>
          <MenuTambah onNewChat={handleNewChat} workspaceId={osState?.workspaceId} />

          {osState?.workspaceId && (
            <div className="relative" ref={toolsPanelRef}>
              <button
                onClick={() => setShowToolsPanel(v => !v)}
                title={`${toolsEnabledCount} tool aktif untuk workspace ini — klik untuk kelola`}
                className={`h-10 px-3 flex items-center gap-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm active:scale-95
                  ${showToolsPanel ? 'bg-primary/15 border-primary/50 text-primary' : 'bg-surface-container-low border-outline-variant text-on-surface-variant'}`}
              >
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                Tools
                <span className="text-[12px] opacity-70">{toolsEnabledCount}</span>
              </button>

              {showToolsPanel && (
                <div className="absolute left-0 top-12 z-50 w-64 rounded-xl border border-outline-variant bg-surface-container-low shadow-lg p-2">
                  <div className="px-2 py-1 text-[12px] font-bold text-on-surface-variant uppercase tracking-wide">
                    Tools untuk workspace ini
                  </div>
                  <button
                    onClick={() => {
                      const svc = kernel.serviceManager?.get('ToolPreferencesService');
                      if (!svc) return;
                      const current = svc.getEffective(osState.workspaceId, 'rag');
                      svc.setWorkspaceOverride(osState.workspaceId, 'rag', !current);
                      setToolTogglesVersion(v => v + 1);
                    }}
                    title="RAG (pengetahuan)"
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-variant text-left text-xs font-semibold text-on-surface transition-all"
                  >
                    <span className={`material-symbols-outlined text-[18px] ${ragEnabledHere ? 'text-primary' : 'text-on-surface-variant'}`}>
                      {ragEnabledHere ? 'toggle_on' : 'toggle_off'}
                    </span>
                    RAG (pengetahuan)
                  </button>
                  {registeredTools.map(tool => {
                    const enabled = getToolEnabled(tool.name);
                    return (
                      <button
                        key={tool.name}
                        onClick={() => {
                          const svc = kernel.serviceManager?.get('ToolPreferencesService');
                          if (!svc) return;
                          const current = svc.getEffective(osState.workspaceId, tool.name);
                          svc.setWorkspaceOverride(osState.workspaceId, tool.name, !current);
                          setToolTogglesVersion(v => v + 1);
                        }}
                        title={tool.description || tool.name}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-variant text-left text-xs font-semibold text-on-surface transition-all"
                      >
                        <span className={`material-symbols-outlined text-[18px] ${enabled ? 'text-primary' : 'text-on-surface-variant'}`}>
                          {enabled ? 'toggle_on' : 'toggle_off'}
                        </span>
                        {formatToolLabel(tool.name)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {konteksInfo && (
            <div className="relative" ref={panelKonteksRef}>
              <button
                onClick={() => setPanelKonteks((v) => !v)}
                title={`${konteksInfo.rincian}\n\nKlik untuk pilihan konteks.`}
                className={`h-10 px-3 flex items-center gap-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm active:scale-95
                  ${konteksInfo.warna === 'penuh' ? 'bg-error/15 border-error/50 text-error'
                    : konteksInfo.warna === 'hampir' ? 'bg-tertiary/15 border-tertiary/50 text-tertiary'
                    : 'bg-surface-container-low border-outline-variant text-on-surface-variant'}`}
              >
                <span className={`material-symbols-outlined text-[18px] ${sedangMemadatkan ? 'animate-spin' : ''}`}>
                  {sedangMemadatkan ? 'progress_activity' : konteksInfo.dilewati > 0 ? 'history' : 'token'}
                </span>
                {konteksInfo.teks}
              </button>

              {panelKonteks && (
                <div className="absolute left-0 top-12 z-50 w-80 rounded-xl border border-outline-variant bg-surface-container-low shadow-lg p-2">
                  <div className="px-2 py-1.5 text-[12px] text-on-surface-variant leading-relaxed">
                    {konteksInfo.rincian}
                  </div>

                  <button
                    onClick={() => { setPanelKonteks(false); padatkanKonteks(); }}
                    disabled={sedangMemadatkan || !bisaPadatkan}
                    className="w-full text-left px-2 py-2 rounded-lg hover:bg-surface-container-highest disabled:opacity-40 disabled:hover:bg-transparent flex items-start gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px] mt-0.5">compress</span>
                    <span>
                      <span className="block text-xs font-bold text-on-surface">Padatkan</span>
                      <span className="block text-[12px] text-on-surface-variant">
                        {bisaPadatkan
                          ? 'Ringkas pesan lama jadi satu pesan yang tetap dikirim — ingatan percakapan tidak hilang. Satu panggilan model berbayar.'
                          : `Perlu minimal ${MIN_PESAN_PADATKAN} pesan untuk dipadatkan.`}
                      </span>
                    </span>
                  </button>

                  <button
                    onClick={() => { setPanelKonteks(false); bersihkanKonteks(); }}
                    disabled={sedangMemadatkan}
                    className="w-full text-left px-2 py-2 rounded-lg hover:bg-surface-container-highest disabled:opacity-40 flex items-start gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px] mt-0.5">delete</span>
                    <span>
                      <span className="block text-xs font-bold text-on-surface">Bersihkan</span>
                      <span className="block text-[12px] text-on-surface-variant">
                        Berhenti mengirim pesan lama tanpa meringkasnya. Gratis, tapi ingatan percakapannya hilang.
                      </span>
                    </span>
                  </button>

                  {konteksInfo.dilewati > 0 && (
                    <button
                      onClick={() => { setPanelKonteks(false); pulihkanKonteks(); }}
                      disabled={sedangMemadatkan}
                      className="w-full text-left px-2 py-2 rounded-lg hover:bg-surface-container-highest disabled:opacity-40 flex items-start gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px] mt-0.5">history</span>
                      <span>
                        <span className="block text-xs font-bold text-on-surface">Pulihkan konteks penuh</span>
                        <span className="block text-[12px] text-on-surface-variant">
                          Kirim lagi seluruh {konteksInfo.dilewati} pesan lama, sebatas anggaran.
                        </span>
                      </span>
                    </button>
                  )}

                  <div className="px-2 pt-1.5 pb-0.5 text-[12px] text-on-surface-variant border-t border-outline-variant mt-1">
                    Tidak ada pilihan di sini yang menghapus pesan. Semuanya tetap terlihat dan tetap tersimpan.
                  </div>
                </div>
              )}
            </div>
          )}

          {isEngineerWorkspace && temuanBelumSimpan.length > 0 && (
            <button
              onClick={simpanTemuan}
              title={`Tulis ${temuanBelumSimpan.length} temuan baru ke ${ALAMAT_TEMUAN}.\n\n${temuanBelumSimpan.map((t) => `• ${t.berkas} — ${t.ringkasan}`).join('\n')}`}
              className="h-10 px-3 flex items-center gap-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm active:scale-95 bg-tertiary/15 border-tertiary/50 text-tertiary"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              Simpan {temuanBelumSimpan.length} temuan
            </button>
          )}

          {isEngineerWorkspace && pengetahuanBelumSimpan.length > 0 && (
            <button
              onClick={simpanPengetahuan}
              title={`Tulis ${pengetahuanBelumSimpan.length} pengetahuan baru ke Brain 1 (project_memory_entries).\n\n${pengetahuanBelumSimpan.map((p) => `• [${p.jenis}] ${p.judul}`).join('\n')}`}
              className="h-10 px-3 flex items-center gap-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm active:scale-95 bg-primary/15 border-primary/50 text-primary"
            >
              <span className="material-symbols-outlined text-[18px]">database</span>
              Simpan {pengetahuanBelumSimpan.length} pengetahuan
            </button>
          )}

          {osState?.workspaceId && !isEngineerWorkspace && workspaceManager?.activeWorkspaceId === 'ws-assistant' && (
            <RiwayatKonversi />
          )}

          {osState?.workspaceId && !isEngineerWorkspace && (
            <div className="relative" ref={tierPanelRef}>
              <button
                onClick={() => setShowTierPanel(v => !v)}
                title={modelTierOverride
                  ? `Model dikunci ke tingkat ${modelTierOverride} untuk sesi chat ini`
                  : 'Tingkat model dipilih otomatis tiap pesan — klik untuk mengunci'}
                className={`h-10 px-3 flex items-center gap-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm active:scale-95
                  ${modelTierOverride ? 'bg-primary/15 border-primary/50 text-primary' : 'bg-surface-container-low border-outline-variant text-on-surface-variant'}`}
              >
                <span className="material-symbols-outlined text-[18px]">layers</span>
                {modelTierOverride || 'Auto'}
              </button>

              {showTierPanel && (
                <div className="absolute left-0 top-12 z-50 w-60 rounded-xl border border-outline-variant bg-surface-container-low shadow-lg p-2">
                  <div className="px-2 py-1 text-[12px] font-bold text-on-surface-variant uppercase tracking-wide">
                    Tingkat model
                  </div>
                  {[
                    { id: null, label: 'Auto', hint: 'Dipilih otomatis tiap pesan' },
                    { id: 'KECIL', label: 'Kecil', hint: 'Paling ringan & murah' },
                    { id: 'SEDANG', label: 'Sedang', hint: 'Seimbang' },
                    { id: 'THINKING', label: 'Thinking', hint: 'Penalaran berat' }
                  ].map(option => {
                    const active = modelTierOverride === option.id;
                    return (
                      <button
                        key={option.label}
                        onClick={() => { setModelTierOverride(option.id); setShowTierPanel(false); }}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-variant text-left transition-all"
                      >
                        <span className={`material-symbols-outlined text-[18px] ${active ? 'text-primary' : 'text-transparent'}`}>check</span>
                        <span className="flex flex-col">
                          <span className={`text-xs font-semibold ${active ? 'text-primary' : 'text-on-surface'}`}>{option.label}</span>
                          <span className="text-[12px] text-on-surface-variant">{option.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                  <p className="px-2 pt-2 text-[12px] text-on-surface-variant leading-relaxed border-t border-outline-variant/50 mt-1">
                    Kuncian ini hanya berlaku selama sesi chat ini terbuka — pindah chat atau muat ulang akan kembali ke Auto.
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMemoryPanelOpen(!isMemoryPanelOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all shadow-sm cursor-pointer border ${
                isMemoryPanelOpen
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-surface-container-low/90 backdrop-blur-md border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'
              }`}
              title={isMemoryPanelOpen ? 'Minimize Memory Context' : 'Buka Memory Context'}
            >
              <span className="material-symbols-outlined text-[16px]">psychology</span>
              <span className="hidden sm:inline">Memory</span>
              {activeMemories.length > 0 && (
                <span className={`text-[12px] px-1.5 py-0.5 rounded-full font-bold ${
                  isMemoryPanelOpen ? 'bg-emerald-500/30 text-emerald-200' : 'bg-surface-variant text-on-surface-variant'
                }`}>
                  {activeMemories.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleToggleMaefMonitor}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all shadow-sm cursor-pointer border ${
                (osState?.layout?.right_workbench || []).includes('widget:maef-monitor')
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/25'
                  : 'bg-surface-container-low/90 backdrop-blur-md border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'
              }`}
              title="Toggle MAEF Monitor"
            >
              <span className="material-symbols-outlined text-[16px]">shield</span>
              <span className="hidden sm:inline">Monitor</span>
            </button>

            {(isMemoryPanelOpen || (osState?.layout?.right_workbench || []).length > 0) && (
              <button
                type="button"
                onClick={handleMinimizeSidePanels}
                className="p-1.5 rounded-xl bg-surface-container-low/90 backdrop-blur-md border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all shadow-sm cursor-pointer"
                title="Luaskan Kolom Chat (Minimize Semua Panel Samping)"
              >
                <span className="material-symbols-outlined text-[18px]">fullscreen</span>
              </button>
            )}
          </div>
        </div>

        {lastCheckpoint && (
          <div className="mx-3 mt-2 mb-0 flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-300 text-xs z-40 shrink-0">
            <span className="material-symbols-outlined text-[15px] text-amber-400 shrink-0">history</span>
            <div className="flex-1 min-w-0 truncate">
              <span className="font-bold">Checkpoint tersedia</span>
              <span className="text-amber-400/60 ml-1.5">{lastCheckpoint.appliedAt} — {lastCheckpoint.ref}</span>
            </div>
            {rollbackState === 'loading' ? (
              <span className="flex items-center gap-1 animate-pulse shrink-0">
                <span className="material-symbols-outlined text-[13px]">hourglass_empty</span>Mengembalikan...
              </span>
            ) : rollbackState === 'done' ? (
              <span className="text-emerald-400 shrink-0">✅ Selesai</span>
            ) : (
              <>
                <button
                  onClick={handleRollback}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-di-warna text-xs font-bold transition-all active:scale-95 shrink-0"
                >
                  <span className="material-symbols-outlined text-[13px]">undo</span>
                  Rollback
                </button>
                <button
                  onClick={() => setLastCheckpoint(null)}
                  className="p-0.5 rounded hover:bg-amber-900/40 text-amber-500/50 hover:text-amber-300 transition-colors shrink-0"
                  title="Tutup"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </>
            )}
          </div>
        )}

        <div className="flex-1 flex flex-col md:flex-row relative min-h-0 min-w-0">
          <div className="flex-1 flex flex-col relative overflow-hidden pt-4 min-h-0 min-w-0">

            <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 custom-scrollbar relative z-10">
              <div className="max-w-[68rem] mx-auto w-full space-y-3">

              {messages.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-20 pointer-events-none gap-1">
                  <span className="material-symbols-outlined text-[28px] text-primary">chat_bubble</span>
                  <div className="text-[12px] tracking-widest text-primary uppercase font-mono">Conversation Engine</div>
                </div>
              )}

              {messages.map((m, idx) => {
                const parsed = parseThinkingContent(m.content);
                const displayText = parsed.thinking ? parsed.answer : (parsed.answer || m.content || '');

                return (
                  <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`relative group ${m.role === 'user' ? 'max-w-[85%] lg:max-w-[75%]' : 'w-full'} ${m.role === 'user' ? 'rounded-2xl px-4 py-3 bg-primary-container/20 border border-primary/30 min-w-0 [overflow-wrap:anywhere]' : 'glass-panel rim-light p-4 md:p-gutter rounded-xl border border-outline-variant overflow-hidden min-w-0'}`}>
                      <div className="text-body-base leading-relaxed">
                        {m.role !== 'user' && langkahPenting(m.steps).length > 0 && (
                          <div className="mb-3 text-body-sm text-on-surface-variant leading-relaxed [overflow-wrap:anywhere]">
                            {langkahPenting(m.steps).map((baris, i) => <div key={i}>{baris}</div>)}
                          </div>
                        )}
                        {parsed.thinking && (
                          <details open className="mb-3 group/nalar">
                            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden inline-flex items-center gap-1.5 text-body-sm text-on-surface-variant hover:text-on-surface select-none transition-colors">
                              <span className={`material-symbols-outlined text-[16px] ${parsed.isThinkingComplete ? '' : 'animate-pulse text-primary'}`}>psychology</span>
                              <span>
                                {!parsed.isThinkingComplete
                                  ? 'Berpikir…'
                                  : m.lamaBerpikir ? `Berpikir selama ${m.lamaBerpikir} detik`
                                  : m.lamaRespons ? `Proses berpikir · respons ${m.lamaRespons} detik` : 'Proses berpikir'}
                              </span>
                              <span className="material-symbols-outlined text-[16px] transition-transform group-open/nalar:rotate-90">chevron_right</span>
                            </summary>
                            <div className="mt-2 ml-2 pl-3 border-l-2 border-outline-variant text-body-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                              {parsed.thinking}
                              {parsed.isThinkingComplete && (
                                <button
                                  onClick={() => openLifecycleInspector('AI_REASONING', parsed.thinking)}
                                  className="mt-2 block text-[12px] text-on-surface-variant/70 hover:text-primary underline underline-offset-2"
                                  title="Buka nalar di Right Workbench"
                                >
                                  Buka di Workbench
                                </button>
                              )}
                            </div>
                          </details>
                        )}

                        {(() => {
                          if (!displayText) return null;
                          const terminal = m.role === 'user' && riwayatPerintahDariPesan([{ content: displayText }])[0];
                          if (terminal) return <KotakKode isi={terminal.keluaran} label="terminal" perintah={terminal.perintah} tinggiMaks />;
                          const MARKER_RE = /(\[MAMET_CMD:[^\]]+\]|\[MAMET_CRITICAL:[^\]]*\]|\[OS EXECUTION REPORT\]|\[SYSTEM:[^\]]+\])/g;
                          const parts = displayText.split(MARKER_RE);
                          const isEngineer = (workspaceManager?.activeWorkspaceId === 'ws-engineer');

                          return parts.map((part, i) => {
                            if (isEngineer && part.startsWith('[MAMET_CMD:')) {
                              const cmd = part.replace('[MAMET_CMD:', '').replace(']', '').trim();
                              const cmdKey = `${idx}_${cmd}`;
                              const state = engineerCmdStates[cmdKey];
                              return (
                                <div key={i} className="my-2 flex items-center gap-2 flex-wrap">
                                  <code className="px-2 py-1 rounded bg-surface-container-high border border-outline-variant text-body-sm font-mono text-primary">{cmd}</code>
                                  {!state || state.status === 'pending' ? (
                                    <>
                                      <button onClick={() => handleRunCommand(cmd, cmdKey)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-di-warna text-xs font-bold transition-all shadow-sm active:scale-95">
                                        <span className="material-symbols-outlined text-[14px]">terminal</span>🖥️ Jalankan
                                      </button>
                                      <button onClick={() => setEngineerCmdStates(prev => ({ ...prev, [cmdKey]: { status: 'skipped', output: '' } }))} className="px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant text-xs hover:bg-surface-variant transition-all">Lewati</button>
                                    </>
                                  ) : state.status === 'running' ? (
                                    <span className="flex items-center gap-1.5 text-xs text-amber-400 animate-pulse"><span className="material-symbols-outlined text-[14px]">hourglass_empty</span>Menjalankan...</span>
                                  ) : state.status === 'done' ? (
                                    <details className="inline">
                                      <summary className="flex items-center gap-1.5 text-xs text-emerald-400 cursor-pointer"><span className="material-symbols-outlined text-[14px]">check_circle</span>Selesai — lihat output</summary>
                                      <pre className="mt-1 p-2 rounded bg-surface-container text-[12px] font-mono text-on-surface-variant overflow-x-auto max-h-40 custom-scrollbar">{state.output}</pre>
                                    </details>
                                  ) : state.status === 'skipped' ? (
                                    <span className="text-xs text-on-surface-variant italic">Dilewati</span>
                                  ) : state.status === 'blocked' ? (
                                    <span className="flex items-start gap-1.5 text-xs text-amber-300" title={state.output}>
                                      <span className="material-symbols-outlined text-[14px]">lock</span>
                                      <span>Tidak diizinkan untuk Engineer — {String(state.output || '').replace(/^TIDAK DIJALANKAN:\s*/, '')}. Jalankan sendiri di terminal bila perlu.</span>
                                    </span>
                                  ) : state.status === 'diulang' ? (
                                    <span className="flex items-start gap-1.5 text-xs text-on-surface-variant" title={state.output}>
                                      <span className="material-symbols-outlined text-[14px]">history</span>
                                      <span>Sudah dijalankan di percakapan ini — hasilnya ada di atas. Perintahnya boleh; mengulanginya tidak akan memberi hasil berbeda.</span>
                                    </span>
                                  ) : (
                                    <details className="inline">
                                      <summary className="flex items-center gap-1.5 text-xs text-red-400 cursor-pointer"><span className="material-symbols-outlined text-[14px]">error</span>Error — lihat detail</summary>
                                      <pre className="mt-1 p-2 rounded bg-red-900/20 text-[12px] font-mono text-red-300 overflow-x-auto max-h-40 custom-scrollbar">{state.output}</pre>
                                    </details>
                                  )}
                                </div>
                              );
                            }

                            if (isEngineer && part.startsWith('[MAMET_CRITICAL:')) {
                              const msg = part.replace('[MAMET_CRITICAL:', '').replace(/\]$/, '').trim();
                              return (
                                <div key={i} className="my-3 p-3 rounded-xl border border-red-500/50 bg-red-950/30 text-red-300">
                                  <div className="flex items-center gap-2 font-bold text-sm mb-1"><span className="material-symbols-outlined text-[18px] text-red-400">warning</span>⚠️ CRITICAL — Perlu Analisis User</div>
                                  <p className="text-sm whitespace-pre-wrap">{msg}</p>
                                  <p className="mt-2 text-xs text-red-400 italic">Ketik di chat untuk modifikasi plan atau berikan instruksi lanjutan.</p>
                                </div>
                              );
                            }

                            if (part === '[OS EXECUTION REPORT]') {
                              return (
                                <div key={i} className="my-2 block w-max items-center px-3 py-2 bg-primary/10 border border-primary/30 text-primary text-body-sm font-bold rounded-lg cursor-pointer hover:bg-primary/20 transition-colors shadow-sm"
                                  onClick={() => openLifecycleInspector('OS_EXECUTION', displayText)}>
                                  <span className="material-symbols-outlined inline-block mr-2 text-[16px] align-text-bottom">terminal</span>
                                  OS EXECUTION REPORT (Click to Inspect)
                                </div>
                              );
                            }

                            if (part.startsWith('[SYSTEM:')) {
                              const title = part.replace('[SYSTEM: ', '').replace(']', '');
                              return (
                                <div key={i} className="my-2 block w-max items-center px-3 py-2 bg-surface-container-high border border-outline-variant text-on-surface-variant text-body-sm font-bold rounded-lg cursor-pointer hover:bg-surface-variant transition-colors shadow-sm"
                                  onClick={() => openLifecycleInspector(title, displayText)}>
                                  <span className="material-symbols-outlined inline-block mr-2 text-[16px] align-text-bottom">settings_system_daydream</span>
                                  {title} (Inspect Context)
                                </div>
                              );
                            }

                            if (m.role !== 'user') return <TeksMarkdown key={i} teks={part} />;
                            return <span key={i} className="whitespace-pre-wrap">{part}</span>;
                          });
                        })()}

                        {m.isStreaming && parsed.isThinkingComplete && <span className="animate-pulse text-primary"> ▍</span>}
                      </div>

                      {(() => {
                        const tools = m.metadata?.toolsUsed || m.toolsUsed || [];
                        if (!Array.isArray(tools) || tools.length === 0) return null;
                        return (
                          <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] text-slate-500 font-mono uppercase tracking-wider mr-1">Tools:</span>
                            {tools.map((tool, tIdx) => (
                              <span
                                key={tIdx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-mono bg-white/5 text-slate-300 border border-white/10"
                              >
                                <span className="material-symbols-outlined text-[12px] text-primary">build</span>
                                {String(tool).replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        );
                      })()}

                      {(() => {
                        const execution = m.metadata?.toolExecution;
                        const hasil = execution?.name === 'word_to_pdf' ? execution.result : null;

                        const remote = execution?.name === 'word_to_pdf' ? execution.remote : null;
                        if (remote?.outputPath) {
                          const unduh = async () => {
                            try {
                              const { url, namaPdf } = await tautanUnduh(remote.outputPath, remote.sourceName, remote.jobId);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = namaPdf;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                            } catch (err) {
                              setMessages(prev => [...prev, { role: 'model', content: blokGalat({ kode: 'UNDUH_PDF', teknis: err.message }) }]);
                            }
                          };
                          return (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button type="button" onClick={unduh} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-fixed text-on-primary text-xs font-semibold transition-colors cursor-pointer">
                                <span className="material-symbols-outlined text-[16px]">download</span>Unduh PDF
                              </button>
                            </div>
                          );
                        }

                        if (!hasil?.ok || !hasil.output || !window.electronAPI?.openConvertedPdf) return null;
                        const buka = async (mode) => {
                          let res;
                          try {
                            res = await window.electronAPI.openConvertedPdf(hasil.output, mode);
                          } catch (err) {
                            const basi = /No handler registered/i.test(err?.message || '');
                            res = {
                              ok: false,
                              error: basi
                                ? 'Tombol ini butuh aplikasi dibuka ulang sepenuhnya (tutup lalu jalankan lagi `npm run desktop`) — memuat ulang jendela saja tidak cukup.'
                                : (err?.message || 'PDF tidak bisa dibuka.')
                            };
                          }
                          if (!res?.ok) {
                            setMessages(prev => [...prev, { role: 'model', content: `⚠️ ${res?.error || 'PDF tidak bisa dibuka.'}` }]);
                          }
                        };
                        return (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => buka('open')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-fixed text-on-primary text-xs font-semibold transition-colors cursor-pointer">
                              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>Buka PDF
                            </button>
                            <button type="button" onClick={() => buka('folder')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface-variant text-xs font-semibold border border-outline-variant transition-colors cursor-pointer">
                              <span className="material-symbols-outlined text-[16px]">folder_open</span>Tampilkan di folder
                            </button>
                          </div>
                        );
                      })()}

                      {(() => {
                        const sources = m.metadata?.groundingSources || m.groundingSources || [];
                        if (!Array.isArray(sources) || sources.length === 0) return null;
                        return (
                          <div className="mt-2.5 pt-2 border-t border-white/5">
                            <div className="text-[12px] text-slate-500 font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px] text-purple-400">travel_explore</span>
                              <span>Sumber Referensi:</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {sources.map((s, sIdx) => {
                                const url = s?.uri || s?.url || '#';
                                const title = s?.title || s?.name || (url !== '#' ? url : `Sumber #${sIdx + 1}`);
                                return (
                                  <a
                                    key={sIdx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 transition-all max-w-xs truncate group/link"
                                    title={title}
                                  >
                                    <span className="truncate">{title}</span>
                                    <span className="material-symbols-outlined text-[11px] text-purple-400 group-hover/link:translate-x-0.5 transition-transform">open_in_new</span>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {(() => {
                        const execution = m.metadata?.toolExecution || m.toolExecution;
                        if (!execution) return null;
                        const execName = execution.name || execution.tool || 'eksekusi_tool';
                        return (
                          <details className="mt-2.5 pt-2 border-t border-white/5 text-[12px] group/details">
                            <summary className="cursor-pointer text-slate-400 hover:text-slate-200 font-mono text-[12px] flex items-center gap-1 select-none">
                              <span className="material-symbols-outlined text-[13px] transition-transform group-open/details:rotate-90">chevron_right</span>
                              <span>Detail Eksekusi ({execName})</span>
                            </summary>
                            <div className="mt-1.5 p-2 rounded bg-black/40 border border-white/10 font-mono text-[12px] text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                              {typeof execution === 'string'
                                ? execution
                                : JSON.stringify(execution, null, 2)}
                            </div>
                          </details>
                        );
                      })()}

                      {m.isConfirmationRequest && (
                        <div className="mt-4 flex items-center gap-3 border-t border-outline-variant pt-3">
                          <button
                            onClick={() => {
                              const eventBus = kernel.serviceManager?.get('EventBus');
                              if (eventBus && m.confirmationId) {
                                eventBus.emit('Engineer:UserConfirmation', { confirmationId: m.confirmationId, confirmed: true });
                                setMessages(prev => { const next = [...prev]; next[idx] = { ...next[idx], content: `✅ **Konfirmasi Diterima**\n\nMelanjutkan ke pembuatan patch...`, isConfirmationRequest: false }; return next; });
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-di-warna text-sm font-bold transition-colors shadow-lg shadow-emerald-500/20"
                          >
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>✅ Lanjutkan ke Patch
                          </button>
                          <button
                            onClick={() => {
                              const eventBus = kernel.serviceManager?.get('EventBus');
                              if (eventBus && m.confirmationId) {
                                eventBus.emit('Engineer:UserConfirmation', { confirmationId: m.confirmationId, confirmed: false });
                                setMessages(prev => { const next = [...prev]; next[idx] = { ...next[idx], content: `❌ **Konfirmasi Ditolak**\n\nPembuatan patch dibatalkan.`, isConfirmationRequest: false }; return next; });
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-sm font-medium transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">cancel</span>❌ Batalkan
                          </button>
                        </div>
                      )}

                      {m.isReasoningBlock && m.reasoningReport && (
                        <div className="mt-3 border-t border-outline-variant pt-3">
                          <button
                            onClick={() => {
                              const report = m.reasoningReport;
                              const detail = `🧠 **Reasoning Report Detail**\n\n**Task ID:** ${report.taskId}\n**Summary:** ${report.summary}\n**Intent:** ${report.intent}\n**Model:** ${report.modelName}\n**Confidence:** ${report.confidence?.level} (${report.confidence?.coverage}% coverage, ${report.confidence?.evidence}/100 evidence)\n**ADR Referenced:** ${report.adrReferenced}\n**Files Analyzed:** ${(report.filesAnalyzed || []).join(', ')}\n**Recommendation:** ${report.recommendation}\n**Compliance:** ${report.compliance?.violations?.length || 0} violations, ${report.compliance?.warnings?.length || 0} warnings\n**Timestamp:** ${report.timestamp}`;
                              openLifecycleInspector('REASONING_DETAIL', detail);
                            }}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline-variant text-on-surface-variant text-body-sm rounded-lg hover:bg-surface-variant hover:text-on-surface transition-all shadow-sm"
                          >
                            <span className="material-symbols-outlined text-[16px]">description</span>📋 Lihat Detail Reasoning
                          </button>
                        </div>
                      )}

                      {m.hasPatchProposal && (
                        <div className="mt-4 flex items-center gap-3 border-t border-primary/20 pt-3">
                          <button
                            onClick={() => {
                              const eventBus = kernel.serviceManager?.get('EventBus');
                              if (eventBus) {
                                eventBus.emit('Engineer:GeneratePatch', tugasDariUsulan({ pesanAsli: m.patchOriginalTask, jawaban: m.content }));
                                setMessages(prev => { const next = [...prev]; next[idx] = { ...next[idx], hasPatchProposal: false, content: next[idx].content + '\n\n_⚙️ Engineer patch pipeline dimulai — Reasoning Lock aktif..._' }; return next; });
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-fixed text-on-primary text-sm font-bold transition-all shadow-lg shadow-primary/20 active:scale-95"
                          >
                            <span className="material-symbols-outlined text-[18px]">build</span>⚙️ Apply Patch
                          </button>
                          <span className="text-body-sm text-on-surface-variant italic">Reasoning Lock akan aktif sebelum eksekusi</span>
                        </div>
                      )}

                      {bolehDinilai(m) && (
                        <TombolUmpanBalik
                          nilai={m.umpanBalik || 0}
                          onNilai={(tombol) => nilaiJawaban(idx, tombol)}
                          galat={galatUmpanBalik?.idx === idx ? galatUmpanBalik.alasan : null}
                        />
                      )}

                      {m.role === 'model' && !m.isStreaming && displayText && (
                        <button
                          onClick={() => handleCopy(displayText, idx)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-surface-container hover:bg-surface-variant border border-outline-variant opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Salin ke clipboard"
                        >
                          {copiedIndex === idx ? (
                            <span className="material-symbols-outlined text-[16px] text-primary">check</span>
                          ) : (
                            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">content_copy</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && messages[messages.length - 1]?.role !== 'model' && (
                <div className="flex justify-start">
                  <div className="glass-panel rim-light px-5 py-3 rounded-2xl border border-outline-variant text-on-surface-variant text-body-sm flex items-center gap-3">
                    <Ikon nama="progress_activity" ukuran={16} className="animate-spin text-primary" /> Awaiting Intent Dispatch...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="px-3 pt-2 pb-2 z-10 flex flex-col items-center w-full">
              {attachedFile && (
                <div className="w-full max-w-[68rem] mb-2 flex items-center justify-between bg-surface-container border border-outline-variant rounded-lg px-3 py-2 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2 text-body-sm text-on-surface">
                    <span className="material-symbols-outlined text-[16px] text-primary">attach_file</span>
                    <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                  </div>
                  <button type="button" onClick={() => setAttachedFile(null)} className="text-on-surface-variant hover:text-error transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              )}

              {webConfirmation && (
                <div className="w-full max-w-[68rem] mb-2.5 p-3.5 bg-surface-container-high/95 backdrop-blur border border-primary/40 rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-2 z-20">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
                        <Ikon nama="public" ukuran={16} className="animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold uppercase tracking-wider text-primary">
                            Human-in-Command • Tier 3 Web Retrieval
                          </span>
                          <span className="text-[12px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium border border-primary/20">
                            PR#9 Gate
                          </span>
                        </div>
                        <p className="text-xs font-bold text-on-surface mt-0.5">
                          Konfirmasi Akses Web Pembanding
                        </p>
                        <p className="text-[12px] text-on-surface-variant mt-0.5 leading-tight">
                          {(webConfirmation.reason || webConfirmation.data?.reason) || 'Konteks lokal belum memadai untuk menjawab pertanyaan terkini.'}
                        </p>
                        <div className="mt-1.5 text-[12px] font-mono bg-surface-container-lowest/80 px-2 py-1 rounded border border-outline-variant text-on-surface flex items-center gap-1.5">
                          <span className="text-primary font-bold shrink-0">Query:</span>
                          <span className="truncate max-w-[320px] sm:max-w-md">{webConfirmation.query || webConfirmation.data?.query}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-1.5 sm:pt-0 border-t sm:border-t-0 border-outline-variant/50">
                      <button
                        type="button"
                        onClick={() => handleResolveWebConfirmation(webConfirmation.requestId || webConfirmation.data?.requestId, false)}
                        className="px-3 py-1.5 text-xs font-medium rounded-xl bg-surface-container hover:bg-surface-variant text-on-surface-variant transition-colors cursor-pointer"
                      >
                        Tolak
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveWebConfirmation(webConfirmation.requestId || webConfirmation.data?.requestId, true)}
                        className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-primary hover:bg-primary-fixed text-on-primary transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">public</span>
                        Setujui Pencarian Web
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSend} className="w-full max-w-[68rem] relative flex items-center gap-1.5 bg-surface-container-low border border-outline-variant rounded-2xl p-1.5 focus-within:border-primary transition-all shadow-lg pulse-focus">
                {workspaceManager?.activeWorkspaceId === 'ws-assistant' && (
                  <div className="shrink-0 ml-1">
                    <FolderKerjaTombol />
                  </div>
                )}

                {workspaceManager?.activeWorkspaceId === 'ws-engineer' && (
                  <div className="shrink-0 ml-1">
                    <AkarRepoTombol />
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e, null); } }}
                  placeholder="Ketik instruksi atau mulai percakapan dengan OS..."
                  className="flex-1 max-h-40 min-h-[38px] bg-transparent resize-none py-2 px-3 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none custom-scrollbar overflow-y-auto"
                  rows="1"
                />
                {(isEngineerWorkspace || workspaceManager?.activeWorkspaceId === 'ws-lite' || workspaceManager?.activeWorkspaceId === 'ws-assistant') && (
                  <>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { if (e.target.files?.[0]) setAttachedFile(e.target.files[0]); e.target.value = ''; }} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl bg-surface-container-high hover:bg-surface-variant text-on-surface-variant transition-all shrink-0" title={isEngineerWorkspace ? 'Lampirkan tangkapan layar atau dokumen teknis — isinya ikut ke penyedia model' : workspaceManager?.activeWorkspaceId === 'ws-lite' ? 'Upload Dokumen RAG' : 'Lampirkan berkas (mis. Word untuk diubah ke PDF)'}>
                      <span className="material-symbols-outlined text-[18px]">attach_file</span>
                    </button>
                  </>
                )}
                {isLoading ? (
                  <button type="button" onClick={hentikanKirim} title="Berhenti menunggu jawaban" className="p-2.5 mr-0.5 rounded-xl bg-error hover:opacity-90 text-on-error transition-all shadow-md shrink-0 cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim() && !attachedFile} className="p-2.5 mr-0.5 rounded-xl bg-primary hover:bg-primary-fixed text-on-primary disabled:opacity-50 disabled:hover:bg-primary transition-all shadow-md shrink-0 cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  </button>
                )}
              </form>
              <div className="text-center mt-1 text-[12px] text-on-surface-variant tracking-widest uppercase opacity-50">
                CE v3.0 • {workspaceManager.activeWorkspaceId}
              </div>
            </div>

            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-secondary/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
          </div>

          {isMemoryPanelOpen && (
            <div className="absolute right-0 top-0 h-full z-40 shadow-2xl">
            <MemoryContextPanel
              memories={activeMemories}
              query={lastMemoryQuery}
              loading={isMemoryLoading}
              serviceManager={kernel.serviceManager}
              onClose={() => setIsMemoryPanelOpen(false)}
              onMinimize={handleMinimizeSidePanels}
              onRefresh={handleRefreshMemory}
              onResolveConflict={async (memoryId, resolution) => {
                const governor = kernel.serviceManager?.get('MemoryGovernorService');
                if (governor) {
                  await governor.resolveConflict(memoryId, resolution);
                  if (lastMemoryQuery) handleRefreshMemory();
                }
              }}
              onArchiveMemory={async (memoryId) => {
                const governor = kernel.serviceManager?.get('MemoryGovernorService');
                if (governor) {
                  await governor.archiveMemory(memoryId);
                  if (lastMemoryQuery) handleRefreshMemory();
                }
              }}
              onRequestPurge={async (memoryId) => {
                const governor = kernel.serviceManager?.get('MemoryGovernorService');
                if (governor) {
                  await governor.requestPurge(memoryId);
                }
              }}
              onExecutePurge={async (memoryId) => {
                const governor = kernel.serviceManager?.get('MemoryGovernorService');
                if (governor) {
                  await governor.executePurge(memoryId);
                }
              }}
              onRestoreMemory={async (memoryId) => {
                const governor = kernel.serviceManager?.get('MemoryGovernorService');
                if (governor) {
                  await governor.restoreMemory(memoryId);
                  if (lastMemoryQuery) handleRefreshMemory();
                }
              }}
            />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
