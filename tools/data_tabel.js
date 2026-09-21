/**
 * Tool: data_tabel (Item 92 Tahap 3, 2026-09-21)
 *
 * Dipindai otomatis oleh ToolRegistryService.scanToolsFolder() → chip "Data Tabel" di panel Tools chat.
 * Chip ini hanya sakelar: bila menyala, AssistantService mengirim bendera `dataTabel: true` dan SERVER (agent-process
 * lib/data_tabel) menjawab "berapa / siapa" dari data rekonsiliasi ASN yang tersimpan (Research App → Excel → Simpan),
 * dihitung oleh kode, dengan tabel ber-NIP ditempel di bawah jawaban. Tidak ada kerja di perangkat — execute() hanya
 * menjelaskan dirinya bila dipanggil langsung.
 */
export default {
  name: 'data_tabel',
  description: 'Menjawab pertanyaan hitung/daftar (berapa, siapa saja yang belum …) dari data tabel rekonsiliasi ASN yang tersimpan — dihitung kode, bukan perkiraan AI.',
  category: 'data',
  async execute() {
    return { message: 'Data Tabel dijalankan di server saat chip menyala; tidak ada aksi di perangkat.' };
  }
};
