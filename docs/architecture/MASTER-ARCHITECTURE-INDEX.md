# Master Architecture Index

Version: 2.1
Status: Active
Authority: Dibawah `constitution/` v3.0, di atas implementasi.
Last Updated: 2026-09-09 (ADR-0018 — Constitution v3 supersedes MAEF v2 hierarchy)

---

## Konstitusi Tertinggi

> [!IMPORTANT]
> **`constitution/00_CONSTITUTION.md` v3.0 (dan seluruh folder `constitution/`, 27 dokumen) adalah Source of Truth tertinggi.**
> Ini menggantikan hierarki lama yang dipimpin MAEF v2/Vision Constitution v2 — lihat [ADR-0018](../adr/ADR-0018-constitution-v3-supreme-authority.md).
> Segala konflik antara dokumen ini dengan implementasi, kode, atau dokumen lain harus diselesaikan mengacu ke `constitution/`.

| Dokumen | Versi | Lokasi | Keterangan |
|---|---|---|---|
| Constitution | **v3.0** | `constitution/00_CONSTITUTION.md` | ✅ AKTIF — Source of Truth tertinggi |
| Vision | **v3.0** | `constitution/01_VISION.md` | ✅ AKTIF — Arah jangka panjang |
| Master Index navigasi tugas | — | `INIT.md` | ✅ AKTIF — index 28 dokumen constitution + peta navigasi tugas |
| MAMET AI ENGINEERING FRAMEWORK (MAEF) | v2.0 | ~~`docs/project-memory/MAEF V2.md`~~ (dihapus 2026-09-09) | ⛔ SUPERSEDED & DIHAPUS — konsep unik diserap ke `constitution/07_ENGINEERING_SYSTEM.md`, lihat ADR-0018 |
| MAMET AI VISION CONSTITUTION | v2.0 | ~~`docs/project-memory/MAMET AI VISION CONSTITUTION V2.md`~~ (dihapus 2026-09-09) | ⛔ SUPERSEDED & DIHAPUS — konsep unik diserap ke `constitution/16_ENGINEERING_METRICS_SYSTEM.md`, lihat ADR-0018 |
| MAMET ARCHITECTURE & ENGINEERING FRAMEWORK (MAEF) | v3.0 | ~~`docs/project-memory/MAEF V3.md`~~ (dihapus 2026-09-09) | ⛔ SUPERSEDED & DIHAPUS — tidak ada konsep unik, tumpang tindih penuh dengan Constitution v3, lihat ADR-0018 |
| MAEF v1.0 | 1.0 | `docs/governance/MAEF.md` | ⛔ DEPRECATED — Lihat MAEF v2 (juga superseded) |
| Vision v1.0 | 1.0 Draft | `docs/governance/VISION.md` | ⛔ DEPRECATED — Lihat Vision Constitution v2 (juga superseded) |

---

## Hirarki Otoritas Dokumen (per ADR-0018, menggantikan MAEF v2 §5)

| Urutan | Dokumen | Lokasi |
|---|---|---|
| 1 | Constitution | `constitution/00_CONSTITUTION.md` (+ seluruh folder `constitution/`) |
| 2 | Vision | `constitution/01_VISION.md` |
| 3 | Core Architecture & System Specification | `constitution/02-19` |
| 4 | Master Architecture Index (dokumen ini) | `docs/architecture/MASTER-ARCHITECTURE-INDEX.md` |
| 5 | Architecture Decision Records (ADR) | `docs/adr/` |
| 6 | Technical Specification / RFC / Blueprints | `docs/architecture/`, `docs/blueprints/` |
| 7 | Engineering Tasks | `docs/tasks/` |
| 8 | Repository (implementasi) | `supabase/`, `frontend/`, `mametlite/` |
| 9 | Runtime System | Supabase Edge Functions (deployed) |

---

## Purpose

This index connects Mamet AI's vision to the repository. It is the first place to check before changing architecture or implementation.

## System Identity

Mamet AI is a personal AI Operating System. LLM providers are replaceable reasoning engines, not the system identity.

## Capability Layers

| Capability | Role | Current Repository Area | Notes |
| --- | --- | --- | --- |
| Assistant | Daily assistant using memory and knowledge | `frontend/`, `supabase/functions/agent-process/` | Full product surface with dashboards and desktop mode |
| MametLite | Fast, read-oriented mode | `mametlite/`, `supabase/functions/rag-process/`, `supabase/functions/agent-process/` | Must remain lightweight and avoid unwanted memory writes |
| Engineer | Internal engineering mode | `docs/project-memory/`, `docs/tasks/`, `docs/adr/`, source repo | Runtime-capable via `appSource: "engineer"` policy in `agent-process` |

## Shared Services

| Service | Role | Current Repository Area |
| --- | --- | --- |
| User Memory | Personal preferences and habits | `user_memories`, memory plugins |
| Knowledge RAG | External documents and references | `documents`, `document_chunks`, `rag-process` |
| Project Memory | Engineering truth and lessons | `project_memory_entries` (DB) + `docs/project-memory/` (snapshot) |
| AI Orchestrator | Tool routing and provider calls | `supabase/functions/agent-process/` |
| Observability | Logs, billing, health | dashboard components, `agent_logs`, `api_usage`, health functions |

## Current Runtime Surfaces

- `frontend/`: full Mamet AI web and Electron shell.
- `mametlite/`: lightweight RAG/research client.
- `backend/`: legacy Express backend, retained for compatibility but not the modern primary runtime.
- `supabase/functions/agent-process/`: main AI orchestration backend.
- `supabase/functions/rag-process/`: document ingestion and embedding pipeline.

## Architecture Rule

Any implementation that conflicts with MAEF v2, Vision Constitution v2, or this index must be recorded in `docs/architecture/ARCHITECTURE-GAPS.md` before being changed.

## Active Architecture Gaps

See: `docs/architecture/ARCHITECTURE-GAPS.md`

## Constitution Review

See: `docs/architecture/CONSTITUTION-REVIEW-REPORT-2026-06-29.md`

