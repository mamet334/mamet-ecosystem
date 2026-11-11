const rapikan = (s: unknown, maks: number) => String(s ?? '').replace(/[\r\n_`]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maks);

export function jumlahDilewatiAman(n: unknown): number {
  const x = Number(n);
  return Number.isInteger(x) && x > 0 ? Math.min(x, 100000) : 0;
}

export function catatanModelRagGagal(sebab: unknown, { alatRag = false }: { alatRag?: boolean } = {}): string {
  const s = rapikan(sebab, 200);
  if (!s) return '';
  const coba = alatRag
    ? ' Anda punya alat RAG: SEBELUM menjawab, coba SEKALI <alat_rag>{"alat":"rag_cari","kueri":"…kata kunci Anda sendiri…"}</alat_rag> — pencarian ulang sering berhasil. Bila tetap gagal, katakan apa adanya bahwa pencarian dokumen gagal dan pengguna bisa mengulang pertanyaannya.'
    : ' Katakan apa adanya bahwa pencarian dokumen gagal pada pesan ini dan pengguna bisa mengulang pertanyaannya.';
  return `\n[CATATAN SISTEM — PENCARIAN DOKUMEN GAGAL] Pencarian dokumen pengguna untuk pesan ini GAGAL (${s}). Dokumen yang relevan mungkin ADA. JANGAN menyatakan dokumen tidak ada atau RAG kosong.${coba}\n`;
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

export function catatanSubagenBerhenti(subagen: string, jenis: 'waktu' | 'waktu-total' | 'gagal', rinci: string): string {
  const nama = String(subagen || 'tak dikenal').replace(/[\r\n`]+/g, ' ').trim().slice(0, 200);
  const sebab = String(rinci || '').replace(/[\r\n`]+/g, ' ').trim().slice(0, 300);
  const apa = jenis === 'waktu'
    ? `dihentikan karena melewati batas waktu ${sebab}`
    : jenis === 'waktu-total'
      ? `tidak dijalankan karena batas waktu total sub-agent (${sebab}) sudah terlampaui`
      : `gagal (${sebab})`;
  return `[CATATAN SISTEM] Sub-agent "${nama}" ${apa}. Hasilnya TIDAK ADA — jangan mengarang isinya; sampaikan kepada pengguna bahwa bagian ini tidak selesai dan boleh dicoba lagi.`;
}

export function catatanTugasSubagenDilewati(jumlah: number, batas: number): string {
  return `[CATATAN SISTEM] ${jumlah} tugas sub-agent tidak dijalankan karena batas ${batas} tugas per pertanyaan. Hasil tugas itu TIDAK ADA — sebutkan kepada pengguna bila jawaban jadi kurang lengkap.\n\n`;
}
