/**
 * Isi panel Monitor (`MaefExecutionMonitorWidget`) = langkah proses GABUNGAN klien + server (29 Okt 2026, ADR-0021 §2.3).
 *
 * Dulu `ConversationEngine` mengirim `jsonMetadata` saja. Jalur hybrid/JSON → langkah server TANPA baris klien
 * ("🔍 Dicari (web): …" tak tampil di mana pun); jalur mengalir → `{ penyedia }` tanpa langkah sama sekali. `steps` dari
 * `onDone` sudah gabungan (AssistantService: `langkahAwal` klien lalu langkah server), jadi itu yang ditampilkan.
 *
 * @param {string[]} steps langkah gabungan dari onDone
 * @param {object|null} jsonMetadata metadata server (bisa null di jalur mengalir)
 * @returns {{ focusStep: string, logs: object } | null} null bila tak ada apa pun untuk ditampilkan
 */
export function jejakUntukMonitor(steps, jsonMetadata) {
  const langkah = Array.isArray(steps) && steps.length > 0 ? steps : (jsonMetadata?.processingSteps || []);
  if (!jsonMetadata && langkah.length === 0) return null;
  return { focusStep: 'execution', logs: { ...(jsonMetadata || {}), processingSteps: langkah } };
}
