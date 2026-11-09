const rapikan = (s: unknown, maks: number) => String(s ?? '').replace(/[\r\n_`]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maks);

export function jumlahDilewatiAman(n: unknown): number {
  const x = Number(n);
  return Number.isInteger(x) && x > 0 ? Math.min(x, 100000) : 0;
}

export function catatanModelRagGagal(sebab: unknown): string {
  const s = rapikan(sebab, 200);
  if (!s) return '';
  return `\n[CATATAN SISTEM — PENCARIAN DOKUMEN GAGAL] Pencarian dokumen pengguna untuk pesan ini GAGAL (${s}). Dokumen yang relevan mungkin ADA. JANGAN menyatakan dokumen tidak ada atau RAG kosong; katakan apa adanya bahwa pencarian dokumen gagal pada pesan ini dan pengguna bisa mengulang pertanyaannya.\n`;
}

export function catatanModelRiwayatDilewati(n: unknown): string {
  const k = jumlahDilewatiAman(n);
  if (!k) return '';
  return `\n[CATATAN SISTEM — RIWAYAT] ${k} pesan lama dari percakapan ini tidak dikirim kepada Anda karena anggaran konteks yang diatur pengguna di Settings. Bila pengguna merujuk sesuatu yang tidak ada di riwayat yang Anda terima, katakan jujur bahwa bagian itu di luar konteks Anda — jangan menebak isinya.\n`;
}

export function catatanPenggunaRagGagal(sebab: unknown): string {
  const s = rapikan(sebab, 160);
  if (!s) return '';
  return `_Catatan sistem: pencarian dokumen Anda gagal pada pesan ini (${s}) — jawaban di atas disusun tanpa dokumen. Silakan ulangi pertanyaannya._`;
}
