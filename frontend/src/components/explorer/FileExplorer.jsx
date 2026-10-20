import React, { useState, useEffect, useCallback, useRef } from 'react';
import { kernel } from '../../core/runtime/Kernel';
import { angka } from '../../core/runtime/services/formatAngka.js';
import Ikon from '../Ikon';

const EXT_MAP = {
  js: { c: 'text-yellow-400' }, jsx: { c: 'text-cyan-400' }, ts: { c: 'text-blue-400' },
  tsx: { c: 'text-cyan-400' }, css: { c: 'text-pink-400' }, scss: { c: 'text-pink-400' },
  html: { c: 'text-orange-400' }, json: { c: 'text-emerald-400' }, md: { c: 'text-slate-300' },
  txt: { c: 'text-slate-300' }, py: { c: 'text-blue-300' }, yml: { c: 'text-rose-300' },
  yaml: { c: 'text-rose-300' }, sh: { c: 'text-emerald-300' }, env: { c: 'text-slate-400' }
};

const LANG_LABEL = {
  javascript: 'JavaScript', typescript: 'TypeScript', css: 'CSS', html: 'HTML',
  json: 'JSON', markdown: 'Markdown', text: 'Plain Text', python: 'Python',
  yaml: 'YAML', bash: 'Bash', unknown: 'Unknown'
};

const KEYWORDS = new Set([
  'function','const','let','var','return','import','export','from','class','extends',
  'if','else','for','while','do','switch','case','break','continue','new','delete',
  'typeof','instanceof','this','await','async','yield','try','catch','finally','throw',
  'def','lambda','pass','with','as','in','of','true','false','null','undefined',
  'None','True','False','and','or','not','is'
]);

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Aturan pewarnaan per jenis berkas. Berkas yang tidak terdaftar (md, txt, ...) tampil polos —
// prosa penuh kata "if"/"for" dan apostrof yang bukan kode.
const C_LIKE = { line: '//', block: ['/*', '*/'], quotes: '"\'`', keywords: true };
const HASH = { line: '#', quotes: '"\'', keywords: true };
const SYNTAX = {
  js: C_LIKE, jsx: C_LIKE, ts: C_LIKE, tsx: C_LIKE, mjs: C_LIKE, cjs: C_LIKE,
  css: { block: ['/*', '*/'], quotes: '"\'' },
  scss: { line: '//', block: ['/*', '*/'], quotes: '"\'' },
  json: { quotes: '"', keywords: true },
  html: { block: ['<!--', '-->'], quotes: '"\'' },
  py: HASH, sh: HASH,
  yml: { ...HASH, keywords: false }, yaml: { ...HASH, keywords: false }, env: { ...HASH, keywords: false }
};

const CLS_STRING = 'text-amber-300';
const CLS_KOMENTAR = 'text-slate-600 italic';
const CLS_KATA_KUNCI = 'text-purple-400 font-semibold';

function warnaiKataKunci(s, pakai) {
  if (!pakai) return escapeHtml(s);
  return s.split(/([a-zA-Z_$][\w$]*)/g)
    .map(t => KEYWORDS.has(t) ? `<span class="${CLS_KATA_KUNCI}">${t}</span>` : escapeHtml(t))
    .join('');
}

