/**
 * grafHome.js — penyusun simpul & garis graf Home (Item 130 Tahap A, 2 Nov 2026).
 *
 * Dipindah APA ADANYA dari `useDashboardData.js` (dulu tertanam di dalam hook, tak bisa diuji tanpa peramban &
 * Supabase). Murni: menerima baris yang sudah diambil, memulangkan `{ nodes, links, stats }`.
 */

/**
 * Isi Knowledge Directory = simpul DATA saja (memori, dokumen, percakapan). Dulu "bukan kategori" — sehingga 12 sub-cluster
 * statis (tanpa `isCategory`) dan 11 layanan ikut terdaftar sebagai entitas berlencana bawaan MEMORI (481 = 458 + 23).
 */
export const GRUP_DATA = Object.freeze(['memory', 'rag', 'chat']);
export function simpulDirektori(nodes) {
  return (nodes || []).filter((n) => GRUP_DATA.includes(n.group));
}

const KELAS = { core: 'pusat', category: 'kategori', subcategory: 'sub', pipeline: 'layanan' };
const kelasSimpul = (n) => KELAS[n?.group] || (n?.isCategory ? 'sub' : 'data');

/**
 * Tata letak graf Home (Item 130 Tahap A). Diukur 2 Nov dengan mesin yang sama (`uji/lib/simulasiGrafHome.mjs`, sebaran
 * data Owner, layar 1366×768): setelan bawaan force-graph → 9 label kategori, **7 pasang saling tindih**, skala 0,155.
 * Akarnya bukan jarak antar-kategori saja: simpul TANPA relasi (10 memori Owner) tak tertambat apa pun, didorong
 * tolakan ±470 simpul sampai ribuan satuan jauhnya, lalu `zoomToFit` mengecilkan seluruh graf demi memuatnya — label
 * kategori di tengah berdesakan. Maka: gravitasi lembut ke pusat (lebih kuat bagi yang tak bertambat) + jarak & tolakan
 * lebih lega bagi kategori.
 *
 * @param {{ force: Function }} sim simulasi d3-force — di peramban `{ force: fg.d3Force }` (ref ForceGraph2D)
 * @param {Array} links garis graf — "tertambat" dihitung dari DATA, bukan dari simulasi: force-graph memasang datanya
 *   secara asinkron, jadi saat efek React berjalan gaya `link` bisa masih memegang garis lama.
 */
export function pasangGayaGraf(sim, links) {
  const jarak = { 'kategori-pusat': 150, 'layanan-pusat': 110, 'layanan-kategori': 80, 'sub-kategori': 70 };
  const tolak = { pusat: -400, kategori: -700, sub: -150, layanan: -80, data: -18 };
  const kunci = (l) => `${kelasSimpul(l.source)}-${kelasSimpul(l.target)}`;
  sim.force('link')?.distance((l) => jarak[kunci(l)] ?? 28);
  sim.force('charge')?.strength((n) => tolak[kelasSimpul(n)] ?? -18);
  const tertambat = new Set();
  (links || []).forEach((l) => { tertambat.add(l.source?.id ?? l.source); tertambat.add(l.target?.id ?? l.target); });
  sim.force('gravitasi', gayaGravitasi((n) => (tertambat.has(n.id) ? 0.02 : 0.12)));
}

/** Tarikan lembut ke titik (0,0) — rumus `forceX(0)`/`forceY(0)` d3, tanpa mengimpor d3 (bukan dependensi langsung). */
export function gayaGravitasi(tarik) {
  let simpul = [];
  const gaya = (alpha) => {
    for (const n of simpul) {
      const k = tarik(n) * alpha;
      n.vx -= (n.x || 0) * k;
      n.vy -= (n.y || 0) * k;
    }
  };
  gaya.initialize = (n) => { simpul = n || []; };
  return gaya;
}

