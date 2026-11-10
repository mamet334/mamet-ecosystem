import { WorkspaceGuardian } from '../workspace_guardian.ts';
import { infoKonektorAman } from '../../../../../shared/konektorAlat.js';
import { muatanKonektorUmumAman } from '../../../../../shared/konektorUmum.js';
import { alatRagAman } from '../../../../../shared/ragAlat.js';
import { jumlahDilewatiAman } from '../catatan_jujur.ts';

export async function parseRequestParams(req: Request, user: any) {
  let reqJson;
  try {
    reqJson = await req.json();
  } catch(e) {
    reqJson = {};
  }
  let { message, tools, model, userId: _clientUserId, userName, file, history, globalMemory, semanticContext, stream, desktopOSMode, ragEnabled, appSource: clientAppSource = 'assistant', workspaceTarget = 'AUTO', auditMode = 'OFF', mode: clientMode, provider, thinking, traceId: clientTraceId, requestId, clientTimezone, streamNalar, memoryEnabled, dataTabel, folderKerja, konektor, konektorUmum, pemilihModel, riwayatDilewati, alatRag } = reqJson;
  const traceId = clientTraceId || requestId || null;
  const mode = clientMode || 'ASSISTANT';
  console.log('[RequestParser] Mode diterima:', mode);

  const jwtAppSource = user.user_metadata?.app_source as string | undefined;
  const ALLOWED_CLIENT_SOURCES = ['assistant', 'mametlite', 'engineer'];
  const resolvedAppSource: string = ALLOWED_CLIENT_SOURCES.includes(clientAppSource)
    ? clientAppSource
    : (jwtAppSource ?? 'assistant');
  const appSource = resolvedAppSource;
  
  const guardian = new WorkspaceGuardian({
    workspaceTarget,
    message: message || ''
  });

  const storageTarget = guardian.determineTarget();
  tools = guardian.filterTools(tools, storageTarget);
  const guardianPromptDirective = guardian.getGuardianPrompt(storageTarget);

  const riwayatAsli: any[] = Array.isArray(history) ? history : [];
  if (history && Array.isArray(history)) {
    history = history.map((msg: any) =>
      msg?.role === 'model' && typeof msg.content === 'string'
        ? { ...msg, content: msg.content.replace(/<call:[^>]+>/gi, '').trim() }
        : msg
    );
  }
  const riwayatSesudahTag: any[] = Array.isArray(history) ? history : [];

  let extractedImage = null;
  let finalMessage = message;

  if (file && file.data) {
    const filename = String(file.name || '').toLowerCase();

    const mime = String(file.mimeType || file.type || '').toLowerCase();
    const akhiranGambar = /\.(png|jpe?g|gif|webp|bmp)$/.test(filename);

    const TEKS = /\.(txt|csv|md|json|ya?ml|sql|js|jsx|mjs|cjs|ts|tsx|html?|css|xml|ini|env|log|sh|ps1|py)$/;

    if (mime.startsWith('image/') || akhiranGambar) {
      const dariAkhiran = filename.replace(/^.*\./, '').replace('jpg', 'jpeg');
      extractedImage = { mimeType: mime.startsWith('image/') ? mime : `image/${dariAkhiran}`, data: file.data };
    } else if (TEKS.test(filename)) {
      const binaryStr = atob(file.data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const textContent = new TextDecoder().decode(bytes).substring(0, 50000);
      finalMessage = `Permintaan User: ${message}\n\n[DOKUMEN TERLAMPIR: ${file.name}]\nIsi Dokumen:\n${textContent}`;
    } else {
      finalMessage = `Permintaan User: ${message}\n\n[DOKUMEN TERLAMPIR: ${file.name}]\n(ISINYA TIDAK DIBACA — jenis berkas ini belum didukung di jalur lampiran. Yang dibaca: gambar, dan teks berakhiran txt/csv/md/json/yaml/sql/js/jsx/ts/tsx/html/css/xml/ini/env/log/sh/ps1/py. Jangan menebak isinya; minta Owner menempelkan isinya sebagai teks bila perlu.)`;
    }
  }

  return {
    message, finalMessage, tools, model, userName, history, globalMemory, semanticContext, stream, desktopOSMode, ragEnabled, appSource, auditMode, extractedImage, guardianPromptDirective, storageTarget, workspaceTarget, mode, provider, thinking, traceId, clientTimezone, streamNalar,
    pemilihModel,
    riwayatAsli, riwayatSesudahTag,
    riwayatDilewati: jumlahDilewatiAman(riwayatDilewati),
    memoryEnabled: memoryEnabled !== false,
    dataTabel: dataTabel === true,
    folderKerja: folderKerjaAman(folderKerja),
    konektor: infoKonektorAman(konektor),
    konektorUmum: muatanKonektorUmumAman(konektorUmum),
    alatRag: alatRagAman(alatRag)
  };
}

function folderKerjaAman(f: any): { nama: string; putaran: number } | null {
  if (!f || typeof f !== 'object') return null;
  const nama = String(f.nama ?? '').replace(/[\\/:\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!nama) return null;
  const putaran = Number.isInteger(f.putaran) ? Math.min(Math.max(f.putaran, 0), 4) : 0;
  return { nama, putaran };
}