// Dibaca SEKALI dari kiri ke kanan, sehingga tiap karakter hanya punya satu peran:
// `//` di dalam "https://..." tetap bagian string, kata kunci di dalam komentar tidak diwarnai.
// (Versi lama menjalankan beberapa regex berurutan di atas hasil regex sebelumnya.)
function highlightCode(code, path) {
  if (!code) return '';
  // Samakan akhir baris dulu. Berkas Windows (\r\n) yang komentarnya dipotong sebelum \n
  // menyisakan \r di dalam span — browser membacanya sebagai baris baru kedua.
  code = code.replace(/\r\n?/g, '\n');
  const aturan = SYNTAX[path?.split('.').pop()?.toLowerCase()];
  if (!aturan) return escapeHtml(code);

  const n = code.length;
  let out = '';
  let i = 0;
  let mulaiPolos = 0;
  const ambil = (cls, akhir) => {
    out += warnaiKataKunci(code.slice(mulaiPolos, i), aturan.keywords);
    out += `<span class="${cls}">${escapeHtml(code.slice(i, akhir))}</span>`;
    i = mulaiPolos = akhir;
  };

  while (i < n) {
    const c = code[i];
    if (aturan.block && code.startsWith(aturan.block[0], i)) {
      const tutup = code.indexOf(aturan.block[1], i + aturan.block[0].length);
      ambil(CLS_KOMENTAR, tutup === -1 ? n : tutup + aturan.block[1].length);
    } else if (aturan.line && code.startsWith(aturan.line, i)) {
      const tutup = code.indexOf('\n', i);
      ambil(CLS_KOMENTAR, tutup === -1 ? n : tutup);
    } else if (aturan.quotes.includes(c)) {
      // String berakhir di kutip penutup atau di akhir baris (kecuali backtick yang boleh
      // multi-baris) — kutip yang tak tertutup tidak mewarnai sisa berkas.
      let j = i + 1;
      while (j < n && code[j] !== c && !(code[j] === '\n' && c !== '`')) j += code[j] === '\\' ? 2 : 1;
      if (j < n && code[j] === c) j++;
      ambil(CLS_STRING, Math.min(j, n));
    } else {
      i++;
    }
  }
  out += warnaiKataKunci(code.slice(mulaiPolos), aturan.keywords);
  return out;
}

function formatSize(b) {
  if (!b || b <= 0) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return angka(b / 1024, 1) + ' KB';
  return angka(b / 1048576, 1) + ' MB';
}

