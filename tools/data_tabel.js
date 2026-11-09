export default {
  name: 'data_tabel',
  description: 'Menjawab pertanyaan hitung/daftar (berapa, siapa saja yang belum …) dari data tabel rekonsiliasi ASN yang tersimpan — dihitung kode, bukan perkiraan AI.',
  category: 'data',
  async execute() {
    return { message: 'Data Tabel dijalankan di server saat chip menyala; tidak ada aksi di perangkat.' };
  }
};
