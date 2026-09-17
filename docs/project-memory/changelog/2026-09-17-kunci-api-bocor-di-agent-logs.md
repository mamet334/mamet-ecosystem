# Kunci API Tersimpan di `agent_logs.metadata` — Dihentikan & Dibersihkan (T7)

**Tanggal:** 17 September 2026
**Roadmap:** T7 di [`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md)
**Status:** ✅ kebocoran dihentikan (`agent-process` v458) & data lama dibersihkan (izin Owner). **Sisa di pihak Owner:**
ganti kunci OpenRouter & token Apify.

## Temuan

Ditemukan saat memeriksa T6 (kolom `metadata`): `agent_logs.metadata` memuat salinan konfigurasi runtime berisi
kunci API dalam teks biasa. Nilai kunci tidak disalin ke laporan, changelog, atau memori.

| | |
|---|---|
| Baris | **698**, 30 Juni 2026 → 17 September 2026 08:58 UTC (masih bertambah tiap chat) |
| Isi | kunci OpenRouter & token Apify di 698 baris; kunci Google (Gemini) & Groq di 614 baris lama |
| Event | `Capability.Executed` (payload `rctx`), `Tool.Requested` (payload `env` + `rctx`) |
| Pembaca | hanya pemilik baris (RLS `auth.uid() = user_id`; 1 akun) — bukan pengguna lain/anon |
| Terbawa ke | dasbor jejak eksekusi di browser (`ExecutionTraceService` memilih `metadata`); `backup-export` (tabel `agent_logs` ikut diekspor ke berkas unduhan) |
| Tabel lain | dipindai 155 kolom teks/JSON skema `public` → hanya `agent_logs.metadata` |

## Penyebab

`lib/event/subscribers/audit_subscriber.ts` dan `lifecycle_subscriber.ts` menulis
`metadata: { trace_id, source, ...event.payload }` lewat `persistTelemetryLog`. Payload event membawa objek
runtime (`rctx`, `env`) yang memuat kunci server dan kunci pengguna.

## Perbaikan kode

| Berkas | Isi |
|---|---|
| `agent-process/lib/saring_rahasia.ts` (baru, murni) | `saringMetadata`: buang `rctx`/`env`/`ctx`/`headers`/service key; properti bernama rahasia (`apiKey`, `token`, `authorization`, …) → `[disamarkan]`; teks berbentuk kunci (OpenRouter, Apify, Google, Groq, `sk-…`, JWT, Bearer) disamarkan; aman untuk referensi melingkar; objek asli tidak diubah. `samarkanTeks` untuk pesan. |
| `agent-process/lib/verification/verification_service.ts` | `persistTelemetryLog` selalu menyaring `metadata` & `message` — satu titik untuk semua penulisan `agent_logs` bermetadata |

Subscriber tidak diubah: penyaringan terpusat menutup semua pemanggil (`audit_subscriber`, `lifecycle_subscriber`,
`synthesis_handler`).

## Bukti

- **Uji Node (kunci palsu):** 9/9 — `rctx`/`env` terbuang, tak ada bentuk kunci tersisa, kunci di dalam teks &
  properti rahasia disamarkan, data biasa & objek asli utuh, referensi melingkar aman. Bundel `agent-process` lolos.
- **Live v458 (deploy Owner):** baris chat 12:41 UTC `Capability.Executed` → metadata `source, success`
  (sebelumnya `rctx, source, success`), tanpa pola kunci.
- **Pembersihan (izin Owner "ya bersihkan"):** satu `UPDATE` — `metadata - 'rctx' - 'env' - 'ctx'` lalu pola kunci
  → `[disamarkan]` → **698 baris**. Pindai ulang 155 kolom: **0** baris berkunci; sisa `rctx`/`env` 0; total
  `agent_logs` tetap 14.954; `trace_id`/`subagent` tetap di 13 baris yang memuatnya. Tidak ada teks yang perlu
  disamarkan (semua kunci berada di dalam `rctx`/`env`).

## Batas yang disadari

- Kunci yang sudah pernah tersimpan harus dianggap bocor: **Owner mengganti kunci OpenRouter & token Apify** (dan
  mencabut kunci Google/Groq lama bila masih aktif di tempat lain).
- Berkas backup yang pernah diunduh sebelum 17 September dapat memuat kunci (tidak ada di Downloads).
- `runtime_context.ts` `logAgentEvent` & `backup-restore` menulis `agent_logs` tanpa metadata payload — tidak
  melewati penyaring, tidak membawa objek runtime.