/**
 * Nama simpul data (judul chat, dokumen, memori) baru tampil di kanvas pada skala ini. Dulu 0,75 — begitu tata letak
 * dirapatkan, layar 1920×1080 langsung melewatinya saat dibuka (skala pas 0,78) dan 490 nama tampil bertumpuk.
 * Nama tetap bisa dibaca lewat sorot (tooltip) dan Knowledge Directory.
 */
export const AMBANG_LABEL_DATA = 2;

/**
 * Tooltip sorot simpul. `float-tooltip` (dipakai force-graph) menulis string lewat `.html()` = innerHTML; nama simpul
 * berasal dari judul chat (awal pesan, bisa tempelan web), nama berkas, dan ringkasan memori buatan model. Di desktop
 * CSP dibuang saat build dan di web CSP mengizinkan 'unsafe-inline' → `<img onerror=…>` di nama akan BERJALAN di
 * renderer yang memegang `window.electronAPI`. Maka nama di-escape: tampil sebagai teks, tak pernah sebagai HTML.
 */
export function labelTooltipAman(node) {
  return String(node?.name ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/**
 * Safely push a link only if both source and target nodes exist.
 * Prevents "node not found" / "Cannot create property 'vx' on string" errors.
 */
export function safeLink(links, nodes, source, target, extra = {}) {
  const sourceId = (typeof source === 'object' && source !== null) ? (source.id || source) : source;
  const targetId = (typeof target === 'object' && target !== null) ? (target.id || target) : target;
  if (!nodes.some(n => n.id === sourceId)) {
    console.warn(`[safeLink] Skipped — source node "${sourceId}" not found`);
    return;
  }
  if (!nodes.some(n => n.id === targetId)) {
    console.warn(`[safeLink] Skipped — target node "${targetId}" not found`);
    return;
  }
  links.push({ source, target, ...extra });
}

export function susunGrafHome({ memories, documents, chats, docChunkCounts, vitals }) {
  const nodes = [];
  const links = [];

  // Helper to determine health color
  const getHealthColor = (relations) => {
    if (relations === 0) return '#ef4444';
    if (relations < 3) return '#eab308';
    return '#22c55e';
  };

  const mapLegacyName = (name) => {
    if (!name) return 'General';
    let n = name.toLowerCase();
    
    // Remove legacy 'ws-' prefix
    if (n.startsWith('ws-')) n = n.substring(3);
    
    // Map to the 3 canonical roles
    if (n === 'owner') return 'engineer';
    if (n === 'agent-forge' || n === 'asisten' || n === 'assistant') return 'assistant';
    if (n === 'lite') return 'lite';
    
    return n;
  };

  // ====================================================================
  // PHASE 1: Register ALL possible subcluster IDs upfront
  // This prevents "node not found: subcat-agent-engineer" because we
  // pre-compute all possible workspace_type mappings from chats data.
  // ====================================================================

  // Collect ALL possible subcluster IDs from data before building graph
  const allPossibleSubclusterIds = new Set();

  // Static subclusters
  const staticSubclusterDefs = [
    { id: 'subcat-mem-rag', name: 'RAG Memory', parent: 'cat-memory' },
    { id: 'subcat-mem-user', name: 'User Memory', parent: 'cat-memory' },
    { id: 'subcat-mem-vector', name: 'Vector DB', parent: 'cat-memory' },
    { id: 'subcat-agent-sub', name: 'Sub Agents', parent: 'cat-agent' },
    { id: 'subcat-agent-tools', name: 'Tools', parent: 'cat-agent' },
    { id: 'subcat-agent-skills', name: 'Skills', parent: 'cat-agent' },
    { id: 'subcat-exec-trace', name: 'Trace Pipeline', parent: 'cat-execution' },
    { id: 'subcat-exec-verify', name: 'Verification', parent: 'cat-execution' },
    { id: 'subcat-exec-audit', name: 'Audit', parent: 'cat-execution' },
    { id: 'subcat-know-docs', name: 'Documents', parent: 'cat-knowledge' },
    { id: 'subcat-know-embed', name: 'Embedding', parent: 'cat-knowledge' },
    { id: 'subcat-know-pgvector', name: 'pgvector', parent: 'cat-knowledge' },
  ];

  staticSubclusterDefs.forEach(sc => allPossibleSubclusterIds.add(sc.id));

  // Pre-compute all possible memory subcluster IDs from actual memory data
  memories.forEach(m => {
    const type = mapLegacyName(m.metadata?.type || m.metadata?.category || 'User');
    allPossibleSubclusterIds.add(`subcat-mem-${type.toLowerCase()}`);
  });

  // Pre-compute all possible document subcluster IDs from actual doc data
  documents.forEach(d => {
    const type = mapLegacyName(d.metadata?.file_type || d.metadata?.type || 'Docs');
    allPossibleSubclusterIds.add(`subcat-know-${type.toLowerCase()}`);
  });

  // Pre-compute all possible chat subcluster IDs from actual chat data
  // THIS PREVENTS the "subcat-agent-engineer" error!
  chats.forEach(c => {
    const type = mapLegacyName(c.workspace_type || 'Sub');
    allPossibleSubclusterIds.add(`subcat-agent-${type.toLowerCase()}`);
  });

  // Build a lookup of all subcluster definitions
  const allSubclusterDefs = new Map();

  // Add static ones first
  staticSubclusterDefs.forEach(sc => {
    allSubclusterDefs.set(sc.id, sc);
  });

  // Helper to register (with definition)
  const ensureSubclusterDef = (id, name, parent) => {
    if (!allSubclusterDefs.has(id)) {
      allSubclusterDefs.set(id, { id, name: name.toUpperCase(), type: 'Subcluster', group: 'subcategory', val: 15, isCategory: true, parent });
    }
  };

  // Add definitions for all pre-computed IDs
  allPossibleSubclusterIds.forEach(id => {
    if (!allSubclusterDefs.has(id)) {
      // Infer parent from ID pattern
      let parent = 'cat-memory';
      let label = id;
      if (id.startsWith('subcat-mem-')) { parent = 'cat-memory'; label = id.replace('subcat-mem-', '') + ' Memory'; }
      else if (id.startsWith('subcat-agent-')) { parent = 'cat-agent'; label = id.replace('subcat-agent-', '') + ' Agents'; }
      else if (id.startsWith('subcat-exec-')) { parent = 'cat-execution'; label = id.replace('subcat-exec-', '') + ' Pipeline'; }
      else if (id.startsWith('subcat-know-')) { parent = 'cat-knowledge'; label = id.replace('subcat-know-', '') + ' Knowledge'; }
      ensureSubclusterDef(id, label, parent);
    }
  });

  // ====================================================================
  // PHASE 2: Build nodes — ALL nodes are created BEFORE any links
  // ====================================================================

  // 2a. Central Node (Constitution 23: Central node is Supabase / MAEF Kernel)
  nodes.push({ id: 'core-maef', name: 'SUPABASE KERNEL', type: 'Core', group: 'core', val: 50, color: '#ffffff', isCategory: true, fx: 0, fy: 0 });

  // 2b. Primary Clusters (Constitution 23 Semantic Clustering)
  const primaryClusters = [
    { id: 'cat-memory', name: 'Memory Cluster', color: '#16a34a' },
    { id: 'cat-agent', name: 'Agent Cluster', color: '#ca8a04' },
    { id: 'cat-execution', name: 'Execution Cluster', color: '#0284c7' },
    { id: 'cat-knowledge', name: 'Knowledge Cluster', color: '#9333ea' },
    { id: 'cat-telemetry', name: 'Activity / Telemetry Cluster', color: '#38bdf8' }
  ];

  primaryClusters.forEach(cluster => {
    nodes.push({ id: cluster.id, name: cluster.name, type: 'Category', group: 'category', color: cluster.color, val: 26, isCategory: true });
  });

  // 2c. All Subclusters (static + dynamic pre-computed)
  allSubclusterDefs.forEach(def => {
    nodes.push({ ...def });
  });

  // 2d. Pipeline Services
  const pipelineServices = [
    { id: 'pipe-supabase',     name: 'Supabase (DB/Auth)',   statusKey: 'supabase' },
    { id: 'pipe-auth',         name: 'Auth',                 statusKey: 'auth' },
    { id: 'pipe-realtime',     name: 'Realtime',             statusKey: 'realtime' },
    { id: 'pipe-storage',      name: 'Storage',              statusKey: 'storage' },
    { id: 'pipe-edge',         name: 'Edge Function',        statusKey: 'edge' },
    { id: 'pipe-memory',       name: 'Memory Service',       statusKey: 'memory' },
    { id: 'pipe-rag',          name: 'RAG Service',          statusKey: 'rag' },
    { id: 'pipe-embedding',    name: 'Embedding',            statusKey: 'embedding' },
    { id: 'pipe-verification', name: 'Verification Engine',  statusKey: 'verification' },
    { id: 'pipe-provider',     name: 'LLM Provider',         statusKey: 'provider' },
    { id: 'pipe-agent',        name: 'Agent Process',        statusKey: 'agentProcess' },
  ];

  pipelineServices.forEach(service => {
    const status = vitals[service.statusKey] || 'UNKNOWN';
    let color = '#94a3b8';
    if (status === 'HEALTHY') color = '#22c55e';
    else if (status === 'DEGRADED') color = '#eab308';
    else if (status === 'DOWN') color = '#ef4444';

    nodes.push({
      id: service.id,
      name: service.name,
      type: 'Pipeline Service',
      group: 'pipeline',
      val: 12,
      isCategory: false,
      status,
      color,
      data: { status }
    });
  });

  // 2e. Data Nodes — memories (Constitution 23: Green, or Red for conflicts)
  memories.forEach(m => {
    const type = mapLegacyName(m.metadata?.type || m.metadata?.category || 'User');
    const subcatId = `subcat-mem-${type.toLowerCase()}`;
    const hits = m.memory_hits || 0;
    const causalLinks = m.causal_links || [];
    let relationsCount = causalLinks.length;
    const sourceChatId = m.metadata?.chat_id || m.metadata?.source_id;
    const sourceDocId = m.metadata?.document_id;
    if (sourceChatId) relationsCount++;
    if (sourceDocId) relationsCount++;

    const isConflict = m.status === 'CONFLICT_PENDING_REVIEW' || m.metadata?.status === 'CONFLICT_PENDING_REVIEW';
    // Constitution 23: Green for memory, Red for conflicts
    const memColor = isConflict ? '#ef4444' : '#22c55e';

    nodes.push({
      id: `mem-${m.id}`,
      name: m.summary || 'Memory',
      type: 'Memory',
      group: 'memory',
      isConflict,
      val: isConflict ? 14 : Math.max(3, Math.min(25, 3 + hits * 2)),
      color: memColor,
      data: { created: m.created_at, used: hits, relations: relationsCount, status: m.status, metadata: m.metadata || {} }
    });
  });

  // 2f. Data Nodes — documents (Constitution 23: Purple for RAG)
  documents.forEach(d => {
    const type = mapLegacyName(d.metadata?.file_type || d.metadata?.type || 'Docs');
    const subcatId = `subcat-know-${type.toLowerCase()}`;
    const chunkCount = docChunkCounts[d.id] || 0;
    nodes.push({
      id: `doc-${d.id}`,
      name: d.title || 'Document',
      type: 'Document',
      group: 'rag',
      val: Math.max(3, Math.min(25, 3 + chunkCount * 0.5)),
      color: '#a855f7', // Constitution 23: Purple for RAG Knowledge
      data: { created: d.created_at, used: 'N/A', relations: chunkCount, metadata: d.metadata || {} }
    });
  });

  // 2g. Data Nodes — chats (Constitution 23: Yellow for Conversations)
  chats.forEach(c => {
    const type = mapLegacyName(c.workspace_type || 'Sub');
    const subcatId = `subcat-agent-${type.toLowerCase()}`;
    nodes.push({
      id: `chat-${c.id}`,
      name: c.title || 'Chat',
      type: 'Conversation',
      group: 'chat',
      val: 8,
      color: '#eab308', // Constitution 23: Yellow for Conversation
      data: { created: c.created_at, used: 1, source: c.workspace_type, relations: 1 }
    });
  });

  // ====================================================================
  // PHASE 3: Build links — ALL nodes exist, so safeLink will never skip
  // ====================================================================

  // 3a. Primary Cluster → Core
  primaryClusters.forEach(cluster => {
    safeLink(links, nodes, cluster.id, 'core-maef');
  });

  // 3b. Subcluster → Parent
  allSubclusterDefs.forEach(def => {
    safeLink(links, nodes, def.id, def.parent);
  });

  // 3c. Pipeline Services → Core + Telemetry
  pipelineServices.forEach(service => {
    const status = vitals[service.statusKey] || 'UNKNOWN';
    const linkColor = (status === 'HEALTHY') ? '#22c55e' : (status === 'DEGRADED' ? '#eab308' : '#ef4444');
    const linkWidth = (status === 'HEALTHY') ? 2 : 0.8;
    safeLink(links, nodes, service.id, 'core-maef', { color: linkColor, width: linkWidth, isPipelineLink: true });
    safeLink(links, nodes, service.id, 'cat-telemetry');
  });

  // 3d. Memory → Subcluster + causal links
  memories.forEach(m => {
    const type = mapLegacyName(m.metadata?.type || m.metadata?.category || 'User');
    const subcatId = `subcat-mem-${type.toLowerCase()}`;
    const hits = m.memory_hits || 0;
    const causalLinks = m.causal_links || [];
    let relationsCount = causalLinks.length;
    const sourceChatId = m.metadata?.chat_id || m.metadata?.source_id;
    const sourceDocId = m.metadata?.document_id;
    if (sourceChatId) relationsCount++;
    if (sourceDocId) relationsCount++;

    if (relationsCount > 0) {
      safeLink(links, nodes, `mem-${m.id}`, subcatId);
    }

    causalLinks.forEach(targetId => {
      safeLink(links, nodes, `mem-${targetId}`, `mem-${m.id}`);
    });
    if (sourceChatId && chats.some(c => c.id === sourceChatId)) {
      safeLink(links, nodes, `chat-${sourceChatId}`, `mem-${m.id}`);
    }
    if (sourceDocId && documents.some(d => d.id === sourceDocId)) {
      safeLink(links, nodes, `doc-${sourceDocId}`, `mem-${m.id}`);
    }
  });

  // 3e. Document → Subcluster
  documents.forEach(d => {
    const type = mapLegacyName(d.metadata?.file_type || d.metadata?.type || 'Docs');
    const subcatId = `subcat-know-${type.toLowerCase()}`;
    const chunkCount = docChunkCounts[d.id] || 0;
    if (chunkCount > 0) {
      safeLink(links, nodes, `doc-${d.id}`, subcatId);
    }
  });

  // 3f. Chat → Subcluster
  chats.forEach(c => {
    const type = mapLegacyName(c.workspace_type || 'Sub');
    const subcatId = `subcat-agent-${type.toLowerCase()}`;
    safeLink(links, nodes, `chat-${c.id}`, subcatId);
  });

  // ---- STATS ----
  const orphanCount = nodes.filter(n => !n.isCategory && n.data && n.data.relations === 0).length;
  const totalDataNodes = nodes.filter(n => !n.isCategory && n.data).length;
  const connectedCount = totalDataNodes - orphanCount;
  const memoryConflicts = memories.filter(m => m.status === 'CONFLICT_PENDING_REVIEW').length;

  const stats = {
    memories: memories.length,
    documents: documents.length,
    chats: chats.length,
    orphans: orphanCount,
    connected: connectedCount,
    memoryConflicts
  };

  return { nodes, links, stats };
}
