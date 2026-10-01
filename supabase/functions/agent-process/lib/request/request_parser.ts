import { WorkspaceGuardian } from '../workspace_guardian.ts';

export async function parseRequestParams(req: Request, user: any) {
  let reqJson;
  try {
    reqJson = await req.json();
  } catch(e) {
    reqJson = {};
  }
  let { message, tools, model, userId: _clientUserId, userName, file, history, globalMemory, semanticContext, stream, desktopOSMode, ragEnabled, appSource: clientAppSource = 'assistant', workspaceTarget = 'AUTO', auditMode = 'OFF', mode: clientMode, provider, thinking, traceId: clientTraceId, requestId, clientTimezone, streamNalar, memoryEnabled, dataTabel, folderKerja } = reqJson;
  const traceId = clientTraceId || requestId || null;
  const mode = clientMode || 'ASSISTANT';
  console.log('[RequestParser] Mode diterima:', mode);

  const jwtAppSource = user.user_metadata?.app_source as string | undefined;
  const ALLOWED_CLIENT_SOURCES = ['assistant', 'mametlite', 'engineer'];
  // [FIX 2026-09-08] Client yang aktif mendeklarasikan appSource SELALU menang atas
  // user_metadata.app_source. Metadata akun hanya dipakai sebagai fallback jika client
  // tidak mengirim nilai yang dikenali. Sebelumnya urutan ini terbalik (metadata selalu
  // menang), sehingga tag 'app_source' lama yang tersisa di akun (mis. dari sesi Engineer
  // sebelumnya) "menempel" permanen dan salah mengklasifikasikan request dari aplikasi
  // lain yang memakai akun Supabase yang sama — menyebabkan Mamet Lite ditolak dengan
  // error ENGINEER_NO_API_KEY walau mengirim appSource: 'mametlite' dengan benar.
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

  if (history && Array.isArray(history)) {
    history = history.map((msg: any) => {
      if (msg.role === 'model' && typeof msg.content === 'string') {
        msg.content = msg.content.replace(/<call:[^>]+>/gi, '').trim();
      }
      return msg;
    });
  }

  if (history && history.length > 15) {
    history = [
      history[0], 
      { role: 'model', content: '[MAMET HEALER: Memori obrolan lama telah diringkas untuk mencegah kepenuhan memori dan menjaga kestabilan.]' }, 
      ...history.slice(-10)
    ];
  }

  let extractedImage = null;
  let finalMessage = message;

  if (file && file.data) {
    const filename = String(file.name || '').toLowerCase();

    // NAMA MEDAN YANG TIDAK PERNAH COCOK (diperbaiki 2026-10-02).
    //
    // Dulu baris ini berbunyi `file.mimeType && file.mimeType.startsWith('image/')`. Tetapi SATU-SATUNYA
    // pembuat muatan ini di seluruh repo — `AssistantService.buildFileData()` — mengirim medan `type`,
    // bukan `mimeType`. Diperiksa 2 Okt: `mimeType` tidak muncul satu kali pun di `frontend/src` maupun
    // `mametlite/src`.
    //
    // Akibatnya cabang gambar TIDAK PERNAH menyala. Setiap tangkapan layar yang dilampirkan jatuh ke
    // cabang terakhir, dan model hanya menerima nama berkas plus catatan — gambarnya tidak pernah
    // dikirim. Fitur yang terlihat ada tetapi buta, dan tak ada yang memberi tahu.
    //
    // Keduanya kini diterima, dan bila mime tidak terbaca sama sekali, akhiran berkas yang menentukan:
    // peramban kadang mengirim type kosong untuk berkas yang diseret dari tempat tertentu.
    const mime = String(file.mimeType || file.type || '').toLowerCase();
    const akhiranGambar = /\.(png|jpe?g|gif|webp|bmp)$/.test(filename);

    // Teks biasa yang isinya aman dibaca apa adanya. Diperluas 2 Okt untuk Engineer: Owner ingin bisa
    // menempelkan dokumen instruksi teknis dan potongan kode. Semuanya teks — tidak ada mesin baru.
    const TEKS = /\.(txt|csv|md|json|ya?ml|sql|js|jsx|mjs|cjs|ts|tsx|html?|css|xml|ini|env|log|sh|ps1|py)$/;

    if (mime.startsWith('image/') || akhiranGambar) {
      // Mime diambil apa adanya bila ada; bila hanya akhiran yang dikenali, mime dirakit dari akhirannya
      // supaya penyedia model tetap menerima bentuk yang sah.
      const dariAkhiran = filename.replace(/^.*\./, '').replace('jpg', 'jpeg');
      extractedImage = { mimeType: mime.startsWith('image/') ? mime : `image/${dariAkhiran}`, data: file.data };
    } else if (TEKS.test(filename)) {
      // Deno-native base64 decode (no Node.js Buffer needed)
      const binaryStr = atob(file.data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const textContent = new TextDecoder().decode(bytes).substring(0, 50000);
      finalMessage = `Permintaan User: ${message}\n\n[DOKUMEN TERLAMPIR: ${file.name}]\nIsi Dokumen:\n${textContent}`;
    } else {
      // Kalimat lama berbunyi "PDF akan dibaca secara ringkas jika memungkinkan" — janji yang tidak
      // pernah ditepati siapa pun di jalur ini. Sekarang dikatakan apa adanya: tidak dibaca.
      finalMessage = `Permintaan User: ${message}\n\n[DOKUMEN TERLAMPIR: ${file.name}]\n(ISINYA TIDAK DIBACA — jenis berkas ini belum didukung di jalur lampiran. Yang dibaca: gambar, dan teks berakhiran txt/csv/md/json/yaml/sql/js/jsx/ts/tsx/html/css/xml/ini/env/log/sh/ps1/py. Jangan menebak isinya; minta Owner menempelkan isinya sebagai teks bila perlu.)`;
    }
  }

  return {
    message, finalMessage, tools, model, userName, history, globalMemory, semanticContext, stream, desktopOSMode, ragEnabled, appSource, auditMode, extractedImage, guardianPromptDirective, storageTarget, workspaceTarget, mode, provider, thinking, traceId, clientTimezone, streamNalar,
    // Tombol Memory desktop (2026-09-15). Hanya `false` yang mematikan — klien yang tidak mengirim (mametlite, versi
    // lama) tetap memakai memori seperti sebelumnya.
    memoryEnabled: memoryEnabled !== false,
    // Tombol Data Tabel desktop (Item 92 Tahap 3). Bendera tersendiri, BUKAN lewat `tools`: daftar tools juga menyaring
    // sub-agent Coordinator, jadi mengirim ['data_tabel'] diam-diam mematikan pencarian web.
    dataTabel: dataTabel === true,
    // Folder kerja Assistant (Item 85 Tahap 1): hanya NAMA folder & nomor putaran alat — alamat lengkap tetap di
    // desktop. Disaring ulang di sini (teks pendek tanpa pemisah alamat), putaran dibatasi 0..4.
    folderKerja: folderKerjaAman(folderKerja)
  };
}

function folderKerjaAman(f: any): { nama: string; putaran: number } | null {
  if (!f || typeof f !== 'object') return null;
  const nama = String(f.nama ?? '').replace(/[\\/:\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!nama) return null;
  const putaran = Number.isInteger(f.putaran) ? Math.min(Math.max(f.putaran, 0), 4) : 0;
  return { nama, putaran };
}