export default function FileExplorer() {
  const [service, setService] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [loadingDir, setLoadingDir] = useState(false);
  const [dirError, setDirError] = useState(null);
  const [selectedFilePath, setSelectedFilePath] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [fileMeta, setFileMeta] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [highlightedHtml, setHighlightedHtml] = useState('');
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const searchTimer = useRef(null);

  // ── Ambil RepositoryReaderService dari Kernel ──
  useEffect(() => {
    let interval = null;
    const getService = () => {
      if (kernel.serviceManager?.has('RepositoryReaderService')) {
        setService(kernel.serviceManager.get('RepositoryReaderService'));
        if (interval) clearInterval(interval);
        return true;
      }
      return false;
    };
    if (!getService() && kernel.status !== 'RUNNING') {
      interval = setInterval(() => { if (getService()) clearInterval(interval); }, 500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, []);

// ── Muat direktori ──
  const loadDirectory = useCallback(async (dirPath = '') => {
    if (!service) {
      setDirError('Service RepositoryReader belum tersedia.');
      return;
    }
    setLoadingDir(true);
    setDirError(null);
    // Reset entries agar UI tidak menampilkan file dari folder sebelumnya
    setEntries([]);
    try {
      const result = await service.listDirectory(dirPath);
      // Normalisasi tipe: pastikan ada field 'type' yang valid ('dir'/'file')
      const normalized = (result || []).map(item => {
        const type = item.type === 'dir' || item.type === 'file' ? item.type : 'file';
        return { ...item, type };
      });
      const sorted = [...normalized].sort((a, b) => {
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      setEntries(sorted);
    } catch (e) {
      // Jangan silent fail — set error state agar UI menampilkan pesan
      setDirError(e.message || 'Gagal memuat direktori');
      setEntries([]);
    } finally {
      setLoadingDir(false);
    }
  }, [service]);

  useEffect(() => {
    if (service) loadDirectory('');
  }, [service, loadDirectory]);

  // ── Muat file ──
  const loadFile = useCallback(async (filePath) => {
    if (!service) return;
    setLoadingFile(true);
    setFileError(null);
    setFileMeta(null);
    setFileContent('');
    setHighlightedHtml('');
    try {
      const result = await service.readFile(filePath);
      if (!result || result.content === undefined || result.content === null) {
        setFileError('File kosong atau tidak dapat dibaca.');
      } else {
        setFileContent(result.content);
        setFileMeta({ path: result.path || filePath, size: result.size || result.content.length, backend: result.backend || 'unknown' });
        setHighlightedHtml(highlightCode(result.content, filePath));
      }
    } catch (e) {
      setFileError(e.message || 'Gagal membaca file');
    } finally {
      setLoadingFile(false);
    }
  }, [service]);

  // ── Pencarian debounce ──
  useEffect(() => {
    if (!service) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); setSearching(false); setSearchError(null); return; }
    setSearching(true);
    setSearchError(null);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await service.searchFiles(q);
        setSearchResults(results || []);
      } catch (e) {
        setSearchError(e.message || 'Pencarian gagal');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery, service]);

  // ── Navigasi ──
  const breadcrumbs = currentPath ? currentPath.split('/').map((seg, i) => ({ name: seg, path: currentPath.split('/').slice(0, i + 1).join('/') })) : [];

  const navigateTo = (path) => {
    setCurrentPath(path || '');
    setExpandedFolders(prev => ({ ...prev, [path || 'root']: true }));
    loadDirectory(path || '');
    setSelectedFilePath(null); setFileContent(''); setFileMeta(null); setHighlightedHtml(''); setFileError(null);
  };

const toggleFolder = (item) => {
    if (expandedFolders[item.path]) { setExpandedFolders(prev => ({ ...prev, [item.path]: false })); return; }
    setExpandedFolders(prev => ({ ...prev, [item.path]: true }));
    setCurrentPath(item.path);
    loadDirectory(item.path);
    // ✅ LOGIKA FOLDER: buka folder, kosongkan panel preview (ini bukan file)
    setSelectedFilePath(null);
    setFileContent(null);
    setFileMeta(null);
    setHighlightedHtml('');
    setFileError(null);
  };

  const openFile = (filePath) => {
    setSelectedFilePath(filePath);
    loadFile(filePath);
    const el = document.getElementById('file-preview-scroll');
    if (el) el.scrollTop = 0;
  };

  const handleCopyPath = async (path) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) { console.warn('[FileExplorer] Gagal menyalin:', e); }
  };

  const getFileIcon = (name) => {
    const ext = name?.split('.').pop()?.toLowerCase() || '';
    const meta = EXT_MAP[ext];
    let ikon;
    if (ext === 'json') ikon = 'data_object';
    else if (meta || ['js', 'jsx', 'ts', 'tsx', 'py', 'css', 'scss', 'html', 'sh'].includes(ext)) ikon = 'code_blocks';
    else if (ext === 'md' || ext === 'txt' || ext === 'yml' || ext === 'yaml' || ext === 'env') ikon = 'description';
    else ikon = 'draft';
    return { ikon, color: meta?.c || 'text-slate-400' };
  };

  const getLang = (path) => {
    const ext = path?.split('.').pop()?.toLowerCase() || '';
    const map = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', css: 'css', scss: 'scss', html: 'html', json: 'json', md: 'markdown', txt: 'text', py: 'python', yml: 'yaml', yaml: 'yaml', sh: 'bash' };
    return map[ext] || 'unknown';
  };

  const selectedName = selectedFilePath?.split('/').pop() || '';
  const { ikon: ikonTerpilih, color: selColor } = selectedFilePath ? getFileIcon(selectedName) : { ikon: 'draft', color: 'text-slate-400' };
  const isElectron = service?.isElectron;
  const backendLabel = fileMeta?.backend === 'electron' ? 'FS Lokal' : fileMeta?.backend === 'github-raw' ? 'GitHub API' : 'Cache';

  return (
    <div className="flex flex-col h-full w-full text-slate-200 overflow-hidden font-sans relative">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-900/70 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <Ikon nama="folder_open" ukuran={16} className="text-purple-400" />
          <span className="text-xs font-bold tracking-widest uppercase text-slate-300">File Explorer</span>
          <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 font-mono">{isElectron ? 'Electron' : 'GitHub'}</span>
        </div>
        <div className="flex-1 max-w-md mx-auto relative min-w-[120px]">
          <Ikon nama="search" ukuran={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari file di repository..." className="w-full pl-9 pr-8 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 focus:outline-none transition-colors" />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"><Ikon nama="close" ukuran={14} /></button>}
        </div>
        <button onClick={() => navigateTo('')} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 text-xs transition-colors shrink-0" title="Ke root"><Ikon nama="home" ukuran={14} /> Root</button>
        <button onClick={() => loadDirectory(currentPath)} className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 shrink-0" title="Refresh"><Ikon nama="refresh" ukuran={14} className={`${loadingDir ? 'animate-spin' : ''}`} /></button>
      </div>

      {/* Dropdown search */}
      {searchQuery.trim() && (
        <div className="absolute top-[52px] left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-h-72 overflow-y-auto custom-scrollbar">
            {searching ? (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-400"><Ikon nama="progress_activity" ukuran={14} className="animate-spin text-purple-400" /> Mencari...</div>
            ) : searchError ? (
              <div className="px-4 py-3 text-xs text-red-400 flex items-center gap-2"><Ikon nama="warning" ukuran={14} /> {searchError}</div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-500">Tidak ada file cocok untuk "{searchQuery}"</div>
            ) : (
              <div className="py-1">
                {searchResults.map(rp => {
                  const name = rp.split('/').pop();
                  const icon = getFileIcon(name);
                  return (
                    <button key={rp} onClick={() => { setSearchQuery(''); setSearchResults([]); openFile(rp); }} className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-800 text-left">
                      <Ikon nama={icon.ikon} ukuran={14} className={`shrink-0 ${icon.color}`} />
                      <span className="text-xs text-slate-300 truncate">{name}</span>
                      <span className="text-[12px] text-slate-500 truncate ml-auto font-mono">{rp}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-4 py-1.5 bg-slate-900/50 border-b border-slate-800 text-[12px] font-mono overflow-x-auto custom-scrollbar shrink-0">
        <button onClick={() => navigateTo('')} className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:text-purple-400 whitespace-nowrap ${currentPath === '' ? 'text-purple-400 font-semibold' : 'text-slate-400'}`}><Ikon nama="folder_open" ukuran={12} /> root</button>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.path}>
            <Ikon nama="chevron_right" ukuran={12} className="text-slate-600 shrink-0" />
            <button onClick={() => navigateTo(crumb.path)} className={`px-1.5 py-0.5 rounded hover:text-purple-400 whitespace-nowrap ${idx === breadcrumbs.length - 1 ? 'text-purple-400 font-semibold' : 'text-slate-400'}`}>{crumb.name}</button>
          </React.Fragment>
        ))}
      </div>

      {/* Body split */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* Panel kiri: tree */}
        <div className="w-full md:w-72 md:max-w-72 shrink-0 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col min-h-0 bg-slate-900/30">
          <div className="px-4 py-2 text-[12px] font-semibold uppercase tracking-widest text-slate-500 border-b border-slate-800/70 shrink-0">Direktori {isElectron ? '(Lokal)' : '(GitHub)'}</div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {loadingDir ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500 gap-2"><Ikon nama="progress_activity" ukuran={20} className="animate-spin text-purple-400" /><span className="text-[12px] font-mono">Memuat direktori...</span></div>
            ) : dirError ? (
              <div className="mx-2 mt-2 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-[12px] text-red-400"><Ikon nama="warning" ukuran={16} className="shrink-0 mt-0.5" /><span className="break-words">{dirError}</span></div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-2"><Ikon nama="folder_open" ukuran={32} className="opacity-40" /><p className="text-[12px]">Direktori kosong</p>{currentPath && <button onClick={() => navigateTo('')} className="text-[12px] text-purple-400 hover:text-purple-300 mt-1">← Kembali ke root</button>}</div>
            ) : (
              <div className="space-y-0.5">
                {entries.map((item) => {
                  if (item.type === 'dir') {
                    const isExpanded = !!expandedFolders[item.path];
                    return (
                      <button key={item.path} onClick={() => toggleFolder(item)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left ${currentPath === item.path ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20' : 'text-slate-300 hover:bg-slate-800/80 border border-transparent'}`}>
                        {isExpanded ? <Ikon nama="expand_more" ukuran={12} className="text-slate-500 shrink-0" /> : <Ikon nama="chevron_right" ukuran={12} className="text-slate-500 shrink-0" />}
                        {currentPath === item.path ? <Ikon nama="folder_open" ukuran={16} className="text-purple-400 shrink-0" /> : <Ikon nama="folder" ukuran={16} className="text-blue-400 shrink-0" />}
                        <span className="text-xs truncate">{item.name}</span>
                      </button>
                    );
                  }
                  const icon = getFileIcon(item.name);
                  const isActive = selectedFilePath === item.path || selectedFilePath === `${currentPath}/${item.name}`;
                  return (
                    <button key={item.path} onClick={() => openFile(item.path)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left group ${isActive ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20' : 'text-slate-300 hover:bg-slate-800/80 border border-transparent'}`} title={item.path}>
                      <span className="w-3 shrink-0" />
                      <Ikon nama={icon.ikon} ukuran={16} className={`shrink-0 ${icon.color}`} />
                      <span className="text-xs truncate flex-1">{item.name}</span>
                      <span className="text-[12px] text-slate-600 opacity-0 group-hover:opacity-100">{formatSize(item.size)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="px-4 py-2 border-t border-slate-800/70 text-[12px] text-slate-600 font-mono flex items-center gap-1.5 shrink-0">
            <Ikon nama="database" ukuran={12} className="shrink-0" />
            <span className="truncate">{entries.length} item • {service ? (isElectron ? 'FS Lokal' : 'github/mamet334/mamet-ecosystem') : 'menunggu service...'}</span>
          </div>
        </div>

        {/* Panel kanan: preview */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 shrink-0 bg-slate-900/50">
            {selectedFilePath ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <Ikon nama={ikonTerpilih} ukuran={16} className={`shrink-0 ${selColor}`} />
                  <span className="text-xs font-medium truncate text-slate-300">{selectedName}</span>
                  <span className="text-[12px] font-mono text-slate-500 truncate hidden sm:block">{selectedFilePath}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {fileMeta && <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-mono">{LANG_LABEL[getLang(selectedFilePath)]}</span>}
                  {fileMeta && <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono hidden sm:inline">{backendLabel} • {formatSize(fileMeta.size)}</span>}
                  <button onClick={() => handleCopyPath(selectedFilePath)} className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 text-[12px]" title="Salin path">
                    {copied ? <Ikon nama="check" ukuran={12} className="text-emerald-400" /> : <Ikon nama="content_copy" ukuran={12} />}
                    <span className="hidden sm:inline">{copied ? 'Tersalin' : 'Salin Path'}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-slate-500"><Ikon nama="description" ukuran={16} /><span className="text-xs">Pilih file untuk melihat isinya</span></div>
            )}
          </div>
          <div id="file-preview-scroll" className="flex-1 overflow-auto custom-scrollbar bg-slate-950 p-4">
            {loadingFile ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2"><Ikon nama="progress_activity" ukuran={24} className="animate-spin text-purple-400" /><span className="text-[12px] font-mono">Membaca file...</span></div>
            ) : fileError ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3"><Ikon nama="warning" ukuran={32} className="text-red-400/60" /><p className="text-xs text-red-400">{fileError}</p></div>
            ) : selectedFilePath ? (
              <pre className="text-[12px] leading-relaxed text-slate-300 font-mono whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: highlightedHtml || '<span class="text-slate-500">(File kosong)</span>' }} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2"><Ikon nama="folder_open" ukuran={48} className="opacity-30" /><p className="text-xs">Klik file di panel kiri untuk melihat isi</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
