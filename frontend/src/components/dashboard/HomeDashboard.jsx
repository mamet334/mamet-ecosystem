import React, { useState, useEffect, useRef, useMemo } from 'react';
import useDashboardData from '../../core/runtime/hooks/useDashboardData';
import ActivityGraph from './ActivityGraph';
import NodeInspector from './NodeInspector';
import ObservabilityPanel from './ObservabilityPanel';
import { supabase } from '../../supabase';
import { kernel } from '../../core/runtime/Kernel';
import { pasangGayaGraf, warnaStatus, statusGabungan, PUSAT, tataPas, susunLapisanKemampuan, gabungGraf, konektorUntukGraf } from '../../core/runtime/hooks/grafHome.js';
import { SUBAGEN } from '../../../../shared/daftarSubagen.js';
import { ALAT_SEMUA } from '../../../../shared/folderKerjaAlat.js';
import { KONEKTOR_DIKENAL } from '../../../../shared/konektorAlat.js';

const FALLBACK_COLOR = '#475569';

export default function HomeDashboard() {
  const {
    graphData,
    stats,
    vitals,
    keteranganLampu,
    laporRealtime,
    selectedNode,
    setSelectedNode,
    activePath,
    setActivePath,
    isDragging,
    setIsDragging,
    lastCheckTime,
    executionTrace,
    observability,
    dimensions,
    setDimensions
  } = useDashboardData();

  // ── Lapisan Kemampuan (Item 130 Tahap D): tertutup di awal, dibuka tombol. Disusun HANYA saat dinyalakan; semua
  // sumbernya di laptop (registry alat, daftar shared/, status konektor baca-saja) — tanpa jaringan, tanpa biaya.
  const [kemampuanTampil, setKemampuanTampil] = useState(false);
  const [lapisan, setLapisan] = useState(null);
  useEffect(() => {
    if (!kemampuanTampil) return;
    let batal = false;
    (async () => {
      const registry = kernel.serviceManager?.get('ToolRegistryService');
      const preferensi = kernel.serviceManager?.get('ToolPreferencesService');
      const alatChat = (registry?.listTools?.() || []).map((t) => ({
        name: t.name,
        aktif: preferensi ? preferensi.getEffective('ws-assistant', t.name) !== false : true,
      }));
      // Hanya `status()` — jalur baca-saja yang juga dipakai Settings › Konektor. Graf tak pernah memanggil alat konektor.
      const statusKonektor = window.electronAPI?.konektor?.status;
      const konektor = statusKonektor ? konektorUntukGraf(await statusKonektor().catch(() => [])) : null;
      if (!batal) {
        setLapisan(susunLapisanKemampuan({ alatChat, alatFolder: ALAT_SEMUA, konektorDikenal: KONEKTOR_DIKENAL, konektor, subagen: SUBAGEN }));
      }
    })();
    return () => { batal = true; };
  }, [kemampuanTampil]);
  const grafTampil = useMemo(
    () => (kemampuanTampil && lapisan ? gabungGraf(graphData, lapisan) : graphData),
    [graphData, kemampuanTampil, lapisan],
  );

  const fgRef = useRef();
  const containerRef = useRef();
  const graphDataRef = useRef(grafTampil);
  const timeoutRef = useRef(null);
  const isDraggingRef = useRef(false);
  const activePathRef = useRef(null);

  useEffect(() => {
    graphDataRef.current = grafTampil;
  }, [grafTampil]);

  // Tata letak (Item 130 Tahap A): label kategori tak menumpuk & simpul tanpa relasi tak terlempar jauh — diukur di
  // uji-graf-home-tahap-a.mjs dengan mesin yang sama. Ref ForceGraph2D (anak) sudah terpasang saat efek induk berjalan.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || grafTampil.nodes.length === 0) return;
    pasangGayaGraf({ force: (nama, gaya) => (gaya === undefined ? fg.d3Force(nama) : fg.d3Force(nama, gaya)) }, grafTampil.links);
    fg.d3ReheatSimulation();
  }, [grafTampil]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

  // Realtime Reasoning Path Listener (moved from original file)
  useEffect(() => {
    const triggerReasoningHighlight = (nodeId) => {
      if (!graphDataRef.current) return;
      const { nodes, links } = graphDataRef.current;

      // Jalur menelusuri arah garis data → kemampuan → belahan; kedua belahan MAMET selalu ikut menyala (Tahap C).
      const activeNodes = new Set([PUSAT.desktop, PUSAT.server]);
      const activeLinks = new Set();

      const targetNode = nodes.find(n => n.id === nodeId);
      if (targetNode) {
        activeNodes.add(nodeId);
        let currentNodes = new Set([nodeId]);

        for (let i = 0; i < 3; i++) {
          let nextNodes = new Set();
          currentNodes.forEach(cId => {
            links.forEach(l => {
              const sId = l.source?.id || l.source;
              const tId = l.target?.id || l.target;
              if (sId === cId) {
                activeNodes.add(tId);
                activeLinks.add(`${sId}->${tId}`);
                nextNodes.add(tId);
              }
            });
          });
          currentNodes = nextNodes;
        }

        setActivePath({ nodes: activeNodes, links: activeLinks });

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (!isDraggingRef.current) {
          timeoutRef.current = setTimeout(() => {
            setActivePath(null);
          }, 3000);
        }
      }
    };

    const channel = supabase.channel('activity-tracing')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_memories' }, payload => {
        triggerReasoningHighlight(`mem-${payload.new.id}`);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, payload => {
        triggerReasoningHighlight(`chat-${payload.new.id}`);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documents' }, payload => {
        triggerReasoningHighlight(`doc-${payload.new.id}`);
      })
      .subscribe((status) => {
        // Lampu Realtime dinilai dari langganan INI (Item 130 Tahap B) — gratis; dulu statusnya tak pernah diisi.
        laporRealtime(status);
      });

    window.triggerReasoningHighlight = triggerReasoningHighlight;

    return () => {
      supabase.removeChannel(channel);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Resize for ForceGraph
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- GRAPH COLORING FUNCTIONS (Constitution 23 Semantic Palette) ---
  // Lampu gabungan simpul fondasi & garis berlampu (jalur pesan, fondasi → belahan) dari vitals terkini.
  const warnaLampu = (kunci) => warnaStatus(statusGabungan(kunci, vitals));

  const getNodeColor = (node) => {
    if (!node) return FALLBACK_COLOR;

    // Red for memory conflicts / alerts
    if (node.isConflict || (node.data && node.data.status === 'CONFLICT_PENDING_REVIEW')) {
      return '#ef4444';
    }

    // Simpul berlampu (fondasi): warna dari status TERKINI (mis. Realtime yang terlapor sesudah graf disusun).
    let baseColor = node.statusKeys ? warnaLampu(node.statusKeys) : node.color;

    if (!baseColor) {
      switch (node.group) {
        case 'core': baseColor = '#ffffff'; break;
        case 'memory': baseColor = '#22c55e'; break;
        case 'rag': baseColor = '#a855f7'; break;
        case 'chat': baseColor = '#eab308'; break;
        case 'category': baseColor = '#38bdf8'; break;
        case 'subcategory': baseColor = '#64748b'; break;
        default: baseColor = FALLBACK_COLOR; break;
      }
    }

    if (activePath && !activePath.nodes.has(node.id)) {
      return baseColor + '20';
    }
    return baseColor;
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    if (window.triggerReasoningHighlight) {
      window.triggerReasoningHighlight(node.id);
    }
  };

  const handleNodeDrag = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    isDraggingRef.current = true;
    setIsDragging(true);
  };

  const handleNodeDragEnd = (node) => {
    isDraggingRef.current = false;
    setIsDragging(false);
    if (activePathRef.current) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setActivePath(null);
      }, 3000);
    }
  };

  // Dulu `zoomToFit(400, 50)` — padding sama di keempat sisi, graf masuk ke bawah judul & legenda. Kini pita atas
  // disisakan (grafHome.js tataPas, Item 130 Tahap C).
  const handleEngineStop = () => {
    const fg = fgRef.current;
    const bbox = fg?.getGraphBbox?.();
    if (!fg || !bbox) return;
    const { x, y, k } = tataPas({ bbox, lebar: dimensions.width, tinggi: dimensions.height });
    fg.centerAt(x, y, 400);
    fg.zoom(k, 400);
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full text-slate-200 relative overflow-hidden font-body-base">
      {/* Main Graph Area */}
      <div ref={containerRef} className="flex-1 relative h-full w-full z-10">
        <ActivityGraph
          graphData={grafTampil}
          kemampuanTampil={kemampuanTampil}
          onToggleKemampuan={() => setKemampuanTampil((t) => !t)}
          dimensions={dimensions}
          fgRef={fgRef}
          getNodeColor={getNodeColor}
          warnaLampu={warnaLampu}
          activePath={activePath}
          handleNodeClick={handleNodeClick}
          onNodeDrag={handleNodeDrag}
          onNodeDragEnd={handleNodeDragEnd}
          onEngineStop={handleEngineStop}
        />
      </div>

      {/* Right Panel: Detail / Metrics */}
      <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-white/10 bg-[rgb(var(--warna-panel-sisi)/0.9)] backdrop-blur-xl p-6 flex flex-col z-20 overflow-y-auto h-1/2 md:h-full shrink-0">
        {selectedNode && !selectedNode.isCategory ? (
          <NodeInspector 
            selectedNode={selectedNode} 
            onClose={() => setSelectedNode(null)} 
            serviceManager={kernel.serviceManager}
          />
        ) : (
          <ObservabilityPanel
            executionTrace={executionTrace}
            observability={observability}
            vitals={vitals}
            keteranganLampu={keteranganLampu}
            stats={stats}
            lastCheckTime={lastCheckTime}
            serviceManager={kernel.serviceManager}
          />
        )}

        <div className="mt-auto pt-6 border-t border-white/5">
          <div className="text-[12px] text-slate-600 font-mono text-center tracking-widest uppercase">
            MAEF Observatory V4.0
          </div>
        </div>
      </div>

      {/* Atmospheric Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 blur-[150px] rounded-full pointer-events-none z-0"></div>
    </div>
  );
}
